"""
API routes for the AI Assistant.
Updated for Crayon migration - uses direct OpenAI API for JSON-structured responses.
"""

import uuid
from typing import Optional
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse, Response
from pydantic import BaseModel
from openai import OpenAI

from ..config import settings
from ..services import DocumentService, PDFService, WordService, OutputStorageService
from ..prompts import GENUI_SYSTEM_PROMPT, NO_DATA_PROMPT


router = APIRouter()

# Initialize OpenAI client
openai_client = OpenAI(
    api_key=settings.openai_api_key,
    base_url=settings.openai_base_url
)

# Initialize storage service for LLM outputs
storage_service = OutputStorageService()


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
            "last_response": None,
        }
    return sessions[session_id]


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

    return {
        "success": True,
        "session_id": session_id,
        "message": result["message"],
        "content_length": result.get("content_length", 0),
    }


@router.post("/chat")
async def chat(request: ChatRequest):
    """
    Chat endpoint that sends data to OpenAI and returns JSON-structured UI responses.
    
    Flow: Excel data → OpenAI → JSON component specification → Frontend renders
    """
    session_id = request.session_id or str(uuid.uuid4())
    session = get_session(session_id)

    # Get document context
    document_context = ""
    if session["data_loaded"] and session["document_service"].is_loaded():
        document_context = session["document_service"].get_data_as_text()

    # Build the system prompt with document data
    if document_context:
        system_content = GENUI_SYSTEM_PROMPT + f"\n\n## Document Data:\n{document_context}"
    else:
        system_content = NO_DATA_PROMPT

    # Build messages for OpenAI
    messages = [
        {"role": "system", "content": system_content},
        {"role": "user", "content": request.prompt},
    ]

    # Stream response from OpenAI
    async def generate():
        full_response = ""
        try:
            response = openai_client.chat.completions.create(
                model=settings.llm_model,
                messages=messages,
                stream=True,
                response_format={"type": "json_object"}  # Force JSON output
            )

            for chunk in response:
                if chunk.choices[0].delta.content:
                    content = chunk.choices[0].delta.content
                    full_response += content
                    yield content

            # Store the response for export
            session["last_response"] = full_response
            
            # Save LLM output to storage
            try:
                storage_service.save_output(
                    session_id=session_id,
                    user_prompt=request.prompt,
                    llm_response=full_response,
                    metadata={
                        "model": settings.llm_model,
                        "data_loaded": session["data_loaded"],
                        "filename": session["document_service"].filename if session["data_loaded"] else None,
                    }
                )
            except Exception as storage_error:
                # Log but don't fail the request if storage fails
                print(f"Warning: Failed to save output to storage: {storage_error}")

        except Exception as e:
            # Return error as JSON block
            error_json = '{"blocks": [{"type": "markdown", "content": "Error: ' + str(e).replace('"', '\\"') + '"}]}'
            yield error_json

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
    }


@router.post("/export-pdf")
async def export_pdf(session_id: str, analysis_text: Optional[str] = None):
    """Export the current analysis as a PDF report."""
    session = get_session(session_id)

    if not session["data_loaded"]:
        raise HTTPException(
            status_code=400, detail="No data loaded. Please upload a document first."
        )

    # Use the last response if no text provided
    if not analysis_text:
        analysis_text = session.get("last_response", "")

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

    # Use the last response if no text provided
    if not analysis_text:
        analysis_text = session.get("last_response", "")

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
    return {"status": "healthy", "version": "3.0.0-crayon"}
