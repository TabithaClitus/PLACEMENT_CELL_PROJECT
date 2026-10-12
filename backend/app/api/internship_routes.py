from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.models.admin_user import AdminUser
from app.services.internship_offer_service import get_internship_records
from app.utils.security import get_current_admin

router = APIRouter(prefix="/admin/internships", tags=["Admin Internships"])


def _match_ctc(ctc_lpa: Optional[float], ctc_display: str, query: str) -> bool:
    q = query.strip()
    if not q:
        return True
    if ctc_display and q.lower() in ctc_display.lower():
        return True
    try:
        q_num = float(q)
        if ctc_lpa is not None and abs(ctc_lpa - q_num) < 1e-9:
            return True
        if ctc_lpa is not None and str(int(ctc_lpa) if ctc_lpa.is_integer() else ctc_lpa).startswith(q):
            return True
    except ValueError:
        pass
    return False


@router.get("")
async def list_internships_endpoint(
    internship_status: Optional[str] = Query(None, description="Joined / Not Joined"),
    internship_mode: Optional[str] = Query(
        None, description="Offline, Online, or __EMPTY__ for blank mode"
    ),
    company_type: Optional[str] = Query(None, description="CORE, ITP, ITS, ITF, etc."),
    organized_by: Optional[str] = Query(None, description="DEPT, SELF, T&P, etc."),
    company_search: Optional[str] = Query(None, description="Substring match on company name"),
    ctc_search: Optional[str] = Query(None, description="Substring or numeric match on CTC (LPA)"),
    current_admin: AdminUser = Depends(get_current_admin),
) -> dict[str, Any]:
    try:
        payload = get_internship_records()
    except FileNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    items = payload["items"]

    if internship_status and internship_status.strip():
        want = internship_status.strip()
        items = [i for i in items if i["internship_status"] == want]

    if internship_mode and internship_mode.strip():
        mode = internship_mode.strip()
        if mode == "__EMPTY__":
            items = [i for i in items if not i["internship_mode"]]
        else:
            items = [i for i in items if i["internship_mode"].lower() == mode.lower()]

    if company_type and company_type.strip():
        want = company_type.strip()
        items = [i for i in items if i["company_type"].upper() == want.upper()]

    if organized_by and organized_by.strip():
        want = organized_by.strip()
        items = [i for i in items if i["organized_by"] == want]

    if company_search and company_search.strip():
        term = company_search.strip().lower()
        items = [i for i in items if term in i["company_name"].lower()]

    if ctc_search and ctc_search.strip():
        q = ctc_search.strip()
        items = [
            i
            for i in items
            if _match_ctc(i.get("ctc_lpa"), i.get("ctc_display", ""), q)
        ]

    return {
        "items": items,
        "total": len(items),
        "filter_options": payload["filter_options"],
        "source_file": payload["source_file"],
    }
