"""
State definitions for the LangGraph chat agent.
"""
from typing import Annotated, Sequence, TypedDict, Optional
from langchain_core.messages import BaseMessage
from langgraph.graph.message import add_messages


class AgentState(TypedDict):
    """State for the chat agent."""
    
    # Conversation messages with automatic message merging
    messages: Annotated[Sequence[BaseMessage], add_messages]
    
    # Document context - the text representation of loaded documents
    document_context: Optional[str]
    
    # Flag indicating if data has been loaded
    data_loaded: bool
    
    # Current session ID
    session_id: str
    
    # The last analysis performed (for PDF generation)
    last_analysis: Optional[str]
