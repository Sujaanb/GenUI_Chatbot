# LLM Output Storage

This directory stores all raw LLM outputs (JSON/markdown responses) for debugging and analysis.

## File Format

Each file is named: `{session_id}_{timestamp}.json`

Example: `abc123_20260106_103045_123456.json`

## File Structure

```json
{
  "session_id": "abc123...",
  "timestamp": "2026-01-06T10:30:45.123456",
  "user_prompt": "What data is in this document?",
  "llm_response": "{\"blocks\": [...]}",
  "llm_response_parsed": {
    "blocks": [...]
  },
  "metadata": {
    "model": "gpt-4o-mini",
    "data_loaded": true,
    "filename": "sample_data.xlsx"
  }
}
```

## Usage

Files are automatically created by the `OutputStorageService` after each LLM response.

You can review these files to:
- Debug LLM output issues
- Analyze response patterns
- Verify JSON structure
- Track conversation history
