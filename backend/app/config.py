"""
Configuration management for the AI Assistant application.
Loads environment variables and provides typed configuration access.
"""

from pathlib import Path
from dotenv import load_dotenv
from pydantic import Field
from pydantic_settings import BaseSettings

# Load environment variables from .env file
env_path = Path(__file__).parent.parent / ".env"
load_dotenv(env_path)


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # API Keys
    thesys_api_key: str = Field(default="", env="THESYS_API_KEY")

    # Model Configuration
    thesys_model: str = Field(default="c1/openai/gpt-5/v-20251130", env="THESYS_MODEL")

    # Server Configuration
    host: str = Field(default="0.0.0.0", env="HOST")
    port: int = Field(default=8000, env="PORT")
    debug: bool = Field(default=True, env="DEBUG")

    # CORS Configuration
    cors_origins: str = Field(
        default="http://localhost:3000,http://127.0.0.1:3000", env="CORS_ORIGINS"
    )

    # Session Configuration
    session_timeout_minutes: int = Field(default=60, env="SESSION_TIMEOUT_MINUTES")
    max_upload_size_mb: int = Field(default=10, env="MAX_UPLOAD_SIZE_MB")

    # Thesys API Configuration
    thesys_base_url: str = "https://api.thesys.dev/v1/embed"
    thesys_pdf_export_url: str = "https://api.thesys.dev/v1/artifact/pdf/export"

    @property
    def cors_origins_list(self) -> list[str]:
        """Return CORS origins as a list."""
        return [origin.strip() for origin in self.cors_origins.split(",")]

    @property
    def max_upload_size_bytes(self) -> int:
        """Return max upload size in bytes."""
        return self.max_upload_size_mb * 1024 * 1024

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"  # Ignore extra env variables like OPENAI_API_KEY


# Global settings instance
settings = Settings()


def validate_settings() -> None:
    """Validate that required settings are configured."""
    errors = []

    if (
        not settings.thesys_api_key
        or settings.thesys_api_key == "your_thesys_api_key_here"
    ):
        errors.append("THESYS_API_KEY is not configured")

    if errors:
        raise ValueError(f"Configuration errors: {', '.join(errors)}")
