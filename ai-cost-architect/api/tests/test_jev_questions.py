"""Tests for the Jev question-set builder."""

from app.questions import build_questions, build_state


def test_state_contains_all_three_sections():
    state = build_state("q", "a", "s")
    assert "QUESTION:\nq" in state
    assert "SOURCE:\ns" in state
    assert "ANSWER:\na" in state


def test_state_without_source_says_no_source():
    assert "NO SOURCE PROVIDED" in build_state("q", "a", None)


def test_relevance_always_present():
    questions = build_questions([], source_provided=False)
    assert questions["relevance"]["type"] == "score"
    assert len(questions["relevance"]["criteria"]) == 5


def test_claim_questions_only_with_source():
    with_src = build_questions(["claim one"], source_provided=True)
    without_src = build_questions(["claim one"], source_provided=False)
    assert "claim_0" in with_src
    assert "claim_0" not in without_src
    assert "contradiction" in with_src
    assert "contradiction" not in without_src


def test_claim_choice_shape():
    questions = build_questions(["claim one", "claim two"], source_provided=True)
    for key in ("claim_0", "claim_1"):
        q = questions[key]
        assert q["type"] == "choice"
        assert set(q["criteria"]) == {"supported", "unsupported", "contradicted", "unverifiable"}
        assert "claim one" in questions["claim_0"]["instructions"]
        assert "claim two" in questions["claim_1"]["instructions"]


def test_relevance_criteria_are_stable():
    """Golden-string: wording changes here change what users see — must be deliberate."""
    questions = build_questions([], source_provided=True)
    assert questions["relevance"]["criteria"] == [
        "Answers a different question entirely",
        "Tangential — mentions the topic but misses what was asked",
        "Partially addresses it; key aspects missing or vague",
        "Addresses the question with minor omissions",
        "Directly and completely answers the question asked",
    ]