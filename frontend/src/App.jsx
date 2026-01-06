import React, { useState, useEffect, useRef, useCallback } from 'react';
import Chatbot from './components/Chatbot';
import { createSession, initializeConnection, disconnect, setConnectionChangeCallback } from './services/api';

/**
 * Main App component - Goes directly to chat interface
 */
export default function App() {
  const [sessionId, setSessionId] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [isInitializing, setIsInitializing] = useState(true);

  // Use refs to track state for callbacks
  const isInitialized = useRef(false);
  const sessionIdRef = useRef(null);
  const isCreatingSession = useRef(false);

  // Keep sessionIdRef in sync
  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  // Function to create a new session (can be called from callback)
  const createNewSession = useCallback(async () => {
    // Prevent concurrent session creation
    if (isCreatingSession.current) return;
    isCreatingSession.current = true;

    try {
      setIsInitializing(true);
      setError(null);
      const result = await createSession();
      setSessionId(result.session_id);
      setIsConnected(true);
      setError(null);
      console.log('Session created:', result.session_id);
    } catch (err) {
      console.error('Failed to create session:', err);
      setError('Failed to create session. Please try again.');
    } finally {
      setIsInitializing(false);
      isCreatingSession.current = false;
    }
  }, []);

  // Function to initialize connection and create session
  const initializeApp = useCallback(async () => {
    setIsInitializing(true);
    setError(null);

    try {
      // Initialize connection
      await initializeConnection();
      // Create session
      await createNewSession();
    } catch (err) {
      console.error('Initialization error:', err);
      setIsConnected(false);
      setError('Cannot connect to backend. Please ensure the server is running.');
      setIsInitializing(false);
    }
  }, [createNewSession]);

  // Create session on mount (only once)
  useEffect(() => {
    // Prevent double initialization in React StrictMode
    if (isInitialized.current) return;
    isInitialized.current = true;

    // Set up connection change callback
    setConnectionChangeCallback((connected) => {
      setIsConnected(connected);
      if (connected) {
        // Clear error on successful connection
        setError(null);
        console.log('Connected');
        // If we don't have a session yet, create one
        if (!sessionIdRef.current && !isCreatingSession.current) {
          console.log('Creating session after reconnection...');
          createNewSession();
        }
      } else {
        console.log('Disconnected, will attempt to reconnect...');
      }
    });

    initializeApp();

    // Cleanup on unmount
    return () => {
      disconnect();
    };
  }, [initializeApp, createNewSession]);

  const handleNewSession = async () => {
    try {
      const result = await createSession();
      setSessionId(result.session_id);
      setUploadedFiles([]);
    } catch (err) {
      console.error('Failed to create session:', err);
    }
  };

  const handleFileUploaded = (result) => {
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
            onClick={initializeApp}
            disabled={isInitializing}
            className="btn-primary"
          >
            {isInitializing ? 'Connecting...' : 'Retry'}
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
}
