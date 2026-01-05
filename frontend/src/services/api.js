/**
 * API Service for communicating with the AI Assistant backend.
 */

const API_URL = import.meta.env.VITE_API_URL || '/api';

/**
 * Create a new session
 * @returns {Promise<{session_id: string, message: string}>}
 */
export async function createSession() {
  const response = await fetch(`${API_URL}/session/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to create session');
  }

  return response.json();
}

/**
 * Upload an Excel file
 * @param {File} file - The Excel file to upload
 * @param {string} sessionId - Optional session ID
 * @returns {Promise<Object>} Upload result
 */
export async function uploadExcel(file, sessionId = null) {
  const formData = new FormData();
  formData.append('file', file);

  let url = `${API_URL}/upload`;
  if (sessionId) {
    url += `?session_id=${sessionId}`;
  }

  const response = await fetch(url, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to upload file');
  }

  return response.json();
}

/**
 * Send a chat message and get a streaming response
 * @param {string} prompt - The user's message
 * @param {string} sessionId - The session ID
 * @param {function} onChunk - Callback for each chunk received
 * @param {function} onComplete - Callback when stream completes
 * @param {function} onError - Callback for errors
 */
export async function sendChatMessage(prompt, sessionId, onChunk, onComplete, onError) {
  try {
    const response = await fetch(`${API_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        session_id: sessionId,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to send message');
    }

    // Get the session ID from response headers if available
    const newSessionId = response.headers.get('X-Session-ID');

    // Read the stream
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let accumulatedResponse = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      accumulatedResponse += chunk;
      onChunk(accumulatedResponse, newSessionId);
    }

    onComplete(accumulatedResponse, newSessionId);
  } catch (error) {
    onError(error);
  }
}

/**
 * Get initial analysis for uploaded data
 * @param {string} sessionId - The session ID
 * @param {function} onChunk - Callback for each chunk received
 * @param {function} onComplete - Callback when stream completes
 * @param {function} onError - Callback for errors
 */
export async function getInitialAnalysis(sessionId, onChunk, onComplete, onError) {
  try {
    const response = await fetch(`${API_URL}/analyze?session_id=${sessionId}`, {
      method: 'POST',
    });

    if (!response.ok) {
      throw new Error('Failed to get analysis');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let accumulatedResponse = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      accumulatedResponse += chunk;
      onChunk(accumulatedResponse);
    }

    onComplete(accumulatedResponse);
  } catch (error) {
    onError(error);
  }
}

/**
 * Get session statistics
 * @param {string} sessionId - The session ID
 * @returns {Promise<Object>} Session statistics
 */
export async function getSessionStats(sessionId) {
  const response = await fetch(`${API_URL}/session/${sessionId}/stats`);

  if (!response.ok) {
    throw new Error('Failed to get session stats');
  }

  return response.json();
}

/**
 * Export analysis as PDF
 * @param {string} sessionId - The session ID
 * @param {string} analysisText - Optional analysis text to include
 * @returns {Promise<Blob>} PDF file blob
 */
export async function exportPDF(sessionId, analysisText = null) {
  let url = `${API_URL}/export-pdf?session_id=${sessionId}`;
  if (analysisText) {
    url += `&analysis_text=${encodeURIComponent(analysisText)}`;
  }

  const response = await fetch(url, {
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error('Failed to export PDF');
  }

  return response.blob();
}

/**
 * Export analysis as Word document
 * @param {string} sessionId - The session ID
 * @param {string} analysisText - Optional analysis text to include
 * @returns {Promise<Blob>} Word file blob
 */
export async function exportWord(sessionId, analysisText = null) {
  let url = `${API_URL}/export-docx?session_id=${sessionId}`;
  if (analysisText) {
    url += `&analysis_text=${encodeURIComponent(analysisText)}`;
  }

  const response = await fetch(url, {
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error('Failed to export Word document');
  }

  return response.blob();
}

/**
 * Download a blob as a file
 * @param {Blob} blob - The blob to download
 * @param {string} filename - The filename
 */
export function downloadBlob(blob, filename) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  a.remove();
}

/**
 * Delete a session
 * @param {string} sessionId - The session ID to delete
 */
export async function deleteSession(sessionId) {
  const response = await fetch(`${API_URL}/session/${sessionId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error('Failed to delete session');
  }

  return response.json();
}

/**
 * Health check
 * @returns {Promise<Object>} Health status
 */
export async function healthCheck() {
  const response = await fetch(`${API_URL}/health`);
  return response.json();
}
