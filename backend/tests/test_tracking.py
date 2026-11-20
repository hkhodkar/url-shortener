import pytest

from app.tracking import country_from_headers, parse_user_agent, referrer_domain, visitor_id

CHROME_WIN = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
)
EDGE_WIN = CHROME_WIN + " Edg/131.0.0.0"
SAFARI_IPHONE = (
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 "
    "(KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1"
)
FIREFOX_LINUX = "Mozilla/5.0 (X11; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0"
CHROME_ANDROID_TABLET = (
    "Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
)
SAMSUNG_PHONE = (
    "Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) "
    "SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36"
)


@pytest.mark.parametrize(
    ("ua", "expected"),
    [
        (CHROME_WIN, ("desktop", "Chrome", "Windows")),
        (EDGE_WIN, ("desktop", "Edge", "Windows")),
        (SAFARI_IPHONE, ("mobile", "Safari", "iOS")),
        (FIREFOX_LINUX, ("desktop", "Firefox", "Linux")),
        (CHROME_ANDROID_TABLET, ("tablet", "Chrome", "Android")),
        (SAMSUNG_PHONE, ("mobile", "Samsung Internet", "Android")),
        ("curl/8.7.1", ("bot", "Other", "Other")),
        (None, ("bot", "Other", "Other")),
    ],
)
def test_parse_user_agent(ua, expected):
    agent = parse_user_agent(ua)
    assert (agent.device, agent.browser, agent.os) == expected


@pytest.mark.parametrize(
    ("referrer", "expected"),
    [
        ("https://www.google.com/search?q=x", "google.com"),
        ("https://news.ycombinator.com/item?id=1", "news.ycombinator.com"),
        ("", None),
        (None, None),
        ("not a url", None),
        ("https://sho.rt/abc", None),
    ],
)
def test_referrer_domain(referrer, expected):
    assert referrer_domain(referrer, own_host="sho.rt") == expected


def test_country_prefers_proxy_header_then_language():
    assert country_from_headers({"cf-ipcountry": "de"}) == "DE"
    assert country_from_headers({"cf-ipcountry": "XX", "accept-language": "en-GB,en"}) == "GB"
    assert country_from_headers({"accept-language": "fr"}) is None


def test_visitor_id_is_stable_and_short():
    assert visitor_id("1.2.3.4", "ua") == visitor_id("1.2.3.4", "ua")
    assert visitor_id("1.2.3.4", "ua") != visitor_id("1.2.3.5", "ua")
    assert len(visitor_id(None, None)) == 16
