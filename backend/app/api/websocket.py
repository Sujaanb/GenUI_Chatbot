"""
WebSocket handler for the AI Assistant.
Single WebSocket endpoint handling all communication.
"""

import uuid
import base64
import json
from typing import Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from openai import OpenAI

from ..config import settings
from ..services import DocumentService, PDFService, WordService
from ..prompts import GENUI_SYSTEM_PROMPT, NO_DATA_PROMPT


router = APIRouter()

# Initialize OpenAI client
openai_client = OpenAI(
    api_key=settings.openai_api_key,
    base_url=settings.openai_base_url
)

# Session storage
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


class ConnectionManager:
    """Manage WebSocket connections."""
    
    def __init__(self):
        self.active_connections: dict[str, WebSocket] = {}
    
    async def connect(self, websocket: WebSocket, session_id: str):
        await websocket.accept()
        self.active_connections[session_id] = websocket
    
    def disconnect(self, session_id: str):
        if session_id in self.active_connections:
            del self.active_connections[session_id]
    
    async def send_message(self, session_id: str, message: dict):
        if session_id in self.active_connections:
            await self.active_connections[session_id].send_json(message)


manager = ConnectionManager()


async def handle_create_session(websocket: WebSocket, session_id: str, payload: dict):
    """Handle session creation."""
    # Session is already created when WebSocket connects
    await websocket.send_json({
        "type": "session_created",
        "payload": {
            "session_id": session_id,
            "message": "Session created successfully. Upload a document to start analyzing."
        }
    })


async def handle_upload(websocket: WebSocket, session_id: str, payload: dict):
    """Handle file upload via base64."""
    try:
        filename = payload.get("filename", "")
        file_data_b64 = payload.get("data", "")
        
        if not filename.endswith((".xlsx", ".xls")):
            await websocket.send_json({
                "type": "error",
                "payload": {
                    "message": "Invalid file type. Please upload an Excel file (.xlsx or .xls)"
                }
            })
            return
        
        # Decode base64 file data
        try:
            file_content = base64.b64decode(file_data_b64)
        except Exception:
            await websocket.send_json({
                "type": "error",
                "payload": {"message": "Invalid file data encoding"}
            })
            return
        
        if len(file_content) > settings.max_upload_size_bytes:
            await websocket.send_json({
                "type": "error",
                "payload": {
                    "message": f"File too large. Maximum size is {settings.max_upload_size_mb}MB"
                }
            })
            return
        
        session = get_session(session_id)
        result = session["document_service"].load_excel(file_content, filename)
        
        if not result["success"]:
            await websocket.send_json({
                "type": "error",
                "payload": {"message": result["message"]}
            })
            return
        
        session["data_loaded"] = True
        
        await websocket.send_json({
            "type": "upload_complete",
            "payload": {
                "success": True,
                "session_id": session_id,
                "message": result["message"],
                "filename": filename,
                "content_length": result.get("content_length", 0)
            }
        })
        
    except Exception as e:
        await websocket.send_json({
            "type": "error",
            "payload": {"message": str(e)}
        })


async def handle_chat(websocket: WebSocket, session_id: str, payload: dict):
    """Handle chat message with streaming response."""
    try:
        prompt = payload.get("prompt", "")
        if not prompt:
            await websocket.send_json({
                "type": "error",
                "payload": {"message": "No prompt provided"}
            })
            return
        
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
            {"role": "user", "content": prompt},
        ]
        
        # Stream response from OpenAI
        full_response = ""
        try:
            response = openai_client.chat.completions.create(
                model=settings.llm_model,
                messages=messages,
                stream=True,
                response_format={"type": "json_object"}
            )
            
            for chunk in response:
                if chunk.choices[0].delta.content:
                    content = chunk.choices[0].delta.content
                    full_response += content
                    
                    # Send chunk to client
                    await websocket.send_json({
                        "type": "chat_chunk",
                        "payload": {
                            "content": content,
                            "accumulated": full_response
                        }
                    })
            
            # Store the response for export
            session["last_response"] = full_response
            
            # Send completion message
            await websocket.send_json({
                "type": "chat_complete",
                "payload": {
                    "content": full_response,
                    "session_id": session_id
                }
            })
            
        except Exception as e:
            await websocket.send_json({
                "type": "error",
                "payload": {"message": f"Chat error: {str(e)}"}
            })
            
    except Exception as e:
        await websocket.send_json({
            "type": "error",
            "payload": {"message": str(e)}
        })


