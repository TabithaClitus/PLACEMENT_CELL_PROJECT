import os
import sys
import re
import glob
import logging
import ctypes
import msvcrt

# Ensure backend directory is in path and cwd is backend for .env settings
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.abspath(os.path.join(SCRIPT_DIR, ".."))
BACKEND_DIR = os.path.join(ROOT_DIR, "backend")

if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

os.chdir(BACKEND_DIR)

from sqlalchemy.orm import Session
from sqlalchemy import select, func
from app.database import SessionLocal
from app.models import Company, Student, PlacementDrive, Placement
from app.services.excel_parser.import_confirm_service import confirm_excel_import

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

SAMPLE_DATA_DIR = os.path.join(ROOT_DIR, "sample_data")

KNOWN_COMPANY_NAMES = {
    "2023 - 2027 Batch Caterpillar.xlsx": "Caterpillar",
    "2023-2027 Batch - ZohoCorp - Batch 1.xlsx": "ZohoCorp",
    "2023-2027 Batch Value Health.xlsx": "Value Health",
    "2023-2027 Batch __ Dhyan Networks.xlsx": "Dhyan Networks",
    "2023-2027 Batch __ Rajsriya.xlsx": "Rajsriya",
    "2023-2027 Batch __ RSJ Inspection.xlsx": "RSJ Inspection",
    "2023-2027__Ahill Apparels.xlsx": "Ahill Apparels",
    "2027 BATCH - CONVERSIGHT AI.xlsx": "Conversight AI",
    "2027 batch emerson.xlsx": "Emerson",
    "2027 Jayem Automotives.xlsx": "Jayem Automotives",
    "2027__Royal Automation.xlsx": "Royal Automation",
    "AFFORDMED.xlsx": "Affordmed",
    "Aerele Technologies Roundwise.xlsx": "Aerele Technologies",
    "Alter Office.xlsx": "Alter Office",
    "Bi3 Technologies.xlsx": "Bi3 Technologies",
    "Cadence Roundwise.xlsx": "Cadence",
    "Cloudvice.xlsx": "Cloudvice",
    "Datapattern.xlsx": "Data Patterns",
    "Econ systems.xlsx": "Econ Systems",
    "EnSmart Controls.xlsx": "EnSmart Controls",
    "EQREV.xlsx": "EQREV",
    "Excelacom technologies.xlsx": "Excelacom Technologies",
    "EXL Roundwise.xlsx": "EXL",
    "Harita Techserv.xlsx": "Harita Techserv",
    "IDP Education Roundwise Details.xlsx": "IDP Education",
    "Juspay August.xlsx": "Juspay",
    "Killis Bird.xlsx": "Killis Bird",
    "LMW Roundwise.xlsx": "LMW",
    "Lucid Imaging.xlsx": "Lucid Imaging",
    "Mayflower Enterprises.xlsx": "Mayflower Enterprises",
    "MGM.xlsx": "MGM",
    "Mistral solution.xlsx": "Mistral Solutions",
    "MulticoreWare Roundwise.xlsx": "MulticoreWare",
    "Netgear - Roundwise.xlsx": "Netgear",
    "PRESIDIO.xlsx": "Presidio",
    "R K Ecran Roundwise.xlsx": "R K Ecran",
    "Rapid data Round wise details.xlsx": "Rapid Data",
    "Rocket India Round wise Details.xlsx": "Rocket India",
    "Schaeffler India.xlsx": "Schaeffler India",
    "SCHNELL ENERGY - 2027.xlsx": "Schnell Energy",
    "Shanthi Gears Round wise Details.xlsx": "Shanthi Gears",
    "Slicktronix.xlsx": "Slicktronix",
    "Soliton Roundwise Details.xlsx": "Soliton",
    "SurveySparrow Technical List.xlsx": "SurveySparrow",
    "TCS ROUND 2 Roundwise Details.xlsx": "TCS",
    "Tridots Tech.xlsx": "Tridots Tech",
    "Ultra Engineering Works_Roundwise Details.xlsx": "Ultra Engineering Works",
    "Unilogic- Roundwise Data.xlsx": "Unilogic",
    "Yuvilabs.xlsx": "Yuvilabs",
    "ZeAI Soft.xlsx": "ZeAI Soft",
}


