"""Load internship offer rows from the batch Excel workbook (Offers sheet only)."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Any

import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parents[3]
OFFER_EXCEL_PATH = PROJECT_ROOT / "Offer Details - 2023-2027 Batch.xlsx"
OFFERS_SHEET = "Offers"


def _cell_str(value: Any) -> str:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return ""
    return str(value).strip()


def _normalize_mode(raw: str) -> str:
    if not raw:
        return ""
    lower = raw.lower()
    if lower == "offline":
        return "Offline"
    if lower == "online":
        return "Online"
    return raw.strip()


def _ctc_display(value: Any) -> str:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return ""
    if isinstance(value, (int, float)):
        if float(value).is_integer():
            return str(int(value))
        return str(value)
    return str(value).strip()


def _ctc_number(value: Any) -> float | None:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


@lru_cache(maxsize=1)
def _load_dataframe() -> pd.DataFrame:
    if not OFFER_EXCEL_PATH.is_file():
        raise FileNotFoundError(f"Internship Excel not found: {OFFER_EXCEL_PATH}")
    return pd.read_excel(OFFER_EXCEL_PATH, sheet_name=OFFERS_SHEET)


def clear_internship_cache() -> None:
    _load_dataframe.cache_clear()


def get_internship_records() -> dict[str, Any]:
    df = _load_dataframe()
    items: list[dict[str, Any]] = []

    for _, row in df.iterrows():
        status = _cell_str(row.get("Internship Status"))
        mode = _normalize_mode(_cell_str(row.get("Internship Mode")))
        company_type = _cell_str(row.get("Type"))
        organized_by = _cell_str(row.get("Organized by"))
        company = _cell_str(row.get("Company Name"))
        ctc_raw = row.get("Salary Package (LPA)")

        items.append(
            {
                "s_no": int(row["S.No"]) if pd.notna(row.get("S.No")) else None,
                "register_number": _cell_str(row.get("Register No")),
                "full_name": _cell_str(row.get("Name")),
                "department": _cell_str(row.get("Department")),
                "company_name": company,
                "ctc_lpa": _ctc_number(ctc_raw),
                "ctc_display": _ctc_display(ctc_raw),
                "internship_status": status,
                "internship_mode": mode,
                "company_type": company_type,
                "organized_by": organized_by,
                "allowing_status": _cell_str(row.get("Allowing Status")),
                "email": _cell_str(row.get("Email ID")),
                "contact": _cell_str(row.get("Student Contact No")),
            }
        )

    statuses = sorted({i["internship_status"] for i in items if i["internship_status"]})
    modes = sorted({i["internship_mode"] for i in items if i["internship_mode"]})
    types = sorted({i["company_type"] for i in items if i["company_type"]})
    organizers = sorted({i["organized_by"] for i in items if i["organized_by"]})

    return {
        "items": items,
        "total": len(items),
        "filter_options": {
            "internship_statuses": statuses,
            "internship_modes": modes,
            "company_types": types,
            "organized_by": organizers,
        },
        "source_file": OFFER_EXCEL_PATH.name,
    }
