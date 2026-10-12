import re
import io
import logging
from typing import Dict, List, Any, Optional, Tuple
import pandas as pd
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

logger = logging.getLogger("placement_cell.jd")

# Master list of all departments
ALL_COLLEGE_DEPARTMENTS: List[str] = [
    "AGRI",
    "AIDS",
    "AIML",
    "BIOMEDICAL",
    "BIOTECHNOLOGY",
    "CIVIL",
    "CSBS",
    "CSE",
    "CSD",
    "CT",
    "ECE",
    "EEE",
    "EIE",
    "FASHION TECH",
    "FOOD TECH",
    "ISE",
    "IT",
    "MECHANICAL",
    "M.E - COMPUTER SCIENCE AND ENGINEERING",
    "M.E - INDUSTRIAL SAFETY ENGINEERING",
    "MBA - SCHOOL OF MANAGEMENT STUDIES",
]

# Department aliases for smart normalization
DEPARTMENT_ALIASES: Dict[str, List[str]] = {
    "AGRI": ["agri", "agriculture", "agricultural engineering", "agricultural"],
    "AIDS": ["aids", "ai&ds", "ai & ds", "artificial intelligence and data science", "artificial intelligence & data science", "ai and ds"],
    "AIML": ["aiml", "ai&ml", "ai & ml", "artificial intelligence and machine learning"],
    "BIOMEDICAL": ["biomedical", "biomedical engineering", "bme", "bm"],
    "BIOTECHNOLOGY": ["biotechnology", "biotech", "bt"],
    "CIVIL": ["civil", "civil engineering"],
    "CSBS": ["csbs", "computer science and business systems"],
    "CSE": ["cse", "computer science", "computer science and engineering", "cs"],
    "CSD": ["csd", "computer science and design", "cs & design"],
    "CT": ["ct", "computer technology"],
    "ECE": ["ece", "electronics and communication", "electronics and communication engineering", "electronics"],
    "EEE": ["eee", "electrical and electronics", "electrical and electronics engineering", "electrical"],
    "EIE": ["eie", "electronics and instrumentation", "electronics and instrumentation engineering"],
    "FASHION TECH": ["fashion tech", "fashion technology", "ft"],
    "FOOD TECH": ["food tech", "food technology"],
    "ISE": ["ise", "information science and engineering", "information science"],
    "IT": ["it", "information technology"],
    "MECHANICAL": ["mechanical", "mech", "mechanical engineering"],
    "M.E - COMPUTER SCIENCE AND ENGINEERING": ["m.e - computer science and engineering", "me cse", "m.e cse", "m.e. cse", "m.e - cse", "me-cse"],
    "M.E - INDUSTRIAL SAFETY ENGINEERING": ["m.e - industrial safety engineering", "me ise", "m.e ise", "m.e. ise", "industrial safety engineering", "industrial safety"],
    "MBA - SCHOOL OF MANAGEMENT STUDIES": ["mba - school of management studies", "mba", "school of management studies", "management studies"],
}


def normalize_text(text: Optional[str]) -> str:
    if not text:
        return ""
    return str(text).strip()


DEPARTMENT_RULES: List[Tuple[str, List[str]]] = [
    # Multi-word specific disciplines must be checked first before general parents
    ("M.E - COMPUTER SCIENCE AND ENGINEERING", [r"m\.e\s*[-–/]?\s*cse\b", r"m\.e\s*[-–/]?\s*computer\s*science"]),
    ("M.E - INDUSTRIAL SAFETY ENGINEERING", [r"m\.e\s*[-–/]?\s*industrial\s*safety", r"industrial\s*safety"]),
    ("MBA - SCHOOL OF MANAGEMENT STUDIES", [r"\bmba\b", r"management\s*studies"]),
    ("CSBS", [r"\bcsbs\b", r"computer\s*science\s*(&|and)\s*business\s*systems", r"\bcs\s*(&|and|\/)\s*bs\b"]),
    ("CSD", [r"\bcsd\b", r"computer\s*science\s*(&|and)\s*design", r"\bcs\s*(&|and|\/)\s*d\b"]),
    ("CT", [r"\bct\b", r"computer\s*technology"]),
    ("AIDS", [r"\baids\b", r"ai\s*(&|and|\/)\s*ds\b", r"artificial\s*intelligence\s*(&|and)\s*data\s*science", r"data\s*science"]),
    ("AIML", [r"\baiml\b", r"ai\s*(&|and|\/)\s*ml\b", r"artificial\s*intelligence\s*(&|and)\s*machine\s*learning"]),
    ("BIOMEDICAL", [r"\bbiomedical\b", r"\bbme\b"]),
    ("BIOTECHNOLOGY", [r"\bbiotechnology\b", r"\bbiotech\b", r"\bbt\b"]),
    ("FASHION TECH", [r"fashion\s*tech", r"fashion\s*technology", r"\bft\b"]),
    ("FOOD TECH", [r"food\s*tech", r"food\s*technology"]),
    ("ISE", [r"\bise\b", r"information\s*science\s*(&|and)\s*engineering", r"information\s*science"]),
    ("EIE", [r"\beie\b", r"electronics\s*(&|and)\s*instrumentation"]),
    ("ECE", [r"\bece\b", r"electronics\s*(&|and)\s*communication"]),
    ("EEE", [r"\beee\b", r"electrical\s*(&|and)\s*electronics"]),
    ("CSE", [r"\bcse\b", r"computer\s*science\s*(&|and)\s*engineering", r"\bcomputer\s*science\b", r"computer\s*engineering"]),
    ("IT", [r"\bit\b", r"information\s*technology"]),
    ("MECHANICAL", [r"\bmech\b", r"mechanical\s*engineering", r"\bmechanical\b"]),
    ("CIVIL", [r"\bcivil\b", r"civil\s*engineering"]),
    ("AGRI", [r"\bagri\b", r"agricultural\s*engineering", r"agriculture", r"agricultural"]),
]


def normalize_dept(dept: Optional[str]) -> str:
    if not dept:
        return ""
    clean = str(dept).strip().lower()
    for standard_name, patterns in DEPARTMENT_RULES:
        for pat in patterns:
            if re.search(pat, clean, re.IGNORECASE):
                return standard_name
    return str(dept).strip().upper()


def extract_text_from_file(file_bytes: bytes, filename: str) -> str:
    """Extracts raw text from PDF, DOCX, or TXT file using high-fidelity multi-engine extraction."""
    ext = filename.lower().split(".")[-1]
    text = ""

    if ext == "pdf":
        text_candidates: List[Tuple[str, str]] = []

        # 1. pypdfium2 (Chromium engine - highest text fidelity and proper word boundaries)
        try:
            import pypdfium2 as pdfium
            doc = pdfium.PdfDocument(io.BytesIO(file_bytes))
            p_texts = []
            for page in doc:
                textpage = page.get_textpage()
                t = textpage.get_text_range()
                if t and t.strip():
                    p_texts.append(t.strip())
            full_pypdfium = "\n".join(p_texts).strip()
            if full_pypdfium:
                text_candidates.append(("pypdfium2", full_pypdfium))
        except Exception as e:
            logger.warning(f"pypdfium2 extraction failed: {e}")

        # 2. pdfplumber (Extract layout text + structured criteria tables)
        table_lines: List[str] = []
        try:
            import pdfplumber
            with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
                plumber_chunks = []
                for page in pdf.pages:
                    pt = page.extract_text(layout=True) or page.extract_text()
                    if pt:
                        plumber_chunks.append(pt)
                    # Extract tables which frequently contain eligibility criteria
                    try:
                        tables = page.extract_tables()
                        for tbl in (tables or []):
                            for row in tbl:
                                clean_cells = [str(c).strip().replace("\n", " ") for c in row if c is not None and str(c).strip()]
                                if len(clean_cells) >= 2:
                                    table_lines.append(f"{clean_cells[0]}: {' | '.join(clean_cells[1:])}")
                                elif len(clean_cells) == 1:
                                    table_lines.append(clean_cells[0])
                    except Exception:
                        pass
                plumber_text = "\n".join(plumber_chunks).strip()
                if plumber_text:
                    text_candidates.append(("pdfplumber", plumber_text))
        except Exception as e:
            logger.warning(f"pdfplumber extraction failed: {e}")

        # 3. pypdf (Fallback)
        try:
            import pypdf
            reader = pypdf.PdfReader(io.BytesIO(file_bytes))
            pypdf_chunks = []
            for page in reader.pages:
                pt = page.extract_text()
                if pt and pt.strip():
                    pypdf_chunks.append(pt.strip())
            pypdf_text = "\n".join(pypdf_chunks).strip()
            if pypdf_text:
                text_candidates.append(("pypdf", pypdf_text))
        except Exception as e2:
            logger.warning(f"pypdf fallback extraction failed: {e2}")

        # Pick the most complete text candidate (by word count)
        if text_candidates:
            text_candidates.sort(key=lambda item: len(item[1].split()), reverse=True)
            text = text_candidates[0][1]
        else:
            text = ""

        # If table lines were extracted by pdfplumber, append them as explicit criteria sections
        if table_lines:
            joined_tables = "\n".join(table_lines)
            text = f"{text}\n\n--- EXTRACTED CRITERIA TABLES ---\n{joined_tables}"

    elif ext in ["docx", "doc"]:
        try:
            import docx
            doc = docx.Document(io.BytesIO(file_bytes))
            paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
            for table in doc.tables:
                for row in table.rows:
                    row_cells = [c.text.strip().replace("\n", " ") for c in row.cells if c.text.strip()]
                    if len(row_cells) >= 2:
                        paragraphs.append(f"{row_cells[0]}: {' | '.join(row_cells[1:])}")
                    elif len(row_cells) == 1:
                        paragraphs.append(row_cells[0])
            text = "\n".join(paragraphs)
        except Exception as e:
            logger.error(f"DOCX extraction failed: {e}")

    else:
        # Plain text / fallback
        try:
            text = file_bytes.decode("utf-8")
        except UnicodeDecodeError:
            text = file_bytes.decode("latin-1", errors="ignore")

    # Clean non-breaking spaces and normalize unicode dashes
    clean_text = (
        text.replace("\xa0", " ")
        .replace("\u2013", "-")
        .replace("\u2014", "-")
        .replace("\u2018", "'")
        .replace("\u2019", "'")
        .replace("\u201c", '"')
        .replace("\u201d", '"')
    )
    return clean_text.strip()


