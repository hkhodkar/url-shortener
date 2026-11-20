from datetime import UTC, datetime, timedelta

from sqlmodel import Session, select

from app.models import Click, Link

IPHONE = (
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 "
    "(KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1"
)


def test_redirect_records_a_click(client, make_link):
    make_link(alias="go-now", target_url="https://example.com/landing")
    response = client.get(
        "/go-now",
        headers={
            "user-agent": IPHONE,
            "referer": "https://www.linkedin.com/feed/",
            "accept-language": "de-DE,de;q=0.9",
        },
    )
    assert response.status_code == 302
    assert response.headers["location"] == "https://example.com/landing"
    assert response.headers["cache-control"] == "no-store"

    with Session(client.app.state.engine) as session:
        click = session.exec(select(Click)).one()
    assert (click.device, click.browser, click.os) == ("mobile", "Safari", "iOS")
    assert click.referrer == "linkedin.com"
    assert click.country == "DE"

    link = client.get("/api/links/go-now").json()
    assert link["clicks"] == 1 and link["last_clicked_at"] is not None


def test_unknown_code_is_404(client):
    response = client.get("/nothing-here")
    assert response.status_code == 404
    assert "Link not found" in response.text


def test_disabled_link_is_gone(client, make_link):
    make_link(alias="paused")
    client.patch("/api/links/paused", json={"is_active": False})
    assert client.get("/paused").status_code == 410
    assert client.get("/api/links/paused").json()["clicks"] == 0


def test_expired_link_is_gone(client, make_link):
    make_link(alias="old")
    with Session(client.app.state.engine) as session:
        link = session.exec(select(Link).where(Link.code == "old")).one()
        link.expires_at = datetime.now(UTC) - timedelta(minutes=1)
        session.add(link)
        session.commit()
    response = client.get("/old")
    assert response.status_code == 410
    assert "expired" in response.text
    assert client.get("/api/links/old").json()["status"] == "expired"


def test_api_and_docs_are_not_short_links(client):
    assert client.get("/api/health").json() == {"status": "ok"}
    assert client.get("/docs").status_code == 200
    assert client.get("/openapi.json").status_code == 200


def test_meta(client):
    meta = client.get("/api/meta").json()
    assert meta["short_base_url"] == "http://sho.rt"
    assert meta["alias_min_length"] == 3
    assert "api" in meta["reserved_words"]
