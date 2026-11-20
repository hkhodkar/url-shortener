from html import escape
from typing import Annotated

from fastapi import APIRouter, Depends, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlmodel import Session, select

from ..database import get_session, utcnow
from ..models import Click, Link
from ..tracking import country_from_headers, parse_user_agent, referrer_domain, visitor_id

router = APIRouter(tags=["redirect"])

PAGE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<style>
  body {{ margin: 0; min-height: 100vh; display: grid; place-items: center;
         font: 15px/1.5 system-ui, sans-serif; background: #f5f7fb; color: #172033; }}
  main {{ max-width: 420px; padding: 32px; text-align: center; }}
  h1 {{ margin: 0 0 8px; font-size: 22px; }}
  p {{ margin: 0; color: #667085; }}
  code {{ padding: 2px 6px; border-radius: 6px; background: #e8ecf4; }}
</style>
</head>
<body><main><h1>{title}</h1><p>{message}</p></main></body>
</html>"""


def _page(status: int, title: str, message: str) -> HTMLResponse:
    return HTMLResponse(PAGE.format(title=title, message=message), status_code=status)


@router.get(
    "/{code}",
    response_class=RedirectResponse,
    status_code=302,
    responses={
        302: {"description": "Redirects to the target URL and counts the click"},
        404: {"description": "Unknown code"},
        410: {"description": "The link expired or was disabled"},
    },
)
def follow_link(code: str, request: Request, session: Annotated[Session, Depends(get_session)]):
    link = session.exec(select(Link).where(Link.code == code)).first()
    shown = f"<code>/{escape(code)}</code>"
    if link is None:
        return _page(404, "Link not found", f"There is no short link at {shown}.")

    now = utcnow()
    status = link.status(now)
    if status == "expired":
        return _page(410, "Link expired", f"The short link {shown} has expired.")
    if status == "disabled":
        return _page(410, "Link disabled", f"The short link {shown} was turned off by its owner.")

    headers = request.headers
    user_agent = headers.get("user-agent")
    forwarded = headers.get("x-forwarded-for", "").split(",")[0].strip()
    ip = forwarded or (request.client.host if request.client else None)
    agent = parse_user_agent(user_agent)
    session.add(
        Click(
            link_id=link.id,
            clicked_at=now,
            visitor_id=visitor_id(ip, user_agent),
            referrer=referrer_domain(headers.get("referer"), request.url.hostname),
            country=country_from_headers(headers),
            device=agent.device,
            browser=agent.browser,
            os=agent.os,
        )
    )
    session.commit()
    # no caching, otherwise browsers skip the server and the click is never counted
    return RedirectResponse(link.target_url, status_code=302, headers={"Cache-Control": "no-store"})