def parse_jd_criteria(jd_text: str) -> Dict[str, Any]:
    """Analyzes JD text and extracts candidate eligibility criteria with multi-rule NLP and regex heuristics."""
    criteria: Dict[str, Any] = {
        "company_name": "",
        "job_role": "",
        "batch": "",
        "eligible_departments": [],
        "min_cgpa": 0.0,
        "min_10th_percent": 0.0,
        "min_12th_percent": 0.0,
        "min_diploma_percent": 0.0,
        "max_current_arrears": 0,
        "max_history_arrears": -1,  # -1 means any / no limit
        "gender": "ALL",
        "salary_package": "",
        "required_certifications": [],
        "raw_text_preview": jd_text[:3000] if jd_text else "",
        "allowed_status_keywords": ["allowed", "allow", "yes", "eligible", "dream", "super dream"],
    }

    if not jd_text:
        return criteria

    # 1. Company Name detection
    # Common formats in placement notices:
    # "Company Name: Presidio" or "Name of the Company: Cognizant"
    # "Sub: Campus Recruitment Drive by Zoho Corporation"
    # "M/s. Robert Bosch is conducting..."
    # "About Trimble:"
    company = ""
    comp_patterns = [
        r"(?:Name\s+of\s+(?:the\s+)?Company|Company\s*Name|Hiring\s*Company|Client\s*Name|Recruiting\s*Company)\s*[:\-–|]\s*([^\r\n,;]+)",
        r"\b(?:Company|Client|Organization|Recruiter|Employer)\s*[:\-–|]\s*([^\r\n,;]+)",
        r"(?:Campus\s*(?:Recruitment|Placement)?\s*Drive\s*(?:by|for)|Hiring\s*(?:by|for)|Recruitment\s*(?:by|for)|Interview\s*(?:by|for))\s+([A-Z][A-Za-z0-9&.\s]{2,40}?)(?:\s*[-–(,]|\s+for|\s+is|\s+on|\s*$)",
        r"(?:M/s\.?|M/S\.?)\s*([A-Z][A-Za-z0-9&.\s]{2,40}?)(?:\s*[-–(,]|\s+is|\s+conducting|\s*$)",
        r"(?:About\s+([A-Z][A-Za-z0-9&.\s]{2,40}?)(?:\s*[:\-–|]|\s*$))",
    ]
    for cp in comp_patterns:
        m = re.search(cp, jd_text, re.IGNORECASE | re.MULTILINE)
        if m:
            candidate = m.group(1).strip()
            # Avoid picking college / administrative noise
            if not re.search(r"college|institute|university|placement|training|circular|notification|notice|ref|date|batch|campus\s*drive|academic|engineering", candidate, re.IGNORECASE):
                company = candidate
                break

    # If still not found, check top lines of document excluding headers
    if not company:
        lines = [l.strip() for l in jd_text.splitlines() if l.strip()]
        for line in lines[:8]:
            if len(line) < 50 and not re.search(r"college|institute|university|campus|placement|training|circular|notification|notice|ref|date|batch|department|dear|greetings|welcome|tap\s*cell|student", line, re.IGNORECASE):
                if re.match(r"^[A-Za-z0-9&.\s\-]{2,40}$", line):
                    company = line
                    break

    criteria["company_name"] = company.strip()

    # 2. Job Role / Designation detection
    role_patterns = [
        r"(?:Job\s*Role\s*/\s*Designation|Job\s*Role|Role\s*Offered|Role|Designation|Position\s*Title|Position|Job\s*Title|Profile|Hiring\s*For)\s*[:\-–|]\s*([^\r\n,;]+)",
    ]
    for rp in role_patterns:
        m = re.search(rp, jd_text, re.IGNORECASE)
        if m:
            candidate = m.group(1).strip()
            if 2 < len(candidate) < 60 and not re.search(r"b\.e|btech|m\.e|all|eligib", candidate, re.IGNORECASE):
                criteria["job_role"] = candidate
                break

    if not criteria["job_role"]:
        role_search = re.search(
            r"\b(Software\s+Development\s+Engineer(?:\s*[-–]\s*[I|1|2])?|Senior\s+Software\s+Engineer|Associate\s+Software\s+Engineer|Software\s+Engineer|Graduate\s+Engineer\s+Trainee|GET|Associate\s+Engineer|System\s+Engineer|Full\s*Stack\s+Developer|Frontend\s+Developer|Backend\s+Developer|Cloud\s+Engineer|Data\s+Analyst|Consultant|QA\s+Engineer|DevOps\s+Engineer)\b",
            jd_text,
            re.IGNORECASE,
        )
        if role_search:
            criteria["job_role"] = role_search.group(1).strip()

    # 3. CGPA Cutoff
    # Supports decimals and integers: "7.0 CGPA", "6.5 & above", "7 CGPA", "Cut off: 6.5", "60% or 6.0 CGPA"
    cgpa_patterns = [
        r"(?:UG\s*CGPA|UG\s*GPA|Current\s*CGPA|Overall\s*CGPA|Minimum\s*CGPA|Min\s*CGPA|Cut\s*off\s*CGPA|Cut-off\s*CGPA|CGPA\s*Cutoff|CGPA\s*Criteria|CGPA)\s*[:\-–|]?\s*(?:>=|>|is|of|minimum|min)?\s*([4-9](?:\.\d{1,2})?)\s*(?:&|\+|and\s*above|above)?",
        r"(?:or\s*)?([4-9](?:\.\d{1,2})?)\s*(?:&|\+|and\s*above|above)?\s*(?:CGPA|GPA)",
        r"(?:minimum|min|at\s*least)\s*([4-9](?:\.\d{1,2})?)\s*(?:CGPA|in\s*UG|in\s*engineering)",
        r"(?:B\.E\s*/\s*B\.Tech|B\.Tech|UG|Engineering)\s*[:\-–|]\s*(?:min|minimum)?\s*([4-9](?:\.\d{1,2})?)\s*(?:CGPA)?",
        r"(?:Cut\s*off|Cut-off|Eligibility)\s*[:\-–|]\s*([4-9](?:\.\d{1,2})?)\s*(?:CGPA)",
    ]
    for cp in cgpa_patterns:
        m = re.search(cp, jd_text, re.IGNORECASE)
        if m:
            try:
                val = float(m.group(1))
                if 4.0 <= val <= 10.0:
                    criteria["min_cgpa"] = val
                    break
            except ValueError:
                pass

    # 4. 10th / 12th / Diploma Cutoff
    # First check throughout / aggregate percentage
    throughout_match = re.search(
        r"([5-9]\d(?:\.\d+)?)\s*%\s*(?:throughout|aggregate|consistent|in\s*all|across\s*academics|across\s*10th|in\s*10th|in\s*sslc)",
        jd_text,
        re.IGNORECASE,
    )
    if throughout_match:
        t_val = float(throughout_match.group(1))
        criteria["min_10th_percent"] = t_val
        criteria["min_12th_percent"] = t_val
        criteria["min_diploma_percent"] = t_val

    # Specific 10th / SSLC
    m_10 = re.search(r"(?:10th|sslc|class\s*x|std\s*10)\s*[:\-–|]?\s*(?:min|minimum|>=)?\s*([5-9]\d(?:\.\d+)?)\s*%", jd_text, re.IGNORECASE)
    if not m_10:
        m_10 = re.search(r"(?:min|minimum|>=)?\s*([5-9]\d(?:\.\d+)?)\s*%\s*(?:in\s*)?(?:10th|sslc|class\s*x)", jd_text, re.IGNORECASE)
    if m_10:
        criteria["min_10th_percent"] = float(m_10.group(1))

    # Specific 12th / HSC
    m_12 = re.search(r"(?:12th|hsc|class\s*xii|std\s*12|higher\s*sec)\s*[:\-–|]?\s*(?:min|minimum|>=)?\s*([5-9]\d(?:\.\d+)?)\s*%", jd_text, re.IGNORECASE)
    if not m_12:
        m_12 = re.search(r"(?:min|minimum|>=)?\s*([5-9]\d(?:\.\d+)?)\s*%\s*(?:in\s*)?(?:12th|hsc|class\s*xii)", jd_text, re.IGNORECASE)
    if m_12:
        criteria["min_12th_percent"] = float(m_12.group(1))

    # Specific Diploma
    m_dip = re.search(r"(?:diploma|dip)\s*[:\-–|]?\s*(?:min|minimum|>=)?\s*([5-9]\d(?:\.\d+)?)\s*%", jd_text, re.IGNORECASE)
    if not m_dip:
        m_dip = re.search(r"(?:min|minimum|>=)?\s*([5-9]\d(?:\.\d+)?)\s*%\s*(?:in\s*)?diploma", jd_text, re.IGNORECASE)
    if m_dip:
        criteria["min_diploma_percent"] = float(m_dip.group(1))

    # 5. Standing Arrears / Backlogs
    # Checks for explicit Zero / Nil / None / No in current / standing / live arrears
    zero_curr = re.search(
        r"(?:no\s*(?:standing|active|current|live)?\s*(?:arrears?|backlogs?)|zero\s*(?:standing|active|current|live)?\s*(?:arrears?|backlogs?)|0\s*(?:standing|active|current|live)?\s*(?:arrears?|backlogs?)|cleared\s*backlogs|without\s*(?:any)?\s*(?:standing|active|current|live)?\s*(?:arrears?|backlogs?)|not\s*eligible\s*with\s*(?:standing|active|current|live)?\s*(?:arrears?|backlogs?))",
        jd_text,
        re.IGNORECASE,
    )
    nil_curr = re.search(
        r"(?:standing|current|active|live)\s*(?:arrears?|backlogs?)?\s*[:\-–|]\s*(?:nil|none|no|zero|0\b|null)",
        jd_text,
        re.IGNORECASE,
    )
    general_nil = re.search(r"\b(?:arrears?|backlogs?)\s*[:\-–|]\s*(?:nil|none|no|zero|0\b|null)", jd_text, re.IGNORECASE)

    if zero_curr or nil_curr or general_nil:
        criteria["max_current_arrears"] = 0
    else:
        num_curr = re.search(
            r"(?:standing|current|active|live)\s*(?:arrears?|backlogs?)?\s*[:\-–|]?\s*(?:max|upto|maximum|<=)?\s*(\d+)",
            jd_text,
            re.IGNORECASE,
        )
        if not num_curr:
            num_curr = re.search(r"(?:max|upto|maximum)\s*(\d+)\s*(?:standing|current|active|live)?\s*(?:arrears?|backlogs?)", jd_text, re.IGNORECASE)
        if not num_curr:
            num_curr = re.search(r"(\d+)\s*(?:standing|current|active|live)\s*(?:arrears?|backlogs?)\s*(?:allowed|permitted)", jd_text, re.IGNORECASE)
        if num_curr:
            criteria["max_current_arrears"] = int(num_curr.group(1))

    # 6. History of Arrears
    zero_hist = re.search(
        r"(?:no\s*history\s*of\s*(?:arrears?|backlogs?)|zero\s*history\s*of\s*(?:arrears?|backlogs?)|without\s*history\s*of\s*(?:arrears?|backlogs?)|clean\s*track\s*record|no\s*arrear\s*history)",
        jd_text,
        re.IGNORECASE,
    )
    nil_hist = re.search(
        r"(?:history\s*(?:of\s*(?:arrears?|backlogs?))?|arrear\s*history|backlog\s*history)\s*[:\-–|]\s*(?:nil|none|no|zero|0\b|null)",
        jd_text,
        re.IGNORECASE,
    )
    if zero_hist or nil_hist:
        criteria["max_history_arrears"] = 0
    else:
        num_hist = re.search(
            r"(?:history\s*(?:of\s*(?:arrears?|backlogs?))?|arrear\s*history)\s*[:\-–|]?\s*(?:max|upto|maximum|<=)?\s*(\d+)",
            jd_text,
            re.IGNORECASE,
        )
        if not num_hist:
            num_hist = re.search(r"(?:(?:max|upto|maximum)\s*)?(\d+)\s*(?:history\s*of\s*(?:arrears?|backlogs?)|history\s*arrears?|history\s*backlogs?)", jd_text, re.IGNORECASE)
        if num_hist:
            criteria["max_history_arrears"] = int(num_hist.group(1))
        else:
            criteria["max_history_arrears"] = -1

    # 7. Batch detection
    # Handles: 'Batch : 2025', 'Batch : 2021-2025', 'Year of Passing: 2025', '2025 Batch', '2021-25 Batch'
    labeled_b = re.search(
        r"(?:Eligible\s*Batch|Target\s*Batch|Passing\s*(?:Out)?\s*Year|Year\s*of\s*Passing|YOP|Batch|Passing\s*Out)\s*[:\-–|]\s*([^\r\n,;]+)",
        jd_text,
        re.IGNORECASE,
    )
    if labeled_b:
        cand_b = labeled_b.group(1).strip()
        y_match = re.search(r"\b(202\d(?:\s*[-–]\s*(?:202\d|\d{2}))?)\b", cand_b)
        if y_match:
            criteria["batch"] = y_match.group(1).replace(" ", "")

    if not criteria["batch"]:
        standalone_b = re.search(
            r"\b(202\d\s*[-–]\s*(?:202\d|\d{2})|202\d)\s*(?:batch|pass(?:ing)?\s*out|passouts?|graduat(?:ing|ion))\b",
            jd_text,
            re.IGNORECASE,
        )
        if standalone_b:
            criteria["batch"] = standalone_b.group(1).replace(" ", "")

    if not criteria["batch"]:
        gen_b = re.search(r"\b(202[4-9]\s*[-–]\s*202[5-9]|202[4-9])\b", jd_text)
        if gen_b:
            criteria["batch"] = gen_b.group(1).replace(" ", "")

    # 8. Department detection (All 21 college departments)
    found_depts = set()
    dept_checks = {
        "AGRI": [r"\bagri\b", r"\bagriculture\b", r"\bagricultural\b"],
        "AIDS": [r"\baids\b", r"ai\s*(&|and|\/)\s*ds\b", r"data\s*science"],
        "AIML": [r"\baiml\b", r"ai\s*(&|and|\/)\s*ml\b", r"machine\s*learning"],
        "BIOMEDICAL": [r"\bbiomedical\b", r"\bbme\b"],
        "BIOTECHNOLOGY": [r"\bbiotechnology\b", r"\bbiotech\b", r"\bbt\b"],
        "CIVIL": [r"\bcivil\b"],
        "CSBS": [r"\bcsbs\b", r"cs\s*(&|and|\/)\s*bs\b", r"business\s*systems"],
        "CSE": [r"\bcse\b", r"computer\s*science(?!\s*and\s*(?:design|business))", r"computer\s*engineering"],
        "CSD": [r"\bcsd\b", r"cs\s*(&|and|\/)\s*d\b", r"computer\s*science\s*(?:&|and)\s*design"],
        "CT": [r"\bct\b", r"computer\s*technology"],
        "ECE": [r"\bece\b", r"\bec\b(?!\s*in)", r"electronics\s*(?:&|and)\s*communication"],
        "EEE": [r"\beee\b", r"\bee\b(?!\s*in)", r"electrical\s*(?:&|and)\s*electronics"],
        "EIE": [r"\beie\b", r"electronics\s*(?:&|and)\s*instrumentation"],
        "FASHION TECH": [r"fashion\s*tech", r"fashion\s*technology", r"\bft\b"],
        "FOOD TECH": [r"food\s*tech", r"food\s*technology"],
        "ISE": [r"\bise\b", r"information\s*science\s*(?:&|and)\s*engineering", r"information\s*science"],
        "IT": [r"\bit\b(?!\s*(?:is|in|of|for|to|will|as|at|on|with|by|from|be|have))", r"information\s*technology"],
        "MECHANICAL": [r"\bmech\b", r"\bmechanical\b"],
        "M.E - COMPUTER SCIENCE AND ENGINEERING": [r"m\.e\s*[-–/]?\s*cse\b", r"m\.e\s*[-–/]?\s*computer\s*science"],
        "M.E - INDUSTRIAL SAFETY ENGINEERING": [r"m\.e\s*[-–/]?\s*industrial\s*safety", r"industrial\s*safety"],
        "MBA - SCHOOL OF MANAGEMENT STUDIES": [r"\bmba\b", r"management\s*studies"],
    }

    # Check for "circuit branches"
    if re.search(r"circuit\s*(?:branches|streams|departments)", jd_text, re.IGNORECASE):
        for cd in ["CSE", "IT", "AIDS", "AIML", "CSBS", "ECE", "EEE", "EIE", "CT", "CSD", "ISE"]:
            found_depts.add(cd)

    for dept_code, patterns in dept_checks.items():
        for pat in patterns:
            if re.search(pat, jd_text, re.IGNORECASE):
                found_depts.add(dept_code)
                break

    # If specific departments were found, prioritize them
    if found_depts:
        criteria["eligible_departments"] = sorted(list(found_depts))
    else:
        # Check if circular explicitly opens to all branches
        true_all_open = re.search(
            r"(?:all\s*(?:engineering\s*)?(?:branches|departments|disciplines|streams)\s*(?:are\s*)?eligible|open\s*to\s*all\s*branches|all\s*branches\s*allowed)",
            jd_text,
            re.IGNORECASE,
        )
        if true_all_open:
            criteria["eligible_departments"] = []
        else:
            criteria["eligible_departments"] = []

    # 9. Salary Package / CTC
    ctc_pattern = r"(?:Salary\s*Package|Pay\s*Package|Annual\s*CTC|CTC\s*Offered|Salary|CTC|Package|Compensation|Stipend|Remuneration)(?:\s*\([^)]*\))?\s*[:\-–|]\s*(?:INR\s*|Rs\.?\s*)?([0-9.,]+(?:\s*(?:-|–|to)\s*[0-9.,]+)?\s*(?:LPA|Lakhs?(?:\s*PA)?|PA|PM|per\s*annum|per\s*month|\/-)?)"
    ctc_match = re.search(ctc_pattern, jd_text, re.IGNORECASE)
    if ctc_match:
        criteria["salary_package"] = ctc_match.group(1).strip()
    else:
        # Standalone e.g. "6.5 LPA" or "4 - 6 LPA"
        ctc_standalone = re.search(r"\b([0-9.,]+(?:\s*(?:-|–|to)\s*[0-9.,]+)?\s*LPA)\b", jd_text, re.IGNORECASE)
        if ctc_standalone:
            criteria["salary_package"] = ctc_standalone.group(1).strip()

    # 10. Gender preference
    if re.search(r"(?:female\s*candidates?\s*only|only\s*for\s*female|women\s*only|girls\s*only)", jd_text, re.IGNORECASE):
        criteria["gender"] = "FEMALE"
    elif re.search(r"(?:male\s*candidates?\s*only|only\s*for\s*male|boys\s*only)", jd_text, re.IGNORECASE):
        criteria["gender"] = "MALE"
    else:
        criteria["gender"] = "ALL"

    # 11. Certifications / specific tracks
    cert_checks = ["Cisco", "Oracle", "ServiceNow", "Japanese", "Embedded", "Maven Silicon VLSI", "AI - navigate"]
    found_certs = []
    for c in cert_checks:
        if re.search(rf"\b{re.escape(c)}\b", jd_text, re.IGNORECASE):
            found_certs.append(c)
    criteria["required_certifications"] = found_certs

    return criteria


