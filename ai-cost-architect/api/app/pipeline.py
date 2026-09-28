"""Pipeline orchestration: extraction -> Jev -> deterministic aggregation."""

import logging
import time

from .aggregate import build_report
from .config import ResolvedProvider, Settings
from .extraction import ExtractionParseError, extract_claims
from .jev import JevClient, JevError
from .llm import ExtractionError, build_provider
from .questions import build_questions, build_state
from .schemas import ValidateRequest, Verdict, ValidationReport

logger = logging.getLogger("tokiq.pipeline")

# Jev returns the option key in lowercase; our report verdicts are uppercase.
_VERDICT_MAP: dict[str, Verdict] = {
    "supported": "SUPPORTED",
    "unsupported": "UNSUPPORTED",
    "contradicted": "CONTRADICTED",
    "unverifiable": "UNABLE_TO_VERIFY",
}


class PipelineError(Exception):
    """Carries a normalized error code + HTTP status for the API layer."""

    def __init__(self, code: str, detail: str, status_code: int):
        self.code = code
        self.detail = detail
        self.status_code = status_code
        super().__init__(detail)


def _parse_verdicts(answers: dict, claim_count: int) -> tuple[dict[int, Verdict], dict[int, float]]:
    verdicts: dict[int, Verdict] = {}
    confidences: dict[int, float] = {}
    for i in range(claim_count):
        ans = answers.get(f"claim_{i}")
        if not isinstance(ans, dict):
            logger.warning("Jev returned no verdict for claim_%d — marking UNABLE_TO_VERIFY", i)
            continue  # missing verdict -> UNABLE_TO_VERIFY at 0 confidence
        choice = ans.get("choice")
        if choice in _VERDICT_MAP:
            verdicts[i] = _VERDICT_MAP[choice]
            probs = ans.get("probabilities") or {}
            confidences[i] = float(probs.get(choice, ans.get("confidence", 0.0)))
        else:
            logger.warning("Jev returned unknown choice %r for claim_%d — marking UNABLE_TO_VERIFY", choice, i)
    return verdicts, confidences


async def run_validation(
    settings: Settings, request: ValidateRequest, provider_hint: str | None = None
) -> ValidationReport:
    started = time.perf_counter()
    source = request.source.strip() if request.source and request.source.strip() else None

    try:
        provider = build_provider(settings, provider_hint or request.provider_hint)
    except Exception as exc:  # NotConfigured
        raise PipelineError("not_configured", str(exc), 503) from exc
    resolved: ResolvedProvider = settings.resolve_provider(provider_hint or request.provider_hint)
    logger.info(
        "stage 1/3 claim extraction — provider=%s model=%s base_url=%s",
        resolved.name, resolved.model, resolved.base_url,
    )

    if not settings.jev_configured():
        raise PipelineError("not_configured", "TYPESAFE_API_KEY is not set — Jev is required for verdicts.", 503)
    jev = JevClient(settings.typesafe_api_key, settings.jev_model, settings.jev_timeout_seconds)

    # 1. Claim extraction (LLM).
    extraction_started = time.perf_counter()
    try:
        extraction = await extract_claims(
            provider, request.question, request.answer, source,
            settings.max_claims, settings.extraction_max_tokens,
        )
    except ExtractionParseError as exc:
        raise PipelineError("extraction_failed", f"Could not parse claims from the model output: {exc}", 502) from exc
    except ExtractionError as exc:
        raise PipelineError("provider_timeout" if "timed out" in str(exc) else "extraction_failed", str(exc), 502) from exc
    logger.info(
        "extraction done in %d ms — %d claim(s)",
        round((time.perf_counter() - extraction_started) * 1000),
        len(extraction.claims),
    )
    for i, claim in enumerate(extraction.claims):
        logger.info("  claim_%d [%s] %r evidence=%r", i, claim.type, claim.text, claim.evidence_quote)

    claim_texts = [c.text for c in extraction.claims]

    # 2. Jev decisions — one batched call; without a source only relevance is asked.
    jev_started = time.perf_counter()
    questions = build_questions(claim_texts, source_provided=bool(source))
    logger.info(
        "stage 2/3 Jev decisions — model=%s questions=%d (%s)",
        settings.jev_model,
        len(questions),
        "relevance only — no source provided" if not source else f"{len(claim_texts)} claim verdicts + relevance + contradiction",
    )
    try:
        answers = await jev.decide(
            build_state(request.question, request.answer, source),
            questions,
        )
    except JevError as exc:
        raise PipelineError("jev_failed", str(exc), 502) from exc
    logger.info("Jev responded in %d ms (model=%s)", round((time.perf_counter() - jev_started) * 1000), answers.get("model"))

    jev_model = answers.get("model", settings.jev_model)
    relevance_ans = answers.get("answers", {}).get("relevance", {})
    relevance_index = float(relevance_ans.get("score", 0.0))
    relevance_confidence = float(relevance_ans.get("confidence", 0.0))
    contradiction_ans = answers.get("answers", {}).get("contradiction")
    contradiction_presence = float(contradiction_ans.get("noul")) if isinstance(contradiction_ans, dict) else None
    logger.info(
        "  relevance score=%.1f (confidence=%.2f) contradiction_noul=%s",
        relevance_index, relevance_confidence,
        f"{contradiction_presence:.2f}" if contradiction_presence is not None else "skipped",
    )

    # Without a source there is nothing to judge against: any claim verdict Jev
    # might return is ignored and every claim stays UNABLE_TO_VERIFY by construction.
    if source is None:
        verdicts, confidences = {}, {}
    else:
        verdicts, confidences = _parse_verdicts(answers.get("answers", {}), len(claim_texts))
    for i, claim in enumerate(claim_texts):
        logger.info(
            "  verdict claim_%d -> %s (confidence=%.2f)",
            i, verdicts.get(i, "UNABLE_TO_VERIFY"), confidences.get(i, 0.0),
        )

    # 3. Deterministic aggregation.
    duration_ms = round((time.perf_counter() - started) * 1000)
    meta = {
        "provider": resolved.name,
        "extraction_model": resolved.model,
        "jev_model": jev_model,
        "duration_ms": duration_ms,
        "source_provided": source is not None,
    }
    report = build_report(
        extraction.claims,
        verdicts,
        confidences,
        source,
        relevance_index,
        relevance_confidence,
        contradiction_presence,
        meta,
    )
    logger.info(
        "stage 3/3 aggregation done — status=%s groundedness=%s total=%d ms",
        report.status,
        "N/A" if report.groundedness.na else f"{report.groundedness.percent}%",
        duration_ms,
    )
    return report