"""
API routes for the AI Assistant.
Simplified flow: Excel data goes directly to Thesys C1 for analysis and UI generation.
"""

import uuid
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse, Response
from pydantic import BaseModel
from openai import OpenAI

from ..config import settings
from ..services import DocumentService, PDFService, WordService, ContentExtractor
from ..prompts import THESYS_SYSTEM_PROMPT


router = APIRouter()

# Initialize Thesys client (uses OpenAI SDK as base client)
thesys_client = OpenAI(
    api_key=settings.thesys_api_key, base_url=settings.thesys_base_url
)


class ChatRequest(BaseModel):
    """Request body for chat endpoint."""

    prompt: str
    session_id: Optional[str] = None


class SessionResponse(BaseModel):
    """Response for session creation."""

    session_id: str
    message: str


# Simple session storage for document data
sessions: dict = {}


def get_session(session_id: str) -> dict:
    """Get or create a session."""
    if session_id not in sessions:
        sessions[session_id] = {
            "document_service": DocumentService(),
            "data_loaded": False,
            "conversation_history": [],  # Store full conversation
            "last_response": None,
        }
    return sessions[session_id]


def format_conversation_for_export(session: dict) -> str:
    """Format the full conversation history for export.

    Uses ContentExtractor to convert Thesys JSON/UI responses to readable text
    while preserving data patterns for chart generation.
    """
    if not session.get("conversation_history"):
        # Try to extract readable content from last_response
        last_response = session.get("last_response", "")
        if last_response:
            extractor = ContentExtractor()
            return extractor.extract_readable_content(last_response)
        return ""

    extractor = ContentExtractor()
    formatted_parts = []

    for entry in session["conversation_history"]:
        if entry["role"] == "user":
            formatted_parts.append(f"## Question\n{entry['content']}\n")
        else:
            # Extract readable content from assistant responses
            content = entry["content"]
            readable_content = extractor.extract_readable_content(content)
            formatted_parts.append(f"## Analysis\n{readable_content}\n")

    return "\n---\n\n".join(formatted_parts) if formatted_parts else ""


@router.post("/session/create", response_model=SessionResponse)
async def create_session():
    """Create a new chat session."""
    session_id = str(uuid.uuid4())
    get_session(session_id)

    return SessionResponse(
        session_id=session_id,
        message="Session created successfully. Upload a document to start analyzing.",
    )


@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...), session_id: Optional[str] = None
):
    """Upload a document for analysis."""
    if not file.filename.endswith((".xlsx", ".xls")):
        raise HTTPException(
            status_code=400,
            detail="Invalid file type. Please upload an Excel file (.xlsx or .xls)",
        )

    content = await file.read()

    if len(content) > settings.max_upload_size_bytes:
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Maximum size is {settings.max_upload_size_mb}MB",
        )

    if not session_id:
        session_id = str(uuid.uuid4())

    session = get_session(session_id)
    result = session["document_service"].load_excel(content, file.filename)

    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])

    session["data_loaded"] = True
    # Clear conversation history when new document is uploaded
    session["conversation_history"] = []

    return {
        "success": True,
        "session_id": session_id,
        "message": result["message"],
        "content_length": result.get("content_length", 0),
    }


@router.post("/chat")
async def chat(request: ChatRequest):
    """
    Chat endpoint that sends data directly to Thesys C1 for analysis and UI generation.

    Simplified flow: Excel data → Thesys → UI
    No intermediate OpenAI/LangGraph processing.
    """
    session_id = request.session_id or str(uuid.uuid4())
    session = get_session(session_id)

    # Store user question in history
    session["conversation_history"].append(
        {
            "role": "user",
            "content": request.prompt,
            "timestamp": datetime.now().isoformat(),
        }
    )

    # Get document context
    document_context = ""
    if session["data_loaded"] and session["document_service"].is_loaded():
        document_context = session["document_service"].get_data_as_text()

    # Build the system prompt with document data
    system_content = THESYS_SYSTEM_PROMPT
    if document_context:
        system_content += f"\n\n## Document Data:\n{document_context}"
    else:
        system_content += "\n\n## Note: No document has been uploaded yet. Ask the user to upload an Excel file."

    # Build messages for Thesys - send user prompt directly with data context
    messages = [
        {"role": "system", "content": system_content},
        {"role": "user", "content": request.prompt},
    ]

    # Stream response from Thesys
    async def generate():
        full_response = ""
        try:
            response = thesys_client.chat.completions.create(
                model=settings.thesys_model, messages=messages, stream=True
            )

            for chunk in response:
                if chunk.choices[0].delta.content:
                    content = chunk.choices[0].delta.content
                    full_response += content
                    yield content

            # Store the response in conversation history
            session["conversation_history"].append(
                {
                    "role": "assistant",
                    "content": full_response,
                    "timestamp": datetime.now().isoformat(),
                }
            )
            # Also store as last_response for backwards compatibility
            session["last_response"] = full_response

        except Exception as e:
            error_msg = f"Error: {str(e)}"
            yield error_msg

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Session-ID": session_id,
        },
    )


@router.get("/session/{session_id}/stats")
async def get_session_stats(session_id: str):
    """Get statistics for a session."""
    session = get_session(session_id)

    if not session["data_loaded"]:
        raise HTTPException(status_code=404, detail="No data loaded for this session")

    doc_service = session["document_service"]
    return {
        "data_loaded": True,
        "filename": doc_service.filename,
        "content_length": len(doc_service.content) if doc_service.content else 0,
        "conversation_count": len(session.get("conversation_history", [])),
    }


@router.post("/export-pdf")
async def export_pdf(session_id: str, analysis_text: Optional[str] = None):
    """Export the current analysis as a PDF report."""
    session = get_session(session_id)

    if not session["data_loaded"]:
        raise HTTPException(
            status_code=400, detail="No data loaded. Please upload a document first."
        )

    # Use full conversation history if no specific text provided
    if not analysis_text:
        analysis_text = format_conversation_for_export(session)

    # Fallback to last response if conversation history is empty
    if not analysis_text:
        last_response = session.get("last_response", "")
        if last_response:
            extractor = ContentExtractor()
            analysis_text = extractor.extract_readable_content(last_response)
        if not analysis_text:
            analysis_text = "No analysis available."

    pdf_service = PDFService()
    pdf_bytes = pdf_service.generate_report(
        filename=session["document_service"].filename, analysis_text=analysis_text
    )

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=analysis_report.pdf"},
    )


@router.post("/export-docx")
async def export_docx(session_id: str, analysis_text: Optional[str] = None):
    """Export the current analysis as a Word document."""
    session = get_session(session_id)

    if not session["data_loaded"]:
        raise HTTPException(
            status_code=400, detail="No data loaded. Please upload a document first."
        )

    # Use full conversation history if no specific text provided
    if not analysis_text:
        analysis_text = format_conversation_for_export(session)

    # Fallback to last response if conversation history is empty
    if not analysis_text:
        last_response = session.get("last_response", "")
        if last_response:
            extractor = ContentExtractor()
            analysis_text = extractor.extract_readable_content(last_response)
        if not analysis_text:
            analysis_text = "No analysis available."

    word_service = WordService()
    docx_bytes = word_service.generate_report(
        content=analysis_text,
        filename=session["document_service"].filename,
        include_charts=True,
    )

    return Response(
        content=docx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": "attachment; filename=analysis_report.docx"},
    )


@router.delete("/session/{session_id}")
async def delete_session(session_id: str):
    """Delete a session and its data."""
    if session_id in sessions:
        del sessions[session_id]
    return {"message": "Session deleted successfully"}


@router.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "version": "2.0.0"}