def safe_float(val: Any, default: float = 0.0) -> float:
    if val is None or pd.isna(val):
        return default
    try:
        s = str(val).strip().replace("%", "")
        return float(s)
    except (ValueError, TypeError):
        return default


def safe_int(val: Any, default: int = 0) -> int:
    if val is None or pd.isna(val):
        return default
    try:
        s = str(val).strip().split(".")[0]
        return int(s)
    except (ValueError, TypeError):
        return default


def find_column(df: pd.DataFrame, candidates: List[str]) -> Optional[str]:
    """Finds matching column name from dataframe ignoring case, spaces, and punctuation."""
    def clean(s: str) -> str:
        return re.sub(r"[^a-z0-9]", "", str(s).lower())

    df_cols = {clean(c): c for c in df.columns}
    for cand in candidates:
        cand_clean = clean(cand)
        if cand_clean in df_cols:
            return df_cols[cand_clean]
    # Substring match fallback
    for cand in candidates:
        cand_clean = clean(cand)
        for cl, original in df_cols.items():
            if cand_clean in cl or cl in cand_clean:
                return original
    return None


def parse_student_master_excel(file_bytes: bytes) -> List[Dict[str, Any]]:
    """Reads the Student Master Excel workbook and standardizes all 25 columns."""
    df = pd.read_excel(io.BytesIO(file_bytes))
    students: List[Dict[str, Any]] = []

    # Map columns flexibly
    col_reg = find_column(df, ["Reg No", "Register No", "Reg. No", "Roll No", "RegisterNumber"])
    col_name = find_column(df, ["Student Name", "Name", "StudentName", "Full Name"])
    col_dept = find_column(df, ["Department", "Dept", "Branch"])
    col_email = find_column(df, ["Student Official Email ID", "Official Email ID", "Official Email", "Email ID"])
    col_undertaking = find_column(df, ["Undertaking", "Under Taking"])
    col_batch = find_column(df, ["Batch", "Academic Year", "Passing Year"])
    col_placed = find_column(df, ["Placed", "Placement Status", "Is Placed"])
    col_cisco = find_column(df, ["Cisco"])
    col_ai_nav = find_column(df, ["AI - navigate", "AI-navigate", "AI navigate"])
    col_oracle = find_column(df, ["Oracle"])
    col_maven = find_column(df, ["Maven Silicon VLSI", "Maven Silicon", "VLSI"])
    col_embedded = find_column(df, ["Embedded"])
    col_japanese = find_column(df, ["Japanese"])
    col_servicenow = find_column(df, ["ServiceNow", "Service Now"])
    col_any_cert = find_column(df, ["Any one Certification", "Any Certification", "Certification"])
    col_mobile = find_column(df, ["Student Mobile", "Mobile", "Contact No", "Phone"])
    col_hosteller = find_column(df, ["Hosteller/Dayscholar", "Hosteller / Dayscholar", "Hostel / Day Scholar"])
    col_gender = find_column(df, ["Gender", "Sex"])
    col_12th = find_column(df, ["12th", "12th %", "HSC", "HSC %"])
    col_dip = find_column(df, ["Dip", "Diploma", "Diploma %"])
    col_cgpa = find_column(df, ["UG CGPA Upto VI", "UG CGPA", "CGPA Upto VI", "CGPA", "Current CGPA"])
    col_arrear_count = find_column(df, ["ARREAR COUNT Upto VI", "Arrear Count", "Current Arrears", "Standing Arrears", "Arrears"])
    col_hist_arrear = find_column(df, ["HISTORY OF ARREAR upto V", "History of Arrears", "History Arrear", "Arrear History"])
    col_personal_mail = find_column(df, ["Personal Mail ID", "Personal Email", "Personal Mail"])

    for idx, row in df.iterrows():
        reg_no = normalize_text(row.get(col_reg)) if col_reg else f"STU{idx+1:04d}"
        if not reg_no or pd.isna(reg_no):
            continue

        student = {
            "s_no": idx + 1,
            "reg_no": str(reg_no).strip().upper(),
            "student_name": normalize_text(row.get(col_name)) if col_name else "",
            "department": normalize_text(row.get(col_dept)) if col_dept else "",
            "dept_code": normalize_dept(row.get(col_dept)) if col_dept else "",
            "official_email": normalize_text(row.get(col_email)) if col_email else "",
            "undertaking": normalize_text(row.get(col_undertaking)) if col_undertaking else "",
            "batch": normalize_text(row.get(col_batch)) if col_batch else "",
            "placed_raw": normalize_text(row.get(col_placed)) if col_placed else "No",
            "cisco": normalize_text(row.get(col_cisco)) if col_cisco else "",
            "ai_navigate": normalize_text(row.get(col_ai_nav)) if col_ai_nav else "",
            "oracle": normalize_text(row.get(col_oracle)) if col_oracle else "",
            "maven_silicon": normalize_text(row.get(col_maven)) if col_maven else "",
            "embedded": normalize_text(row.get(col_embedded)) if col_embedded else "",
            "japanese": normalize_text(row.get(col_japanese)) if col_japanese else "",
            "servicenow": normalize_text(row.get(col_servicenow)) if col_servicenow else "",
            "any_one_cert": normalize_text(row.get(col_any_cert)) if col_any_cert else "",
            "mobile": normalize_text(row.get(col_mobile)) if col_mobile else "",
            "hosteller_dayscholar": normalize_text(row.get(col_hosteller)) if col_hosteller else "",
            "gender": normalize_text(row.get(col_gender)).upper() if col_gender else "",
            "twelfth_percent": safe_float(row.get(col_12th)),
            "diploma_percent": safe_float(row.get(col_dip)),
            "ug_cgpa": safe_float(row.get(col_cgpa)),
            "arrear_count": safe_int(row.get(col_arrear_count)),
            "history_arrear": safe_int(row.get(col_hist_arrear)),
            "personal_email": normalize_text(row.get(col_personal_mail)) if col_personal_mail else "",
        }
        students.append(student)

    return students


