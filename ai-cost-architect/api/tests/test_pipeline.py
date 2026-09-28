"""End-to-end pipeline tests with faked LLM + faked Jev."""

import pytest

from app import pipeline
from app.pipeline import PipelineError, run_validation
from tests.conftest import (
    REFUND_EXAMPLE,
    REFUND_EXTRACTION,
    REFUND_JEV_ANSWERS,
    FakeJev,
    FakeLLMProvider,
)


@pytest.fixture
def patched(monkeypatch, settings):
    """Wire fakes into the pipeline; returns (provider, jev) for assertions."""
    provider = FakeLLMProvider([REFUND_EXTRACTION])
    jev = FakeJev(REFUND_JEV_ANSWERS)
    monkeypatch.setattr(pipeline, "build_provider", lambda s, hint=None: provider)
    monkeypatch.setattr(pipeline, "JevClient", lambda key, model, timeout: jev)
    return provider, jev


@pytest.mark.asyncio
async def test_happy_path_refund_example(settings, patched):
    _, jev = patched
    report = await run_validation(settings, REFUND_EXAMPLE)

    assert report.status == "fail"  # one contradicted claim
    assert len(report.claims) == 1
    claim = report.claims[0]
    assert claim.verdict == "CONTRADICTED"
    assert claim.confidence == 0.9
    assert claim.evidence_quote == "Customers can request a refund within 30 days of purchase."
    assert claim.evidence_in_source is True
    assert report.groundedness.percent == 0
    assert report.groundedness.contradicted == 1
    assert report.relevance.percent == 100
    assert report.contradiction_presence == 1.0
    assert report.meta["source_provided"] is True
    assert "duration_ms" in report.meta


@pytest.mark.asyncio
async def test_no_source_short_circuits_claim_questions(settings, patched):
    _, jev = patched
    request = REFUND_EXAMPLE.model_copy(update={"source": None})
    report = await run_validation(settings, request)

    # Jev was only asked the relevance score.
    questions = jev.question_sets[0]
    assert set(questions) == {"relevance"}
    # All claims are unverifiable by construction; groundedness honestly N/A.
    assert all(c.verdict == "UNABLE_TO_VERIFY" for c in report.claims)
    assert report.groundedness.na is True
    assert report.groundedness.percent is None
    assert report.contradiction_presence is None


@pytest.mark.asyncio
async def test_missing_jev_verdict_becomes_unable_to_verify(settings, patched):
    _, _ = patched
    answers = {"relevance": {"score": 3.0, "confidence": 0.8}}  # claim_0 missing
    jev = FakeJev(answers)
    import app.pipeline as p

    original = p.JevClient
    p.JevClient = lambda key, model, timeout: jev
    try:
        report = await run_validation(settings, REFUND_EXAMPLE)
    finally:
        p.JevClient = original

    assert report.claims[0].verdict == "UNABLE_TO_VERIFY"
    assert report.claims[0].confidence == 0.0


@pytest.mark.asyncio
async def test_jev_timeout_surfaces_after_retry(settings, patched):
    from app.jev import JevError

    class ExplodingJev:
        async def decide(self, state, questions):
            raise JevError("Jev timed out after 30s")

    import app.pipeline as p

    original = p.JevClient
    p.JevClient = lambda key, model, timeout: ExplodingJev()
    try:
        with pytest.raises(PipelineError) as exc:
            await run_validation(settings, REFUND_EXAMPLE)
    finally:
        p.JevClient = original
    assert exc.value.code == "jev_failed"
    assert exc.value.status_code == 502


@pytest.mark.asyncio
async def test_not_configured_provider_names_missing_var(settings):
    from app.config import NotConfigured

    bad = settings.model_copy(update={"extraction_provider": "openai", "openai_api_key": ""})
    with pytest.raises(PipelineError) as exc:
        await run_validation(bad, REFUND_EXAMPLE)
    assert exc.value.code == "not_configured"
    assert "OPENAI_API_KEY" in exc.value.detail


@pytest.mark.asyncio
async def test_empty_claims_list_is_valid_report(settings, patched):
    provider, _ = patched
    provider._completions = ['{"claims": []}']
    report = await run_validation(settings, REFUND_EXAMPLE)
    assert report.claims == []
    assert report.groundedness.total == 0
    assert report.relevance.percent == 100


@pytest.mark.asyncio
async def test_provider_hint_is_used(settings, patched, monkeypatch):
    _, _ = patched
    from app.config import ResolvedProvider

    seen = {}

    def fake_resolve(self, hint=None):
        seen["hint"] = hint
        return ResolvedProvider(
            name="ollama", base_url="http://localhost:11434/v1", api_key="ollama", model="llama3.1"
        )

    monkeypatch.setattr(type(settings), "resolve_provider", fake_resolve)
    request = REFUND_EXAMPLE.model_copy(update={"provider_hint": "groq"})
    await run_validation(settings, request)
    assert seen["hint"] == "groq"