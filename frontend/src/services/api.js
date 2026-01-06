/**
 * Chat API Service for communicating with the AI Assistant backend.
 * All operations go through a unified real-time connection.
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Get the chat endpoint URL
function getChatUrl() {
  const url = new URL(API_URL);
  const protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${url.host}/chat`;
}

/**
 * Generate a unique request ID
 */
function generateRequestId() {
  return crypto.randomUUID ? crypto.randomUUID() :
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
}

/**
 * Chat Service for managing connection and message handling
 */
class ChatService {
  constructor() {
    this.ws = null;
    this.sessionId = null;
    this.pendingRequests = new Map();
    this.streamingCallbacks = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.isConnecting = false;
    this.connectionPromise = null;
    this.onConnectionChange = null;
  }

  /**
   * Connect to chat server
   * @returns {Promise<void>}
   */
  async connect() {
    // If already connected, return immediately
    if (this.ws?.readyState === WebSocket.OPEN) {
      return Promise.resolve();
    }

    // If currently connecting with a valid promise, wait for it
    if (this.isConnecting && this.connectionPromise) {
      return this.connectionPromise;
    }

    // Reset state for new connection attempt
    this.isConnecting = true;
    this.ws = null;

    this.connectionPromise = new Promise((resolve, reject) => {
      try {
        const chatUrl = getChatUrl();
        this.ws = new WebSocket(chatUrl);

        this.ws.onopen = () => {
          console.log('Connected to chat server');
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          if (this.onConnectionChange) {
            this.onConnectionChange(true);
          }
          resolve();
        };

        this.ws.onclose = (event) => {
          console.log('Connection closed:', event.code, event.reason);
          this.isConnecting = false;
          // Reset connection promise so next connect() creates a new one
          this.connectionPromise = null;
          if (this.onConnectionChange) {
            this.onConnectionChange(false);
          }
          this.handleDisconnect();
        };

        this.ws.onerror = (error) => {
          console.error('Connection error:', error);
          this.isConnecting = false;
          // Reset connection promise so retry works
          this.connectionPromise = null;
          reject(error);
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event);
        };
      } catch (error) {
        this.isConnecting = false;
        this.connectionPromise = null;
        reject(error);
      }
    });

    return this.connectionPromise;
  }

  /**
   * Handle incoming messages
   */
  handleMessage(event) {
    try {
      const data = JSON.parse(event.data);
      const { action, request_id, status, payload } = data;

      // Handle streaming messages
      if (status === 'stream') {
        const callbacks = this.streamingCallbacks.get(request_id);
        if (callbacks?.onChunk) {
          callbacks.onChunk(payload);
        }
        return;
      }

      // Handle final responses
      const pending = this.pendingRequests.get(request_id);
      if (pending) {
        if (status === 'success') {
          // If there were streaming callbacks, call onComplete
          const callbacks = this.streamingCallbacks.get(request_id);
          if (callbacks?.onComplete) {
            callbacks.onComplete(payload);
          }
          this.streamingCallbacks.delete(request_id);
          pending.resolve(payload);
        } else if (status === 'error') {
          const callbacks = this.streamingCallbacks.get(request_id);
          if (callbacks?.onError) {
            callbacks.onError(new Error(payload.error));
          }
          this.streamingCallbacks.delete(request_id);
          pending.reject(new Error(payload.error));
        }
        this.pendingRequests.delete(request_id);
      }
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  }

  /**
   * Handle disconnection and attempt reconnection
   */
  async handleDisconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      // Reject all pending requests
      for (const [, pending] of this.pendingRequests) {
        pending.reject(new Error('Connection lost'));
      }
      this.pendingRequests.clear();
      this.streamingCallbacks.clear();
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    await new Promise(resolve => setTimeout(resolve, delay));

    try {
      await this.connect();

      // Restore session if we had one
      if (this.sessionId) {
        await this.restoreSession(this.sessionId);
      }
    } catch (error) {
      console.error('Reconnection failed:', error);
    }
  }

  /**
   * Send a request and wait for response
   * @param {string} action - The action to perform
   * @param {object} payload - The payload data
   * @param {object} streamingCallbacks - Optional callbacks for streaming responses
   * @returns {Promise<object>}
   */
  async sendRequest(action, payload = {}, streamingCallbacks = null) {
    await this.connect();

    const requestId = generateRequestId();

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(requestId, { resolve, reject });

      if (streamingCallbacks) {
        this.streamingCallbacks.set(requestId, streamingCallbacks);
      }

      const message = {
        action,
        request_id: requestId,
        payload,
      };

      try {
        this.ws.send(JSON.stringify(message));
      } catch (error) {
        this.pendingRequests.delete(requestId);
        this.streamingCallbacks.delete(requestId);
        reject(error);
      }
    });
  }

  /**
   * Restore a session after reconnection
   */
  async restoreSession(sessionId) {
    try {
      const result = await this.sendRequest('restore_session', { session_id: sessionId });
      console.log('Session restored:', result);
      return result;
    } catch (error) {
      console.error('Failed to restore session:', error);
      // Session might have expired, don't throw
      this.sessionId = null;
    }
  }

  /**
   * Close the WebSocket connection
   */
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.sessionId = null;
    this.pendingRequests.clear();
    this.streamingCallbacks.clear();
  }
}

