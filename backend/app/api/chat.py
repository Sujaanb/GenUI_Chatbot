"""
Chat endpoint handler.
All operations (session, upload, chat, export) go through this single connection.
"""

import uuid
import base64
from datetime import datetime
from typing import Optional, Dict, Any
from fastapi import WebSocket, WebSocketDisconnect
from openai import OpenAI

from ..config import settings
from ..services import DocumentService, PDFService, WordService, ContentExtractor
from ..prompts import THESYS_SYSTEM_PROMPT


# Initialize Thesys client
thesys_client = OpenAI(
    api_key=settings.thesys_api_key, base_url=settings.thesys_base_url
)

# Session storage (shared with REST routes for compatibility)
sessions: Dict[str, dict] = {}


def get_session(session_id: str) -> dict:
    """Get or create a session."""
    if session_id not in sessions:
        sessions[session_id] = {
            "document_service": DocumentService(),
            "data_loaded": False,
            "conversation_history": [],
            "last_response": None,
        }
    return sessions[session_id]


def format_conversation_for_export(session: dict) -> str:
    """Format the full conversation history for export."""
    if not session.get("conversation_history"):
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
            content = entry["content"]
            readable_content = extractor.extract_readable_content(content)
            formatted_parts.append(f"## Analysis\n{readable_content}\n")

    return "\n---\n\n".join(formatted_parts) if formatted_parts else ""


