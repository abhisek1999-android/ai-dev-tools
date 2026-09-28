"""Settings + provider registry for the TokIQ Answer Validator API."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class ProviderSpec:
    """Static facts about a supported extraction provider."""

    def __init__(self, name: str, default_base_url: str, api_key_env: str, default_model: str, key_optional: bool = False):
        self.name = name
        self.default_base_url = default_base_url
        self.api_key_env = api_key_env
        self.default_model = default_model
        self.key_optional = key_optional


PROVIDERS: dict[str, ProviderSpec] = {
    "openai": ProviderSpec("openai", "https://api.openai.com/v1", "OPENAI_API_KEY", "gpt-4o-mini"),
    "anthropic": ProviderSpec("anthropic", "https://api.anthropic.com", "ANTHROPIC_API_KEY", "claude-haiku-4-5-20251001"),
    "groq": ProviderSpec("groq", "https://api.groq.com/openai/v1", "GROQ_API_KEY", "llama-3.3-70b-versatile"),
    # Ollama needs no real key; requests fail loudly at connection time if the server is down.
    "ollama": ProviderSpec("ollama", "http://localhost:11434/v1", "OLLAMA_API_KEY", "llama3.1", key_optional=True),
}


class NotConfigured(Exception):
    """Raised when the selected provider is missing its credentials."""

    def __init__(self, detail: str):
        self.detail = detail
        super().__init__(detail)


class Settings(BaseSettings):
    """All knobs come from the environment (or api/.env); nothing is hard-coded."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    extraction_provider: str = "ollama"
    extraction_model: str = ""  # blank = provider default
    extraction_base_url: str = ""  # blank = provider default
    ollama_base_url: str = "http://localhost:11434/v1"

    openai_api_key: str = ""
    anthropic_api_key: str = ""
    groq_api_key: str = ""

    typesafe_api_key: str = ""
    jev_model: str = "jev-latest"

    cors_origins: str = "http://localhost:4200,http://127.0.0.1:4200"
    extraction_timeout_seconds: float = 60.0
    jev_timeout_seconds: float = 30.0
    max_claims: int = 15
    log_level: str = "INFO"
    # Reasoning models (e.g. GLM) spend the completion budget on thinking before
    # emitting output — 2000 tokens reliably starves them on longer inputs.
    extraction_max_tokens: int = 4000

    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    def resolve_provider(self, hint: str | None = None) -> "ResolvedProvider":
        """Map a provider hint (or the configured default) to base URL, key and model.

        Raises NotConfigured with the exact missing variable so the API can return
        a self-explanatory 503.
        """
        name = (hint or self.extraction_provider).strip().lower()
        if name not in PROVIDERS:
            raise NotConfigured(
                f"Unknown provider '{name}'. Supported: {', '.join(sorted(PROVIDERS))}."
            )
        spec = PROVIDERS[name]

        if name == "ollama" and not self.extraction_base_url:
            base_url = self.ollama_base_url
        else:
            base_url = self.extraction_base_url or spec.default_base_url

        if spec.key_optional:
            # Local runtimes (Ollama) accept any non-empty bearer; the server being
            # reachable is the real check.
            api_key = "ollama"
        else:
            api_key = getattr(self, spec.api_key_env.lower(), "")
            if not api_key:
                raise NotConfigured(f"EXTRACTION_PROVIDER={name} requires {spec.api_key_env} to be set.")

        model = self.extraction_model or spec.default_model
        return ResolvedProvider(name=name, base_url=base_url.rstrip("/"), api_key=api_key, model=model)

    def jev_configured(self) -> bool:
        return bool(self.typesafe_api_key)


class ResolvedProvider(BaseSettings):
    model_config = SettingsConfigDict(env_file=None, extra="allow")

    name: str
    base_url: str
    api_key: str
    model: str


@lru_cache
def get_settings() -> Settings:
    return Settings()