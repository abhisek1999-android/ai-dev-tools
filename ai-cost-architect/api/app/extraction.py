"""Claim-extraction prompt, robust JSON parsing and verbatim-span enforcement."""

import json
import logging
import re

from pydantic import ValidationError

from .schemas import ExtractionResult

logger = logging.getLogger("tokiq.extraction")

_FENCE_RE = re.compile(r"^```(?:json)?\s*|\s*```$", re.MULTILINE)


class ExtractionParseError(Exception):
    """The model's output could not be parsed into ExtractionResult."""


def extraction_system_prompt(max_claims: int) -> str:
    return (
        "You are a precise claim extractor. You never paraphrase. You extract atomic, "
        "checkable factual claims from an LLM answer and, when a source is provided, "
        "the exact source sentences that relate to each claim.\n\n"
        "Rules:\n"
        "- An ATOMIC claim is a single verifiable statement. Split compound sentences "
        "into separate claims.\n"
        "- Skip purely restating the question, pure opinions without factual content, "
        "and boilerplate greetings.\n"
        "- Include at most " + str(max_claims) + " claims, prioritizing the most "
        "consequential facts (numbers, dates, policies, named facts).\n"
        '- For each claim, "text" MUST be copied character-for-character from the ANSWER. '
        "Never rewrite, trim or merge wording.\n"
        '- When a SOURCE is provided, "evidence_quote" MUST be copied character-for-character '
        "from the SOURCE and be the sentence(s) that most directly bear on the claim. "
        'Use null if the source says nothing about it. Never fabricate a quote.\n'
        '- "type" is "fact" for assertions, "hedged" for claims qualified by might/could/'
        'possibly, "opinion" for subjective statements.\n\n'
        "Return ONLY JSON matching exactly:\n"
        '{"claims": [{"text": str, "type": "fact"|"hedged"|"opinion", '
        '"evidence_quote": str|null}]}'
    )


def extraction_user_prompt(question: str, answer: str, source: str | None) -> str:
    parts = [f"QUESTION:\n{question}"]
    parts.append(f"SOURCE:\n{source if source else 'NO SOURCE PROVIDED'}")
    parts.append(f"ANSWER:\n{answer}")
    return "\n\n".join(parts)


def _strip_fences(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        text = _FENCE_RE.sub("", text).strip()
    return text


def _find_json_object(text: str) -> str:
    """Return the outermost {...} block, tolerating leading prose or trailing garbage."""
    start = text.find("{")
    if start == -1:
        raise ExtractionParseError("No JSON object found in model output")
    depth = 0
    in_string = False
    escape = False
    for i, ch in enumerate(text[start:], start=start):
        if escape:
            escape = False
            continue
        if ch == "\\":
            escape = True
            continue
        if ch == '"':
            in_string = not in_string
            continue
        if in_string:
            continue
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return text[start : i + 1]
    raise ExtractionParseError("Unterminated JSON object in model output")


def _normalize_ws(s: str) -> str:
    return re.sub(r"\s+", " ", s).strip()


def parse_extraction(raw: str, answer: str, source: str | None, max_claims: int) -> ExtractionResult:
    """Parse the model output into ExtractionResult, enforcing verbatim spans.

    Claims whose text is not a (whitespace-normalized) substring of the answer are
    DROPPED, never paraphrased — the report must only ever quote the original answer.
    Evidence quotes not found in the source are nulled out (and will be flagged via
    evidence_in_source downstream if they somehow survive).
    """
    cleaned = _find_json_object(_strip_fences(raw))
    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError as exc:
        raise ExtractionParseError(f"Invalid JSON: {exc}") from exc
    try:
        result = ExtractionResult.model_validate(data)
    except ValidationError as exc:
        raise ExtractionParseError(f"Schema mismatch: {exc.errors()[0]['msg']}") from exc

    answer_norm = _normalize_ws(answer)
    source_norm = _normalize_ws(source) if source else None

    kept = []
    for claim in result.claims[:max_claims]:
        if _normalize_ws(claim.text) not in answer_norm:
            logger.warning("dropping non-verbatim claim (not found in answer): %r", claim.text)
            continue  # not verbatim -> drop rather than modify the answer
        if claim.evidence_quote and (source_norm is None or _normalize_ws(claim.evidence_quote) not in source_norm):
            logger.warning("nulling fabricated/unmatched evidence quote: %r", claim.evidence_quote)
            claim.evidence_quote = None  # fabricated or drifted quote -> drop the quote
        kept.append(claim)
    dropped = len(result.claims) - len(kept)
    if dropped:
        logger.warning("%d claim(s) dropped by verbatim/span enforcement", dropped)
    return ExtractionResult(claims=kept)


async def extract_claims(
    provider,
    question: str,
    answer: str,
    source: str | None,
    max_claims: int,
    max_tokens: int = 4000,
) -> ExtractionResult:
    """Run extraction, with two one-shot retries: doubled token budget for empty
    output (reasoning models), and one parse-repair retry feeding the error back."""
    from .llm import EmptyContentError

    system = extraction_system_prompt(max_claims)
    user = extraction_user_prompt(question, answer, source)

    try:
        raw = await provider.complete_json(system, user, max_tokens)
    except EmptyContentError as exc:
        # The model thought past its budget — give it twice the headroom, once.
        logger.warning("empty extraction output (%s) — retrying with doubled token budget", exc)
        raw = await provider.complete_json(system, user, max_tokens * 2)

    logger.debug("extraction raw output: %s", raw[:500])
    first_error: ExtractionParseError | None = None
    try:
        return parse_extraction(raw, answer, source, max_claims)
    except ExtractionParseError as exc:
        first_error = exc  # kept for the retry message; `as` names are scoped to the block
        logger.warning("extraction output unparseable (%s) — retrying once", exc)

    retry_user = (
        f"{user}\n\nYour previous reply was invalid: {first_error}\n"
        "Reply again with ONLY the corrected JSON, no prose, no code fences."
    )
    raw = await provider.complete_json(system, retry_user)
    return parse_extraction(raw, answer, source, max_claims)