async def handle_export_pdf(websocket: WebSocket, session_id: str, payload: dict):
    """Handle PDF export."""
    try:
        session = get_session(session_id)
        
        if not session["data_loaded"]:
            await websocket.send_json({
                "type": "error",
                "payload": {"message": "No data loaded. Please upload a document first."}
            })
            return
        
        analysis_text = payload.get("analysis_text") or session.get("last_response", "")
        
        pdf_service = PDFService()
        pdf_bytes = pdf_service.generate_report(
            filename=session["document_service"].filename,
            analysis_text=analysis_text
        )
        
        # Encode as base64
        pdf_b64 = base64.b64encode(pdf_bytes).decode("utf-8")
        
        await websocket.send_json({
            "type": "export_ready",
            "payload": {
                "data": pdf_b64,
                "mime": "application/pdf",
                "filename": "analysis_report.pdf"
            }
        })
        
    except Exception as e:
        await websocket.send_json({
            "type": "error",
            "payload": {"message": f"Export error: {str(e)}"}
        })


async def handle_export_docx(websocket: WebSocket, session_id: str, payload: dict):
    """Handle Word document export."""
    try:
        session = get_session(session_id)
        
        if not session["data_loaded"]:
            await websocket.send_json({
                "type": "error",
                "payload": {"message": "No data loaded. Please upload a document first."}
            })
            return
        
        analysis_text = payload.get("analysis_text") or session.get("last_response", "")
        
        word_service = WordService()
        docx_bytes = word_service.generate_report(
            content=analysis_text,
            filename=session["document_service"].filename,
            include_charts=True
        )
        
        # Encode as base64
        docx_b64 = base64.b64encode(docx_bytes).decode("utf-8")
        
        await websocket.send_json({
            "type": "export_ready",
            "payload": {
                "data": docx_b64,
                "mime": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "filename": "analysis_report.docx"
            }
        })
        
    except Exception as e:
        await websocket.send_json({
            "type": "error",
            "payload": {"message": f"Export error: {str(e)}"}
        })


async def handle_delete_session(websocket: WebSocket, session_id: str, payload: dict):
    """Handle session deletion."""
    if session_id in sessions:
        del sessions[session_id]
    
    await websocket.send_json({
        "type": "session_deleted",
        "payload": {"message": "Session deleted successfully"}
    })


# Message type handlers
MESSAGE_HANDLERS = {
    "create_session": handle_create_session,
    "upload": handle_upload,
    "chat": handle_chat,
    "export_pdf": handle_export_pdf,
    "export_docx": handle_export_docx,
    "delete_session": handle_delete_session,
}


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """Main WebSocket endpoint."""
    session_id = str(uuid.uuid4())
    await manager.connect(websocket, session_id)
    
    # Send session ID immediately after connection
    await websocket.send_json({
        "type": "connected",
        "payload": {"session_id": session_id}
    })
    
    try:
        while True:
            # Receive message
            data = await websocket.receive_text()
            
            try:
                message = json.loads(data)
                msg_type = message.get("type", "")
                payload = message.get("payload", {})
                
                # Route to appropriate handler
                handler = MESSAGE_HANDLERS.get(msg_type)
                if handler:
                    await handler(websocket, session_id, payload)
                else:
                    await websocket.send_json({
                        "type": "error",
                        "payload": {"message": f"Unknown message type: {msg_type}"}
                    })
                    
            except json.JSONDecodeError:
                await websocket.send_json({
                    "type": "error",
                    "payload": {"message": "Invalid JSON message"}
                })
                
    except WebSocketDisconnect:
        manager.disconnect(session_id)
        # Optionally clean up session after disconnect
        # if session_id in sessions:
        #     del sessions[session_id]
