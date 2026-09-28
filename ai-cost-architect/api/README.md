# TokIQ Answer Validator API

FastAPI backend for the LLM Answer Validator tool. Pipeline:

```
POST /api/validate {question, answer, source?}
  → LLM claim extraction (OpenAI | Anthropic | Groq | Ollama, configurable)
  → Jev (TypeSafe System One) batched semantic decisions
  → deterministic aggregation
  → ValidationReport (relevance, groundedness, per-claim verdicts + evidence)
```

When no source is provided, claims are honestly reported `UNABLE_TO_VERIFY` and
groundedness is `N/A` — the API never claims factual correctness without a source
of truth.

## Run locally

```bash
cd api
python -m venv .venv
.venv\Scripts\activate          # Windows (bash: source .venv/bin/activate)
pip install -r requirements.txt
copy .env.example .env          # set TYPESAFE_API_KEY (+ provider key, or use Ollama)
uvicorn app.main:app --reload --port 8000
```

CORS is preconfigured for `http://localhost:4200` (the Angular dev server).

- `GET  /api/health` — which providers are configured, whether Jev is ready
- `POST /api/validate` — run a validation

## Providers

`EXTRACTION_PROVIDER` selects the claim-extraction LLM: `ollama` (default,
local + free), `openai`, `anthropic`, or `groq`. Each needs its API key env var
(except Ollama, which needs `OLLAMA_BASE_URL` reachable). `EXTRACTION_MODEL`
overrides the default model; `EXTRACTION_BASE_URL` overrides the provider's
base URL (proxies, gateways).

## Tests

```bash
pytest
```

All external calls are faked; no keys or running services are needed.