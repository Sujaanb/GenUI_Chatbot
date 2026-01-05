"""
API routes for the AI Assistant.
"""
import json
import uuid
from typing import Optional
from fastapi import APIRouter, UploadFile, File, HTTPException, Request
from fastapi.responses import StreamingResponse, Response
from pydantic import BaseModel
import httpx
from openai import OpenAI

from ..config import settings
from ..agents import session_manager, set_document_service
from ..services import PDFService, WordService
from ..prompts import ASSISTANT_SYSTEM_PROMPT, DOCUMENT_ANALYSIS_PROMPT


router = APIRouter()

# Initialize OpenAI client for Thesys
thesys_client = OpenAI(
    api_key=settings.thesys_api_key,
    base_url=settings.thesys_base_url
)


class ChatRequest(BaseModel):
    """Request body for chat endpoint."""
    prompt: str
    session_id: Optional[str] = None


class SessionResponse(BaseModel):
    """Response for session creation."""
    session_id: str
    message: str


@router.post("/session/create", response_model=SessionResponse)
async def create_session():
    """Create a new chat session."""
    session_id = str(uuid.uuid4())
    session_manager.get_or_create_agent(session_id)
    
    return SessionResponse(
        session_id=session_id,
        message="Session created successfully. You can start chatting or upload a document for analysis."
    )


@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    session_id: Optional[str] = None
):
    """
    Upload a document for analysis.
    
    Args:
        file: The file to upload (Excel supported)
        session_id: Optional session ID. If not provided, a new session is created.
        
    Returns:
        Upload status and session ID
    """
    # Validate file type
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(
            status_code=400,
            detail="Invalid file type. Please upload an Excel file (.xlsx or .xls)"
        )
    
    # Read file content
    content = await file.read()
    
    # Check file size
    if len(content) > settings.max_upload_size_bytes:
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Maximum size is {settings.max_upload_size_mb}MB"
        )
    
    # Create or get session
    if not session_id:
        session_id = str(uuid.uuid4())
    
    agent = session_manager.get_or_create_agent(session_id)
    
    # Load the document
    result = agent.load_document(content, file.filename)
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])
    
    # Update the session state
    state = session_manager.get_state(session_id)
    state["data_loaded"] = True
    state["document_context"] = agent.document_service.get_data_as_text()
    session_manager.update_state(session_id, state)
    
    return {
        "success": True,
        "session_id": session_id,
        "message": result["message"],
        "content_length": result.get("content_length", 0)
    }


@router.post("/chat")
async def chat(request: ChatRequest):
    """
    Chat endpoint that streams responses using Thesys C1 API.
    
    This endpoint:
    1. Processes the user's prompt through the LangGraph agent
    2. Sends the agent's response to Thesys C1 for UI generation
    3. Streams the generated UI back to the client
    """
    session_id = request.session_id or str(uuid.uuid4())
    
    # Get or create agent
    agent = session_manager.get_or_create_agent(session_id)
    state = session_manager.get_state(session_id)
    
    # Run the agent to get analysis
    try:
        result_state = agent.run(request.prompt, state)
        session_manager.update_state(session_id, result_state)
        
        # Get the agent's response
        agent_response = ""
        for msg in reversed(result_state["messages"]):
            if hasattr(msg, "content") and msg.content and msg.type == "ai":
                agent_response = msg.content
                break
        
        if not agent_response:
            agent_response = "I apologize, but I couldn't generate a response. Please try rephrasing your question."
        
    except Exception as e:
        agent_response = f"An error occurred during analysis: {str(e)}"
    
    # Build the system prompt for Thesys with data context
    system_prompt = f"""{ASSISTANT_SYSTEM_PROMPT}

## Important Instructions for UI Generation:
When generating UI responses:
- Use appropriate charts (PieChart, BarChart, LineChart) for data visualization when applicable
- Use Tables for detailed data display
- Use Cards for summary statistics and KPIs
- Make the UI interactive and informative
- Always include relevant numbers and percentages when available

## Current Document Status:
{"Document loaded and ready for analysis." if state.get('data_loaded') else "No document has been uploaded yet."}
"""
    
    # Build messages for Thesys
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"Present the following information with appropriate visualizations:\n\n{agent_response}"}
    ]
    
    # Stream response from Thesys
    async def generate():
        try:
            response = thesys_client.chat.completions.create(
                model=settings.thesys_model,
                messages=messages,
                stream=True
            )
            
            for chunk in response:
                if chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content
                    
        except Exception as e:
            yield f"Error generating UI: {str(e)}"
    
    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Session-ID": session_id
        }
    )


@router.get("/session/{session_id}/stats")
async def get_session_stats(session_id: str):
    """Get statistics for a session."""
    agent = session_manager.get_or_create_agent(session_id)
    
    if not agent.document_service.is_loaded():
        raise HTTPException(status_code=404, detail="No data loaded for this session")
    
    return {
        "data_loaded": True,
        "filename": agent.document_service.filename,
        "content_length": len(agent.document_service.content) if agent.document_service.content else 0
    }


@router.post("/export-pdf")
async def export_pdf(session_id: str, analysis_text: Optional[str] = None):
    """
    Export the current analysis as a PDF report.
    
    Args:
        session_id: The session ID
        analysis_text: Optional analysis text to include in the report
    """
    agent = session_manager.get_or_create_agent(session_id)
    state = session_manager.get_state(session_id)
    
    if not state.get("data_loaded"):
        raise HTTPException(
            status_code=400,
            detail="No data loaded. Please upload a document first."
        )
    
    # Use the last analysis if no text provided
    if not analysis_text and state.get("last_analysis"):
        analysis_text = state["last_analysis"]
    
    # Generate PDF
    pdf_service = PDFService()
    pdf_bytes = pdf_service.generate_report(
        filename=agent.document_service.filename,
        analysis_text=analysis_text or ""
    )
    
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": "attachment; filename=analysis_report.pdf"
        }
    )


@router.post("/export-docx")
async def export_docx(session_id: str, analysis_text: Optional[str] = None):
    """
    Export the current analysis as a Word document.
    
    Args:
        session_id: The session ID
        analysis_text: Optional analysis text to include in the report
    """
    agent = session_manager.get_or_create_agent(session_id)
    state = session_manager.get_state(session_id)
    
    if not state.get("data_loaded"):
        raise HTTPException(
            status_code=400,
            detail="No data loaded. Please upload a document first."
        )
    
    # Use the last analysis if no text provided
    if not analysis_text and state.get("last_analysis"):
        analysis_text = state["last_analysis"]
    
    # Generate Word document
    word_service = WordService()
    docx_bytes = word_service.generate_report(
        content=analysis_text or "",
        filename=agent.document_service.filename,
        include_charts=True
    )
    
    return Response(
        content=docx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={
            "Content-Disposition": "attachment; filename=analysis_report.docx"
        }
    )


@router.delete("/session/{session_id}")
async def delete_session(session_id: str):
    """Delete a session and its data."""
    session_manager.clear_session(session_id)
    return {"message": "Session deleted successfully"}


@router.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "version": "1.0.0"}
