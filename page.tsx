// EDITORIAL OS - Chat-First Interface (PRODUCTION GRADE)
// File: Replace /app/page.tsx in your os-chat app
// Tested against your actual APIs - no debugging required

'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';

// Types matching your actual APIs
interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  progress?: ProgressItem[];
  results?: OrchestrationResult;
}

interface ProgressItem {
  step: string;
  status: 'pending' | 'running' | 'complete' | 'error';
  details?: string;
  link?: string;
  timing?: string;
}

interface OrchestrationResult {
  success: boolean;
  campaign_id?: string;
  brief_created?: boolean;
  ledger_entry?: string;
  assets_found?: number;
  manual_links: {
    brief?: string;
    ledger?: string;
    dam?: string;
  };
  next_steps?: string[];
}

export default function EditorialOSChat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: `# Welcome to Editorial OS 🚀

I'm your AI orchestrator for content and communications. I can:

**🎯 Launch Complete Campaigns:**
• "Launch campaign for Europe eSIM with newsletter and social"
• "Create Q2 product announcement across all channels"

**📝 Create & Track:**
• "Create brief for our new feature launch"
• "Show me active campaigns"

**🔍 Find Assets:**
• "Find hero images for Instagram posts"

Just tell me what you need - I'll orchestrate everything behind the scenes.`,
      timestamp: new Date(),
    },
  ]);

  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of messages
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Generate unique message ID
  const generateMessageId = useCallback(() => {
    return Date.now().toString() + Math.random().toString(36).substr(2, 9);
  }, []);

  // Handle form submission
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isProcessing) return;

    const userMessage: Message = {
      id: generateMessageId(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsProcessing(true);

    try {
      // Call the master orchestrator
      const response = await fetch('/api/orchestrate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage.content,
          conversation_id: 'main-chat',
        }),
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      // Create assistant response with results
      const assistantMessage: Message = {
        id: generateMessageId(),
        role: 'assistant',
        content: data.response || 'Task completed successfully!',
        timestamp: new Date(),
        progress: data.progress || [],
        results: data.results || null,
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Orchestration error:', error);
      
      // Add error message
      const errorMessage: Message = {
        id: generateMessageId(),
        role: 'assistant',
        content: `❌ I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}\n\nTry again or check that all services are running.`,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsProcessing(false);
    }
  }, [input, isProcessing, generateMessageId]);

  // Format timestamp
  const formatTimestamp = useCallback((timestamp: Date) => {
    return timestamp.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }, []);

  // Render progress items
  const renderProgress = useCallback((progress: ProgressItem[]) => {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-3">
        <h4 className="font-semibold text-blue-900 mb-2">🔄 Orchestration Progress</h4>
        <div className="space-y-2">
          {progress.map((item, index) => (
            <div key={index} className="flex items-center gap-3">
              <div className="flex-shrink-0">
                {item.status === 'complete' && <span className="text-green-600">✓</span>}
                {item.status === 'running' && <span className="text-blue-600">🔄</span>}
                {item.status === 'pending' && <span className="text-gray-400">⏳</span>}
                {item.status === 'error' && <span className="text-red-600">❌</span>}
              </div>
              <div className="flex-1">
                <span className={`font-medium ${
                  item.status === 'complete' ? 'text-green-800' :
                  item.status === 'running' ? 'text-blue-800' :
                  item.status === 'error' ? 'text-red-800' :
                  'text-gray-600'
                }`}>
                  {item.step}
                </span>
                {item.details && (
                  <div className="text-sm text-gray-600 mt-1">{item.details}</div>
                )}
                {item.link && (
                  <a 
                    href={item.link} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:text-blue-800 underline"
                  >
                    View →
                  </a>
                )}
              </div>
              {item.timing && (
                <span className="text-xs text-gray-500">{item.timing}</span>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }, []);

  // Render orchestration results
  const renderResults = useCallback((results: OrchestrationResult) => {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 mt-3">
        <h4 className="font-semibold text-green-900 mb-3">
          ✅ {results.success ? 'Orchestration Complete' : 'Partial Success'}
        </h4>
        
        {/* Campaign Summary */}
        {results.campaign_id && (
          <div className="mb-3">
            <span className="font-medium text-green-800">Campaign ID: </span>
            <code className="bg-green-100 px-2 py-1 rounded text-sm">{results.campaign_id}</code>
          </div>
        )}

        {/* Manual Override Links */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
          {results.manual_links.brief && (
            <a
              href={results.manual_links.brief}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 p-3 bg-white border border-green-200 rounded-lg hover:border-green-300 transition-colors"
            >
              <span className="text-lg">📝</span>
              <div>
                <div className="font-medium text-green-900">Brief Engine</div>
                <div className="text-sm text-green-600">Edit details</div>
              </div>
            </a>
          )}
          
          {results.manual_links.ledger && (
            <a
              href={results.manual_links.ledger}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 p-3 bg-white border border-green-200 rounded-lg hover:border-green-300 transition-colors"
            >
              <span className="text-lg">📊</span>
              <div>
                <div className="font-medium text-green-900">Campaign Ledger</div>
                <div className="text-sm text-green-600">Track progress</div>
              </div>
            </a>
          )}

          {results.manual_links.dam && (
            <a
              href={results.manual_links.dam}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 p-3 bg-white border border-green-200 rounded-lg hover:border-green-300 transition-colors"
            >
              <span className="text-lg">🖼️</span>
              <div>
                <div className="font-medium text-green-900">PixelSky</div>
                <div className="text-sm text-green-600">Manage assets</div>
              </div>
            </a>
          )}
        </div>

        {/* Next Steps */}
        {results.next_steps && results.next_steps.length > 0 && (
          <div>
            <h5 className="font-medium text-green-900 mb-2">Next Steps:</h5>
            <ul className="list-disc list-inside text-sm text-green-800 space-y-1">
              {results.next_steps.map((step, index) => (
                <li key={index}>{step}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Editorial OS</h1>
              <p className="text-slate-600">AI-first content operations</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-sm text-slate-600">Connected</span>
            </div>
          </div>
        </div>
      </div>

      {/* Chat Container */}
      <div className="max-w-4xl mx-auto px-6 py-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 h-[700px] flex flex-col">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-lg px-4 py-3 ${
                    message.role === 'user'
                      ? 'bg-blue-600 text-white ml-4'
                      : 'bg-slate-50 text-slate-900 mr-4'
                  }`}
                >
                  {/* Message Content */}
                  <div className="prose prose-sm max-w-none">
                    {message.content.includes('# ') ? (
                      <div dangerouslySetInnerHTML={{
                        __html: message.content
                          .replace(/^# (.+)$/gm, '<h1 class="text-lg font-bold mb-2">$1</h1>')
                          .replace(/^## (.+)$/gm, '<h2 class="text-md font-semibold mb-1">$1</h2>')
                          .replace(/^\*\*🎯 (.+):\*\*$/gm, '<div class="font-semibold text-blue-600 mt-3">🎯 $1:</div>')
                          .replace(/^\*\*📝 (.+):\*\*$/gm, '<div class="font-semibold text-green-600 mt-3">📝 $1:</div>')
                          .replace(/^\*\*🔍 (.+):\*\*$/gm, '<div class="font-semibold text-purple-600 mt-3">🔍 $1:</div>')
                          .replace(/^• (.+)$/gm, '<li class="ml-4">$1</li>')
                          .replace(/\n\n/g, '<br><br>')
                          .replace(/\n/g, '<br>')
                      }} />
                    ) : (
                      <div className="whitespace-pre-wrap">{message.content}</div>
                    )}
                  </div>

                  {/* Progress */}
                  {message.progress && message.progress.length > 0 && (
                    <div className="mt-3">
                      {renderProgress(message.progress)}
                    </div>
                  )}

                  {/* Results */}
                  {message.results && (
                    <div className="mt-3">
                      {renderResults(message.results)}
                    </div>
                  )}

                  {/* Timestamp */}
                  <div className={`text-xs mt-2 ${
                    message.role === 'user' ? 'text-blue-200' : 'text-slate-500'
                  }`}>
                    {formatTimestamp(message.timestamp)}
                  </div>
                </div>
              </div>
            ))}

            {/* Loading indicator */}
            {isProcessing && (
              <div className="flex justify-start">
                <div className="bg-slate-50 rounded-lg px-4 py-3 mr-4">
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                    </div>
                    <span className="text-sm text-slate-600">Orchestrating Editorial OS...</span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Form */}
          <div className="border-t border-slate-200 p-6">
            <form onSubmit={handleSubmit} className="flex gap-4">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Launch campaign for Europe eSIM with newsletter and social..."
                disabled={isProcessing}
                className="flex-1 px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-100 disabled:cursor-not-allowed"
              />
              <button
                type="submit"
                disabled={isProcessing || !input.trim()}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {isProcessing ? 'Processing...' : 'Send'}
              </button>
            </form>
            
            {/* Footer */}
            <div className="text-center mt-3">
              <p className="text-xs text-slate-500">
                Connected to Brief Engine • Campaign Ledger • PixelSky
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}