import logging
import tempfile
import os
from typing import Any
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.models import (
    Student, Company, PlacementDrive, PlacementStage,
    StudentRegistration, StudentStageResult, Placement, ImportLog
)
from app.services.excel_parser.parser_engine import parse_excel_workbook
from app.services.excel_parser.parser_models import ParsedWorkbook, SheetCategory
from app.services.excel_parser.import_validation_service import validate_excel_import
from app.services.excel_parser.confirm_models import ImportConfirmResponse

logger = logging.getLogger(__name__)


def confirm_excel_import(
    file_input: str | bytes,
    file_name: str,
    company_name: str,
    academic_year: str,
    db: Session
) -> ImportConfirmResponse:
    """
    Confirms and executes database ingestion for a validated Excel workbook within an atomic database transaction.
    Requirements:
      1. Normalizes OFFER/OFFERED/ACCEPTED into PLACED.
      2. Never creates ACCEPTED as a separate status string.
      3. Uses a database transaction and rolls back everything on error.
      4. Idempotent on repeated uploads.
      5. Records detailed import_logs and statistics.
    """
    temp_path = None
    if isinstance(file_input, bytes):
        with tempfile.NamedTemporaryFile(delete=False, suffix=".xlsx") as tmp:
            tmp.write(file_input)
            temp_path = tmp.name
        file_to_parse = temp_path
    else:
        file_to_parse = file_input

    try:
        # Step 1: Pre-validation check
        validation_res = validate_excel_import(
            file_input=file_to_parse,
            file_name=file_name,
            company_name=company_name,
            academic_year=academic_year,
            db=db
        )

        if not validation_res.is_valid_for_import:
            logger.warning(
                "Workbook contains %d malformed register numbers – they will be skipped during import.",
                len(validation_res.invalid_register_numbers),
            )

        parsed_wb: ParsedWorkbook = parse_excel_workbook(file_to_parse)

        # Step 2: Atomic Transaction Ingestion
        try:
            # Get or Create Company
            company = db.scalar(select(Company).where(Company.name.ilike(company_name)))
            if not company:
                company = Company(name=company_name, industry="Technology")
                db.add(company)
                db.flush()

            # Get or Create Placement Drive
            drive_name = f"{company.name} Drive {academic_year}"
            drive = db.scalar(
                select(PlacementDrive).where(
                    PlacementDrive.company_id == company.id,
                    PlacementDrive.drive_name == drive_name,
                    PlacementDrive.academic_year == academic_year
                )
            )
            if not drive:
                drive = PlacementDrive(
                    company_id=company.id,
                    drive_name=drive_name,
                    academic_year=academic_year,
                    status="ACTIVE"
                )
                db.add(drive)
                db.flush()

            success_records = 0
            error_records = 0
            sheet_stats: list[dict[str, Any]] = []

            stage_order = 1
            # In-memory tracking to ensure idempotency and prevent duplicate inserts within session
            seen_stage_students: set[tuple[int, int]] = set()
            seen_placements: set[tuple[int, int]] = set()
            seen_registrations: dict[tuple[int, int], StudentRegistration] = {}

            # Pre-compute sheet records and candidate progression sets
            valid_sheets = [
                s for s in parsed_wb.parsed_sheets
                if not s.is_empty and s.category != SheetCategory.IGNORE
            ]

            sheet_valid_regs: dict[str, set[str]] = {}
            for s in valid_sheets:
                sheet_valid_regs[s.sheet_name] = {
                    rec.register_number for rec in s.records
                    if rec.register_number and rec.is_register_valid
                }

            progression_sheets = [s for s in valid_sheets if s.category == SheetCategory.PROGRESSION]
            placed_sheets = [s for s in valid_sheets if s.category == SheetCategory.PLACED]

            all_placed_regs: set[str] = set()
            for ps in placed_sheets:
                all_placed_regs.update(sheet_valid_regs.get(ps.sheet_name, set()))
            for s in valid_sheets:
                for rec in s.records:
                    if (rec.status or "").upper() in ("OFFER", "OFFERED", "ACCEPTED", "PLACED"):
                        if rec.register_number and rec.is_register_valid:
                            all_placed_regs.add(rec.register_number)

            for sheet in valid_sheets:
                sheet_success = 0
                sheet_errors = 0

                if sheet.category == SheetCategory.REGISTERED:
                    for rec in sheet.records:
                        if not rec.register_number or not rec.is_register_valid:
                            sheet_errors += 1
                            continue

                        # Fetch or Create Student
                        student = db.scalar(select(Student).where(Student.register_number == rec.register_number))
                        if not student:
                            student = Student(
                                register_number=rec.register_number,
                                full_name=rec.student_name or "Unknown Candidate",
                                department=rec.department or "General",
                                academic_year=academic_year
                            )
                            db.add(student)
                            db.flush()
                        else:
                            if rec.student_name and student.full_name == "Unknown Candidate":
                                student.full_name = rec.student_name
                            if rec.department and student.department == "General":
                                student.department = rec.department

                        # Fetch or Create Registration
                        reg_key = (drive.id, student.id)
                        if reg_key in seen_registrations:
                            reg = seen_registrations[reg_key]
                        else:
                            reg = db.scalar(
                                select(StudentRegistration).where(
                                    StudentRegistration.student_id == student.id,
                                    StudentRegistration.drive_id == drive.id
                                )
                            )
                            if not reg:
                                reg = StudentRegistration(
                                    student_id=student.id,
                                    drive_id=drive.id,
                                    is_eligible=True
                                )
                                db.add(reg)
                                db.flush()
                            seen_registrations[reg_key] = reg

                        sheet_success += 1

                elif sheet.category in (SheetCategory.PROGRESSION, SheetCategory.PLACED, SheetCategory.UNKNOWN):
                    stage = db.scalar(
                        select(PlacementStage).where(
                            PlacementStage.drive_id == drive.id,
                            PlacementStage.stage_name == sheet.sheet_name
                        )
                    )
                    if not stage:
                        stage = PlacementStage(
                            drive_id=drive.id,
                            stage_name=sheet.sheet_name,
                            stage_order=stage_order,
                            normalized_category=sheet.category.value
                        )
                        db.add(stage)
                        db.flush()
                        stage_order += 1

                    # Determine advancement logic for this progression stage
                    is_progression = (sheet.category == SheetCategory.PROGRESSION)
                    subsequent_regs: set[str] = set()
                    is_last_prog_without_placed = False

                    if is_progression and sheet in progression_sheets:
                        prog_idx = progression_sheets.index(sheet)
                        for next_s in progression_sheets[prog_idx + 1:]:
                            subsequent_regs.update(sheet_valid_regs.get(next_s.sheet_name, set()))
                        subsequent_regs.update(all_placed_regs)
                        is_last_prog_without_placed = (prog_idx == len(progression_sheets) - 1 and len(placed_sheets) == 0)

                    has_status_col = (sheet.column_mapping.get("status") is not None)

                    for rec in sheet.records:
                        if not rec.register_number or not rec.is_register_valid:
                            sheet_errors += 1
                            continue

                        student = db.scalar(select(Student).where(Student.register_number == rec.register_number))
                        if not student:
                            student = Student(
                                register_number=rec.register_number,
                                full_name=rec.student_name or "Unknown Candidate",
                                department=rec.department or "General",
                                academic_year=academic_year
                            )
                            db.add(student)
                            db.flush()

                        reg_key = (drive.id, student.id)
                        if reg_key in seen_registrations:
                            reg = seen_registrations[reg_key]
                        else:
                            reg = db.scalar(
                                select(StudentRegistration).where(
                                    StudentRegistration.student_id == student.id,
                                    StudentRegistration.drive_id == drive.id
                                )
                            )
                            if not reg:
                                reg = StudentRegistration(
                                    student_id=student.id,
                                    drive_id=drive.id,
                                    is_eligible=True
                                )
                                db.add(reg)
                                db.flush()
                            seen_registrations[reg_key] = reg

                        # Determine if candidate CLEARED this stage:
                        # 1. In PLACED sheets: all candidates qualified/placed.
                        # 2. In PROGRESSION sheets:
                        #    - If candidate appears in subsequent stages or offer: CLEARED (QUALIFIED).
                        #    - If last stage without separate placed sheet and not rejected: CLEARED (QUALIFIED).
                        #    - If sheet has explicit status column showing qualification: CLEARED (QUALIFIED).
                        #    - Otherwise: candidate only participated / registered for this stage without clearing it (NOT_CLEARED).
                        raw_status = (rec.status or "").upper()
                        if sheet.category == SheetCategory.PLACED or raw_status in ("OFFER", "OFFERED", "ACCEPTED", "PLACED"):
                            normalized_status = "QUALIFIED"
                        elif is_progression:
                            advances = rec.register_number in subsequent_regs
                            explicit_failed = raw_status in ("DISQUALIFIED", "ABSENT", "REJECTED", "FAIL", "FAILED", "NOT_CLEARED")
                            if explicit_failed:
                                normalized_status = "NOT_CLEARED"
                            elif advances:
                                normalized_status = "QUALIFIED"
                            elif is_last_prog_without_placed:
                                normalized_status = "QUALIFIED"
                            elif has_status_col and raw_status in ("QUALIFIED", "SELECTED", "SHORTLISTED", "PASS", "PRESENT"):
                                normalized_status = "QUALIFIED"
                            else:
                                normalized_status = "NOT_CLEARED"
                        else:
                            normalized_status = "QUALIFIED"

                        stage_student_key = (stage.id, student.id)
                        if stage_student_key not in seen_stage_students:
                            stage_res = db.scalar(
                                select(StudentStageResult).where(
                                    StudentStageResult.stage_id == stage.id,
                                    StudentStageResult.student_id == student.id
                                )
                            )
                            if not stage_res:
                                stage_res = StudentStageResult(
                                    stage_id=stage.id,
                                    student_id=student.id,
                                    registration_id=reg.id,
                                    status=normalized_status
                                )
                                db.add(stage_res)
                                db.flush()
                            else:
                                stage_res.status = normalized_status
                            seen_stage_students.add(stage_student_key)

                        # Rule 7 & 8: Normalize OFFER / OFFERED / ACCEPTED -> PLACED
                        if sheet.category == SheetCategory.PLACED or raw_status in ("OFFER", "OFFERED", "ACCEPTED", "PLACED"):
                            placement_key = (drive.id, student.id)
                            if placement_key not in seen_placements:
                                placement = db.scalar(
                                    select(Placement).where(
                                        Placement.student_id == student.id,
                                        Placement.drive_id == drive.id
                                    )
                                )
                                if not placement:
                                    placement = Placement(
                                        student_id=student.id,
                                        drive_id=drive.id,
                                        registration_id=reg.id,
                                        stage_id=stage.id,
                                        status="PLACED",  # Always normalize OFFER/OFFERED/ACCEPTED to PLACED
                                        package_ctc=6.5
                                    )
                                    db.add(placement)
                                    db.flush()
                                else:
                                    placement.status = "PLACED"
                                seen_placements.add(placement_key)

                        sheet_success += 1

                success_records += sheet_success
                error_records += sheet_errors
                sheet_stats.append({
                    "sheet_name": sheet.sheet_name,
                    "category": sheet.category.value,
                    "success": sheet_success,
                    "errors": sheet_errors
                })

            # Save Import Log
            log = ImportLog(
                filename=file_name,
                file_type="EXCEL",
                company_id=company.id,
                drive_id=drive.id,
                total_rows=success_records + error_records,
                imported_rows=success_records,
                failed_rows=error_records,
                status="SUCCESS" if error_records == 0 else "PARTIAL_SUCCESS",
                error_details={
                    "sheet_statistics": sheet_stats,
                    "registered_count": validation_res.registered_count,
                    "progression_count": validation_res.progression_count,
                    "placed_count": validation_res.placed_count,
                    "global_duplicates": parsed_wb.global_duplicates
                }
            )
            db.add(log)
            db.commit()

            return ImportConfirmResponse(
                status="SUCCESS",
                message=f"Workbook '{file_name}' imported into PostgreSQL successfully.",
                import_log_id=log.id,
                company_id=company.id,
                drive_id=drive.id,
                company_name=company.name,
                drive_name=drive.drive_name,
                academic_year=academic_year,
                total_records_processed=success_records + error_records,
                imported_records_count=success_records,
                failed_records_count=error_records,
                statistics={
                    "registered_count": validation_res.registered_count,
                    "progression_count": validation_res.progression_count,
                    "placed_count": validation_res.placed_count,
                    "sheets_processed": len(sheet_stats)
                }
            )

        except Exception as e:
            db.rollback()
            logger.error(f"Transaction failed during import confirm: {e}")
            raise e

    finally:
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)
