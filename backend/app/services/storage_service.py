"""
Storage service for saving LLM outputs.
Saves all raw JSON/markdown responses to a storage folder.
"""

import os
import json
from datetime import datetime
from pathlib import Path
from typing import Optional


class OutputStorageService:
    """Service for storing LLM outputs to disk."""

    def __init__(self, storage_dir: str = "storage/llm_outputs"):
        """
        Initialize the storage service.
        
        Args:
            storage_dir: Directory path where outputs will be stored
        """
        self.storage_dir = Path(storage_dir)
        self.storage_dir.mkdir(parents=True, exist_ok=True)

    def save_output(
        self,
        session_id: str,
        user_prompt: str,
        llm_response: str,
        metadata: Optional[dict] = None,
    ) -> str:
        """
        Save LLM output to storage.
        
        Args:
            session_id: The session ID
            user_prompt: The user's prompt
            llm_response: The raw LLM response (JSON/markdown)
            metadata: Optional metadata to include
            
        Returns:
            Path to the saved file
        """
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
        filename = f"{session_id}_{timestamp}.json"
        filepath = self.storage_dir / filename

        # Prepare the data to save
        output_data = {
            "session_id": session_id,
            "timestamp": datetime.now().isoformat(),
            "user_prompt": user_prompt,
            "llm_response": llm_response,
            "metadata": metadata or {},
        }

        # Try to parse the LLM response as JSON for better formatting
        try:
            parsed_response = json.loads(llm_response)
            output_data["llm_response_parsed"] = parsed_response
        except json.JSONDecodeError:
            # If not valid JSON, keep as string
            pass

        # Save to file
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(output_data, f, indent=2, ensure_ascii=False)

        return str(filepath)

    def get_session_outputs(self, session_id: str) -> list[dict]:
        """
        Get all outputs for a specific session.
        
        Args:
            session_id: The session ID
            
        Returns:
            List of output data dictionaries
        """
        outputs = []
        pattern = f"{session_id}_*.json"
        
        for filepath in self.storage_dir.glob(pattern):
            try:
                with open(filepath, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    outputs.append(data)
            except Exception as e:
                print(f"Error reading {filepath}: {e}")
                continue
        
        # Sort by timestamp
        outputs.sort(key=lambda x: x.get("timestamp", ""))
        return outputs

    def get_latest_output(self, session_id: str) -> Optional[dict]:
        """
        Get the most recent output for a session.
        
        Args:
            session_id: The session ID
            
        Returns:
            The latest output data or None
        """
        outputs = self.get_session_outputs(session_id)
        return outputs[-1] if outputs else None

    def clear_session_outputs(self, session_id: str) -> int:
        """
        Delete all outputs for a session.
        
        Args:
            session_id: The session ID
            
        Returns:
            Number of files deleted
        """
        pattern = f"{session_id}_*.json"
        count = 0
        
        for filepath in self.storage_dir.glob(pattern):
            try:
                filepath.unlink()
                count += 1
            except Exception as e:
                print(f"Error deleting {filepath}: {e}")
                
        return count
