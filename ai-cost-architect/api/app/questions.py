"""Jev question-set builder — the semantic contract of the validator.

One batched call per validation. When no source is provided, per-claim questions
are skipped entirely: every claim is UNABLE_TO_VERIFY by construction, so asking
Jev to judge them would both waste latency and invite unjustified verdicts.
"""

# Ordered rubric for the relevance score. Index i maps to percent = i * 25.
RELEVANCE_LEVELS = [
    "Answers a different question entirely",
    "Tangential — mentions the topic but misses what was asked",
    "Partially addresses it; key aspects missing or vague",
    "Addresses the question with minor omissions",
    "Directly and completely answers the question asked",
]

VERDICT_OPTIONS = ["supported", "unsupported", "contradicted", "unverifiable"]

_CLAIM_INSTRUCTIONS = (
    "Claim {n} from the ANSWER is: \"{text}\". Judge it against the SOURCE only."
)

_CLAIM_CRITERIA = {
    "supported": "The SOURCE explicitly states or unambiguously entails the claim.",
    "unsupported": "The SOURCE addresses the topic but does not go as far as the "
    "claim — the answer asserts more than the source establishes.",
    "contradicted": "The SOURCE states something incompatible with the claim.",
    "unverifiable": "The claim cannot be judged from the SOURCE at all — it is "
    "subjective, an opinion or prediction, or the source contains nothing about it.",
}

_CONTRADICTION_NOUL = (
    "To what degree does the ANSWER contain statements that conflict with the SOURCE?"
)


def build_state(question: str, answer: str, source: str | None) -> str:
    parts = [f"QUESTION:\n{question}"]
    parts.append(f"SOURCE:\n{source if source else 'NO SOURCE PROVIDED'}")
    parts.append(f"ANSWER:\n{answer}")
    return "\n\n".join(parts)


def build_questions(claim_texts: list[str], source_provided: bool) -> dict:
    """Return the Jev question map for one validation run.

    Always includes the relevance score. Claim-verdict choices and the contradiction
    noul only make sense against a source, so they are omitted without one.
    """
    questions: dict = {
        "relevance": {
            "type": "score",
            "instructions": "How well does the ANSWER address the QUESTION actually asked?",
            "criteria": RELEVANCE_LEVELS,
        }
    }
    if not source_provided:
        return questions

    for i, text in enumerate(claim_texts):
        questions[f"claim_{i}"] = {
            "type": "choice",
            "instructions": _CLAIM_INSTRUCTIONS.format(n=i + 1, text=text),
            "criteria": dict(_CLAIM_CRITERIA),
        }
    questions["contradiction"] = {"type": "noul", "instructions": _CONTRADICTION_NOUL}
    return questions