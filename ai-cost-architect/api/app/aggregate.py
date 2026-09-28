"""Deterministic aggregation of Jev decisions into the validation report.

Pure functions, zero I/O. Every threshold is a named constant so tuning and tests
touch exactly one place.
"""

import re

from .questions import RELEVANCE_LEVELS
from .schemas import (
    ClaimReport,
    GroundednessReport,
    RelevanceReport,
    Status,
    ValidationReport,
    Verdict,
)

FAIL_GROUNDEDNESS = 50  # below -> fail
FAIL_RELEVANCE = 50  # below -> fail
WARNING_GROUNDEDNESS = 80  # below -> warning
WARNING_UNSUPPORTED = 3  # at/above -> warning
WARNING_CONTRADICTION_NOUL = 0.5  # at/above -> warning

STATUS_PASS: Status = "pass"
STATUS_WARNING: Status = "warning"
STATUS_FAIL: Status = "fail"


def relevance_percent(score_index: float) -> int:
    """Map Jev's 0..4 score index onto the 0/25/50/75/100 rubric."""
    idx = int(round(score_index))
    idx = max(0, min(idx, len(RELEVANCE_LEVELS) - 1))
    return idx * 25


def relevance_level(score_index: float) -> str:
    idx = int(round(score_index))
    return RELEVANCE_LEVELS[max(0, min(idx, len(RELEVANCE_LEVELS) - 1))]


def build_claim_reports(
    claims: list,
    verdicts: dict[int, Verdict],
    confidences: dict[int, float],
    source: str | None,
) -> list[ClaimReport]:
    """Pair each extracted claim with its Jev verdict.

    A claim missing a Jev verdict becomes UNABLE_TO_VERIFY with 0 confidence —
    never an invented judgment.
    """
    reports = []
    for i, claim in enumerate(claims):
        verdict = verdicts.get(i, "UNABLE_TO_VERIFY")
        confidence = confidences.get(i, 0.0)
        evidence = claim.evidence_quote
        evidence_in_source = bool(
            evidence and source and _substr(evidence, source)
        )
        reports.append(
            ClaimReport(
                id=i,
                text=claim.text,
                type=claim.type,
                verdict=verdict,
                confidence=confidence,
                evidence_quote=evidence if evidence_in_source else None,
                evidence_in_source=evidence_in_source,
            )
        )
    return reports


def _substr(quote: str, source: str) -> bool:
    return re.sub(r"\s+", " ", quote).strip() in re.sub(r"\s+", " ", source)


def compute_groundedness(claim_reports: list[ClaimReport], source_provided: bool) -> GroundednessReport:
    counts = {"SUPPORTED": 0, "UNSUPPORTED": 0, "CONTRADICTED": 0, "UNABLE_TO_VERIFY": 0}
    for c in claim_reports:
        counts[c.verdict] += 1

    if not source_provided:
        return GroundednessReport(
            na=True,
            percent=None,
            supported=counts["SUPPORTED"],
            unsupported=counts["UNSUPPORTED"],
            contradicted=counts["CONTRADICTED"],
            unverifiable=counts["UNABLE_TO_VERIFY"],
            total=len(claim_reports),
        )

    decidable = counts["SUPPORTED"] + counts["UNSUPPORTED"] + counts["CONTRADICTED"]
    percent = round(100 * counts["SUPPORTED"] / decidable) if decidable else None
    return GroundednessReport(
        na=False,
        percent=percent,
        supported=counts["SUPPORTED"],
        unsupported=counts["UNSUPPORTED"],
        contradicted=counts["CONTRADICTED"],
        unverifiable=counts["UNABLE_TO_VERIFY"],
        total=len(claim_reports),
    )


def determine_status(
    groundedness: GroundednessReport,
    relevance_percent: int,
    contradiction_presence: float | None,
) -> Status:
    # First match wins.
    if groundedness.contradicted >= 1:
        return STATUS_FAIL
    if groundedness.percent is not None and groundedness.percent < FAIL_GROUNDEDNESS:
        return STATUS_FAIL
    if relevance_percent < FAIL_RELEVANCE:
        return STATUS_FAIL
    if groundedness.percent is not None and groundedness.percent < WARNING_GROUNDEDNESS:
        return STATUS_WARNING
    if groundedness.unsupported >= WARNING_UNSUPPORTED:
        return STATUS_WARNING
    if contradiction_presence is not None and contradiction_presence >= WARNING_CONTRADICTION_NOUL:
        return STATUS_WARNING
    if groundedness.unverifiable >= 1:
        return STATUS_WARNING  # honesty: not everything could be verified
    return STATUS_PASS


def build_report(
    claims: list,
    verdicts: dict[int, Verdict],
    confidences: dict[int, float],
    source: str | None,
    relevance_score_index: float,
    relevance_confidence: float,
    contradiction_presence: float | None,
    meta: dict,
) -> ValidationReport:
    claim_reports = build_claim_reports(claims, verdicts, confidences, source)
    groundedness = compute_groundedness(claim_reports, source_provided=bool(source))
    percent = relevance_percent(relevance_score_index)
    status = determine_status(groundedness, percent, contradiction_presence)
    return ValidationReport(
        status=status,
        relevance=RelevanceReport(
            percent=percent,
            level=relevance_level(relevance_score_index),
            confidence=relevance_confidence,
        ),
        groundedness=groundedness,
        claims=claim_reports,
        contradiction_presence=contradiction_presence if source else None,
        meta=meta,
    )