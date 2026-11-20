from datetime import date, datetime
from typing import Annotated, Literal
from urllib.parse import urlsplit

from pydantic import (
    AfterValidator,
    BaseModel,
    ConfigDict,
    Field,
    StringConstraints,
    field_validator,
)

from .codes import alias_problem

LinkStatus = Literal["active", "expired", "disabled"]


def _check_url(value: str) -> str:
    parts = urlsplit(value)
    if parts.scheme not in {"http", "https"}:
        raise ValueError("URL must start with http:// or https://")
    host = parts.hostname or ""
    if not host or (" " in value):
        raise ValueError("Enter a valid URL")
    if "." not in host and host != "localhost":
        raise ValueError("Enter a valid URL")
    return value


def _empty_to_none(value: str | None) -> str | None:
    return value or None


TargetUrl = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=2048),
    AfterValidator(_check_url),
]
Title = Annotated[
    str | None,
    StringConstraints(strip_whitespace=True, max_length=120),
    AfterValidator(_empty_to_none),
]


class LinkCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    target_url: TargetUrl
    alias: Annotated[str | None, StringConstraints(strip_whitespace=True)] = None
    title: Title = None
    expires_at: datetime | None = None

    @field_validator("alias")
    @classmethod
    def _valid_alias(cls, value: str | None) -> str | None:
        if not value:
            return None
        problem = alias_problem(value)
        if problem:
            raise ValueError(problem)
        return value


class LinkUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    target_url: TargetUrl | None = None
    title: Title = None
    expires_at: datetime | None = None
    is_active: bool | None = None


class LinkRead(BaseModel):
    id: int
    code: str
    short_url: str
    target_url: str
    title: str | None
    is_custom: bool
    is_active: bool
    status: LinkStatus
    expires_at: datetime | None
    clicks: int
    last_clicked_at: datetime | None
    created_at: datetime
    updated_at: datetime


class Page[T](BaseModel):
    items: list[T]
    total: int
    page: int
    page_size: int


class AliasCheck(BaseModel):
    alias: str
    available: bool
    reason: str | None = None


class TimelinePoint(BaseModel):
    date: date
    clicks: int
    unique_visitors: int


class BreakdownItem(BaseModel):
    label: str
    count: int


class LinkStats(BaseModel):
    code: str
    range: int
    start: date
    end: date
    total_clicks: int
    unique_visitors: int
    all_time_clicks: int
    timeline: list[TimelinePoint]
    referrers: list[BreakdownItem]
    countries: list[BreakdownItem]
    devices: list[BreakdownItem]
    browsers: list[BreakdownItem]
    operating_systems: list[BreakdownItem]


class Summary(BaseModel):
    total_links: int
    active_links: int
    total_clicks: int
    clicks_last_7_days: int
    clicks_previous_7_days: int
    timeline: list[TimelinePoint]
    top_links: list[LinkRead]
    recent_links: list[LinkRead]


class Meta(BaseModel):
    short_base_url: str
    alias_min_length: int
    alias_max_length: int
    reserved_words: list[str]


class ErrorBody(BaseModel):
    detail: str = Field(examples=["Link not found"])