def parse_placed_students_excel(file_bytes: bytes) -> Dict[str, Dict[str, Any]]:
    """Reads the Placed Students Offer workbook and creates a lookup indexed by normalized Register No."""
    df = pd.read_excel(io.BytesIO(file_bytes))
    placed_map: Dict[str, Dict[str, Any]] = {}

    col_reg = find_column(df, ["Register No", "Reg No", "Reg. No", "Roll No", "RegisterNumber"])
    col_name = find_column(df, ["Name", "Student Name", "StudentName"])
    col_dept = find_column(df, ["Department", "Dept", "Branch"])
    col_company = find_column(df, ["Company Name", "Company", "Placed Company"])
    col_salary = find_column(df, ["Salary Package (LPA)", "Salary Package", "Package (LPA)", "CTC (LPA)", "Package"])
    col_intern_status = find_column(df, ["Internship Status", "Intern Status"])
    col_intern_mode = find_column(df, ["Internship Mode", "Intern Mode"])
    col_type = find_column(df, ["Type", "Offer Type"])
    col_allowing_status = find_column(df, ["Allowing Status", "AllowingStatus", "Allowed Status", "Allow Status"])
    col_email = find_column(df, ["Email ID", "Email", "Student Email"])
    col_contact = find_column(df, ["Student Contact No", "Contact No", "Mobile"])
    col_organized = find_column(df, ["Organized by", "Organized By"])
    col_offer_entry_date = find_column(df, ["Offer Entry Date"])
    col_joined_date = find_column(df, ["Joined Date"])
    col_offered_date = find_column(df, ["Offered Date"])
    col_offer_ref = find_column(df, ["Offer reference no.", "Offer Reference No"])
    col_is_interncum = find_column(df, ["Is that Interncum Placement Offer?", "Interncum Placement Offer", "Interncum"])
    col_appt_date = find_column(df, ["Appoinment Letter Date", "Appointment Letter Date"])
    col_appt_ref = find_column(df, ["Appointment Letter reference no.", "Appointment Letter Reference No"])
    col_appt_proof = find_column(df, ["Appoinment Letter - Proof Link", "Appointment Letter Proof"])
    col_offer_proof = find_column(df, ["Offer - Proof Link", "Offer Proof Link"])
    col_mail_proof = find_column(df, ["Mail Proof"])
    col_intern_letter = find_column(df, ["Internship Letter"])
    col_intern_offer = find_column(df, ["Internship Cum Offer"])

    for idx, row in df.iterrows():
        reg_no = normalize_text(row.get(col_reg)) if col_reg else None
        if not reg_no or pd.isna(reg_no):
            continue

        clean_reg = str(reg_no).strip().upper()
        allowing_raw = normalize_text(row.get(col_allowing_status)) if col_allowing_status else ""

        record = {
            "s_no": idx + 1,
            "register_no": clean_reg,
            "name": normalize_text(row.get(col_name)) if col_name else "",
            "department": normalize_text(row.get(col_dept)) if col_dept else "",
            "company_name": normalize_text(row.get(col_company)) if col_company else "",
            "salary_package": safe_float(row.get(col_salary)),
            "salary_raw": normalize_text(row.get(col_salary)) if col_salary else "",
            "internship_status": normalize_text(row.get(col_intern_status)) if col_intern_status else "",
            "internship_mode": normalize_text(row.get(col_intern_mode)) if col_intern_mode else "",
            "offer_type": normalize_text(row.get(col_type)) if col_type else "",
            "allowing_status": allowing_raw,
            "email_id": normalize_text(row.get(col_email)) if col_email else "",
            "student_contact_no": normalize_text(row.get(col_contact)) if col_contact else "",
            "organized_by": normalize_text(row.get(col_organized)) if col_organized else "",
            "offer_entry_date": normalize_text(row.get(col_offer_entry_date)) if col_offer_entry_date else "",
            "joined_date": normalize_text(row.get(col_joined_date)) if col_joined_date else "",
            "offered_date": normalize_text(row.get(col_offered_date)) if col_offered_date else "",
            "offer_reference_no": normalize_text(row.get(col_offer_ref)) if col_offer_ref else "",
            "is_interncum_offer": normalize_text(row.get(col_is_interncum)) if col_is_interncum else "",
            "appointment_letter_date": normalize_text(row.get(col_appt_date)) if col_appt_date else "",
            "appointment_letter_ref": normalize_text(row.get(col_appt_ref)) if col_appt_ref else "",
            "appointment_proof_link": normalize_text(row.get(col_appt_proof)) if col_appt_proof else "",
            "offer_proof_link": normalize_text(row.get(col_offer_proof)) if col_offer_proof else "",
            "mail_proof": normalize_text(row.get(col_mail_proof)) if col_mail_proof else "",
            "internship_letter": normalize_text(row.get(col_intern_letter)) if col_intern_letter else "",
            "internship_cum_offer": normalize_text(row.get(col_intern_offer)) if col_intern_offer else "",
        }
        # If student has multiple offers, prioritize latest or keep first
        if clean_reg not in placed_map:
            placed_map[clean_reg] = record
        else:
            # Append company if different
            existing = placed_map[clean_reg]
            if record["company_name"] and record["company_name"] != existing["company_name"]:
                existing["company_name"] += f" / {record['company_name']}"
                if record["allowing_status"]:
                    existing["allowing_status"] = record["allowing_status"]

    return placed_map


