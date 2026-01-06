/**
 * Main App Component
 * TypeScript version - entry point for the application.
 */

import React, { useState, useEffect } from 'react';
import Chatbot from './components/Chatbot';
import { createSession, healthCheck } from './services/api';
import type { UploadedFile, UploadResponse } from './types';

/**
 * Main App component - Goes directly to chat interface
 */
const App: React.FC = () => {
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);

    // Check backend health and create session on mount
    useEffect(() => {
        const initializeApp = async () => {
            try {
                await healthCheck();
                setIsConnected(true);
                setError(null);

                // Create initial session
                const result = await createSession();
                setSessionId(result.session_id);
            } catch (err) {
                setIsConnected(false);
                setError('Cannot connect to backend. Please ensure the server is running.');
            }
        };

        initializeApp();

        // Check health periodically
        const interval = setInterval(async () => {
            try {
                await healthCheck();
                setIsConnected(true);
                setError(null);
            } catch (err) {
                setIsConnected(false);
                setError('Cannot connect to backend. Please ensure the server is running.');
            }
        }, 30000);

        return () => clearInterval(interval);
    }, []);

    const handleNewSession = async () => {
        try {
            const result = await createSession();
            setSessionId(result.session_id);
            setUploadedFiles([]);
        } catch (err) {
            console.error('Failed to create session:', err);
        }
    };

    const handleFileUploaded = (result: UploadResponse & { filename?: string }) => {
        if (result.success) {
            setSessionId(result.session_id);
            setUploadedFiles(prev => [...prev, {
                name: result.filename || 'Uploaded file',
                rowCount: result.row_count,
                uploadedAt: new Date()
            }]);
        }
    };

    // Show error if not connected
    if (!isConnected && error) {
        return (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg
                            className="w-8 h-8 text-red-600"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                            />
                        </svg>
                    </div>
                    <h2 className="text-xl font-semibold text-gray-800 mb-2">
                        Connection Error
                    </h2>
                    <p className="text-gray-600 mb-4">{error}</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="btn-primary"
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    // Show loading while creating session
    if (!sessionId) {
        return (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center">
                <div className="text-center">
                    <div className="loading-dots mb-4">
                        <span></span>
                        <span></span>
                        <span></span>
                    </div>
                    <p className="text-gray-600">Initializing...</p>
                </div>
            </div>
        );
    }

    // Always show chatbot directly
    return (
        <Chatbot
            sessionId={sessionId}
            onNewSession={handleNewSession}
            onFileUploaded={handleFileUploaded}
            uploadedFiles={uploadedFiles}
        />
    );
};

export default App;
