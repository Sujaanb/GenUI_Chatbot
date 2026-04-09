"""
AI Assistant - FastAPI Application
A Generative UI chatbot for document analysis using Thesys C1 and LangGraph.
"""

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from datetime import datetime

from app.config import settings, validate_settings
from app.api import chat_endpoint
from app.health import get_health_status


# Track application start time for uptime calculation
start_time = datetime.utcnow()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events."""
    # Startup
    print("🚀 Starting AI Assistant...")
    try:
        validate_settings()
        print("✅ Configuration validated successfully")
    except ValueError as e:
        print(f"⚠️  Configuration warning: {e}")
        print("   Please update your .env file with valid API keys")

    yield

    # Shutdown
    print("👋 Shutting down AI Assistant...")


# Create FastAPI application
app = FastAPI(
    title="AI Assistant",
    description="""
    A Generative UI chatbot for document analysis.
    
    ## Features
    - Upload Excel files for analysis
    - Analyze documents with interactive visualizations
    - Natural language interface for querying data
    - Export analysis reports as PDF
    
    ## Powered By
    - Thesys C1 for Generative UI
    - LangGraph for intelligent agents
    - OpenAI for natural language processing
    """,
    version="1.0.0",
    lifespan=lifespan,
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Session-ID"],
)


# Chat endpoint
app.websocket("/chat")(chat_endpoint)


@app.get("/")
async def root():
    """Root endpoint with API information."""
    return {
        "name": "AI Assistant API",
        "version": "1.0.0",
        "description": "A Generative UI chatbot for document analysis",
        "documentation": "/docs",
        "health": "/api/health",
    }


@app.get("/api/health")
async def health():
    """
    Health check endpoint with detailed diagnostics.
    
    Returns:
        HealthStatus: Application health status, dependencies, and configuration details
    
    Example response:
    ```json
    {
        "status": "healthy",
        "timestamp": "2024-01-15T10:30:45.123456Z",
        "version": "1.0.0",
        "uptime_seconds": 3600,
        "dependencies": {
            "thesys_api_configured": true
        },
        "configuration": {
            "debug": true,
            "host": "0.0.0.0",
            "port": 8000,
            "session_timeout_minutes": 60,
            "max_upload_size_mb": 10,
            "cors_origins_count": 2
        }
    }
    ```
    """
    return await get_health_status(start_time)


if __name__ == "__main__":
    uvicorn.run(
        "main:app", host=settings.host, port=settings.port, reload=settings.debug
    )
