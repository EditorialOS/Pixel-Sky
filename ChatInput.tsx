'use client';

import { useState, useRef, useEffect, KeyboardEvent } from 'react';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({ onSend, disabled, placeholder }: ChatInputProps) {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  const handleSubmit = () => {
    if (input.trim() && !disabled) {
      onSend(input.trim());
      setInput('');
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="chat-input-glow bg-os-surface border border-os-border rounded-2xl transition-all duration-300">
      <div className="flex items-end gap-3 p-3">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={placeholder || "What do you need?"}
          rows={1}
          className="flex-1 bg-transparent text-os-text placeholder-os-muted resize-none outline-none text-sm leading-relaxed max-h-[200px]"
        />
        <button
          onClick={handleSubmit}
          disabled={!input.trim() || disabled}
          className={`flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200 ${
            input.trim() && !disabled
              ? 'bg-os-accent hover:bg-indigo-600 text-white'
              : 'bg-os-border text-os-muted cursor-not-allowed'
          }`}
        >
          {disabled ? (
            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
          )}
        </button>
      </div>
      <div className="px-4 pb-2 flex items-center gap-4 text-[10px] text-os-muted">
        <span>Press Enter to send</span>
        <span>Shift+Enter for new line</span>
      </div>
    </div>
  );
}
