"""Demo links with three months of generated clicks.

The click generator uses a small seeded PRNG (mulberry32) and no float math
beyond + - * /, so the frontend's demo mode produces exactly the same data.
"""

import math
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy import insert
from sqlmodel import Session, func, select

from .models import Click, Link

SEED = 20260611
HISTORY_DAYS = 90
DAY = 86_400

REFERRERS: dict[str, list[tuple[str | None, float]]] = {
    "social": [
        (None, 30),
        ("x.com", 22),
        ("linkedin.com", 18),
        ("reddit.com", 10),
        ("facebook.com", 8),
        ("news.ycombinator.com", 6),
        ("google.com", 6),
    ],
    "dev": [
        (None, 25),
        ("github.com", 22),
        ("google.com", 20),
        ("stackoverflow.com", 12),
        ("news.ycombinator.com", 8),
        ("reddit.com", 7),
        ("dev.to", 6),
    ],
    "email": [
        (None, 45),
        ("mail.google.com", 25),
        ("outlook.live.com", 15),
        ("linkedin.com", 8),
        ("x.com", 7),
    ],
    "search": [
        (None, 20),
        ("google.com", 45),
        ("bing.com", 10),
        ("linkedin.com", 10),
        ("duckduckgo.com", 8),
        ("x.com", 7),
    ],
}

COUNTRIES: dict[str, list[tuple[str | None, float]]] = {
    "global": [
        ("US", 30),
        ("DE", 10),
        ("GB", 9),
        ("IN", 9),
        ("CA", 6),
        ("FR", 5),
        ("NL", 4),
        ("BR", 4),
        ("AU", 3),
        ("ES", 3),
        ("SE", 2),
        ("PL", 2),
        ("JP", 2),
        (None, 2),
    ],
    "europe": [
        ("DE", 22),
        ("GB", 14),
        ("FR", 12),
        ("NL", 10),
        ("ES", 8),
        ("IT", 7),
        ("SE", 6),
        ("PL", 6),
        ("US", 5),
        ("AT", 4),
        ("CH", 4),
        (None, 2),
    ],
    "us": [
        ("US", 55),
        ("CA", 12),
        ("GB", 6),
        ("IN", 6),
        ("MX", 5),
        ("DE", 4),
        ("BR", 4),
        ("AU", 4),
        (None, 2),
    ],
}

# device, browser, os, weight
AGENTS: list[tuple[str, str, str, float]] = [
    ("desktop", "Chrome", "Windows", 24),
    ("desktop", "Chrome", "macOS", 12),
    ("desktop", "Safari", "macOS", 7),
    ("desktop", "Edge", "Windows", 7),
    ("desktop", "Firefox", "Windows", 4),
    ("desktop", "Firefox", "Linux", 2),
    ("desktop", "Chrome", "Linux", 2),
    ("mobile", "Safari", "iOS", 18),
    ("mobile", "Chrome", "Android", 15),
    ("mobile", "Samsung Internet", "Android", 3),
    ("mobile", "Chrome", "iOS", 2),
    ("tablet", "Safari", "iOS", 3),
    ("tablet", "Chrome", "Android", 1),
]

# traffic by UTC weekday, Sunday first
WEEKDAY_FACTOR = [0.7, 1.05, 1.15, 1.12, 1.08, 1.0, 0.78]


@dataclass(frozen=True)
class DemoLink:
    code: str
    target_url: str
    title: str | None
    is_custom: bool
    created_days_ago: int
    popularity: float
    shape: str  # steady, launch, growing or campaign
    referrers: str
    region: str
    mobile_bias: float = 1
    expires_in_days: int | None = None  # negative means it already expired
    disabled_days_ago: int | None = None
    spike_days_ago: int | None = None