def parse_ssg_excel(file_bytes: bytes) -> set:
    """Reads an SSG student Excel (Name + Reg No columns) and returns a set of normalised register numbers."""
    try:
        df = pd.read_excel(io.BytesIO(file_bytes))
        col_reg = find_column(df, ["Reg No", "Register No", "Reg. No", "Roll No", "RegisterNumber", "Reg"])
        if not col_reg:
            # If no recognisable reg-no column, try the first non-name column
            for c in df.columns:
                if "name" not in str(c).lower():
                    col_reg = c
                    break
        ssg_set: set = set()
        for _, row in df.iterrows():
            val = row.get(col_reg) if col_reg else None
            if val is not None and not pd.isna(val):
                ssg_set.add(str(val).strip().upper())
        return ssg_set
    except Exception as e:
        logger.warning(f"SSG Excel parse failed: {e}")
        return set()


def evaluate_students_eligibility(
    students: List[Dict[str, Any]],
    placed_map: Dict[str, Dict[str, Any]],
    criteria: Dict[str, Any],
    ssg_reg_nos: Optional[set] = None,
) -> Dict[str, Any]:
    """Matches each student against JD criteria and checks allowing status for placed students."""

    results: List[Dict[str, Any]] = []

    # Criteria extract
    min_cgpa = safe_float(criteria.get("min_cgpa", 0.0))
    min_10th = safe_float(criteria.get("min_10th_percent", 0.0))
    min_12th = safe_float(criteria.get("min_12th_percent", 0.0))
    min_dip = safe_float(criteria.get("min_diploma_percent", 0.0))
    max_current_arrears = criteria.get("max_current_arrears", 0)
    max_history_arrears = criteria.get("max_history_arrears", -1)
    eligible_depts = [d.upper() for d in criteria.get("eligible_departments", []) if d]
    req_batch = normalize_text(criteria.get("batch", ""))
    gender_filter = normalize_text(criteria.get("gender", "ALL")).upper()
    req_certs = criteria.get("required_certifications", [])

    allowed_keywords = [
        k.strip().lower() for k in criteria.get("allowed_status_keywords", ["allowed", "allow", "yes", "eligible", "dream", "super dream"])
        if k.strip()
    ]

    total_evaluated = len(students)
    count_eligible_unplaced = 0
    count_placed_allowed = 0
    count_placed_not_allowed = 0
    count_criteria_mismatch = 0

    for stu in students:
        reg_no = stu["reg_no"]
        failures: List[str] = []

        # 1. Department Check (strict canonical department matching)
        if eligible_depts:
            dept_code = stu.get("dept_code") or normalize_dept(stu.get("department"))
            if dept_code not in eligible_depts:
                failures.append(f"Department '{stu.get('department')}' not in eligible list ({', '.join(eligible_depts)})")

        # 2. Batch Check (supports '2025', '2021-2025', '2021-25', etc.)
        if req_batch:
            stu_batch = stu.get("batch", "")
            req_clean = re.sub(r"[^0-9]", "", req_batch)
            stu_clean = re.sub(r"[^0-9]", "", stu_batch)
            matched_b = False
            if req_batch.lower() in stu_batch.lower() or stu_batch.lower() in req_batch.lower():
                matched_b = True
            elif req_clean and stu_clean:
                # Compare last 2 digits or last 4 digits (graduation year e.g. 25 vs 2025)
                if len(req_clean) >= 2 and len(stu_clean) >= 2 and req_clean[-2:] == stu_clean[-2:]:
                    matched_b = True
                elif len(req_clean) >= 4 and len(stu_clean) >= 4 and req_clean[-4:] == stu_clean[-4:]:
                    matched_b = True
            if not matched_b:
                failures.append(f"Batch mismatch (Student: {stu_batch}, Required: {req_batch})")

        # 3. CGPA Check
        if min_cgpa > 0.0:
            if stu["ug_cgpa"] < min_cgpa:
                failures.append(f"CGPA {stu['ug_cgpa']:.2f} < Cutoff {min_cgpa:.2f}")

        # 4. 12th / Diploma Check
        if min_12th > 0.0:
            # If student has diploma and diploma >= min_dip (or min_12th), let them pass
            if stu["diploma_percent"] > 0.0:
                target_dip = min_dip if min_dip > 0.0 else min_12th
                if stu["diploma_percent"] < target_dip:
                    failures.append(f"Diploma {stu['diploma_percent']:.1f}% < {target_dip:.1f}%")
            elif stu["twelfth_percent"] > 0.0:
                if stu["twelfth_percent"] < min_12th:
                    failures.append(f"12th {stu['twelfth_percent']:.1f}% < {min_12th:.1f}%")

        # 5. Standing Arrears Check
        if max_current_arrears is not None and max_current_arrears >= 0:
            if stu["arrear_count"] > max_current_arrears:
                failures.append(f"Standing Arrears {stu['arrear_count']} > Max Allowed {max_current_arrears}")

        # 6. History of Arrears Check
        if max_history_arrears is not None and max_history_arrears >= 0:
            if stu["history_arrear"] > max_history_arrears:
                failures.append(f"History of Arrears {stu['history_arrear']} > Max Allowed {max_history_arrears}")

        # 7. Gender Check
        if gender_filter and gender_filter != "ALL":
            if stu["gender"] and stu["gender"] != gender_filter:
                failures.append(f"Gender {stu['gender']} does not match JD requirement ({gender_filter})")

        # 8. Certifications Check
        if req_certs:
            for rc in req_certs:
                rc_key = rc.lower()
                has_cert = False
                if "cisco" in rc_key and "yes" in stu["cisco"].lower():
                    has_cert = True
                elif "oracle" in rc_key and "yes" in stu["oracle"].lower():
                    has_cert = True
                elif "service" in rc_key and "yes" in stu["servicenow"].lower():
                    has_cert = True
                elif "japanese" in rc_key and "yes" in stu["japanese"].lower():
                    has_cert = True
                elif "embedded" in rc_key and "yes" in stu["embedded"].lower():
                    has_cert = True
                elif "maven" in rc_key and "yes" in stu["maven_silicon"].lower():
                    has_cert = True
                elif "navigate" in rc_key and "yes" in stu["ai_navigate"].lower():
                    has_cert = True
                elif "any" in rc_key and ("yes" in stu["any_one_cert"].lower() or stu["any_one_cert"]):
                    has_cert = True

                if not has_cert:
                    failures.append(f"Missing required certification: {rc}")

        # Placement info lookup
        placed_info = placed_map.get(reg_no)
        is_placed_flag = (
            placed_info is not None
            or stu["placed_raw"].strip().lower() in ["yes", "placed", "y", "true", "1"]
        )

        company_placed = placed_info["company_name"] if placed_info else ""
        salary_placed = placed_info["salary_package"] if placed_info else 0.0
        allowing_status_raw = placed_info["allowing_status"] if placed_info else ""

        # Determine Eligibility and Detailed Status
        if len(failures) > 0:
            status_code = "CRITERIA_MISMATCH"
            is_eligible = False
            status_label = "Ineligible (Criteria)"
            reason = "; ".join(failures)
            count_criteria_mismatch += 1
        else:
            # Meets all academic criteria!
            if not is_placed_flag:
                status_code = "ELIGIBLE_UNPLACED"
                is_eligible = True
                status_label = "Eligible (Unplaced)"
                reason = "Meets all academic criteria. Not currently placed."
                count_eligible_unplaced += 1
            else:
                # Placed student! Check Allowing Status!
                # If allowing status matches allowed keywords:
                allow_norm = allowing_status_raw.strip().lower()
                is_allowed = any(keyword in allow_norm for keyword in allowed_keywords)

                if is_allowed:
                    status_code = "PLACED_ALLOWED"
                    is_eligible = True
                    status_label = "Placed - Allowed to Attend"
                    reason = f"Meets criteria & Placed in {company_placed or 'Company'} ({salary_placed} LPA). Allowing Status: '{allowing_status_raw}' (Permitted to attend drive)."
                    count_placed_allowed += 1
                else:
                    status_code = "PLACED_NOT_ALLOWED"
                    is_eligible = False
                    status_label = "Placed - Not Allowed"
                    reason = f"Meets academic criteria but placed in {company_placed or 'Company'} ({salary_placed} LPA). Allowing Status: '{allowing_status_raw or 'Not Allowed'}' (Cannot attend)."
                    count_placed_not_allowed += 1

        results.append({
            "reg_no": stu["reg_no"],
            "student_name": stu["student_name"],
            "department": stu["department"],
            "dept_code": stu["dept_code"],
            "batch": stu["batch"],
            "gender": stu["gender"],
            "ug_cgpa": stu["ug_cgpa"],
            "twelfth_percent": stu["twelfth_percent"],
            "diploma_percent": stu["diploma_percent"],
            "arrear_count": stu["arrear_count"],
            "history_arrear": stu["history_arrear"],
            "official_email": stu["official_email"],
            "personal_email": stu["personal_email"],
            "mobile": stu["mobile"],
            "undertaking": stu["undertaking"],
            "hosteller_dayscholar": stu["hosteller_dayscholar"],
            # Placement details
            "is_placed": is_placed_flag,
            "placed_company": company_placed,
            "salary_package": salary_placed,
            "allowing_status": allowing_status_raw,
            # Eligibility outcomes
            "is_eligible": is_eligible,
            "is_ssg": reg_no in ssg_reg_nos if ssg_reg_nos else False,
            "status_code": status_code,
            "status_label": status_label,
            "reason": reason,
            "failures": failures,
            # Full Certifications
            "cisco": stu["cisco"],
            "ai_navigate": stu["ai_navigate"],
            "oracle": stu["oracle"],
            "maven_silicon": stu["maven_silicon"],
            "embedded": stu["embedded"],
            "japanese": stu["japanese"],
            "servicenow": stu["servicenow"],
            "any_one_cert": stu["any_one_cert"],
        })

    # Summary metrics
    summary = {
        "total_evaluated": total_evaluated,
        "total_eligible": count_eligible_unplaced + count_placed_allowed,
        "eligible_unplaced": count_eligible_unplaced,
        "placed_allowed": count_placed_allowed,
        "placed_not_allowed": count_placed_not_allowed,
        "criteria_mismatch": count_criteria_mismatch,
        "company_name": criteria.get("company_name", ""),
        "job_role": criteria.get("job_role", ""),
    }

    return {
        "summary": summary,
        "criteria_applied": criteria,
        "students": results,
    }


