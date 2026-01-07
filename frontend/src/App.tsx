/**
 * Main App Component
 * TypeScript version - entry point for the application with WebSocket.
 */

import React, { useState } from 'react';
import Chatbot from './components/Chatbot';
import { wsClient } from './services/websocket';
import type { UploadedFile } from './types';

/**
 * Main App component - Goes directly to chat interface
 */
const App: React.FC = () => {
    const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);

    const handleNewSession = () => {
        // Disconnect and reconnect to get a new session
        wsClient.disconnect();
        setUploadedFiles([]);
        wsClient.connect();
    };

    const handleFileUploaded = (result: { success: boolean; filename: string }) => {
        if (result.success) {
            setUploadedFiles(prev => [...prev, {
                name: result.filename,
                uploadedAt: new Date()
            }]);
        }
    };

    // Always show chatbot - it handles connection state internally
    return (
        <Chatbot
            onNewSession={handleNewSession}
            onFileUploaded={handleFileUploaded}
            uploadedFiles={uploadedFiles}
        />
    );
};

export default App;

