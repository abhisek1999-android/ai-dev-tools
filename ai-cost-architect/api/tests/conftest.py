"""Shared fixtures: fake LLM provider + fake Jev client, and sample payloads."""

import pytest

from app.config import Settings
from app.schemas import ValidateRequest


class FakeLLMProvider:
    """Returns a canned completion; records the prompts and budgets it was given.

    empty_first raises EmptyContentError on the first call (reasoning-model
    starvation), then serves the completions; empty_always raises every time.
    """

    def __init__(self, completions: list[str] | None = None, empty_first: bool = False, empty_always: bool = False):
        from app.llm import EmptyContentError

        self._completions = list(completions or [])
        self._empty_first = empty_first
        self._empty_always = empty_always
        self._EmptyContentError = EmptyContentError
        self.calls: list[tuple[str, str, int]] = []

    async def complete_json(self, system: str, user: str, max_tokens: int = 2000) -> str:
        self.calls.append((system, user, max_tokens))
        if self._empty_always or (self._empty_first and len(self.calls) == 1):
            raise self._EmptyContentError("ollama returned empty content (finish_reason=length)")
        served = len(self.calls) - (2 if self._empty_first else 1)
        idx = min(served, len(self._completions) - 1)
        return self._completions[idx]


class FakeJev:
    """Returns a canned answers map; records state and questions."""

    def __init__(self, answers: dict, model: str = "jev-1.13.0"):
        self._answers = answers
        self._model = model
        self.states: list[str] = []
        self.question_sets: list[dict] = []

    async def decide(self, state: str, questions: dict) -> dict:
        self.states.append(state)
        self.question_sets.append(questions)
        return {"model": self._model, "answers": self._answers, "usage": {}}


@pytest.fixture
def settings() -> Settings:
    # Credentials that are never used (all calls are faked) but pass config checks.
    return Settings(
        extraction_provider="ollama",
        typesafe_api_key="test-key",
        _env_file=None,  # never read api/.env during tests
    )


REFUND_EXAMPLE = ValidateRequest(
    question="What is our company's refund policy?",
    answer="Customers can request a refund within 60 days of purchase.",
    source="Customers can request a refund within 30 days of purchase.",
)

REFUND_EXTRACTION = (
    '{"claims": [{"text": "Customers can request a refund within 60 days of purchase.", '
    '"type": "fact", "evidence_quote": "Customers can request a refund within 30 days of purchase."}]}'
)

REFUND_JEV_ANSWERS = {
    "relevance": {"type": "score", "score": 4.0, "confidence": 0.95},
    "claim_0": {
        "type": "choice",
        "choice": "contradicted",
        "confidence": 0.9,
        "probabilities": {"supported": 0.0, "unsupported": 0.05, "contradicted": 0.9, "unverifiable": 0.05},
    },
    "contradiction": {"type": "noul", "noul": 1.0},
}