def generate_eligible_excel(results_data: Dict[str, Any]) -> bytes:
    """Generates a beautifully styled Excel workbook containing eligible candidates."""
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Eligible Students"

    # Styling Palette
    header_fill = PatternFill(start_color="1E293B", end_color="1E293B", fill_type="solid")
    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    white_fill = PatternFill(start_color="FFFFFF", end_color="FFFFFF", fill_type="solid")
    alt_fill = PatternFill(start_color="F8FAFC", end_color="F8FAFC", fill_type="solid")
    placed_fill = PatternFill(start_color="ECFDF5", end_color="ECFDF5", fill_type="solid")  # soft green
    thin_border = Border(
        left=Side(style="thin", color="CBD5E1"),
        right=Side(style="thin", color="CBD5E1"),
        top=Side(style="thin", color="CBD5E1"),
        bottom=Side(style="thin", color="CBD5E1")
    )

    headers = [
        "S.No", "Register No", "Student Name", "Department", "Batch", "Gender",
        "UG CGPA", "Arrears", "History of Arrears", "12th %", "Diploma %",
        "Eligibility Status", "SSG Student?", "Placed?", "Placed Company", "Package (LPA)", "Allowing Status",
        "Official Email", "Personal Email", "Mobile", "Hostel/Day", "Remarks / Reason"
    ]

    ws.append(headers)
    for col_num in range(1, len(headers) + 1):
        cell = ws.cell(row=1, column=col_num)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = thin_border
    ws.row_dimensions[1].height = 28

    students = results_data.get("students", [])
    row_idx = 2
    for s in students:
        # If user exports, can export all or eligible; here write all with clean status
        status_code = s.get("status_code", "")
        row_vals = [
            row_idx - 1,
            s.get("reg_no", ""),
            s.get("student_name", ""),
            s.get("department", ""),
            s.get("batch", ""),
            s.get("gender", ""),
            s.get("ug_cgpa", 0.0),
            s.get("arrear_count", 0),
            s.get("history_arrear", 0),
            s.get("twelfth_percent", 0.0),
            s.get("diploma_percent", 0.0),
            s.get("status_label", ""),
            "Yes (SSG)" if s.get("is_ssg") else "No",
            "Yes" if s.get("is_placed") else "No",
            s.get("placed_company", ""),
            s.get("salary_package", "") if s.get("salary_package") else "",
            s.get("allowing_status", ""),
            s.get("official_email", ""),
            s.get("personal_email", ""),
            s.get("mobile", ""),
            s.get("hosteller_dayscholar", ""),
            s.get("reason", "")
        ]
        ws.append(row_vals)

        fill = placed_fill if status_code == "PLACED_ALLOWED" else (alt_fill if row_idx % 2 == 0 else white_fill)
        for col_num in range(1, len(headers) + 1):
            cell = ws.cell(row=row_idx, column=col_num)
            cell.fill = fill
            cell.border = thin_border
            cell.alignment = Alignment(vertical="center")
            if col_num in [1, 5, 6, 8, 9, 13]:
                cell.alignment = Alignment(horizontal="center", vertical="center")
            elif col_num in [7, 10, 11, 15]:
                cell.alignment = Alignment(horizontal="right", vertical="center")

        ws.row_dimensions[row_idx].height = 20
        row_idx += 1

    # Auto-adjust column widths
    for col in ws.columns:
        col_letter = get_column_letter(col[0].column)
        max_len = max(len(str(cell.value or "")) for cell in col[:50])
        ws.column_dimensions[col_letter].width = min(max(max_len + 3, 11), 40)

    output = io.BytesIO()
    wb.save(output)
    return output.getvalue()


