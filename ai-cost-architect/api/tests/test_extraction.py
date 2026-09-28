"""Tests for JSON parsing/repair, verbatim-span enforcement and the retry."""

import pytest

from app.extraction import (
    ExtractionParseError,
    extraction_system_prompt,
    extract_claims,
    parse_extraction,
)


def test_parses_clean_json():
    result = parse_extraction(
        '{"claims": [{"text": "It costs $5.", "type": "fact", "evidence_quote": null}]}',
        answer="It costs $5.",
        source=None,
        max_claims=15,
    )
    assert len(result.claims) == 1
    assert result.claims[0].text == "It costs $5."


def test_parses_fenced_json():
    result = parse_extraction(
        '```json\n{"claims": [{"text": "It costs $5.", "type": "fact"}]}\n```',
        answer="It costs $5.",
        source=None,
        max_claims=15,
    )
    assert len(result.claims) == 1


def test_finds_json_with_leading_prose():
    result = parse_extraction(
        'Here you go:\n{"claims": [{"text": "It costs $5.", "type": "fact"}]} hope that helps',
        answer="It costs $5.",
        source=None,
        max_claims=15,
    )
    assert len(result.claims) == 1


def test_non_verbatim_claim_is_dropped_never_paraphrased():
    raw = '{"claims": [{"text": "It costs five dollars.", "type": "fact"}]}'
    result = parse_extraction(raw, answer="It costs $5.", source=None, max_claims=15)
    assert result.claims == []  # dropped, not rewritten


def test_whitespace_normalized_verbatim_still_accepted():
    raw = '{"claims": [{"text": "It   costs $5.", "type": "fact"}]}'
    result = parse_extraction(raw, answer="It costs $5.", source=None, max_claims=15)
    assert len(result.claims) == 1


def test_fabricated_evidence_quote_is_nulled():
    raw = (
        '{"claims": [{"text": "It costs $5.", "type": "fact", '
        '"evidence_quote": "The price is ten dollars."}]}'
    )
    result = parse_extraction(raw, answer="It costs $5.", source="Our price is $5 flat.", max_claims=15)
    assert result.claims[0].evidence_quote is None


def test_valid_evidence_quote_kept():
    raw = (
        '{"claims": [{"text": "It costs $5.", "type": "fact", '
        '"evidence_quote": "Our price is $5 flat."}]}'
    )
    result = parse_extraction(raw, answer="It costs $5.", source="Our price is $5 flat.", max_claims=15)
    assert result.claims[0].evidence_quote == "Our price is $5 flat."


def test_max_claims_cap():
    raw = '{"claims": [' + ",".join(
        [f'{{"text": "fact {i}", "type": "fact"}}' for i in range(20)]
    ) + "]}"
    result = parse_extraction(
        raw,
        answer=" ".join(f"fact {i}" for i in range(20)),
        source=None,
        max_claims=3,
    )
    assert len(result.claims) == 3


def test_invalid_json_raises():
    with pytest.raises(ExtractionParseError):
        parse_extraction("not json at all", answer="a", source=None, max_claims=15)


def test_schema_mismatch_raises():
    with pytest.raises(ExtractionParseError):
        parse_extraction('{"claims": [{"text": "", "type": "fact"}]}', answer="a", source=None, max_claims=15)


def test_unterminated_json_raises():
    with pytest.raises(ExtractionParseError):
        parse_extraction('{"claims": [{"text": "a", "type": "fact"}', answer="a", source=None, max_claims=15)


@pytest.mark.asyncio
async def test_retry_feeds_error_back_to_model():
    from tests.conftest import FakeLLMProvider

    provider = FakeLLMProvider([
        "garbage, not JSON",
        '{"claims": [{"text": "It costs $5.", "type": "fact"}]}',
    ])
    result = await extract_claims(provider, "q", "It costs $5.", None, 15)
    assert len(result.claims) == 1
    assert len(provider.calls) == 2
    assert "invalid" in provider.calls[1][1]  # retry user prompt mentions the parse error


@pytest.mark.asyncio
async def test_gives_up_after_one_retry():
    from tests.conftest import FakeLLMProvider

    provider = FakeLLMProvider(["garbage", "still garbage"])
    with pytest.raises(ExtractionParseError):
        await extract_claims(provider, "q", "It costs $5.", None, 15)
    assert len(provider.calls) == 2


def test_system_prompt_mentions_verbatim_and_limit():
    prompt = extraction_system_prompt(15)
    assert "character-for-character" in prompt
    assert "15" in prompt


@pytest.mark.asyncio
async def test_empty_content_retries_with_doubled_budget():
    """Reasoning-model starvation: 200-with-empty-content gets one retry at 2x budget."""
    from tests.conftest import FakeLLMProvider

    provider = FakeLLMProvider(
        ['{"claims": [{"text": "It costs $5.", "type": "fact"}]}'], empty_first=True
    )
    result = await extract_claims(provider, "q", "It costs $5.", None, 15, max_tokens=4000)
    assert len(result.claims) == 1
    assert provider.calls[0][2] == 4000   # initial budget
    assert provider.calls[1][2] == 8000   # doubled on the empty-content retry


@pytest.mark.asyncio
async def test_empty_content_twice_raises():
    from app.llm import EmptyContentError
    from tests.conftest import FakeLLMProvider

    provider = FakeLLMProvider(empty_always=True)
    with pytest.raises(EmptyContentError):
        await extract_claims(provider, "q", "It costs $5.", None, 15, max_tokens=4000)
    assert len(provider.calls) == 2  # one initial call + one doubled-budget retry, no more