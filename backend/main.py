"""
AI Assistant - FastAPI Application
A Generative UI chatbot for document analysis using Thesys C1 and LangGraph.
"""

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.config import settings, validate_settings
from app.api import router


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

# Include API routes
app.include_router(router, prefix="/api")


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


if __name__ == "__main__":
    uvicorn.run(
        "main:app", host=settings.host, port=settings.port, reload=settings.debug
    )
