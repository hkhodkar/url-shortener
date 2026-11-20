from typing import Annotated

from fastapi import APIRouter, Depends, Request
from sqlmodel import Session

from .. import services
from ..database import get_session, utcnow
from ..schemas import Summary

router = APIRouter(tags=["summary"])


@router.get("/summary", response_model=Summary)
def get_summary(request: Request, session: Annotated[Session, Depends(get_session)]):
    """Totals, the last 30 days of clicks and the top links for the dashboard."""
    return services.summary(session, utcnow(), request.app.state.settings.short_base_url)
