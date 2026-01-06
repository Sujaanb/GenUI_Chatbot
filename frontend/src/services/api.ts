/**
 * API Service for communicating with the AI Assistant backend.
 * TypeScript version with proper typing.
 */

import type {
    SessionResponse,
    UploadResponse,
    HealthResponse
} from '../types';

const API_URL = import.meta.env.VITE_API_URL || '/api';

/**
 * Create a new session
 */
export async function createSession(): Promise<SessionResponse> {
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
 */
export async function uploadExcel(
    file: File,
    sessionId: string | null = null
): Promise<UploadResponse> {
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
 */
export async function sendChatMessage(
    prompt: string,
    sessionId: string,
    onChunk: (accumulatedResponse: string, sessionId?: string) => void,
    onComplete: (finalResponse: string, sessionId?: string) => void,
    onError: (error: Error) => void
): Promise<void> {
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
        const newSessionId = response.headers.get('X-Session-ID') || undefined;

        // Read the stream
        const reader = response.body?.getReader();
        if (!reader) {
            throw new Error('No response body');
        }

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
        onError(error instanceof Error ? error : new Error(String(error)));
    }
}

/**
 * Get initial analysis for uploaded data
 */
export async function getInitialAnalysis(
    sessionId: string,
    onChunk: (accumulatedResponse: string) => void,
    onComplete: (finalResponse: string) => void,
    onError: (error: Error) => void
): Promise<void> {
    try {
        const response = await fetch(`${API_URL}/analyze?session_id=${sessionId}`, {
            method: 'POST',
        });

        if (!response.ok) {
            throw new Error('Failed to get analysis');
        }

        const reader = response.body?.getReader();
        if (!reader) {
            throw new Error('No response body');
        }

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
        onError(error instanceof Error ? error : new Error(String(error)));
    }
}

/**
 * Get session statistics
 */
export async function getSessionStats(sessionId: string): Promise<{
    data_loaded: boolean;
    filename: string;
    content_length: number;
}> {
    const response = await fetch(`${API_URL}/session/${sessionId}/stats`);

    if (!response.ok) {
        throw new Error('Failed to get session stats');
    }

    return response.json();
}

/**
 * Export analysis as PDF
 */
export async function exportPDF(
    sessionId: string,
    analysisText: string | null = null
): Promise<Blob> {
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
 */
export async function exportWord(
    sessionId: string,
    analysisText: string | null = null
): Promise<Blob> {
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
 */
export function downloadBlob(blob: Blob, filename: string): void {
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
 */
export async function deleteSession(sessionId: string): Promise<{ message: string }> {
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
 */
export async function healthCheck(): Promise<HealthResponse> {
    const response = await fetch(`${API_URL}/health`);
    return response.json();
}
