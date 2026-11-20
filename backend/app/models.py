from datetime import datetime

from sqlalchemy import Column, ForeignKey, Integer
from sqlmodel import Field, SQLModel

from .database import UTCDateTime, utcnow


class Link(SQLModel, table=True):
    __tablename__ = "links"

    id: int | None = Field(default=None, primary_key=True)
    code: str = Field(max_length=32, unique=True, index=True)
    target_url: str = Field(max_length=2048)
    title: str | None = Field(default=None, max_length=120)
    is_custom: bool = False
    is_active: bool = True
    expires_at: datetime | None = Field(default=None, sa_type=UTCDateTime)
    created_at: datetime = Field(default_factory=utcnow, sa_type=UTCDateTime)
    updated_at: datetime = Field(default_factory=utcnow, sa_type=UTCDateTime)

    def status(self, now: datetime) -> str:
        if not self.is_active:
            return "disabled"
        if self.expires_at is not None and self.expires_at <= now:
            return "expired"
        return "active"


class Click(SQLModel, table=True):
    __tablename__ = "clicks"

    id: int | None = Field(default=None, primary_key=True)
    link_id: int = Field(
        sa_column=Column(Integer, ForeignKey("links.id", ondelete="CASCADE"), index=True)
    )
    clicked_at: datetime = Field(default_factory=utcnow, sa_type=UTCDateTime, index=True)
    # hash of ip + user agent, enough to count unique visitors without storing either
    visitor_id: str = Field(max_length=32)
    referrer: str | None = Field(default=None, max_length=255)
    country: str | None = Field(default=None, max_length=2)
    device: str = Field(default="desktop", max_length=16)
    browser: str = Field(default="Other", max_length=32)
    os: str = Field(default="Other", max_length=32)
