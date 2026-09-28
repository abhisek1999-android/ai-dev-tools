"""Request/report pydantic models — the single source of truth for the API contract."""

from typing import Literal

from pydantic import BaseModel, Field

ProviderName = Literal["openai", "anthropic", "groq", "ollama"]
Verdict = Literal["SUPPORTED", "UNSUPPORTED", "CONTRADICTED", "UNABLE_TO_VERIFY"]
ClaimType = Literal["fact", "opinion", "hedged"]
Status = Literal["pass", "warning", "fail"]
ErrorCode = Literal["invalid_request", "extraction_failed", "jev_failed", "provider_timeout", "not_configured"]


class ValidateRequest(BaseModel):
    question: str = Field(min_length=1, max_length=4000)
    answer: str = Field(min_length=1, max_length=8000)
    source: str | None = Field(default=None, max_length=16000)
    provider_hint: ProviderName | None = None


class ExtractedClaim(BaseModel):
    """Raw output of the extraction LLM, before any verdict exists."""

    text: str = Field(min_length=1)  # verbatim span of the answer
    type: ClaimType = "fact"
    evidence_quote: str | None = None  # verbatim span of the source, or null


class ExtractionResult(BaseModel):
    claims: list[ExtractedClaim] = Field(default_factory=list)


class ClaimReport(BaseModel):
    id: int
    text: str
    type: ClaimType
    verdict: Verdict
    confidence: float = Field(ge=0.0, le=1.0)  # Jev probability of the returned verdict
    evidence_quote: str | None = None
    evidence_in_source: bool = False  # deterministic re-check: quote is a substring of the source


class RelevanceReport(BaseModel):
    percent: int = Field(ge=0, le=100)
    level: str  # legend label, e.g. "Directly and completely answers the question asked"
    confidence: float = Field(ge=0.0, le=1.0)


class GroundednessReport(BaseModel):
    na: bool = False  # true when no source was provided
    percent: int | None = Field(default=None, ge=0, le=100)
    supported: int = 0
    unsupported: int = 0
    contradicted: int = 0
    unverifiable: int = 0
    total: int = 0


class ValidationReport(BaseModel):
    status: Status
    relevance: RelevanceReport
    groundedness: GroundednessReport
    claims: list[ClaimReport]
    contradiction_presence: float | None = None  # Jev noul, None when no source
    meta: dict = Field(default_factory=dict)


class ErrorResponse(BaseModel):
    error: ErrorCode
    detail: str