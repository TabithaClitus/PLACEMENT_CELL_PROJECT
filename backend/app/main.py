import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import auth
from app.api import import_routes, student_routes, company_routes, analytics_routes, jd_routes, internship_routes

logger = logging.getLogger("placement_cell")
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown lifecycle events."""
    logger.info("Placement Cell API starting up…")
    try:
        from app.database import engine, Base
        import app.models  # noqa: F401
        Base.metadata.create_all(bind=engine)
    except Exception as exc:
        logger.warning("Auto table check note: %s", exc)
    yield
    logger.info("Placement Cell API shutting down…")


def create_app() -> FastAPI:
    app = FastAPI(
        title="Placement Cell API",
        description="College Placement Management & Analytics Portal — Admin Backend",
        version="0.1.0",
        lifespan=lifespan,
    )

    # Configurable CORS with Render origin support
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins + ["https://placement-cell-frontend.onrender.com"],
        allow_origin_regex=r"https://.*\.onrender\.com",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Routers
    app.include_router(auth.router)
    app.include_router(import_routes.router)
    app.include_router(student_routes.router)
    app.include_router(company_routes.router)
    app.include_router(analytics_routes.router)
    app.include_router(jd_routes.router)
    app.include_router(internship_routes.router)

    @app.get("/api/health", tags=["Health"])
    def health_check():
        return {"status": "ok"}

    return app


app = create_app()
