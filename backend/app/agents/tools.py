"""
Tools for the LangGraph chat agent.
"""
import json
from typing import Optional
from langchain_core.tools import tool
from ..services.document_service import DocumentService


# Global reference to the Document service (will be set by the session manager)
_document_service: Optional[DocumentService] = None


def set_document_service(service: DocumentService) -> None:
    """Set the Document service instance for the tools to use."""
    global _document_service
    _document_service = service


def get_document_service() -> Optional[DocumentService]:
    """Get the current Document service instance."""
    return _document_service


@tool
def get_document_content() -> str:
    """
    Get the content of the loaded document.
    Returns the full text content of any uploaded document for analysis.
    Use this tool when you need to reference the document data.
    """
    if _document_service is None or not _document_service.is_loaded():
        return json.dumps({"error": "No document has been loaded. Please ask the user to upload a file first."})
    
    return _document_service.get_content()


# List of all available tools
AGENT_TOOLS = [
    get_document_content
]
