"""Pure unit tests for the deterministic aggregation — no mocks needed."""

from app.aggregate import (
    compute_groundedness,
    determine_status,
    build_claim_reports,
    build_report,
)
from app.schemas import ClaimReport, GroundednessReport


def _claims(verdicts: list[str]) -> list[ClaimReport]:
    return [
        ClaimReport(
            id=i,
            text=f"claim {i}",
            type="fact",
            verdict=v,
            confidence=0.9,
            evidence_quote=None,
            evidence_in_source=False,
        )
        for i, v in enumerate(verdicts)
    ]


def _g(percent=None, na=False, s=0, u=0, c=0, uv=0, total=0) -> GroundednessReport:
    return GroundednessReport(
        na=na, percent=percent, supported=s, unsupported=u,
        contradicted=c, unverifiable=uv, total=total,
    )


class TestGroundedness:
    def test_supported_ratio(self):
        g = compute_groundedness(_claims(["SUPPORTED", "SUPPORTED", "UNSUPPORTED"]), source_provided=True)
        assert g.percent == 67  # round(100 * 2/3)
        assert g.total == 3

    def test_all_supported_is_100(self):
        g = compute_groundedness(_claims(["SUPPORTED"] * 4), source_provided=True)
        assert g.percent == 100

    def test_no_decidable_claims_is_none(self):
        g = compute_groundedness(_claims(["UNABLE_TO_VERIFY"]), source_provided=True)
        assert g.percent is None

    def test_no_source_is_na(self):
        g = compute_groundedness(_claims(["UNABLE_TO_VERIFY", "UNABLE_TO_VERIFY"]), source_provided=False)
        assert g.na is True
        assert g.percent is None
        assert g.unverifiable == 2


class TestStatus:
    def test_contradicted_always_fails(self):
        assert determine_status(_g(percent=100, s=5, c=1, total=6), 100, 0.0) == "fail"

    def test_groundedness_below_50_fails(self):
        assert determine_status(_g(percent=49, s=1, u=1, total=2), 100, 0.0) == "fail"

    def test_groundedness_50_is_not_fail(self):
        assert determine_status(_g(percent=50, s=1, u=1, total=2), 100, 0.0) == "warning"

    def test_relevance_below_50_fails(self):
        assert determine_status(_g(percent=100, s=4, total=4), 49, 0.0) == "fail"

    def test_relevance_50_is_not_fail(self):
        assert determine_status(_g(percent=100, s=4, total=4), 50, 0.0) == "pass"

    def test_groundedness_below_80_warns(self):
        assert determine_status(_g(percent=79, s=3, u=1, total=4), 100, 0.0) == "warning"

    def test_groundedness_80_passes(self):
        assert determine_status(_g(percent=80, s=4, u=1, total=5), 100, 0.0) == "pass"

    def test_three_unsupported_warns(self):
        assert determine_status(_g(percent=100, s=3, u=3, total=6), 100, 0.0) == "warning"

    def test_two_unsupported_passes(self):
        assert determine_status(_g(percent=100, s=4, u=2, total=6), 100, 0.0) == "pass"

    def test_contradiction_noul_at_threshold_warns(self):
        assert determine_status(_g(percent=100, s=4, total=4), 100, 0.5) == "warning"

    def test_any_unverifiable_warns(self):
        assert determine_status(_g(percent=100, s=4, uv=1, total=5), 100, 0.0) == "warning"

    def test_clean_pass(self):
        assert determine_status(_g(percent=100, s=4, total=4), 100, 0.0) == "pass"

    def test_na_groundedness_never_fails_on_groundedness(self):
        # No source: percent is None, no contradicted claims -> only relevance can fail.
        assert determine_status(_g(na=True, uv=3, total=3), 100, None) == "warning"


class TestClaimReports:
    def test_missing_verdict_is_unable_to_verify(self):
        class C:
            text = "t"
            type = "fact"
            evidence_quote = None

        reports = build_claim_reports([C()], verdicts={}, confidences={}, source=None)
        assert reports[0].verdict == "UNABLE_TO_VERIFY"
        assert reports[0].confidence == 0.0

    def test_fabricated_evidence_is_dropped(self):
        class C:
            text = "t"
            type = "fact"
            evidence_quote = "not in the source"

        reports = build_claim_reports(
            [C()], verdicts={0: "UNSUPPORTED"}, confidences={0: 0.8},
            source="the real source text",
        )
        assert reports[0].evidence_quote is None
        assert reports[0].evidence_in_source is False

    def test_verbatim_evidence_is_kept(self):
        class C:
            text = "t"
            type = "fact"
            evidence_quote = "real source text"

        reports = build_claim_reports(
            [C()], verdicts={0: "SUPPORTED"}, confidences={0: 0.8},
            source="the real source text lives here",
        )
        assert reports[0].evidence_quote == "real source text"
        assert reports[0].evidence_in_source is True


class TestBuildReport:
    def test_relevance_percent_from_score_index(self):
        class C:
            text = "t"
            type = "fact"
            evidence_quote = None

        report = build_report(
            [C()], verdicts={}, confidences={}, source=None,
            relevance_score_index=4.0, relevance_confidence=0.9,
            contradiction_presence=None, meta={},
        )
        assert report.relevance.percent == 100
        assert report.relevance.level == "Directly and completely answers the question asked"
        assert report.groundedness.na is True