class ChatHandler:
    """Handles chat connections and message routing."""

    def __init__(self, websocket: WebSocket):
        self.websocket = websocket
        self.session_id: Optional[str] = None

    async def send_response(
        self,
        action: str,
        request_id: str,
        status: str,
        payload: Dict[str, Any] = None,
    ):
        """Send a response message to the client."""
        message = {
            "action": action,
            "request_id": request_id,
            "status": status,
            "payload": payload or {},
        }
        await self.websocket.send_json(message)

    async def send_error(self, action: str, request_id: str, error: str):
        """Send an error response."""
        await self.send_response(action, request_id, "error", {"error": error})

    async def handle_create_session(self, request_id: str, payload: Dict[str, Any]):
        """Handle session creation."""
        session_id = str(uuid.uuid4())
        get_session(session_id)
        self.session_id = session_id

        await self.send_response(
            "create_session",
            request_id,
            "success",
            {
                "session_id": session_id,
                "message": "Session created successfully. Upload a document to start analyzing.",
            },
        )

    async def handle_upload(self, request_id: str, payload: Dict[str, Any]):
        """Handle file upload (base64 encoded)."""
        try:
            file_data = payload.get("file_data")
            filename = payload.get("filename", "uploaded.xlsx")
            session_id = payload.get("session_id") or self.session_id

            if not file_data:
                await self.send_error("upload", request_id, "No file data provided")
                return

            if not filename.endswith((".xlsx", ".xls")):
                await self.send_error(
                    "upload",
                    request_id,
                    "Invalid file type. Please upload an Excel file (.xlsx or .xls)",
                )
                return

            # Decode base64 file data
            try:
                content = base64.b64decode(file_data)
            except Exception:
                await self.send_error("upload", request_id, "Invalid base64 file data")
                return

            if len(content) > settings.max_upload_size_bytes:
                await self.send_error(
                    "upload",
                    request_id,
                    f"File too large. Maximum size is {settings.max_upload_size_mb}MB",
                )
                return

            if not session_id:
                session_id = str(uuid.uuid4())

            session = get_session(session_id)
            result = session["document_service"].load_excel(content, filename)

            if not result["success"]:
                await self.send_error("upload", request_id, result["message"])
                return

            session["data_loaded"] = True
            session["conversation_history"] = []
            self.session_id = session_id

            await self.send_response(
                "upload",
                request_id,
                "success",
                {
                    "success": True,
                    "session_id": session_id,
                    "message": result["message"],
                    "content_length": result.get("content_length", 0),
                },
            )

        except Exception as e:
            await self.send_error("upload", request_id, str(e))

    async def handle_chat(self, request_id: str, payload: Dict[str, Any]):
        """Handle chat message with streaming response."""
        try:
            prompt = payload.get("prompt")
            session_id = payload.get("session_id") or self.session_id

            if not prompt:
                await self.send_error("chat", request_id, "No prompt provided")
                return

            if not session_id:
                session_id = str(uuid.uuid4())

            session = get_session(session_id)
            self.session_id = session_id

            # Store user question in history
            session["conversation_history"].append(
                {
                    "role": "user",
                    "content": prompt,
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

            # Build messages for Thesys
            messages = [
                {"role": "system", "content": system_content},
                {"role": "user", "content": prompt},
            ]

            # Stream response from Thesys
            full_response = ""
            try:
                response = thesys_client.chat.completions.create(
                    model=settings.thesys_model, messages=messages, stream=True
                )

                for chunk in response:
                    if chunk.choices[0].delta.content:
                        content = chunk.choices[0].delta.content
                        full_response += content
                        # Send streaming chunk
                        await self.send_response(
                            "chat",
                            request_id,
                            "stream",
                            {"content": content, "session_id": session_id},
                        )

                # Store the response in conversation history
                session["conversation_history"].append(
                    {
                        "role": "assistant",
                        "content": full_response,
                        "timestamp": datetime.now().isoformat(),
                    }
                )
                session["last_response"] = full_response

                # Send completion message
                await self.send_response(
                    "chat",
                    request_id,
                    "success",
                    {
                        "content": full_response,
                        "session_id": session_id,
                        "complete": True,
                    },
                )

            except Exception as e:
                await self.send_error("chat", request_id, str(e))

        except Exception as e:
            await self.send_error("chat", request_id, str(e))

    async def handle_export(self, request_id: str, payload: Dict[str, Any]):
        """Handle document export (returns base64 encoded file)."""
        try:
            session_id = payload.get("session_id") or self.session_id
            format_type = payload.get("format", "pdf")
            analysis_text = payload.get("analysis_text")

            if format_type not in ["pdf", "docx"]:
                await self.send_error(
                    "export", request_id, "Invalid format. Use 'pdf' or 'docx'"
                )
                return

            if not session_id:
                await self.send_error("export", request_id, "No session ID provided")
                return

            session = get_session(session_id)

            if not session["data_loaded"]:
                await self.send_error(
                    "export",
                    request_id,
                    "No data loaded. Please upload a document first.",
                )
                return

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

            # Generate the appropriate document format
            if format_type == "pdf":
                pdf_service = PDFService()
                content_bytes = pdf_service.generate_report(
                    filename=session["document_service"].filename,
                    analysis_text=analysis_text,
                )
                mime_type = "application/pdf"
                file_extension = "pdf"
            else:  # docx
                word_service = WordService()
                content_bytes = word_service.generate_report(
                    content=analysis_text,
                    filename=session["document_service"].filename,
                    include_charts=True,
                )
                mime_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                file_extension = "docx"

            # Encode to base64 for transmission
            content_base64 = base64.b64encode(content_bytes).decode("utf-8")

            await self.send_response(
                "export",
                request_id,
                "success",
                {
                    "file_data": content_base64,
                    "mime_type": mime_type,
                    "filename": f"analysis_report.{file_extension}",
                },
            )

        except Exception as e:
            await self.send_error("export", request_id, str(e))

    async def handle_restore_session(self, request_id: str, payload: Dict[str, Any]):
        """Handle session restoration after reconnect."""
        session_id = payload.get("session_id")

        if not session_id or session_id not in sessions:
            await self.send_error(
                "restore_session", request_id, "Session not found or expired"
            )
            return

        self.session_id = session_id
        session = sessions[session_id]

        await self.send_response(
            "restore_session",
            request_id,
            "success",
            {
                "session_id": session_id,
                "data_loaded": session["data_loaded"],
                "message_count": len(session.get("conversation_history", [])),
            },
        )

    async def handle_message(self, data: dict):
        """Route incoming messages to appropriate handlers."""
        action = data.get("action")
        request_id = data.get("request_id", str(uuid.uuid4()))
        payload = data.get("payload", {})

        handlers = {
            "create_session": self.handle_create_session,
            "upload": self.handle_upload,
            "chat": self.handle_chat,
            "export": self.handle_export,
            "restore_session": self.handle_restore_session,
        }

        handler = handlers.get(action)
        if handler:
            await handler(request_id, payload)
        else:
            await self.send_error(
                action or "unknown", request_id, f"Unknown action: {action}"
            )


async def chat_endpoint(websocket: WebSocket):
    """Main chat endpoint handler."""
    await websocket.accept()
    handler = ChatHandler(websocket)

    try:
        while True:
            # Receive message
            data = await websocket.receive_json()
            await handler.handle_message(data)

    except WebSocketDisconnect:
        # Client disconnected
        pass
    except Exception as e:
        # Send error and close
        try:
            await websocket.send_json(
                {
                    "action": "error",
                    "request_id": "system",
                    "status": "error",
                    "payload": {"error": str(e)},
                }
            )
        except:
            pass
