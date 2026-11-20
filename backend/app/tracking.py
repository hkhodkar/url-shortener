"""Turns the headers of a redirect request into the fields of a click."""

import hashlib
import re
from dataclasses import dataclass
from urllib.parse import urlsplit

# order matters: Edge and Opera also send "Chrome", Chrome also sends "Safari"
_BROWSERS = [
    ("Edge", re.compile(r"Edg(e|A|iOS)?/")),
    ("Opera", re.compile(r"OPR/|Opera")),
    ("Samsung Internet", re.compile(r"SamsungBrowser/")),
    ("Firefox", re.compile(r"Firefox/|FxiOS/")),
    ("Chrome", re.compile(r"Chrome/|CriOS/")),
    ("Safari", re.compile(r"Version/[\d.]+.*Safari/")),
]
_OS = [
    ("iOS", re.compile(r"iPhone|iPad|iPod")),
    ("Android", re.compile(r"Android")),
    ("Windows", re.compile(r"Windows")),
    ("macOS", re.compile(r"Mac OS X|Macintosh")),
    ("Linux", re.compile(r"Linux|X11")),
]
_BOT = re.compile(r"bot|crawl|spider|slurp|preview|curl|wget|python-requests|httpx", re.I)
_TABLET = re.compile(r"iPad|Tablet|Android(?!.*Mobile)")
_MOBILE = re.compile(r"Mobi|iPhone|iPod|Android.*Mobile")


@dataclass(frozen=True)
class Agent:
    device: str
    browser: str
    os: str


def parse_user_agent(user_agent: str | None) -> Agent:
    ua = user_agent or ""
    if not ua or _BOT.search(ua):
        return Agent(device="bot", browser="Other", os="Other")
    browser = next((name for name, pattern in _BROWSERS if pattern.search(ua)), "Other")
    os_name = next((name for name, pattern in _OS if pattern.search(ua)), "Other")
    if _TABLET.search(ua):
        device = "tablet"
    elif _MOBILE.search(ua):
        device = "mobile"
    else:
        device = "desktop"
    return Agent(device=device, browser=browser, os=os_name)


def referrer_domain(referrer: str | None, own_host: str | None = None) -> str | None:
    """Hostname of the referring page without "www.", None for direct visits."""
    if not referrer:
        return None
    try:
        host = urlsplit(referrer).hostname
    except ValueError:
        return None
    if not host:
        return None
    host = host.removeprefix("www.")
    if own_host and host == own_host.removeprefix("www."):
        return None
    return host[:255]


def country_from_headers(headers) -> str | None:
    """Country code set by a CDN or proxy, else the region of the browser language."""
    for name in ("cf-ipcountry", "x-country-code", "x-vercel-ip-country"):
        value = (headers.get(name) or "").strip().upper()
        if re.fullmatch(r"[A-Z]{2}", value) and value not in {"XX", "T1"}:
            return value
    language = (headers.get("accept-language") or "").split(",")[0]
    match = re.search(r"[-_]([A-Za-z]{2})\b", language)
    return match.group(1).upper() if match else None


def visitor_id(ip: str | None, user_agent: str | None) -> str:
    raw = f"{ip or ''}|{user_agent or ''}".encode()
    return hashlib.sha256(raw).hexdigest()[:16]
