/**
 * WebSocket Service for real-time communication with AI Assistant backend.
 * Handles connection management, auto-reconnect, and message dispatching.
 */

// WebSocket URL - use ws:// for localhost, wss:// for production
const WS_URL = import.meta.env.VITE_WS_URL ||
    (window.location.protocol === 'https:'
        ? `wss://${window.location.host}/ws`
        : `ws://localhost:8000/ws`);

// Message types from server
export type ServerMessageType =
    | 'connected'
    | 'session_created'
    | 'upload_complete'
    | 'chat_chunk'
    | 'chat_complete'
    | 'export_ready'
    | 'session_deleted'
    | 'error';

// Message types to server
export type ClientMessageType =
    | 'create_session'
    | 'upload'
    | 'chat'
    | 'export_pdf'
    | 'export_docx'
    | 'delete_session';

export interface ServerMessage {
    type: ServerMessageType;
    payload: Record<string, unknown>;
}

export interface ClientMessage {
    type: ClientMessageType;
    payload: Record<string, unknown>;
}

// Event handlers type
export type MessageHandler = (message: ServerMessage) => void;
export type ConnectionHandler = () => void;

interface EventHandlers {
    onMessage: MessageHandler[];
    onConnect: ConnectionHandler[];
    onDisconnect: ConnectionHandler[];
    onReconnecting: ConnectionHandler[];
}

class WebSocketClient {
    private ws: WebSocket | null = null;
    private sessionId: string | null = null;
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 10;
    private reconnectDelay = 1000; // Start with 1 second
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    private isIntentionalClose = false;

    private handlers: EventHandlers = {
        onMessage: [],
        onConnect: [],
        onDisconnect: [],
        onReconnecting: [],
    };

    constructor() {
        this.connect();
    }

    /**
     * Connect to WebSocket server
     */
    connect(): void {
        if (this.ws?.readyState === WebSocket.OPEN) {
            return;
        }

        this.isIntentionalClose = false;

        try {
            this.ws = new WebSocket(WS_URL);

            this.ws.onopen = () => {
                console.log('WebSocket connected');
                this.reconnectAttempts = 0;
                this.reconnectDelay = 1000;
                this.handlers.onConnect.forEach(handler => handler());
            };

            this.ws.onclose = (event) => {
                console.log('WebSocket closed:', event.code, event.reason);
                this.handlers.onDisconnect.forEach(handler => handler());

                if (!this.isIntentionalClose) {
                    this.scheduleReconnect();
                }
            };

            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
            };

            this.ws.onmessage = (event) => {
                try {
                    const message: ServerMessage = JSON.parse(event.data);

                    // Store session ID from connected message
                    if (message.type === 'connected' && message.payload.session_id) {
                        this.sessionId = message.payload.session_id as string;
                    }

                    // Dispatch to all handlers
                    this.handlers.onMessage.forEach(handler => handler(message));
                } catch (error) {
                    console.error('Failed to parse WebSocket message:', error);
                }
            };
        } catch (error) {
            console.error('Failed to create WebSocket:', error);
            this.scheduleReconnect();
        }
    }

    /**
     * Schedule a reconnection attempt with exponential backoff
     */
    private scheduleReconnect(): void {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('Max reconnection attempts reached');
            return;
        }

        this.handlers.onReconnecting.forEach(handler => handler());

        this.reconnectTimer = setTimeout(() => {
            this.reconnectAttempts++;
            console.log(`Reconnecting... attempt ${this.reconnectAttempts}`);
            this.connect();
        }, this.reconnectDelay);

        // Exponential backoff with max of 30 seconds
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
    }

    /**
     * Close the WebSocket connection
     */
    disconnect(): void {
        this.isIntentionalClose = true;
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }

    /**
     * Check if connected
     */
    isConnected(): boolean {
        return this.ws?.readyState === WebSocket.OPEN;
    }

    /**
     * Get current session ID
     */
    getSessionId(): string | null {
        return this.sessionId;
    }

    /**
     * Send a message to the server
     */
    send(type: ClientMessageType, payload: Record<string, unknown> = {}): boolean {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.error('WebSocket not connected');
            return false;
        }

        const message: ClientMessage = { type, payload };
        this.ws.send(JSON.stringify(message));
        return true;
    }

    /**
     * Register event handlers
     */
    onMessage(handler: MessageHandler): () => void {
        this.handlers.onMessage.push(handler);
        return () => {
            this.handlers.onMessage = this.handlers.onMessage.filter(h => h !== handler);
        };
    }

    onConnect(handler: ConnectionHandler): () => void {
        this.handlers.onConnect.push(handler);
        return () => {
            this.handlers.onConnect = this.handlers.onConnect.filter(h => h !== handler);
        };
    }

    onDisconnect(handler: ConnectionHandler): () => void {
        this.handlers.onDisconnect.push(handler);
        return () => {
            this.handlers.onDisconnect = this.handlers.onDisconnect.filter(h => h !== handler);
        };
    }

    onReconnecting(handler: ConnectionHandler): () => void {
        this.handlers.onReconnecting.push(handler);
        return () => {
            this.handlers.onReconnecting = this.handlers.onReconnecting.filter(h => h !== handler);
        };
    }
}