def read_file_bytes_windows(path: str) -> bytes:
    """Reads file bytes reliably even if another process (like Excel) has it open."""
    GENERIC_READ = 0x80000000
    FILE_SHARE_READ = 0x00000001
    FILE_SHARE_WRITE = 0x00000002
    FILE_SHARE_DELETE = 0x00000004
    OPEN_EXISTING = 3
    FILE_ATTRIBUTE_NORMAL = 0x80

    handle = ctypes.windll.kernel32.CreateFileW(
        path,
        GENERIC_READ,
        FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
        None,
        OPEN_EXISTING,
        FILE_ATTRIBUTE_NORMAL,
        None
    )
    if handle != -1 and handle is not None:
        try:
            fd = msvcrt.open_osfhandle(handle, 0)
            with open(fd, "rb") as f:
                return f.read()
        except Exception:
            pass

    with open(path, "rb") as f:
        return f.read()


def clean_company_name(filename: str) -> str:
    if filename in KNOWN_COMPANY_NAMES:
        return KNOWN_COMPANY_NAMES[filename]

    name = os.path.splitext(filename)[0]
    name = re.sub(r'20\d{2}\s*[-_–]?\s*20\d{2}', '', name, flags=re.IGNORECASE)
    name = re.sub(r'20\d{2}\s*batch', '', name, flags=re.IGNORECASE)
    name = re.sub(r'20\d{2}', '', name, flags=re.IGNORECASE)
    name = re.sub(r'batch\s*\d*', '', name, flags=re.IGNORECASE)
    name = re.sub(r'\bRound\s*wise\b', '', name, flags=re.IGNORECASE)
    name = re.sub(r'\bDetails\b', '', name, flags=re.IGNORECASE)
    name = re.sub(r'\bList\b', '', name, flags=re.IGNORECASE)
    name = re.sub(r'\bTechnical\b', '', name, flags=re.IGNORECASE)
    name = name.replace('__', ' ').replace('_', ' ').replace('-', ' ').strip()
    name = re.sub(r'\s+', ' ', name)
    return name or os.path.splitext(filename)[0]


def is_non_company_file(filename: str) -> bool:
    lower = filename.lower()
    return "ai fluency" in lower or "declaration form" in lower or lower.endswith(".md") or lower.endswith(".json")


def batch_import():
    db: Session = SessionLocal()
    try:
        all_files = glob.glob(os.path.join(SAMPLE_DATA_DIR, "*.xlsx")) + glob.glob(os.path.join(SAMPLE_DATA_DIR, "*.xls"))
        excel_files = [f for f in all_files if not is_non_company_file(os.path.basename(f))]
        excel_files.sort()

        logger.info("Found %d company Excel files to import from %s", len(excel_files), SAMPLE_DATA_DIR)

        success_count = 0
        failed_count = 0

        for idx, file_path in enumerate(excel_files, 1):
            filename = os.path.basename(file_path)
            company_name = clean_company_name(filename)

            academic_year = "2026-2027"
            if "2024" in filename:
                academic_year = "2024-2025"
            elif "2025" in filename and "2026" not in filename and "2027" not in filename:
                academic_year = "2025-2026"

            logger.info("[%d/%d] Importing '%s' -> Company: '%s', Year: '%s'", idx, len(excel_files), filename, company_name, academic_year)
            try:
                file_bytes = read_file_bytes_windows(file_path)
                res = confirm_excel_import(
                    file_input=file_bytes,
                    file_name=filename,
                    company_name=company_name,
                    academic_year=academic_year,
                    db=db
                )
                logger.info("  -> SUCCESS: %s (Processed: %d, Imported: %d)", company_name, res.total_records_processed, res.imported_records_count)
                success_count += 1
            except Exception as e:
                logger.error("  -> FAILED to import '%s': %s", filename, e, exc_info=True)
                failed_count += 1
                db.rollback()

        total_companies = db.query(func.count(Company.id)).scalar()
        total_students = db.query(func.count(Student.id)).scalar()
        total_drives = db.query(func.count(PlacementDrive.id)).scalar()
        total_placements = db.query(func.count(Placement.id)).scalar()

        logger.info("\n" + "="*50)
        logger.info("BATCH IMPORT COMPLETED")
        logger.info("Files processed successfully: %d / %d (Failed: %d)", success_count, len(excel_files), failed_count)
        logger.info("Total Companies in DB: %d", total_companies)
        logger.info("Total Drives in DB: %d", total_drives)
        logger.info("Total Students in DB: %d", total_students)
        logger.info("Total Placements in DB: %d", total_placements)
        logger.info("="*50)

    finally:
        db.close()


if __name__ == "__main__":
    batch_import()
