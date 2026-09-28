"""LLM provider adapters for claim extraction.

One OpenAI-compatible adapter covers OpenAI, Groq and Ollama (same /chat/completions
contract, different base_url); a small Anthropic adapter covers /v1/messages.
Plain httpx — no vendor SDKs — so timeouts, retries and error mapping are identical
across all four providers.
"""

import logging
from typing import Protocol

import httpx

from .config import NotConfigured, ResolvedProvider, Settings
from .schemas import ExtractionResult

logger = logging.getLogger("tokiq.llm")


class LLMProvider(Protocol):
    async def complete_json(self, system: str, user: str, max_tokens: int = 2000) -> str:
        """Return the raw text of the model's completion (expected to be JSON)."""
        ...


class ExtractionError(Exception):
    """The provider call failed at the transport/auth level (not a JSON-parse issue)."""


class EmptyContentError(ExtractionError):
    """The provider returned 200 but no output — typically a reasoning model that
    spent the entire max_tokens budget on thinking (finish_reason="length")."""


def _empty_content_error(provider_name: str, finish_reason: str | None) -> EmptyContentError:
    return EmptyContentError(
        f"{provider_name} returned empty content (finish_reason={finish_reason or 'unknown'}). "
        "A reasoning model likely spent the whole max_tokens budget thinking. "
        "Raise EXTRACTION_MAX_TOKENS in api/.env or switch EXTRACTION_MODEL to a non-reasoning model."
    )


class OpenAICompatibleProvider:
    """POST {base_url}/chat/completions — works for OpenAI, Groq and Ollama."""

    def __init__(self, resolved: ResolvedProvider, timeout: float):
        self._resolved = resolved
        self._timeout = timeout

    async def complete_json(self, system: str, user: str, max_tokens: int = 2000) -> str:
        body = {
            "model": self._resolved.model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "response_format": {"type": "json_object"},
            "max_tokens": max_tokens,
            "temperature": 0,
        }
        headers = {"Authorization": f"Bearer {self._resolved.api_key}"}
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                resp = await client.post(
                    f"{self._resolved.base_url}/chat/completions", json=body, headers=headers
                )
        except httpx.TimeoutException as exc:
            raise ExtractionError(f"{self._resolved.name} timed out after {self._timeout}s") from exc
        except httpx.HTTPError as exc:
            raise ExtractionError(f"{self._resolved.name} request failed: {exc}") from exc
        if resp.status_code >= 500:
            raise ExtractionError(f"{self._resolved.name} returned {resp.status_code}")
        if resp.status_code >= 400:
            raise ExtractionError(f"{self._resolved.name} returned {resp.status_code}: {resp.text[:300]}")
        data = resp.json()
        try:
            choice = data["choices"][0]
            content = choice["message"]["content"] or ""
        except (KeyError, IndexError, TypeError) as exc:
            raise ExtractionError(f"Unexpected response shape from {self._resolved.name}") from exc
        if not content.strip():
            raise _empty_content_error(self._resolved.name, choice.get("finish_reason"))
        if choice.get("finish_reason") == "length":
            # Output made it but was cut off — the parse layer repairs truncated
            # JSON, but the caller should know why a repair was needed.
            logger.warning(
                "%s output truncated by max_tokens — trailing claims may be lost",
                self._resolved.name,
            )
        return content


class AnthropicProvider:
    """POST {base_url}/v1/messages."""

    def __init__(self, resolved: ResolvedProvider, timeout: float):
        self._resolved = resolved
        self._timeout = timeout

    async def complete_json(self, system: str, user: str, max_tokens: int = 2000) -> str:
        body = {
            "model": self._resolved.model,
            "system": system,
            "messages": [{"role": "user", "content": user}],
            "max_tokens": max_tokens,
            "temperature": 0,
        }
        headers = {
            "x-api-key": self._resolved.api_key,
            "anthropic-version": "2023-06-01",
        }
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                resp = await client.post(
                    f"{self._resolved.base_url}/v1/messages", json=body, headers=headers
                )
        except httpx.TimeoutException as exc:
            raise ExtractionError(f"{self._resolved.name} timed out after {self._timeout}s") from exc
        except httpx.HTTPError as exc:
            raise ExtractionError(f"{self._resolved.name} request failed: {exc}") from exc
        if resp.status_code >= 500:
            raise ExtractionError(f"{self._resolved.name} returned {resp.status_code}")
        if resp.status_code >= 400:
            raise ExtractionError(f"{self._resolved.name} returned {resp.status_code}: {resp.text[:300]}")
        data = resp.json()
        try:
            blocks = data["content"]
            stop_reason = data.get("stop_reason")
        except (KeyError, TypeError) as exc:
            raise ExtractionError(f"Unexpected response shape from {self._resolved.name}") from exc
        content = "".join(block.get("text", "") for block in blocks)
        if not content.strip():
            raise _empty_content_error(self._resolved.name, stop_reason)
        return content


def build_provider(settings: Settings, hint: str | None = None) -> LLMProvider:
    """Resolve the configured provider into a ready adapter. Raises NotConfigured."""
    resolved = settings.resolve_provider(hint)
    if resolved.name == "anthropic":
        return AnthropicProvider(resolved, settings.extraction_timeout_seconds)
    return OpenAICompatibleProvider(resolved, settings.extraction_timeout_seconds)