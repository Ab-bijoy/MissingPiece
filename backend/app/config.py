"""Settings from environment variables (build prompt section 11).

Every host-specific value lives here, read from `backend/.env` locally or from
the host's environment in production. Nothing is hard-coded.
"""

from decimal import Decimal
from functools import lru_cache

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Database: postgresql+psycopg://user:password@host:5432/dbname (add ?sslmode=require on Neon)
    database_url: str
    # Separate, empty database for pytest. Tests drop every table, so never point it at real data.
    test_database_url: str | None = None

    # Supabase Auth: identity only. Set the JWT secret (HS256 projects) or the JWKS URL (newer projects).
    supabase_url: str = ""
    supabase_jwt_secret: str = ""
    supabase_jwks_url: str = ""
    supabase_jwt_audience: str = "authenticated"
    supabase_service_role_key: str = ""  # storage and seed script only, never sent to the browser
    storage_bucket: str = "registration-documents"

    # Development only: accept tokens signed with DEV_JWT_SECRET instead of Supabase's.
    # Lets you call the API before Supabase is set up. Never turn on in production.
    dev_auth: bool = False
    dev_jwt_secret: str = "dev-only-secret-change-me-at-least-32-bytes"

    groq_api_key: str = ""
    groq_model: str = "openai/gpt-oss-20b"
    groq_moderation_timeout_seconds: float = Field(default=6.0, gt=0, le=30)

    payment_provider: str = "mock"
    payment_webhook_secret: str = "dev-webhook-secret"
    # SSLCommerz (PAYMENT_PROVIDER=sslcommerz). Sandbox store: developer.sslcommerz.com/registration
    sslcommerz_store_id: str = ""
    sslcommerz_store_password: str = ""
    sslcommerz_sandbox: bool = True  # false = real money
    # The backend's public address for gateway callbacks, e.g. https://api.example.com.
    # Empty = the address the request came in on (fine on localhost).
    api_public_url: str = ""
    platform_commission_rate: Decimal = Decimal("0.05")

    # Email for approval and rejection notices (build prompt 10: SMTP, off until filled in).
    # Gmail: host smtp.gmail.com, port 465, user = your Gmail address, password = a 16-letter App password.
    smtp_host: str = ""
    smtp_port: int = 465
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = ""  # defaults to smtp_user
    smtp_from_name: str = "MissingPiece"

    @property
    def smtp_enabled(self) -> bool:
        return bool(self.smtp_host and self.smtp_user and self.smtp_password)

    # Comma-separated list of allowed browser origins, e.g. http://localhost:5173
    cors_origins: str = "http://localhost:5173"
    # Where the mock payment page sends the sponsor back to
    frontend_url: str = "http://localhost:5173"
    jobs_secret: str = "dev-jobs-secret"

    @field_validator("database_url", "test_database_url")
    @classmethod
    def use_psycopg3(cls, v: str | None) -> str | None:
        # Accept plain postgresql:// URLs (as pgAdmin and Neon show them) and use the psycopg 3 driver.
        if v and v.startswith("postgresql://"):
            return "postgresql+psycopg://" + v[len("postgresql://") :]
        if v and v.startswith("postgres://"):
            return "postgresql+psycopg://" + v[len("postgres://") :]
        return v

    @staticmethod
    def is_placeholder(secret: str) -> bool:
        """True for empty, short or example secrets (the values in .env.example are public)."""
        s = secret.strip().lower()
        return len(s) < 32 or s.startswith(("change-me", "dev-only", "dev-webhook", "dev-jobs"))

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
