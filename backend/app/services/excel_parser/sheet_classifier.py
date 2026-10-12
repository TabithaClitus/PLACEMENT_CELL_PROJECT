from typing import Any
from app.services.excel_parser.parser_models import SheetCategory

CATEGORY_KEYWORDS = {
    SheetCategory.PLACED: [
        "offer list", "offered list", "final selects", "final select",
        "final selection", "placed", "offer", "offered", "selects"
    ],
    SheetCategory.PROGRESSION: [
        "round", "technical", "aptitude", "interview",
        "assessment", "test", "screening", "coding", "lab test",
        "design round", "selected", "level", "hr", "personal hr", "technical hr"
    ],
    SheetCategory.REGISTERED: [
        "registration", "registered", "registration list", "master list",
        "applied", "eligible list", "shortlisted students", "sheet1", "overall", "list", "final list", "total registered"
    ],
    SheetCategory.IGNORE: [
        "instructions", "pivot", "template", "sample", "declaration",
        "xerox", "absent", "ab", "summary", "exception list"
    ]
}


def classify_sheet(
    sheet_name: str,
    total_valid_records: int = 0,
    has_register_column: bool = True
) -> tuple[SheetCategory, float]:
    """
    Classifies a worksheet into REGISTERED, PROGRESSION, PLACED, UNKNOWN, or IGNORE.
    Returns:
        (SheetCategory, confidence_score)
    """
    name_clean = sheet_name.strip().lower()

    # Empty / Irrelevant sheet check
    if total_valid_records == 0 or not has_register_column:
        if any(kw in name_clean for kw in CATEGORY_KEYWORDS[SheetCategory.IGNORE]) or total_valid_records == 0:
            return SheetCategory.IGNORE, 1.0

    # Definite IGNORE keywords check (absent list, xerox, summary, etc.)
    if name_clean in ("ab", "absent", "xerox", "summary") or any(
        kw in name_clean for kw in ["instructions", "pivot", "template", "sample", "declaration", "exception list"]
    ):
        return SheetCategory.IGNORE, 0.95

    # 1. PLACED check (Highest precedence for definitive offer lists)
    if any(kw in name_clean for kw in ["offer", "final select", "final selection", "placed"]):
        return SheetCategory.PLACED, 0.95

    # 2. Ambiguous "selected" check:
    # If "selected" is accompanied by "round" or "screening" (e.g. "Selected - Round 2"), it is PROGRESSION
    if "selected" in name_clean:
        if any(kw in name_clean for kw in ["round", "screening", "test", "lab"]):
            return SheetCategory.PROGRESSION, 0.90
        return SheetCategory.PLACED, 0.75

    # 3. REGISTERED check (Before general progression check so 'Shortlisted Students' or 'List' becomes REGISTERED)
    if any(kw in name_clean for kw in CATEGORY_KEYWORDS[SheetCategory.REGISTERED]):
        return SheetCategory.REGISTERED, 0.85

    # 4. PROGRESSION check
    if any(kw in name_clean for kw in CATEGORY_KEYWORDS[SheetCategory.PROGRESSION]):
        return SheetCategory.PROGRESSION, 0.90

    # Default fallback based on record presence
    if total_valid_records > 0 and has_register_column:
        return SheetCategory.PROGRESSION, 0.60

    return SheetCategory.IGNORE, 0.90
