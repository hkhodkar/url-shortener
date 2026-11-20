from collections.abc import Callable
from datetime import UTC, date, datetime, time, timedelta

from fastapi import HTTPException
from sqlalchemy import ColumnElement, and_, or_
from sqlmodel import Session, col, func, select

from .models import Click, Link
from .schemas import BreakdownItem, LinkRead, LinkStats, Page, Summary, TimelinePoint

SORT_FIELDS = ("created_at", "clicks", "title", "expires_at", "code")
BREAKDOWN_LIMIT = 10


def _click_totals():
    return (
        select(
            Click.link_id,
            func.count(col(Click.id)).label("clicks"),
            func.max(Click.clicked_at).label("last_clicked_at"),
        )
        .group_by(Click.link_id)
        .subquery()
    )


def to_read(
    link: Link, clicks: int, last_clicked_at: datetime | None, now: datetime, base_url: str
) -> LinkRead:
    return LinkRead(
        id=link.id,
        code=link.code,
        short_url=f"{base_url}/{link.code}",
        target_url=link.target_url,
        title=link.title,
        is_custom=link.is_custom,
        is_active=link.is_active,
        status=link.status(now),
        expires_at=link.expires_at,
        clicks=clicks,
        last_clicked_at=last_clicked_at,
        created_at=link.created_at,
        updated_at=link.updated_at,
    )


def status_filter(status: str, now: datetime) -> ColumnElement[bool]:
    not_expired = or_(col(Link.expires_at).is_(None), col(Link.expires_at) > now)
    if status == "disabled":
        return col(Link.is_active).is_(False)
    if status == "expired":
        return and_(col(Link.is_active).is_(True), col(Link.expires_at) <= now)
    return and_(col(Link.is_active).is_(True), not_expired)


def list_links(
    session: Session,
    *,
    now: datetime,
    base_url: str,
    search: str | None,
    status: str | None,
    sort: str,
    page: int,
    page_size: int,
) -> Page[LinkRead]:
    totals = _click_totals()
    clicks = func.coalesce(totals.c.clicks, 0)
    query = select(Link, clicks, totals.c.last_clicked_at).outerjoin(
        totals, totals.c.link_id == Link.id
    )
    term = (search or "").strip().lower()
    if term:
        query = query.where(
            or_(
                *(
                    func.lower(field).contains(term, autoescape=True)
                    for field in (col(Link.title), col(Link.code), col(Link.target_url))
                )
            )
        )
    if status:
        query = query.where(status_filter(status, now))

    total = session.exec(select(func.count()).select_from(query.subquery())).one()

    descending = sort.startswith("-")
    field = sort.lstrip("-")
    order: list = []
    if field == "expires_at":
        # links without an expiry date always go last
        order.append(col(Link.expires_at).is_(None))
    column = {
        "created_at": col(Link.created_at),
        "clicks": clicks,
        "title": func.lower(func.coalesce(col(Link.title), col(Link.target_url))),
        "expires_at": col(Link.expires_at),
        "code": col(Link.code),
    }[field]
    order.append(column.desc() if descending else column.asc())
    order.append(col(Link.id).desc())

    rows = session.exec(
        query.order_by(*order).offset((page - 1) * page_size).limit(page_size)
    ).all()
    return Page[LinkRead](
        items=[to_read(link, n, last, now, base_url) for link, n, last in rows],
        total=total,
        page=page,
        page_size=page_size,
    )


def get_link(session: Session, code: str) -> Link:
    link = session.exec(select(Link).where(Link.code == code)).first()
    if link is None:
        raise HTTPException(status_code=404, detail="Link not found")
    return link


def read_link(session: Session, link: Link, now: datetime, base_url: str) -> LinkRead:
    clicks, last = session.exec(
        select(func.count(col(Click.id)), func.max(Click.clicked_at)).where(
            Click.link_id == link.id
        )
    ).one()
    return to_read(link, clicks, last, now, base_url)


def alias_taken(session: Session, alias: str) -> bool:
    query = select(Link.id).where(func.lower(Link.code) == alias.lower())
    return session.exec(query).first() is not None


def _day_start(day: date) -> datetime:
    return datetime.combine(day, time.min, tzinfo=UTC)


def _timeline(session: Session, start: date, end: date, *where) -> list[TimelinePoint]:
    day = func.date(Click.clicked_at)
    rows = session.exec(
        select(day, func.count(), func.count(func.distinct(Click.visitor_id)))
        .where(Click.clicked_at >= _day_start(start), *where)
        .group_by(day)
    ).all()
    by_day = {date.fromisoformat(d): (n, unique) for d, n, unique in rows}
    points = []
    current = start
    while current <= end:
        clicks, unique = by_day.get(current, (0, 0))
        points.append(TimelinePoint(date=current, clicks=clicks, unique_visitors=unique))
        current += timedelta(days=1)
    return points


def _breakdown(session: Session, column, label: Callable[[str | None], str], *where):
    rows = session.exec(select(column, func.count()).where(*where).group_by(column)).all()
    items = [BreakdownItem(label=label(value), count=n) for value, n in rows]
    items.sort(key=lambda item: (-item.count, item.label))
    return items[:BREAKDOWN_LIMIT]


def link_stats(session: Session, link: Link, days: int, now: datetime) -> LinkStats:
    end = now.date()
    start = end - timedelta(days=days - 1)
    in_range = (Click.link_id == link.id, Click.clicked_at >= _day_start(start))

    total, unique = session.exec(
        select(func.count(), func.count(func.distinct(Click.visitor_id))).where(*in_range)
    ).one()
    all_time = session.exec(
        select(func.count()).select_from(Click).where(Click.link_id == link.id)
    ).one()

    def same(value: str | None) -> str:
        return value or "Other"

    return LinkStats(
        code=link.code,
        range=days,
        start=start,
        end=end,
        total_clicks=total,
        unique_visitors=unique,
        all_time_clicks=all_time,
        timeline=_timeline(session, start, end, Click.link_id == link.id),
        referrers=_breakdown(session, Click.referrer, lambda v: v or "Direct", *in_range),
        countries=_breakdown(session, Click.country, lambda v: v or "Unknown", *in_range),
        devices=_breakdown(session, Click.device, same, *in_range),
        browsers=_breakdown(session, Click.browser, same, *in_range),
        operating_systems=_breakdown(session, Click.os, same, *in_range),
    )


def summary(session: Session, now: datetime, base_url: str) -> Summary:
    today = now.date()
    week_start = _day_start(today - timedelta(days=6))
    previous_start = week_start - timedelta(days=7)

    def count_clicks(*where) -> int:
        return session.exec(select(func.count()).select_from(Click).where(*where)).one()

    total_links = session.exec(select(func.count()).select_from(Link)).one()
    active_links = session.exec(
        select(func.count()).select_from(Link).where(status_filter("active", now))
    ).one()

    def links(sort: str) -> list[LinkRead]:
        return list_links(
            session,
            now=now,
            base_url=base_url,
            search=None,
            status=None,
            sort=sort,
            page=1,
            page_size=5,
        ).items

    return Summary(
        total_links=total_links,
        active_links=active_links,
        total_clicks=count_clicks(),
        clicks_last_7_days=count_clicks(Click.clicked_at >= week_start),
        clicks_previous_7_days=count_clicks(
            Click.clicked_at >= previous_start, Click.clicked_at < week_start
        ),
        timeline=_timeline(session, today - timedelta(days=29), today),
        top_links=links("-clicks"),
        recent_links=links("-created_at"),
    )