DEMO_LINKS = [
    DemoLink(
        code="angular-signals",
        target_url="https://angular.dev/guide/signals",
        title="Angular signals guide",
        is_custom=True,
        created_days_ago=120,
        popularity=7,
        shape="steady",
        referrers="dev",
        region="global",
    ),
    DemoLink(
        code="spring-sale",
        target_url="https://shop.example.com/collections/spring-sale?utm_source=newsletter",
        title="Spring sale landing page",
        is_custom=True,
        created_days_ago=80,
        popularity=8,
        shape="launch",
        referrers="email",
        region="us",
        mobile_bias=1.6,
        expires_in_days=-21,
    ),
    DemoLink(
        code="portfolio",
        target_url="https://github.com/hkhodkar",
        title="GitHub profile",
        is_custom=True,
        created_days_ago=150,
        popularity=4,
        shape="steady",
        referrers="social",
        region="global",
    ),
    DemoLink(
        code="fJ3kQ9a",
        target_url="https://fastapi.tiangolo.com/tutorial/sql-databases/",
        title="FastAPI SQL databases tutorial",
        is_custom=False,
        created_days_ago=64,
        popularity=3.5,
        shape="growing",
        referrers="dev",
        region="global",
    ),
    DemoLink(
        code="webinar-nov",
        target_url="https://events.example.com/webinars/scaling-frontend-teams",
        title="Webinar: scaling frontend teams",
        is_custom=True,
        created_days_ago=35,
        popularity=4,
        shape="campaign",
        referrers="social",
        region="europe",
        mobile_bias=0.8,
        expires_in_days=12,
        spike_days_ago=9,
    ),
    DemoLink(
        code="Xb81mPq",
        target_url="https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/302",
        title="MDN: 302 Found",
        is_custom=False,
        created_days_ago=95,
        popularity=2.5,
        shape="steady",
        referrers="search",
        region="global",
    ),
    DemoLink(
        code="careers",
        target_url="https://jobs.example.com/careers/senior-frontend-engineer",
        title="Senior frontend engineer job post",
        is_custom=True,
        created_days_ago=28,
        popularity=5,
        shape="launch",
        referrers="social",
        region="europe",
        expires_in_days=30,
    ),
    DemoLink(
        code="release-notes",
        target_url="https://github.com/angular/angular/releases",
        title="Angular release notes",
        is_custom=True,
        created_days_ago=70,
        popularity=3,
        shape="steady",
        referrers="dev",
        region="global",
    ),
    DemoLink(
        code="q3-report",
        target_url="https://files.example.com/reports/q3-2026.pdf",
        title="Q3 2026 report (PDF)",
        is_custom=True,
        created_days_ago=58,
        popularity=3,
        shape="launch",
        referrers="email",
        region="us",
        disabled_days_ago=15,
    ),
    DemoLink(
        code="Lm4Tz2w",
        target_url="https://www.typescriptlang.org/docs/handbook/2/generics.html",
        title="TypeScript generics handbook",
        is_custom=False,
        created_days_ago=45,
        popularity=2.5,
        shape="growing",
        referrers="search",
        region="global",
    ),
    DemoLink(
        code="newsletter-42",
        target_url="https://newsletter.example.com/issues/42",
        title="Newsletter #42",
        is_custom=True,
        created_days_ago=20,
        popularity=6,
        shape="launch",
        referrers="email",
        region="europe",
        mobile_bias=1.4,
    ),
    DemoLink(
        code="k9Vd0Rs",
        target_url="https://sqlmodel.tiangolo.com/",
        title=None,
        is_custom=False,
        created_days_ago=52,
        popularity=2,
        shape="steady",
        referrers="dev",
        region="us",
    ),
    DemoLink(
        code="black-friday",
        target_url="https://shop.example.com/black-friday",
        title="Black Friday deals",
        is_custom=True,
        created_days_ago=18,
        popularity=5,
        shape="growing",
        referrers="social",
        region="us",
        mobile_bias=1.8,
        expires_in_days=9,
    ),
    DemoLink(
        code="survey-2026",
        target_url="https://forms.example.com/s/customer-survey-2026",
        title="Customer survey 2026",
        is_custom=True,
        created_days_ago=33,
        popularity=4,
        shape="campaign",
        referrers="email",
        region="europe",
        expires_in_days=-3,
        spike_days_ago=30,
    ),
    DemoLink(
        code="Qe7hN1c",
        target_url="https://www.chartjs.org/docs/latest/",
        title="Chart.js docs",
        is_custom=False,
        created_days_ago=6,
        popularity=2,
        shape="steady",
        referrers="dev",
        region="global",
    ),
]


