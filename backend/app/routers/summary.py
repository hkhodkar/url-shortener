from typing import Annotated

from fastapi import APIRouter, Depends, Request
from sqlmodel import Session

from .. import services
from ..codes import ALIAS_MAX_LENGTH, ALIAS_MIN_LENGTH, RESERVED_WORDS
from ..database import get_session, utcnow
from ..schemas import Meta, Summary

router = APIRouter(tags=["summary"])


@router.get("/summary", response_model=Summary)
def get_summary(request: Request, session: Annotated[Session, Depends(get_session)]):
    """Totals, the last 30 days of clicks and the top links for the dashboard."""
    return services.summary(session, utcnow(), request.app.state.settings.short_base_url)


@router.get("/meta", response_model=Meta, tags=["meta"])
def get_meta(request: Request):
    """Settings the frontend needs, like the address short links start with."""
    return Meta(
        short_base_url=request.app.state.settings.short_base_url,
        alias_min_length=ALIAS_MIN_LENGTH,
        alias_max_length=ALIAS_MAX_LENGTH,
        reserved_words=sorted(RESERVED_WORDS),
    )
