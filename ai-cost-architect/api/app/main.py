"""TokIQ Answer Validator API — FastAPI app, CORS, /api/validate, /api/health."""

import logging
import time

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import PROVIDERS, NotConfigured, get_settings
from .pipeline import PipelineError, run_validation
from .schemas import ErrorResponse, ValidateRequest

app = FastAPI(title="TokIQ Answer Validator API", version="0.1.0")

_settings = get_settings()

# One root handler for the whole app: uvicorn only configures its own loggers,
# so without this our pipeline logs below WARNING would be swallowed.
logging.basicConfig(
    level=_settings.log_level.upper(),
    format="%(asctime)s %(levelname)-7s %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("tokiq.api")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_settings.cors_origin_list(),
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type"],
)


@app.get("/api/health")
async def health() -> dict:
    """Preflight check: which providers are usable and whether Jev is configured."""
    settings = get_settings()
    configured: dict[str, bool] = {}
    for name, spec in PROVIDERS.items():
        try:
            configured[name] = bool(settings.resolve_provider(name).api_key) if not spec.key_optional else True
        except NotConfigured:
            configured[name] = False
    return {
        "status": "ok",
        "default_provider": settings.extraction_provider,
        "providers_configured": configured,
        "jev_configured": settings.jev_configured(),
    }


@app.post("/api/validate")
async def validate(payload: ValidateRequest, request: Request) -> JSONResponse:
    settings = get_settings()
    started = time.perf_counter()

    logger.info(
        "POST /api/validate — question %d chars, answer %d chars, source %s (%d chars), provider_hint=%s",
        len(payload.question),
        len(payload.answer),
        "provided" if payload.source else "NONE",
        len(payload.source or ""),
        payload.provider_hint or "default",
    )

    try:
        report = await run_validation(settings, payload)
    except PipelineError as exc:
        logger.error(
            "validate failed after %d ms — error=%s detail=%s",
            round((time.perf_counter() - started) * 1000),
            exc.code,
            exc.detail,
        )
        return JSONResponse(
            status_code=exc.status_code,
            content=ErrorResponse(error=exc.code, detail=exc.detail).model_dump(),
        )

    logger.info(
        "validate done in %d ms — status=%s relevance=%s%% groundedness=%s supported=%d unsupported=%d "
        "contradicted=%d unverifiable=%d claims=%d",
        round((time.perf_counter() - started) * 1000),
        report.status,
        report.relevance.percent,
        "N/A" if report.groundedness.na else f"{report.groundedness.percent}%",
        report.groundedness.supported,
        report.groundedness.unsupported,
        report.groundedness.contradicted,
        report.groundedness.unverifiable,
        len(report.claims),
    )
    return JSONResponse(content=report.model_dump())