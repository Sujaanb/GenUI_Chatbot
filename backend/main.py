"""
AI Assistant - FastAPI Application
A Generative UI chatbot for document analysis with WebSocket communication.
"""

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.config import settings, validate_settings
from app.api import ws_router


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
    - WebSocket-based real-time communication
    - Upload Excel files for analysis
    - Analyze documents with interactive visualizations
    - Natural language interface for querying data
    - Export analysis reports as PDF/Word
    
    ## WebSocket Endpoint
    Connect to `/ws` for all communication.
    """,
    version="2.0.0",
    lifespan=lifespan,
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include WebSocket router
app.include_router(ws_router)


@app.get("/")
async def root():
    """Root endpoint with API information."""
    return {
        "name": "AI Assistant API",
        "version": "2.0.0",
        "description": "A Generative UI chatbot for document analysis",
        "websocket": "/ws",
        "documentation": "/docs",
    }


if __name__ == "__main__":
    uvicorn.run(
        "main:app", host=settings.host, port=settings.port, reload=settings.debug
    )
