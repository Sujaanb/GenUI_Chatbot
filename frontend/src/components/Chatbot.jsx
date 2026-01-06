import React, { useState, useRef, useEffect } from 'react';
import { C1Component, ThemeProvider } from '@thesysai/genui-sdk';
import { Send, Download, RefreshCw, Trash2, Paperclip, FileSpreadsheet, CheckCircle, X, FileText } from 'lucide-react';
import { sendChatMessage, exportDocument, downloadBlob, uploadExcel } from '../services/api';

/**
 * Message component for displaying chat messages
 */
function Message({ message, isStreaming }) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end mb-4">
        <div className="message-user">
          <p>{message.content}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start mb-4">
      <div className="message-assistant w-full">
        <ThemeProvider>
          <C1Component
            c1Response={message.content}
            isStreaming={isStreaming && message.isLatest}
          />
        </ThemeProvider>
      </div>
    </div>
  );
}

/**
 * Loading indicator component
 */
function LoadingIndicator() {
  return (
    <div className="flex justify-start mb-4">
      <div className="message-assistant">
        <div className="flex items-center gap-2">
          <div className="loading-dots">
            <span></span>
            <span></span>
            <span></span>
          </div>
          <span className="text-gray-500 text-sm">Thinking...</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Main Chatbot component
 */
export default function Chatbot({ sessionId, onNewSession, onFileUploaded, uploadedFiles = [] }) {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showUploadSuccess, setShowUploadSuccess] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Hide upload success after 3 seconds
  useEffect(() => {
    if (showUploadSuccess) {
      const timer = setTimeout(() => setShowUploadSuccess(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [showUploadSuccess]);

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage = inputValue.trim();
    setInputValue('');
    setIsLoading(true);

    // Add user message
    setMessages((prev) => [
      ...prev,
      { role: 'user', content: userMessage },
    ]);

    // Add placeholder for assistant message
    setMessages((prev) => [
      ...prev,
      { role: 'assistant', content: '', isLatest: true },
    ]);

    try {
      await sendChatMessage(
        userMessage,
        sessionId,
        // onChunk
        (accumulatedResponse) => {
          setMessages((prev) => {
            const newMessages = [...prev];
            const lastIndex = newMessages.length - 1;
            newMessages[lastIndex] = {
              ...newMessages[lastIndex],
              content: accumulatedResponse,
            };
            return newMessages;
          });
        },
        // onComplete
        (finalResponse) => {
          setMessages((prev) => {
            const newMessages = [...prev];
            const lastIndex = newMessages.length - 1;
            newMessages[lastIndex] = {
              ...newMessages[lastIndex],
              content: finalResponse,
              isLatest: false,
            };
            return newMessages;
          });
          setIsLoading(false);
        },
        // onError
        (error) => {
          console.error('Chat error:', error);
          setMessages((prev) => {
            const newMessages = [...prev];
            const lastIndex = newMessages.length - 1;
            newMessages[lastIndex] = {
              ...newMessages[lastIndex],
              content: 'Sorry, an error occurred. Please try again.',
              isLatest: false,
            };
            return newMessages;
          });
          setIsLoading(false);
        }
      );
    } catch (error) {
      console.error('Send error:', error);
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleExportPDF = async () => {
    if (!sessionId) return;

    setIsExporting(true);
    try {
      const blob = await exportDocument(sessionId, 'pdf');
      downloadBlob(blob, 'analysis_report.pdf');
    } catch (error) {
      console.error('Export error:', error);
      alert('Failed to export PDF. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportWord = async () => {
    if (!sessionId) return;

    setIsExporting(true);
    try {
      const blob = await exportDocument(sessionId, 'docx');
      downloadBlob(blob, 'analysis_report.docx');
    } catch (error) {
      console.error('Export error:', error);
      alert('Failed to export Word document. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleClearChat = () => {
    if (window.confirm('Are you sure you want to clear the chat history?')) {
      setMessages([]);
    }
  };

  // Suggested prompts for users
  const suggestedPrompts = [
    'What data is in this document?',
    'Summarize the key insights',
    'Show me the main patterns',
    'What are the most important findings?',
    'Create a visualization of this data',
  ];

  const handleSuggestedPrompt = (prompt) => {
    setInputValue(prompt);
    inputRef.current?.focus();
  };

  // File upload handler
  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      alert('Please upload an Excel file (.xlsx or .xls)');
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      const result = await uploadExcel(file, sessionId);
      if (result.success) {
        setShowUploadSuccess(true);
        if (onFileUploaded) {
          onFileUploaded({ ...result, filename: file.name });
        }
      } else {
        setUploadError(result.message || 'Upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      setUploadError(error.message || 'Upload failed');
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const hasDataLoaded = uploadedFiles.length > 0;

  return (
    <div className="chat-container bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-gray-800">AI Assistant</h2>
          <div className="flex items-center gap-2">
            <p className="text-xs text-gray-500">Session: {sessionId?.slice(0, 8)}...</p>
            {uploadedFiles.length > 0 && (
              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                {uploadedFiles.length} file{uploadedFiles.length > 1 ? 's' : ''} loaded
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportWord}
            disabled={isExporting || messages.length === 0}
            className="btn-secondary flex items-center gap-1 text-sm"
            title="Export as Word"
          >
            {isExporting ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <FileText className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">Word</span>
          </button>
          <button
            onClick={handleExportPDF}
            disabled={isExporting || messages.length === 0}
            className="btn-secondary flex items-center gap-1 text-sm"
            title="Export as PDF"
          >
            {isExporting ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">PDF</span>
          </button>
          <button
            onClick={handleClearChat}
            disabled={messages.length === 0}
            className="btn-secondary flex items-center gap-1 text-sm"
            title="Clear chat"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            onClick={onNewSession}
            className="btn-secondary flex items-center gap-1 text-sm"
            title="New session"
          >
            <RefreshCw className="w-4 h-4" />
            <span className="hidden sm:inline">New</span>
          </button>
        </div>
      </div>

      {/* Upload Success Toast */}
      {showUploadSuccess && (
        <div className="absolute top-16 left-1/2 transform -translate-x-1/2 z-50 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 animate-fade-in">
          <CheckCircle className="w-4 h-4" />
          <span>File uploaded successfully!</span>
        </div>
      )}

      {/* Messages */}
      <div className="chat-messages flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="mb-6">
              <h3 className="text-xl font-semibold text-gray-700 mb-2">
                {hasDataLoaded ? 'Ready to Analyze' : 'Welcome to AI Assistant'}
              </h3>
              <p className="text-gray-500">
                {hasDataLoaded
                  ? 'Ask questions about your data to get insights and visualizations.'
                  : 'Upload an Excel file using the button below to get started, or just ask a question.'}
              </p>
            </div>

            <div className="w-full max-w-md">
              <p className="text-sm text-gray-400 mb-3">Try these prompts:</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {suggestedPrompts.map((prompt, index) => (
                  <button
                    key={index}
                    onClick={() => handleSuggestedPrompt(prompt)}
                    className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 hover:border-blue-300 transition-colors"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            {messages.map((message, index) => (
              <Message
                key={index}
                message={message}
                isStreaming={isLoading}
              />
            ))}
            {isLoading && messages[messages.length - 1]?.content === '' && (
              <LoadingIndicator />
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input with File Upload Button */}
      <div className="chat-input-container">
        {/* Upload Error */}
        {uploadError && (
          <div className="max-w-4xl mx-auto mb-2 p-2 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center justify-between">
            <span>{uploadError}</span>
            <button onClick={() => setUploadError(null)} className="text-red-500 hover:text-red-700">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="flex items-end gap-2 max-w-4xl mx-auto">
          {/* File Upload Button */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileSelect}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="p-3 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 hover:border-blue-400 transition-colors text-gray-500 hover:text-blue-600 flex-shrink-0"
            title="Upload Excel file"
          >
            {isUploading ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : (
              <Paperclip className="w-5 h-5" />
            )}
          </button>

          {/* Text Input */}
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={hasDataLoaded ? "Ask about your data..." : "Ask a question or upload a file to start..."}
              className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={1}
              disabled={isLoading}
              style={{
                minHeight: '48px',
                maxHeight: '120px',
              }}
            />
          </div>

          {/* Send Button */}
          <button
            onClick={handleSend}
            disabled={!inputValue.trim() || isLoading}
            className="btn-primary p-3 rounded-xl"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
        <p className="text-xs text-gray-400 text-center mt-2">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
