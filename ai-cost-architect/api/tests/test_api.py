"""API-level tests: validation errors, health, not_configured, CORS."""

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_reports_configuration():
    resp = client.get("/api/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert "default_provider" in body
    assert "providers_configured" in body
    assert "jev_configured" in body


def test_empty_question_is_422():
    resp = client.post(
        "/api/validate",
        json={"question": "", "answer": "some answer"},
    )
    assert resp.status_code == 422


def test_missing_answer_is_422():
    resp = client.post("/api/validate", json={"question": "q"})
    assert resp.status_code == 422


def test_overlong_source_is_422():
    resp = client.post(
        "/api/validate",
        json={"question": "q", "answer": "a", "source": "x" * 20000},
    )
    assert resp.status_code == 422


def test_error_responses_are_normalized(monkeypatch):
    # Hermetic: force an unconfigured provider regardless of any live .env /
    # running Ollama on the dev machine, so the API must return a clean error.
    from app import main as app_main
    from app.config import Settings

    dead = Settings(
        extraction_provider="openai",
        openai_api_key="",  # explicit empty overrides any OS-level env var
        typesafe_api_key="",
        _env_file=None,
    )
    monkeypatch.setattr(app_main, "get_settings", lambda: dead)

    resp = client.post(
        "/api/validate",
        json={"question": "q", "answer": "a"},
    )
    assert resp.status_code == 503
    body = resp.json()
    assert body["error"] == "not_configured"
    assert "OPENAI_API_KEY" in body["detail"]


def test_cors_preflight_allows_dev_origin():
    resp = client.options(
        "/api/validate",
        headers={
            "Origin": "http://localhost:4200",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "Content-Type",
        },
    )
    assert resp.status_code == 200
    assert resp.headers["access-control-allow-origin"] == "http://localhost:4200"


def test_cors_rejects_unknown_origin():
    resp = client.options(
        "/api/validate",
        headers={"Origin": "http://evil.example", "Access-Control-Request-Method": "POST"},
    )
    # CORSMiddleware denies disallowed origins.
    assert resp.status_code == 400