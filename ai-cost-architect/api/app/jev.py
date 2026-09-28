"""httpx client for TypeSafe's Jev (System One) — POST api.typesafe.ai/v1/systemone.

Jev returns typed answers (choice/score/noul) for a state + question set in one
batched, parallel call. It never generates prose, so evidence quotes must come from
the extraction LLM; this client only ever yields verdicts, scores and probabilities.
"""

import logging

import httpx

logger = logging.getLogger("tokiq.jev")


class JevError(Exception):
    """The Jev call failed after one retry."""


class JevClient:
    def __init__(self, api_key: str, model: str, timeout: float):
        if not api_key:
            raise JevError("TYPESAFE_API_KEY is not set")
        self._api_key = api_key
        self._model = model
        self._timeout = timeout
        self._url = "https://api.typesafe.ai/v1/systemone"

    async def decide(self, state: str, questions: dict) -> dict:
        """One decision call, retried once on timeout/5xx (the call is idempotent)."""
        body = {"state": state, "model": self._model, "questions": questions}
        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }
        last_error: Exception | None = None
        for attempt in (1, 2):
            try:
                async with httpx.AsyncClient(timeout=self._timeout) as client:
                    resp = await client.post(self._url, json=body, headers=headers)
                if resp.status_code < 500:
                    if resp.status_code >= 400:
                        raise JevError(f"Jev returned {resp.status_code}: {resp.text[:300]}")
                    logger.debug("Jev response: %s", resp.text[:500])
                    return resp.json()
                last_error = JevError(f"Jev returned {resp.status_code}")
                logger.warning("Jev 5xx on attempt %d — %s", attempt, last_error)
            except httpx.TimeoutException as exc:
                last_error = JevError(f"Jev timed out after {self._timeout}s")
                logger.warning("Jev timeout on attempt %d — %s", attempt, last_error)
                if attempt == 1:
                    continue
                raise last_error from exc
            except httpx.HTTPError as exc:
                last_error = JevError(f"Jev request failed: {exc}")
            if attempt == 2:
                break
        raise last_error or JevError("Jev call failed")