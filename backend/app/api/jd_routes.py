import json
import logging
from typing import Any, Optional
from fastapi import APIRouter, File, UploadFile, Form, Depends, HTTPException, status, Response
from fastapi.responses import StreamingResponse
import io

from app.services.jd_service import (
    extract_text_from_file,
    parse_jd_criteria,
    parse_student_master_excel,
    parse_placed_students_excel,
    parse_ssg_excel,
    evaluate_students_eligibility,
    generate_eligible_excel,
    create_sample_datasets,
)

logger = logging.getLogger("placement_cell.jd_routes")

router = APIRouter(prefix="/api/jd", tags=["JD Eligibility Matching"])


@router.post("/parse-jd")
async def parse_jd_endpoint(
    file: Optional[UploadFile] = File(None),
    text: Optional[str] = Form(None),
) -> dict[str, Any]:
    """Parses a Job Description file (.pdf, .docx, .txt) or pasted text and extracts eligibility criteria."""
    extracted_text = ""
    filename = "pasted_text.txt"

    if file and file.filename:
        filename = file.filename
        contents = await file.read()
        if contents:
            extracted_text = extract_text_from_file(contents, filename)

    if not extracted_text and text:
        extracted_text = text.strip()

    if not extracted_text:
        # Rather than crashing with 400 if user uploaded a scanned/empty PDF, provide helpful feedback
        default_empty_criteria = parse_jd_criteria("")
        return {
            "filename": filename,
            "extracted_text": "",
            "criteria": default_empty_criteria,
            "is_empty": True,
            "message": "Notice: No selectable text found in the uploaded file (it may be a scanned image or protected document). You can paste the text directly or type the criteria into the fields below."
        }

    criteria = parse_jd_criteria(extracted_text)
    return {
        "filename": filename,
        "extracted_text": extracted_text,
        "criteria": criteria,
        "is_empty": False,
        "message": f"Successfully extracted criteria from '{filename}'."
    }


@router.post("/evaluate")
async def evaluate_eligibility_endpoint(
    students_file: Optional[UploadFile] = File(None),
    placed_file: Optional[UploadFile] = File(None),
    jd_file: Optional[UploadFile] = File(None),
    ssg_file: Optional[UploadFile] = File(None),
    criteria_json: str = Form("{}"),
) -> dict[str, Any]:
    """Evaluates student master records against JD criteria and matches allowing status from the placed records."""
    try:
        criteria = json.loads(criteria_json)
    except Exception as e:
        logger.warning(f"Failed to parse criteria_json: {e}")
        criteria = {}

    # If jd_file is supplied and criteria is empty, extract on the fly
    if jd_file and jd_file.filename and (not criteria or not criteria.get("company_name")):
        jd_bytes = await jd_file.read()
        if jd_bytes:
            extracted = extract_text_from_file(jd_bytes, jd_file.filename)
            if extracted:
                parsed = parse_jd_criteria(extracted)
                # Merge parsed criteria
                for k, v in parsed.items():
                    if k not in criteria or not criteria[k]:
                        criteria[k] = v

    # Require student master file — no silent fallback to demo data
    if not students_file:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please upload your Student Master Excel sheet (.xlsx) to run the evaluation."
        )

    students_bytes = await students_file.read()
    if not students_bytes:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Student Master file is empty.")
    students = parse_student_master_excel(students_bytes)

    placed_map = {}
    if placed_file:
        placed_bytes = await placed_file.read()
        if placed_bytes:
            placed_map = parse_placed_students_excel(placed_bytes)

    # Parse SSG list (optional)
    ssg_reg_nos: Optional[set] = None
    if ssg_file and ssg_file.filename:
        ssg_bytes = await ssg_file.read()
        if ssg_bytes:
            ssg_reg_nos = parse_ssg_excel(ssg_bytes)
            logger.info(f"SSG list loaded: {len(ssg_reg_nos)} students")

    if not students:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No valid student records found in the uploaded Student Master sheet."
        )

    results = evaluate_students_eligibility(students, placed_map, criteria, ssg_reg_nos)
    return results


@router.post("/export-excel")
async def export_eligible_excel_endpoint(
    data: dict[str, Any]
):
    """Exports evaluated student list to a styled Excel (.xlsx) file."""
    excel_bytes = generate_eligible_excel(data)
    company = data.get("summary", {}).get("company_name", "Placement")
    safe_company = "".join([c for c in company if c.isalnum() or c in (" ", "_", "-")]).strip() or "Eligible_Students"
    filename = f"{safe_company}_Eligible_Candidates.xlsx"

    return StreamingResponse(
        io.BytesIO(excel_bytes),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@router.get("/sample-data")
async def get_sample_data_endpoint() -> dict[str, Any]:
    """Returns pre-loaded sample datasets and evaluation for testing the workflow."""
    sample_master, sample_placed, sample_jd = create_sample_datasets()
    students = parse_student_master_excel(sample_master)
    placed_map = parse_placed_students_excel(sample_placed)
    criteria = parse_jd_criteria(sample_jd)

    evaluation = evaluate_students_eligibility(students, placed_map, criteria)
    return {
        "sample_jd_text": sample_jd,
        "criteria": criteria,
        "students_count": len(students),
        "placed_count": len(placed_map),
        "evaluation": evaluation,
    }


@router.get("/download-template/{template_type}")
async def download_template_endpoint(template_type: str):
    """Downloads sample template Excel for Student Master or Placed Students."""
    sample_master, sample_placed, _ = create_sample_datasets()

    if template_type == "student_master":
        return StreamingResponse(
            io.BytesIO(sample_master),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": 'attachment; filename="Student_Master_Template.xlsx"'}
        )
    elif template_type == "placed_students":
        return StreamingResponse(
            io.BytesIO(sample_placed),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": 'attachment; filename="Placed_Students_Template.xlsx"'}
        )
    else:
        raise HTTPException(status_code=404, detail="Unknown template type")
