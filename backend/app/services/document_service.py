"""
Document loading service for handling various file types.
Uses LangChain document loaders for flexible file parsing.
"""
import io
import tempfile
import os
from typing import Optional
from langchain_community.document_loaders import UnstructuredExcelLoader


class DocumentService:
    """Service for loading and processing documents."""
    
    def __init__(self):
        self.content: Optional[str] = None
        self.filename: Optional[str] = None
        self.raw_data: Optional[bytes] = None
    
    def load_excel(self, file_content: bytes, filename: str) -> dict:
        """
        Load an Excel file and extract content as text.
        Uses LangChain's UnstructuredExcelLoader to handle any Excel structure.
        
        Args:
            file_content: Raw bytes of the Excel file
            filename: Name of the uploaded file
            
        Returns:
            Dictionary with status and message
        """
        try:
            self.raw_data = file_content
            self.filename = filename
            
            # Write to temporary file (UnstructuredExcelLoader requires file path)
            with tempfile.NamedTemporaryFile(delete=False, suffix=self._get_suffix(filename)) as tmp_file:
                tmp_file.write(file_content)
                tmp_path = tmp_file.name
            
            try:
                # Use UnstructuredExcelLoader to parse the Excel file
                loader = UnstructuredExcelLoader(tmp_path, mode="elements")
                documents = loader.load()
                
                # Combine all document content into a single string
                content_parts = []
                for doc in documents:
                    content_parts.append(doc.page_content)
                
                self.content = "\n\n".join(content_parts)
                
                return {
                    "success": True,
                    "message": f"Successfully loaded {filename}",
                    "content_length": len(self.content),
                    "document_count": len(documents)
                }
            finally:
                # Clean up temporary file
                if os.path.exists(tmp_path):
                    os.unlink(tmp_path)
            
        except Exception as e:
            return {
                "success": False,
                "message": f"Error loading Excel file: {str(e)}"
            }
    
    def _get_suffix(self, filename: str) -> str:
        """Get the file suffix from filename."""
        if filename.endswith('.xlsx'):
            return '.xlsx'
        elif filename.endswith('.xls'):
            return '.xls'
        return '.xlsx'
    
    def get_content(self) -> str:
        """Get the loaded document content."""
        if self.content is None:
            return "No document loaded"
        return self.content
    
    def get_data_as_text(self) -> str:
        """Get document content formatted for LLM context."""
        if self.content is None:
            return "No document loaded"
        
        return f"""## Document: {self.filename or 'Unknown'}

{self.content}
"""
    
    def is_loaded(self) -> bool:
        """Check if a document has been loaded."""
        return self.content is not None
