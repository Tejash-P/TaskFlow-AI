import React, { useState, useEffect, useRef } from 'react';
import api from '../lib/api';
import { MessageSquare, X, Send, Sparkles, Loader2, Bot, User } from 'lucide-react';

export default function ChatAssistant({ isOpen, onClose, onTasksMutated }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hi there! I am your TaskFlow AI assistant. I can help you create, list, update, and complete tasks. What would you like to do?' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  if (!isOpen) return null;

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setInput('');
    setLoading(true);

    try {
      // Send message along with history (excluding initial assistant greeting to keep context clean if desired)
      const response = await api.post('/assistant/chat', {
        message: userMessage,
        history: messages
      });

      setMessages(prev => [...prev, { role: 'assistant', content: response.data.response }]);

      // Trigger dashboard task list refresh in case the AI executed a function-call tool
      if (onTasksMutated) {
        onTasksMutated();
      }
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I encountered an error communicating with my system. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed md:relative inset-0 md:inset-auto z-40 md:z-0 flex flex-col w-full md:w-80 h-full md:h-[calc(100vh-2rem)] bg-zinc-950 md:bg-zinc-950/40 border-l border-zinc-900 md:rounded-2xl md:border shadow-2xl overflow-hidden animate-slide-in">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-zinc-900 bg-zinc-950">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-md bg-purple-500/20 text-purple-400">
            <Sparkles className="h-4 w-4" />
          </div>
          <span className="text-sm font-bold text-white tracking-tight">AI Assistant</span>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-lg transition-all cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-zinc-950/20">
        {messages.map((msg, index) => {
          const isAssistant = msg.role === 'assistant';
          return (
            <div key={index} className={`flex gap-3 ${isAssistant ? 'justify-start' : 'justify-end'}`}>
              {isAssistant && (
                <div className="h-7 w-7 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
                  <Bot className="h-4.5 w-4.5" />
                </div>
              )}
              <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed font-medium shadow-md ${
                isAssistant
                  ? 'bg-zinc-900 text-zinc-200 border border-zinc-800/80 rounded-tl-xs'
                  : 'bg-purple-600 text-white rounded-tr-xs'
              }`}>
                {msg.content}
              </div>
              {!isAssistant && (
                <div className="h-7 w-7 rounded-lg bg-zinc-800 text-zinc-400 flex items-center justify-center shrink-0">
                  <User className="h-4 w-4" />
                </div>
              )}
            </div>
          );
        })}

        {loading && (
          <div className="flex gap-3 justify-start">
            <div className="h-7 w-7 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
              <Bot className="h-4.5 w-4.5 animate-pulse" />
            </div>
            <div className="bg-zinc-900 border border-zinc-800/80 rounded-2xl rounded-tl-xs px-4 py-3 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input Form */}
      <form onSubmit={handleSend} className="p-3 border-t border-zinc-900 bg-zinc-950 flex items-center gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={loading}
          placeholder="Ask AI to manage tasks..."
          className="flex-1 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-white placeholder-zinc-500 focus:outline-hidden focus:ring-1 focus:ring-purple-500 focus:border-purple-500 text-xs font-medium"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="p-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl transition-all cursor-pointer disabled:opacity-40 disabled:pointer-events-none shrink-0"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
