'use client';

import { ChatMessage as ChatMessageType } from '@/lib/types';

interface ChatMessageProps {
  message: ChatMessageType;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  return (
    <div className={`message-enter ${isUser ? 'flex justify-end' : ''}`}>
      <div className={`max-w-2xl ${isUser ? 'ml-12' : 'mr-12'}`}>
        {/* Message bubble */}
        <div
          className={`rounded-2xl px-4 py-3 ${
            isUser
              ? 'bg-os-accent text-white rounded-br-md'
              : isSystem
              ? 'bg-os-surface/50 border border-os-border text-os-muted text-sm'
              : 'bg-os-surface border border-os-border rounded-bl-md'
          }`}
        >
          {/* Assistant icon */}
          {!isUser && !isSystem && (
            <div className="flex items-center gap-2 mb-2 pb-2 border-b border-os-border/50">
              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
                <span className="text-[10px]">✦</span>
              </div>
              <span className="text-xs text-os-muted font-medium">Editorial OS</span>
            </div>
          )}

          {/* Message content */}
          <div className={`whitespace-pre-wrap ${isSystem ? '' : 'text-sm leading-relaxed'}`}>
            {message.content}
          </div>

          {/* Status indicator */}
          {message.status === 'pending' && (
            <div className="flex items-center gap-1 mt-2 pt-2 border-t border-os-border/50">
              <div className="typing-dot w-1.5 h-1.5 rounded-full bg-os-muted" />
              <div className="typing-dot w-1.5 h-1.5 rounded-full bg-os-muted" />
              <div className="typing-dot w-1.5 h-1.5 rounded-full bg-os-muted" />
            </div>
          )}
        </div>

        {/* Action buttons */}
        {message.actions && message.actions.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2 ml-1">
            {message.actions.map((action, index) => (
              <a
                key={index}
                href={action.url}
                target="_blank"
                rel="noopener noreferrer"
                className="action-btn"
              >
                {action.module && (
                  <span className="text-base">
                    {action.module === 'brief' && '📝'}
                    {action.module === 'deck' && '📊'}
                    {action.module === 'dam' && '🖼️'}
                  </span>
                )}
                {action.label}
                <svg className="w-3 h-3 text-os-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            ))}
          </div>
        )}

        {/* Timestamp */}
        <div className={`text-[10px] text-os-muted mt-1 ${isUser ? 'text-right mr-1' : 'ml-1'}`}>
          {new Date(message.timestamp).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
          })}
        </div>
      </div>
    </div>
  );
}
