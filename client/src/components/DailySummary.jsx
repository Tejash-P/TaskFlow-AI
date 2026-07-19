import React, { useState, useEffect } from 'react';
import api from '../lib/api';
import { Sparkles, RefreshCw, Loader2 } from 'lucide-react';

export default function DailySummary() {
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchSummary = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/assistant/summary');
      setSummary(response.data.summary);
    } catch (err) {
      console.error(err);
      setError('Could not generate AI briefing. Please check your API configuration.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-purple-500/20 bg-linear-to-r from-purple-950/40 to-indigo-950/40 p-6 shadow-xl backdrop-blur-md">
      {/* Decorative Blur Backgrounds */}
      <div className="absolute -top-12 -right-12 w-24 h-24 bg-purple-500/10 rounded-full blur-xl pointer-events-none"></div>

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-purple-500/20 text-purple-400">
            <Sparkles className="h-5 w-5" />
          </div>
          <h2 className="text-lg font-bold text-white tracking-tight">AI Daily Briefing</h2>
        </div>
        <button
          onClick={fetchSummary}
          disabled={loading}
          className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-all cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
          title="Regenerate Summary"
        >
          {loading ? (
            <Loader2 className="h-4.5 w-4.5 animate-spin" />
          ) : (
            <RefreshCw className="h-4.5 w-4.5" />
          )}
        </button>
      </div>

      {loading ? (
        <div className="space-y-3 animate-pulse py-2">
          <div className="h-4 bg-zinc-800/80 rounded-sm w-3/4"></div>
          <div className="h-4 bg-zinc-800/80 rounded-sm w-5/6"></div>
          <div className="h-4 bg-zinc-800/80 rounded-sm w-2/3"></div>
        </div>
      ) : error ? (
        <p className="text-zinc-500 text-sm italic">{error}</p>
      ) : (
        <div className="text-zinc-300 text-sm leading-relaxed whitespace-pre-line font-medium">
          {summary || 'Your briefing is empty. Try creating some tasks to get a personalized update!'}
        </div>
      )}
    </div>
  );
}
