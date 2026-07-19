import React, { useState } from 'react';
import api from '../lib/api';
import { Sparkles, Loader2, Plus } from 'lucide-react';

export default function QuickAdd({ onTaskCreated }) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;

    setLoading(true);
    setError('');

    try {
      const response = await api.post('/tasks/parse', { text });
      onTaskCreated(response.data);
      setText('');
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'AI parsing failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit} className="relative flex items-center">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={loading}
          placeholder="AI Quick Add: 'Buy groceries tomorrow 4pm, high priority'..."
          className="w-full pl-4 pr-24 py-3.5 bg-zinc-900 border border-zinc-800 rounded-2xl text-white placeholder-zinc-500 focus:outline-hidden focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 transition-all text-sm font-medium"
        />
        <div className="absolute right-2.5 flex items-center gap-1.5">
          <button
            type="submit"
            disabled={loading || !text.trim()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-linear-to-r from-purple-600 to-indigo-600 text-white font-semibold rounded-xl text-xs hover:from-purple-500 hover:to-indigo-500 transition-all shadow-md cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            {loading ? 'Parsing...' : 'Generate'}
          </button>
        </div>
      </form>
      {error && (
        <p className="mt-2 text-xs text-red-400 font-medium px-2">{error}</p>
      )}
    </div>
  );
}
