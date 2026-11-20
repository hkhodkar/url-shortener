import logging
from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, SQLModel

from .config import Settings
from .database import make_engine
from .routers import links, redirect, summary
from .seed import seed_if_empty

logger = logging.getLogger("url_shortener")


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings.from_env()
    engine = make_engine(settings.database_url)

    @asynccontextmanager
    async def lifespan(_app: FastAPI):
        SQLModel.metadata.create_all(engine)
        if settings.seed_demo_data:
            with Session(engine) as session:
                if seed_if_empty(session):
                    logger.info("Database was empty, loaded demo links and clicks")
        yield
        engine.dispose()

    app = FastAPI(
        title="URL Shortener API",
        description=(
            "Create short links with custom aliases and expiry dates, "
            "follow them through `GET /{code}` and read click statistics."
        ),
        version="1.0.0",
        lifespan=lifespan,
    )
    app.state.engine = engine
    app.state.settings = settings

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    api = APIRouter(prefix="/api")
    api.include_router(links.router)
    api.include_router(summary.router)

    @api.get("/health", tags=["health"])
    def health() -> dict[str, str]:
        return {"status": "ok"}

    app.include_router(api)
    # the catch-all short link route goes last so /api and /docs win
    app.include_router(redirect.router)
    return app


app = create_app()