// Singleton instance
export const wsClient = new WebSocketClient();

// ================================================================
// High-level API functions (matching the old REST API interface)
// ================================================================

/**
 * Upload an Excel file via WebSocket
 */
export async function uploadExcel(file: File): Promise<void> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = () => {
            const base64 = (reader.result as string).split(',')[1]; // Remove data:... prefix

            // Set up one-time handler for response
            const unsubscribe = wsClient.onMessage((message) => {
                if (message.type === 'upload_complete') {
                    unsubscribe();
                    resolve();
                } else if (message.type === 'error') {
                    unsubscribe();
                    reject(new Error(message.payload.message as string));
                }
            });

            wsClient.send('upload', {
                filename: file.name,
                data: base64,
            });
        };

        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
    });
}

/**
 * Send a chat message with streaming response
 */
export function sendChatMessage(
    prompt: string,
    onChunk: (accumulated: string) => void,
    onComplete: (response: string) => void,
    onError: (error: Error) => void
): () => void {
    let accumulated = '';

    const unsubscribe = wsClient.onMessage((message) => {
        switch (message.type) {
            case 'chat_chunk':
                accumulated = message.payload.accumulated as string;
                onChunk(accumulated);
                break;
            case 'chat_complete':
                unsubscribe();
                onComplete(message.payload.content as string);
                break;
            case 'error':
                unsubscribe();
                onError(new Error(message.payload.message as string));
                break;
        }
    });

    wsClient.send('chat', { prompt });

    // Return unsubscribe function to allow cancellation
    return unsubscribe;
}

/**
 * Export analysis as PDF
 */
export async function exportPDF(analysisText?: string): Promise<Blob> {
    return new Promise((resolve, reject) => {
        const unsubscribe = wsClient.onMessage((message) => {
            if (message.type === 'export_ready') {
                unsubscribe();
                const base64 = message.payload.data as string;
                const binary = atob(base64);
                const bytes = new Uint8Array(binary.length);
                for (let i = 0; i < binary.length; i++) {
                    bytes[i] = binary.charCodeAt(i);
                }
                resolve(new Blob([bytes], { type: 'application/pdf' }));
            } else if (message.type === 'error') {
                unsubscribe();
                reject(new Error(message.payload.message as string));
            }
        });

        wsClient.send('export_pdf', analysisText ? { analysis_text: analysisText } : {});
    });
}

/**
 * Export analysis as Word document
 */
export async function exportWord(analysisText?: string): Promise<Blob> {
    return new Promise((resolve, reject) => {
        const unsubscribe = wsClient.onMessage((message) => {
            if (message.type === 'export_ready') {
                unsubscribe();
                const base64 = message.payload.data as string;
                const binary = atob(base64);
                const bytes = new Uint8Array(binary.length);
                for (let i = 0; i < binary.length; i++) {
                    bytes[i] = binary.charCodeAt(i);
                }
                resolve(new Blob([bytes], {
                    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                }));
            } else if (message.type === 'error') {
                unsubscribe();
                reject(new Error(message.payload.message as string));
            }
        });

        wsClient.send('export_docx', analysisText ? { analysis_text: analysisText } : {});
    });
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
 * Delete session (cleanup)
 */
export function deleteSession(): void {
    wsClient.send('delete_session', {});
}

export default wsClient;