def create_sample_datasets() -> Tuple[bytes, bytes, str]:
    """Generates realistic sample Student Master Excel, Placed Excel, and JD text."""
    # 1. Sample Student Master Excel
    master_rows = [
        {
            "S.No": 1, "Reg No": "71762104001", "Student Name": "Aakash Ramanathan", "Department": "Computer Science and Engineering",
            "Student Official Email ID": "aakash.r@college.edu", "Undertaking": "Yes", "Batch": "2023-2027", "Placed": "No",
            "Cisco": "Yes", "AI - navigate": "Yes", "Oracle": "No", "Maven Silicon VLSI": "No", "Embedded": "No", "Japanese": "No",
            "ServiceNow": "Yes", "Any one Certification": "Yes", "Student Mobile": "9876543210", "Hosteller/Dayscholar": "Dayscholar",
            "Gender": "Male", "12th": 88.5, "Dip": 0, "UG CGPA Upto VI": 8.45, "ARREAR COUNT Upto VI": 0, "HISTORY OF ARREAR upto V": 0,
            "Personal Mail ID": "aakash.raman@gmail.com"
        },
        {
            "S.No": 2, "Reg No": "71762104002", "Student Name": "Bhavani Sundaram", "Department": "Information Technology",
            "Student Official Email ID": "bhavani.s@college.edu", "Undertaking": "Yes", "Batch": "2023-2027", "Placed": "Yes",
            "Cisco": "Yes", "AI - navigate": "No", "Oracle": "Yes", "Maven Silicon VLSI": "No", "Embedded": "No", "Japanese": "Yes",
            "ServiceNow": "Yes", "Any one Certification": "Yes", "Student Mobile": "9876543211", "Hosteller/Dayscholar": "Hosteller",
            "Gender": "Female", "12th": 92.0, "Dip": 0, "UG CGPA Upto VI": 8.92, "ARREAR COUNT Upto VI": 0, "HISTORY OF ARREAR upto V": 0,
            "Personal Mail ID": "bhavani.sundaram@gmail.com"
        },
        {
            "S.No": 3, "Reg No": "71762104003", "Student Name": "Chirag Mehta", "Department": "Electronics and Communication",
            "Student Official Email ID": "chirag.m@college.edu", "Undertaking": "Yes", "Batch": "2023-2027", "Placed": "Yes",
            "Cisco": "No", "AI - navigate": "No", "Oracle": "No", "Maven Silicon VLSI": "Yes", "Embedded": "Yes", "Japanese": "No",
            "ServiceNow": "No", "Any one Certification": "Yes", "Student Mobile": "9876543212", "Hosteller/Dayscholar": "Dayscholar",
            "Gender": "Male", "12th": 81.0, "Dip": 0, "UG CGPA Upto VI": 7.82, "ARREAR COUNT Upto VI": 0, "HISTORY OF ARREAR upto V": 1,
            "Personal Mail ID": "chirag.m@gmail.com"
        },
        {
            "S.No": 4, "Reg No": "71762104004", "Student Name": "Deepika Krishnan", "Department": "Computer Science and Engineering",
            "Student Official Email ID": "deepika.k@college.edu", "Undertaking": "Yes", "Batch": "2023-2027", "Placed": "No",
            "Cisco": "Yes", "AI - navigate": "Yes", "Oracle": "Yes", "Maven Silicon VLSI": "No", "Embedded": "No", "Japanese": "No",
            "ServiceNow": "No", "Any one Certification": "Yes", "Student Mobile": "9876543213", "Hosteller/Dayscholar": "Hosteller",
            "Gender": "Female", "12th": 85.0, "Dip": 0, "UG CGPA Upto VI": 7.65, "ARREAR COUNT Upto VI": 0, "HISTORY OF ARREAR upto V": 0,
            "Personal Mail ID": "deepika.k@gmail.com"
        },
        {
            "S.No": 5, "Reg No": "71762104005", "Student Name": "Eashwar Natarajan", "Department": "Mechanical Engineering",
            "Student Official Email ID": "eashwar.n@college.edu", "Undertaking": "Yes", "Batch": "2023-2027", "Placed": "No",
            "Cisco": "No", "AI - navigate": "No", "Oracle": "No", "Maven Silicon VLSI": "No", "Embedded": "No", "Japanese": "No",
            "ServiceNow": "No", "Any one Certification": "No", "Student Mobile": "9876543214", "Hosteller/Dayscholar": "Dayscholar",
            "Gender": "Male", "12th": 76.5, "Dip": 0, "UG CGPA Upto VI": 6.70, "ARREAR COUNT Upto VI": 1, "HISTORY OF ARREAR upto V": 2,
            "Personal Mail ID": "eashwar.n@gmail.com"
        },
        {
            "S.No": 6, "Reg No": "71762104006", "Student Name": "Farhana Banu", "Department": "Artificial Intelligence and Data Science",
            "Student Official Email ID": "farhana.b@college.edu", "Undertaking": "Yes", "Batch": "2023-2027", "Placed": "Yes",
            "Cisco": "Yes", "AI - navigate": "Yes", "Oracle": "No", "Maven Silicon VLSI": "No", "Embedded": "No", "Japanese": "No",
            "ServiceNow": "Yes", "Any one Certification": "Yes", "Student Mobile": "9876543215", "Hosteller/Dayscholar": "Hosteller",
            "Gender": "Female", "12th": 89.0, "Dip": 0, "UG CGPA Upto VI": 8.60, "ARREAR COUNT Upto VI": 0, "HISTORY OF ARREAR upto V": 0,
            "Personal Mail ID": "farhana.b@gmail.com"
        },
        {
            "S.No": 7, "Reg No": "71762104007", "Student Name": "Gautham Velu", "Department": "Computer Science and Engineering",
            "Student Official Email ID": "gautham.v@college.edu", "Undertaking": "Yes", "Batch": "2023-2027", "Placed": "No",
            "Cisco": "No", "AI - navigate": "Yes", "Oracle": "No", "Maven Silicon VLSI": "No", "Embedded": "No", "Japanese": "No",
            "ServiceNow": "No", "Any one Certification": "Yes", "Student Mobile": "9876543216", "Hosteller/Dayscholar": "Dayscholar",
            "Gender": "Male", "12th": 68.0, "Dip": 0, "UG CGPA Upto VI": 6.85, "ARREAR COUNT Upto VI": 0, "HISTORY OF ARREAR upto V": 0,
            "Personal Mail ID": "gautham.v@gmail.com"
        },
        {
            "S.No": 8, "Reg No": "71762104008", "Student Name": "Harini V", "Department": "Electronics and Communication",
            "Student Official Email ID": "harini.v@college.edu", "Undertaking": "Yes", "Batch": "2023-2027", "Placed": "Yes",
            "Cisco": "Yes", "AI - navigate": "No", "Oracle": "No", "Maven Silicon VLSI": "Yes", "Embedded": "Yes", "Japanese": "No",
            "ServiceNow": "No", "Any one Certification": "Yes", "Student Mobile": "9876543217", "Hosteller/Dayscholar": "Hosteller",
            "Gender": "Female", "12th": 94.0, "Dip": 0, "UG CGPA Upto VI": 9.15, "ARREAR COUNT Upto VI": 0, "HISTORY OF ARREAR upto V": 0,
            "Personal Mail ID": "harini.v@gmail.com"
        }
    ]
    df_master = pd.DataFrame(master_rows)
    buf_master = io.BytesIO()
    df_master.to_excel(buf_master, index=False)

    # 2. Sample Placed Students Excel
    placed_rows = [
        {
            "S.No": 1, "Register No": "71762104002", "Name": "Bhavani Sundaram", "Department": "Information Technology",
            "Company Name": "Zoho Corporation", "Salary Package (LPA)": 6.0, "Internship Status": "Selected", "Internship Mode": "Hybrid",
            "Type": "Product", "Allowing Status": "Allowed", "Email ID": "bhavani.s@college.edu", "Student Contact No": "9876543211",
            "Organized by": "Placement Cell", "Offer Entry Date": "2026-08-15", "Joined Date": "2027-01-05", "Offered Date": "2026-08-14",
            "Offer reference no.": "ZOHO/2026/OFF/104", "Is that Interncum Placement Offer?": "Yes", "Appoinment Letter Date": "2026-09-01",
            "Appointment Letter reference no.": "ZOHO/APPT/884", "Appoinment Letter - Proof Link": "https://drive.google.com/proof1",
            "Offer - Proof Link": "https://drive.google.com/proof2", "Mail Proof": "https://drive.google.com/mail1",
            "Internship Letter": "https://drive.google.com/intern1", "Internship Cum Offer": "Yes"
        },
        {
            "S.No": 2, "Register No": "71762104003", "Name": "Chirag Mehta", "Department": "Electronics and Communication",
            "Company Name": "TCS Ninja", "Salary Package (LPA)": 3.6, "Internship Status": "No", "Internship Mode": "On-site",
            "Type": "Service", "Allowing Status": "Not Allowed", "Email ID": "chirag.m@college.edu", "Student Contact No": "9876543212",
            "Organized by": "Placement Cell", "Offer Entry Date": "2026-07-20", "Joined Date": "2027-06-15", "Offered Date": "2026-07-19",
            "Offer reference no.": "TCS/OFF/7741", "Is that Interncum Placement Offer?": "No", "Appoinment Letter Date": "2026-08-01",
            "Appointment Letter reference no.": "TCS/APPT/229", "Appoinment Letter - Proof Link": "https://drive.google.com/proof3",
            "Offer - Proof Link": "https://drive.google.com/proof4", "Mail Proof": "https://drive.google.com/mail2",
            "Internship Letter": "", "Internship Cum Offer": "No"
        },
        {
            "S.No": 3, "Register No": "71762104006", "Name": "Farhana Banu", "Department": "Artificial Intelligence and Data Science",
            "Company Name": "Rapid Data Technologies", "Salary Package (LPA)": 4.5, "Internship Status": "Underway", "Internship Mode": "Remote",
            "Type": "Service", "Allowing Status": "Dream Offer Allowed", "Email ID": "farhana.b@college.edu", "Student Contact No": "9876543215",
            "Organized by": "Placement Cell", "Offer Entry Date": "2026-08-25", "Joined Date": "2027-01-10", "Offered Date": "2026-08-24",
            "Offer reference no.": "RDT/OFF/901", "Is that Interncum Placement Offer?": "Yes", "Appoinment Letter Date": "2026-09-05",
            "Appointment Letter reference no.": "RDT/APPT/412", "Appoinment Letter - Proof Link": "https://drive.google.com/proof5",
            "Offer - Proof Link": "https://drive.google.com/proof6", "Mail Proof": "https://drive.google.com/mail3",
            "Internship Letter": "https://drive.google.com/intern3", "Internship Cum Offer": "Yes"
        },
        {
            "S.No": 4, "Register No": "71762104008", "Name": "Harini V", "Department": "Electronics and Communication",
            "Company Name": "Cadence Design Systems", "Salary Package (LPA)": 12.0, "Internship Status": "Selected", "Internship Mode": "On-site",
            "Type": "Product", "Allowing Status": "Not Allowed", "Email ID": "harini.v@college.edu", "Student Contact No": "9876543217",
            "Organized by": "Placement Cell", "Offer Entry Date": "2026-09-10", "Joined Date": "2027-01-15", "Offered Date": "2026-09-08",
            "Offer reference no.": "CAD/2026/889", "Is that Interncum Placement Offer?": "Yes", "Appoinment Letter Date": "2026-09-20",
            "Appointment Letter reference no.": "CAD/APPT/991", "Appoinment Letter - Proof Link": "https://drive.google.com/proof7",
            "Offer - Proof Link": "https://drive.google.com/proof8", "Mail Proof": "https://drive.google.com/mail4",
            "Internship Letter": "https://drive.google.com/intern4", "Internship Cum Offer": "Yes"
        }
    ]
    df_placed = pd.DataFrame(placed_rows)
    buf_placed = io.BytesIO()
    df_placed.to_excel(buf_placed, index=False)

    # 3. Sample JD Text
    sample_jd_text = """JOB DESCRIPTION - ON-CAMPUS RECRUITMENT DRIVE

Company Name: Presidio Cloud Solutions
Job Role: Associate Cloud Software Engineer
Salary Package: 8.5 LPA (CTC)
Batch: 2023-2027

Eligibility Criteria:
- Target Branches: B.E / B.Tech in CSE, IT, ECE, AIDS
- Minimum UG CGPA: 7.50 and above
- 10th & 12th Standard: 65% aggregate throughout academics
- Arrears Criteria: Zero standing arrears at the time of recruitment (0 Arrears)
- History of Arrears: Maximum up to 1 history of arrear allowed
- Certification: Candidates with ServiceNow, Cisco, or Cloud Certifications preferred
- Gender: Open for all eligible candidates (Male & Female)

Note on Placed Students:
Students already placed in mass/tier-2 companies are permitted to participate ONLY if they possess 'Allowed' or 'Dream Offer Allowed' clearance status from the Placement Cell.
"""

    return buf_master.getvalue(), buf_placed.getvalue(), sample_jd_text
