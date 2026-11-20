from datetime import datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from sqlmodel import Session

from .. import services
from ..codes import alias_problem, random_code
from ..database import get_session, utcnow
from ..models import Link
from ..schemas import (
    AliasCheck,
    ErrorBody,
    LinkCreate,
    LinkRead,
    LinkStats,
    LinkStatus,
    LinkUpdate,
    Page,
)

router = APIRouter(prefix="/links", tags=["links"])

SessionDep = Annotated[Session, Depends(get_session)]
SortParam = Literal[
    "created_at",
    "-created_at",
    "clicks",
    "-clicks",
    "title",
    "-title",
    "expires_at",
    "-expires_at",
    "code",
    "-code",
]
STATS_RANGES = (7, 30, 90)
NOT_FOUND = {404: {"model": ErrorBody, "description": "No link with this code"}}


def _base_url(request: Request) -> str:
    return request.app.state.settings.short_base_url


def _ensure_future(expires_at: datetime | None, now: datetime) -> None:
    if expires_at is None:
        return
    if expires_at.tzinfo is None:
        raise HTTPException(422, "expires_at needs a timezone, e.g. 2026-12-31T23:59:59Z")
    if expires_at <= now:
        raise HTTPException(422, "The expiry date must be in the future")


@router.get("", response_model=Page[LinkRead])
def list_links(
    request: Request,
    session: SessionDep,
    search: Annotated[str | None, Query(max_length=100)] = None,
    status: LinkStatus | None = None,
    sort: SortParam = "-created_at",
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 10,
):
    return services.list_links(
        session,
        now=utcnow(),
        base_url=_base_url(request),
        search=search,
        status=status,
        sort=sort,
        page=page,
        page_size=page_size,
    )


@router.get("/check-alias", response_model=AliasCheck)
def check_alias(session: SessionDep, alias: Annotated[str, Query(max_length=64)]):
    """Tells the form whether a custom alias can still be used."""
    alias = alias.strip()
    problem = alias_problem(alias)
    if problem:
        return AliasCheck(alias=alias, available=False, reason=problem)
    if services.alias_taken(session, alias):
        return AliasCheck(alias=alias, available=False, reason="This alias is already taken")
    return AliasCheck(alias=alias, available=True)


@router.post(
    "",
    response_model=LinkRead,
    status_code=201,
    responses={409: {"model": ErrorBody, "description": "Alias already taken"}},
)
def create_link(request: Request, session: SessionDep, payload: LinkCreate):
    now = utcnow()
    _ensure_future(payload.expires_at, now)
    if payload.alias:
        if services.alias_taken(session, payload.alias):
            raise HTTPException(409, f"The alias '{payload.alias}' is already taken")
        code = payload.alias
    else:
        code = random_code()
        while services.alias_taken(session, code):
            code = random_code()

    link = Link(
        code=code,
        target_url=payload.target_url,
        title=payload.title,
        is_custom=payload.alias is not None,
        expires_at=payload.expires_at,
        created_at=now,
        updated_at=now,
    )
    session.add(link)
    session.commit()
    session.refresh(link)
    return services.to_read(link, 0, None, now, _base_url(request))


@router.get("/{code}", response_model=LinkRead, responses=NOT_FOUND)
def get_link(request: Request, session: SessionDep, code: str):
    link = services.get_link(session, code)
    return services.read_link(session, link, utcnow(), _base_url(request))


@router.patch("/{code}", response_model=LinkRead, responses=NOT_FOUND)
def update_link(request: Request, session: SessionDep, code: str, payload: LinkUpdate):
    """Only the fields sent are changed. Send `expires_at: null` to remove the expiry."""
    link = services.get_link(session, code)
    now = utcnow()
    changes = payload.model_dump(exclude_unset=True)
    for field in ("target_url", "is_active"):
        if field in changes and changes[field] is None:
            raise HTTPException(422, f"{field} cannot be empty")
    if "expires_at" in changes:
        _ensure_future(changes["expires_at"], now)

    for field, value in changes.items():
        setattr(link, field, value)
    if changes:
        link.updated_at = now
    session.add(link)
    session.commit()
    session.refresh(link)
    return services.read_link(session, link, now, _base_url(request))


@router.delete("/{code}", status_code=204, responses=NOT_FOUND)
def delete_link(session: SessionDep, code: str):
    link = services.get_link(session, code)
    session.delete(link)
    session.commit()
    return Response(status_code=204)


@router.get("/{code}/stats", response_model=LinkStats, responses=NOT_FOUND)
def link_stats(
    session: SessionDep,
    code: str,
    days: Annotated[int, Query(alias="range", description="7, 30 or 90 days")] = 30,
):
    """Clicks of the last 7, 30 or 90 days (UTC), including today."""
    if days not in STATS_RANGES:
        raise HTTPException(422, "range must be 7, 30 or 90")
    link = services.get_link(session, code)
    return services.link_stats(session, link, days, utcnow())
