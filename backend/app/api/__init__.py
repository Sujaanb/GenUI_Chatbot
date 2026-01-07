"""
API module for the AI Assistant.
"""

from .websocket import router as ws_router

__all__ = ["ws_router"]
