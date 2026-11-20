from datetime import UTC, datetime, timedelta

from tests.conftest import BASE_URL


def future(days: int = 7) -> str:
    return (datetime.now(UTC) + timedelta(days=days)).isoformat()


def test_create_link_with_random_code(client):
    response = client.post("/api/links", json={"target_url": "https://example.com/a?b=c"})
    assert response.status_code == 201
    link = response.json()
    assert len(link["code"]) == 7
    assert link["short_url"] == f"{BASE_URL}/{link['code']}"
    assert link["is_custom"] is False
    assert link["status"] == "active"
    assert link["clicks"] == 0
    assert link["title"] is None


def test_create_link_with_alias_title_and_expiry(make_link):
    link = make_link(alias="my-launch", title="  Launch post ", expires_at=future())
    assert link["code"] == "my-launch"
    assert link["title"] == "Launch post"
    assert link["is_custom"] is True
    assert link["expires_at"] is not None


def test_rejects_non_http_urls(client):
    for url in ["ftp://example.com/file", "javascript:alert(1)", "example.com", "https://"]:
        response = client.post("/api/links", json={"target_url": url})
        assert response.status_code == 422, url


def test_rejects_bad_and_reserved_aliases(client):
    for alias in ["a", "bad alias", "api", "-dash"]:
        response = client.post(
            "/api/links", json={"target_url": "https://example.com", "alias": alias}
        )
        assert response.status_code == 422, alias


def test_duplicate_alias_is_a_conflict_ignoring_case(client, make_link):
    make_link(alias="promo")
    response = client.post("/api/links", json={"target_url": "https://x.org", "alias": "PROMO"})
    assert response.status_code == 409
    assert "already taken" in response.json()["detail"]


def test_expiry_must_be_in_the_future(client):
    past = (datetime.now(UTC) - timedelta(hours=1)).isoformat()
    response = client.post("/api/links", json={"target_url": "https://x.org", "expires_at": past})
    assert response.status_code == 422


def test_check_alias(client, make_link):
    make_link(alias="taken")
    assert client.get("/api/links/check-alias", params={"alias": "free-one"}).json() == {
        "alias": "free-one",
        "available": True,
        "reason": None,
    }
    taken = client.get("/api/links/check-alias", params={"alias": "Taken"}).json()
    assert taken["available"] is False and "taken" in taken["reason"]
    reserved = client.get("/api/links/check-alias", params={"alias": "docs"}).json()
    assert reserved == {"alias": "docs", "available": False, "reason": "This word is reserved"}
    short = client.get("/api/links/check-alias", params={"alias": "ab"}).json()
    assert short["available"] is False


def test_get_update_and_delete(client, make_link):
    make_link(alias="edit-me", title="Old")
    response = client.patch(
        "/api/links/edit-me",
        json={"title": "New", "target_url": "https://example.org/new", "is_active": False},
    )
    assert response.status_code == 200
    link = response.json()
    assert (link["title"], link["target_url"], link["status"]) == (
        "New",
        "https://example.org/new",
        "disabled",
    )
    assert client.get("/api/links/edit-me").json()["title"] == "New"

    # only sent fields change, null clears optional ones
    cleared = client.patch("/api/links/edit-me", json={"title": None}).json()
    assert cleared["title"] is None and cleared["target_url"] == "https://example.org/new"

    assert client.patch("/api/links/edit-me", json={"target_url": None}).status_code == 422
    assert client.delete("/api/links/edit-me").status_code == 204
    assert client.get("/api/links/edit-me").status_code == 404
    assert client.delete("/api/links/edit-me").status_code == 404


def test_update_expiry(client, make_link):
    make_link(alias="soon", expires_at=future(3))
    later = client.patch("/api/links/soon", json={"expires_at": future(30)}).json()
    assert later["status"] == "active"
    removed = client.patch("/api/links/soon", json={"expires_at": None}).json()
    assert removed["expires_at"] is None
    past = (datetime.now(UTC) - timedelta(days=1)).isoformat()
    assert client.patch("/api/links/soon", json={"expires_at": past}).status_code == 422


def test_list_search_sort_and_paging(client, make_link):
    make_link(alias="alpha", title="Alpha docs", target_url="https://docs.example.com")
    make_link(alias="beta", title="Beta blog")
    make_link(alias="gamma", title=None, target_url="https://gamma.dev/100%_real")
    for _ in range(3):
        client.get("/beta")
    client.get("/alpha")

    page = client.get("/api/links", params={"sort": "-clicks", "page_size": 2}).json()
    assert page["total"] == 3 and page["page_size"] == 2
    assert [link["code"] for link in page["items"]] == ["beta", "alpha"]
    second = client.get("/api/links", params={"sort": "-clicks", "page_size": 2, "page": 2})
    assert [link["code"] for link in second.json()["items"]] == ["gamma"]

    by_title = client.get("/api/links", params={"sort": "title"}).json()["items"]
    assert [link["code"] for link in by_title] == ["alpha", "beta", "gamma"]

    found = client.get("/api/links", params={"search": "DOCS"}).json()
    assert [link["code"] for link in found["items"]] == ["alpha"]
    # % and _ are matched literally
    literal = client.get("/api/links", params={"search": "100%_"}).json()
    assert [link["code"] for link in literal["items"]] == ["gamma"]

    assert client.get("/api/links", params={"sort": "nope"}).status_code == 422
    assert client.get("/api/links", params={"page_size": 500}).status_code == 422


def test_status_filter(client, make_link):
    make_link(alias="live")
    make_link(alias="paused")
    client.patch("/api/links/paused", json={"is_active": False})
    make_link(alias="later", expires_at=future())

    def codes(status):
        items = client.get("/api/links", params={"status": status}).json()["items"]
        return sorted(link["code"] for link in items)

    assert codes("active") == ["later", "live"]
    assert codes("disabled") == ["paused"]
    assert codes("expired") == []


def test_expiry_sort_puts_links_without_expiry_last(client, make_link):
    make_link(alias="never")
    make_link(alias="far", expires_at=future(30))
    make_link(alias="near", expires_at=future(2))
    asc = client.get("/api/links", params={"sort": "expires_at"}).json()["items"]
    desc = client.get("/api/links", params={"sort": "-expires_at"}).json()["items"]
    assert [link["code"] for link in asc] == ["near", "far", "never"]
    assert [link["code"] for link in desc] == ["far", "near", "never"]
