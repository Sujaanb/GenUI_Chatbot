"""
LangGraph Chat Agent.
Orchestrates conversations using tools and LLM.
"""
from typing import Literal
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage
from langgraph.graph import StateGraph, END
from langgraph.prebuilt import ToolNode

from .state import AgentState
from .tools import AGENT_TOOLS, set_document_service, get_document_service
from ..prompts import ASSISTANT_SYSTEM_PROMPT
from ..config import settings
from ..services.document_service import DocumentService


class ChatAgent:
    """
    LangGraph-based chat agent for document analysis.
    Uses tools to query data and an LLM to generate insights.
    """
    
    def __init__(self, session_id: str):
        """
        Initialize the agent with a session ID.
        
        Args:
            session_id: Unique identifier for this session
        """
        self.session_id = session_id
        self.document_service = DocumentService()
        self.llm = ChatOpenAI(
            model=settings.llm_model,
            api_key=settings.openai_api_key,
            temperature=0.7,
            streaming=True
        )
        self.llm_with_tools = self.llm.bind_tools(AGENT_TOOLS)
        self.graph = self._build_graph()
        
        # Set the document service for tools to use
        set_document_service(self.document_service)
    
    def _build_graph(self) -> StateGraph:
        """Build the LangGraph workflow."""
        
        # Create the graph
        workflow = StateGraph(AgentState)
        
        # Add nodes
        workflow.add_node("agent", self._agent_node)
        workflow.add_node("tools", ToolNode(AGENT_TOOLS))
        
        # Set entry point
        workflow.set_entry_point("agent")
        
        # Add conditional edges
        workflow.add_conditional_edges(
            "agent",
            self._should_continue,
            {
                "continue": "tools",
                "end": END
            }
        )
        
        # Add edge from tools back to agent
        workflow.add_edge("tools", "agent")
        
        return workflow.compile()
    
    def _agent_node(self, state: AgentState) -> dict:
        """
        The main agent node that processes messages and decides actions.
        """
        messages = list(state["messages"])
        
        # Add system message if not present
        if not messages or not isinstance(messages[0], SystemMessage):
            system_content = ASSISTANT_SYSTEM_PROMPT
            
            # Add data context if available
            if state.get("document_context"):
                system_content += f"\n\n## Current Document Context:\n{state['document_context']}"
            
            messages = [SystemMessage(content=system_content)] + messages
        
        # Call the LLM
        response = self.llm_with_tools.invoke(messages)
        
        return {"messages": [response]}
    
    def _should_continue(self, state: AgentState) -> Literal["continue", "end"]:
        """
        Determine if the agent should continue (call tools) or end.
        """
        messages = state["messages"]
        last_message = messages[-1]
        
        # If there are tool calls, continue to the tools node
        if hasattr(last_message, "tool_calls") and last_message.tool_calls:
            return "continue"
        
        # Otherwise, end the conversation turn
        return "end"
    
    def load_document(self, file_content: bytes, filename: str) -> dict:
        """
        Load a document into the agent's context.
        
        Args:
            file_content: Raw bytes of the file
            filename: Name of the file
            
        Returns:
            Dictionary with load status
        """
        result = self.document_service.load_excel(file_content, filename)
        
        if result["success"]:
            # Update the document service reference for tools
            set_document_service(self.document_service)
        
        return result
    
    def get_initial_state(self) -> AgentState:
        """Get the initial state for a new conversation."""
        document_context = None
        data_loaded = False
        
        if self.document_service.is_loaded():
            document_context = self.document_service.get_data_as_text()
            data_loaded = True
        
        return {
            "messages": [],
            "document_context": document_context,
            "data_loaded": data_loaded,
            "session_id": self.session_id,
            "last_analysis": None
        }
    
    def run(self, user_message: str, state: AgentState = None) -> AgentState:
        """
        Run the agent with a user message.
        
        Args:
            user_message: The user's input message
            state: Optional existing state to continue from
            
        Returns:
            Updated state after processing
        """
        if state is None:
            state = self.get_initial_state()
        
        # Add the user message
        state["messages"] = list(state["messages"]) + [HumanMessage(content=user_message)]
        
        # Update context if data is loaded
        if self.document_service.is_loaded():
            state["document_context"] = self.document_service.get_data_as_text()
            state["data_loaded"] = True
        
        # Run the graph
        result = self.graph.invoke(state)
        
        # Store the last analysis
        if result["messages"]:
            last_msg = result["messages"][-1]
            if isinstance(last_msg, AIMessage) and last_msg.content:
                result["last_analysis"] = last_msg.content
        
        return result
    
    async def arun(self, user_message: str, state: AgentState = None):
        """
        Async generator that streams the agent's response.
        
        Args:
            user_message: The user's input message
            state: Optional existing state to continue from
            
        Yields:
            Chunks of the response as they're generated
        """
        if state is None:
            state = self.get_initial_state()
        
        # Add the user message
        state["messages"] = list(state["messages"]) + [HumanMessage(content=user_message)]
        
        # Update context if data is loaded
        if self.document_service.is_loaded():
            state["document_context"] = self.document_service.get_data_as_text()
            state["data_loaded"] = True
        
        # Stream the graph execution
        async for event in self.graph.astream(state):
            yield event


# Session manager to store agents by session ID
class SessionManager:
    """Manages agent sessions."""
    
    def __init__(self):
        self._sessions: dict[str, ChatAgent] = {}
        self._states: dict[str, AgentState] = {}
    
    def get_or_create_agent(self, session_id: str) -> ChatAgent:
        """Get existing agent or create a new one for the session."""
        if session_id not in self._sessions:
            self._sessions[session_id] = ChatAgent(session_id)
            self._states[session_id] = self._sessions[session_id].get_initial_state()
        return self._sessions[session_id]
    
    def get_state(self, session_id: str) -> AgentState:
        """Get the state for a session."""
        if session_id not in self._states:
            agent = self.get_or_create_agent(session_id)
            self._states[session_id] = agent.get_initial_state()
        return self._states[session_id]
    
    def update_state(self, session_id: str, state: AgentState) -> None:
        """Update the state for a session."""
        self._states[session_id] = state
    
    def clear_session(self, session_id: str) -> None:
        """Clear a session."""
        if session_id in self._sessions:
            del self._sessions[session_id]
        if session_id in self._states:
            del self._states[session_id]


# Global session manager instance
session_manager = SessionManager()