class Mulberry32:
    """Tiny seeded PRNG, matches the JavaScript version bit for bit."""

    def __init__(self, seed: int) -> None:
        self.state = seed & 0xFFFFFFFF

    def __call__(self) -> float:
        self.state = (self.state + 0x6D2B79F5) & 0xFFFFFFFF
        a = self.state
        t = _imul(a ^ (a >> 15), 1 | a)
        t = ((t + _imul(t ^ (t >> 7), 61 | t)) & 0xFFFFFFFF) ^ t
        return ((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296


def _imul(a: int, b: int) -> int:
    return (a * b) & 0xFFFFFFFF


def _pick[T](rng: Mulberry32, items: list[tuple[T, float]]) -> T:
    total = 0.0
    for _, weight in items:
        total += weight
    r = rng() * total
    cumulative = 0.0
    for value, weight in items:
        cumulative += weight
        if r < cumulative:
            return value
    return items[-1][0]


def _shape_factor(link: DemoLink, days_ago: int) -> float:
    age = link.created_days_ago - days_ago
    if link.shape == "launch":
        return 1 + 6 / (1 + age)
    if link.shape == "growing":
        return 0.25 + 1.5 * age / link.created_days_ago
    if link.shape == "campaign" and link.spike_days_ago is not None:
        if days_ago == link.spike_days_ago:
            return 4
        if days_ago == link.spike_days_ago - 1:
            return 2.2
    return 1


def build_demo_data(now: datetime) -> tuple[list[Link], list[list[dict]]]:
    """Links plus, for each link, its clicks as plain dicts."""
    rng = Mulberry32(SEED)
    today = datetime(now.year, now.month, now.day, tzinfo=UTC)
    elapsed_today = int((now - today).total_seconds())

    links: list[Link] = []
    clicks: list[list[dict]] = []
    for index, demo in enumerate(DEMO_LINKS):
        created_at = today - timedelta(days=demo.created_days_ago, minutes=-(index * 37 % 60 + 540))
        expires_at = None
        if demo.expires_in_days is not None:
            if demo.expires_in_days < 0:
                expires_at = today + timedelta(days=demo.expires_in_days, hours=12)
            else:
                expires_at = today + timedelta(days=demo.expires_in_days + 1, seconds=-1)
        updated_at = created_at
        if demo.disabled_days_ago is not None:
            updated_at = today - timedelta(days=demo.disabled_days_ago, hours=-10)
        links.append(
            Link(
                code=demo.code,
                target_url=demo.target_url,
                title=demo.title,
                is_custom=demo.is_custom,
                is_active=demo.disabled_days_ago is None,
                expires_at=expires_at,
                created_at=created_at,
                updated_at=updated_at,
            )
        )

        # the last day with traffic, expired and disabled links stop the day before
        last_day = 0
        if demo.expires_in_days is not None and demo.expires_in_days < 0:
            last_day = -demo.expires_in_days + 1
        if demo.disabled_days_ago is not None:
            last_day = demo.disabled_days_ago + 1

        countries = COUNTRIES[demo.region]
        referrers = REFERRERS[demo.referrers]
        agents = [
            ((device, browser, os), weight if device == "desktop" else weight * demo.mobile_bias)
            for device, browser, os, weight in AGENTS
        ]
        pool = max(8, math.floor(demo.popularity * 25))
        link_clicks: list[dict] = []

        for days_ago in range(min(demo.created_days_ago, HISTORY_DAYS - 1), last_day - 1, -1):
            day_start = today - timedelta(days=days_ago)
            weekday = (day_start.weekday() + 1) % 7
            rate = demo.popularity * _shape_factor(demo, days_ago) * WEEKDAY_FACTOR[weekday]
            jitter = 0.6 + 0.8 * rng()
            count = math.floor(rate * jitter + rng())

            window_start = max(0, int((created_at - day_start).total_seconds()))
            window_end = elapsed_today if days_ago == 0 else DAY
            if days_ago == 0:
                count = math.floor(count * elapsed_today / DAY)
            if window_end <= window_start:
                continue

            for _ in range(count):
                offset = window_start + math.floor(rng() * (window_end - window_start))
                visitor = math.floor(rng() * pool)
                referrer = _pick(rng, referrers)
                country = _pick(rng, countries)
                device, browser, os = _pick(rng, agents)
                link_clicks.append(
                    {
                        "clicked_at": day_start + timedelta(seconds=offset),
                        "visitor_id": f"seed{index:02d}v{visitor:04d}",
                        "referrer": referrer,
                        "country": country,
                        "device": device,
                        "browser": browser,
                        "os": os,
                    }
                )
        clicks.append(link_clicks)
    return links, clicks


def seed_if_empty(session: Session, now: datetime | None = None) -> bool:
    if session.exec(select(func.count()).select_from(Link)).one():
        return False
    links, clicks = build_demo_data(now or datetime.now(UTC))
    session.add_all(links)
    session.flush()
    rows = [
        {**click, "link_id": link.id}
        for link, link_clicks in zip(links, clicks, strict=True)
        for click in link_clicks
    ]
    if rows:
        session.execute(insert(Click), rows)
    session.commit()
    return True