// Singleton instance
const chatService = new ChatService();

/**
 * Set connection change callback
 * @param {function} callback - Called with (isConnected) on connection state changes
 */
export function setConnectionChangeCallback(callback) {
  chatService.onConnectionChange = callback;
}

/**
 * Initialize chat connection
 * @returns {Promise<void>}
 */
export async function initializeConnection() {
  return chatService.connect();
}

/**
 * Disconnect from chat server
 */
export function disconnect() {
  chatService.disconnect();
}

/**
 * Create a new session
 * @returns {Promise<{session_id: string, message: string}>}
 */
export async function createSession() {
  const result = await chatService.sendRequest('create_session');
  chatService.sessionId = result.session_id;
  return result;
}

/**
 * Upload an Excel file
 * @param {File} file - The Excel file to upload
 * @param {string} sessionId - Optional session ID
 * @returns {Promise<Object>} Upload result
 */
export async function uploadExcel(file, sessionId = null) {
  // Convert file to base64
  const arrayBuffer = await file.arrayBuffer();
  const base64 = btoa(
    new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
  );

  const result = await chatService.sendRequest('upload', {
    file_data: base64,
    filename: file.name,
    session_id: sessionId || chatService.sessionId,
  });

  if (result.session_id) {
    chatService.sessionId = result.session_id;
  }

  return result;
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
  let accumulatedResponse = '';

  try {
    await chatService.sendRequest(
      'chat',
      {
        prompt,
        session_id: sessionId || chatService.sessionId,
      },
      {
        onChunk: (payload) => {
          accumulatedResponse += payload.content;
          onChunk(accumulatedResponse, payload.session_id);
        },
        onComplete: (payload) => {
          onComplete(payload.content, payload.session_id);
        },
        onError: (error) => {
          onError(error);
        },
      }
    );
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
  // Use the chat endpoint with a predefined prompt
  return sendChatMessage(
    'Please provide an initial analysis of the uploaded document.',
    sessionId,
    onChunk,
    onComplete,
    onError
  );
}

/**
 * Export analysis as PDF or Word document
 * @param {string} sessionId - The session ID
 * @param {string} format - The export format: "pdf" or "docx"
 * @param {string} analysisText - Optional analysis text to include
 * @returns {Promise<Blob>} Document file blob
 */
export async function exportDocument(sessionId, format, analysisText = null) {
  const result = await chatService.sendRequest('export', {
    session_id: sessionId || chatService.sessionId,
    format,
    analysis_text: analysisText,
  });

  // Decode base64 to blob
  const binaryString = atob(result.file_data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  return new Blob([bytes], { type: result.mime_type });
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
 * Get current session ID
 * @returns {string|null}
 */
export function getCurrentSessionId() {
  return chatService.sessionId;
}
