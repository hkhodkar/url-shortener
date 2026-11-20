from datetime import UTC, datetime, timedelta

from sqlmodel import Session

from app.models import Click
from app.seed import DEMO_LINKS


def add_clicks(client, code, clicks):
    link_id = client.get(f"/api/links/{code}").json()["id"]
    with Session(client.app.state.engine) as session:
        for click in clicks:
            session.add(Click(link_id=link_id, **click))
        session.commit()


def test_stats_counts_and_breakdowns(client, make_link):
    make_link(alias="report")
    now = datetime.now(UTC)
    add_clicks(
        client,
        "report",
        [
            {
                "clicked_at": now,
                "visitor_id": "a",
                "referrer": "x.com",
                "country": "DE",
                "device": "mobile",
                "browser": "Safari",
                "os": "iOS",
            },
            {
                "clicked_at": now,
                "visitor_id": "a",
                "referrer": None,
                "country": None,
                "device": "desktop",
                "browser": "Chrome",
                "os": "Windows",
            },
            {
                "clicked_at": now - timedelta(days=3),
                "visitor_id": "b",
                "referrer": "x.com",
                "country": "DE",
                "device": "desktop",
                "browser": "Chrome",
                "os": "macOS",
            },
            {
                "clicked_at": now - timedelta(days=20),
                "visitor_id": "c",
                "referrer": "x.com",
                "country": "US",
                "device": "desktop",
                "browser": "Firefox",
                "os": "Linux",
            },
        ],
    )

    week = client.get("/api/links/report/stats", params={"range": 7}).json()
    assert week["range"] == 7
    assert (week["total_clicks"], week["unique_visitors"], week["all_time_clicks"]) == (3, 2, 4)
    assert len(week["timeline"]) == 7
    assert week["timeline"][-1] == {
        "date": now.date().isoformat(),
        "clicks": 2,
        "unique_visitors": 1,
    }
    assert week["referrers"] == [{"label": "x.com", "count": 2}, {"label": "Direct", "count": 1}]
    assert week["countries"] == [{"label": "DE", "count": 2}, {"label": "Unknown", "count": 1}]
    assert week["browsers"][0] == {"label": "Chrome", "count": 2}

    month = client.get("/api/links/report/stats", params={"range": 30}).json()
    assert month["total_clicks"] == 4 and len(month["timeline"]) == 30


def test_stats_range_must_be_7_30_or_90(client, make_link):
    make_link(alias="ranged")
    assert client.get("/api/links/ranged/stats", params={"range": 14}).status_code == 422
    assert client.get("/api/links/missing/stats").status_code == 404


def test_seeded_data(seeded_client):
    page = seeded_client.get("/api/links", params={"page_size": 100}).json()
    assert page["total"] == len(DEMO_LINKS)
    statuses = {link["code"]: link["status"] for link in page["items"]}
    assert statuses["spring-sale"] == "expired"
    assert statuses["q3-report"] == "disabled"
    assert statuses["angular-signals"] == "active"

    summary = seeded_client.get("/api/summary").json()
    assert summary["total_links"] == len(DEMO_LINKS)
    assert summary["total_clicks"] > 2000
    assert len(summary["timeline"]) == 30
    assert len(summary["top_links"]) == 5
    clicks = [link["clicks"] for link in summary["top_links"]]
    assert clicks == sorted(clicks, reverse=True)

    stats = seeded_client.get("/api/links/angular-signals/stats", params={"range": 90}).json()
    assert stats["unique_visitors"] < stats["total_clicks"]
    assert sum(point["clicks"] for point in stats["timeline"]) == stats["total_clicks"]
    assert sum(item["count"] for item in stats["devices"]) == stats["total_clicks"]


def test_seeding_happens_only_once(seeded_client):
    from app.seed import seed_if_empty

    with Session(seeded_client.app.state.engine) as session:
        assert seed_if_empty(session) is False
