"""
Health check functionality for the AI Assistant API.
Provides detailed diagnostics about the application status and dependencies.
"""

from datetime import datetime
from pydantic import BaseModel
from app.config import settings


class HealthStatus(BaseModel):
    """Health status response model."""

    status: str  # "healthy" or "degraded"
    timestamp: str
    version: str
    uptime_seconds: float | None = None
    dependencies: dict[str, bool]
    configuration: dict[str, str | bool]


async def get_health_status(start_time: datetime) -> HealthStatus:
    """
    Get comprehensive health status of the application.

    Args:
        start_time: Application start time for uptime calculation

    Returns:
        HealthStatus object with detailed diagnostics
    """
    uptime = (datetime.utcnow() - start_time).total_seconds()

    # Check dependencies
    dependencies = {
        "thesys_api_configured": bool(
            settings.thesys_api_key
            and settings.thesys_api_key != "your_thesys_api_key_here"
        ),
    }

    # Determine overall status
    all_healthy = all(dependencies.values())
    status = "healthy" if all_healthy else "degraded"

    return HealthStatus(
        status=status,
        timestamp=datetime.utcnow().isoformat() + "Z",
        version="1.0.0",
        uptime_seconds=uptime,
        dependencies=dependencies,
        configuration={
            "debug": settings.debug,
            "host": settings.host,
            "port": settings.port,
            "session_timeout_minutes": settings.session_timeout_minutes,
            "max_upload_size_mb": settings.max_upload_size_mb,
            "cors_origins_count": len(settings.cors_origins_list),
        },
    )
