import React, { useState } from 'react';
import api from '../lib/api';
import Navigation from '../components/Navigation';
import { Sparkles, Copy, Check, Loader2, Send, FileText, Share2, MessageSquare, Mail } from 'lucide-react';

export default function ContentGenerator() {
  const [prompt, setPrompt] = useState('');
  const [contentType, setContentType] = useState('email');
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async (e) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setGenerating(true);
    setResult(null);
    setCopied(false);

    try {
      if (contentType === 'email') {
        const res = await api.post('/content/email', { prompt });
        setResult({
          type: 'email',
          subject: res.data.generatedSubject,
          body: res.data.generatedBody,
        });
      } else {
        const res = await api.post('/content/generate', { prompt, type: contentType });
        setResult({
          type: contentType,
          body: res.data.text,
        });
      }
    } catch (err) {
      console.error(err);
      alert('Failed to generate content. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = () => {
    if (!result) return;
    const textToCopy = result.type === 'email'
      ? `Subject: ${result.subject}\n\n${result.body}`
      : result.body;

    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const types = [
    { id: 'email', name: 'Email Draft', icon: Mail, description: 'Generates structured subject & email body.' },
    { id: 'social-post', name: 'Social Post', icon: Share2, description: 'Perfect for LinkedIn or Twitter.' },
    { id: 'report-snippet', name: 'Report Snippet', icon: FileText, description: 'Formal reporting and project highlights.' },
    { id: 'message', name: 'Team Message', icon: MessageSquare, description: 'Brief updates for Slack or Teams.' },
  ];

  return (
    <div className="flex min-h-screen bg-zinc-950 text-zinc-100 pb-20 md:pb-0">
      <Navigation />

      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
        <header className="flex items-center justify-between px-6 md:px-8 py-5 border-b border-zinc-900 sticky top-0 bg-zinc-950/80 backdrop-blur-md z-30">
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white">AI Content Generator</h1>
            <p className="text-xs text-zinc-400 font-medium">Compose draft emails, update posts, or summarize report writeups instantly.</p>
          </div>
        </header>

        <div className="flex-1 p-6 md:p-8 space-y-6 max-w-4xl w-full mx-auto">
          {/* Controls */}
          <form onSubmit={handleGenerate} className="p-6 bg-zinc-900/20 border border-zinc-900/60 rounded-3xl space-y-6">
            {/* Type selector */}
            <div className="space-y-3">
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Content Type</label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {types.map((t) => {
                  const Icon = t.icon;
                  const isSelected = contentType === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setContentType(t.id)}
                      className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-3 ${isSelected ? 'bg-purple-600/10 border-purple-500/50 text-white shadow-lg shadow-purple-500/5' : 'bg-zinc-950 border-zinc-900 text-zinc-400 hover:text-zinc-200 hover:border-zinc-800'}`}
                    >
                      <Icon className={`h-5 w-5 ${isSelected ? 'text-purple-400' : 'text-zinc-500'}`} />
                      <div>
                        <h4 className="text-xs font-bold">{t.name}</h4>
                        <p className="text-[9px] text-zinc-500 font-medium mt-1 leading-relaxed">{t.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Prompt input */}
            <div className="space-y-2.5">
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Writing Prompt</label>
              <textarea
                placeholder='E.g., "Request a status update on the marketing design from Sarah, polite but asking for delivery by tomorrow noon"'
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows="4"
                className="bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-3 text-sm text-zinc-200 placeholder-zinc-650 focus:outline-hidden focus:border-purple-500 w-full resize-none leading-relaxed"
                required
              />
            </div>

            <button
              type="submit"
              disabled={generating || !prompt.trim()}
              className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-950/60 disabled:text-zinc-600 rounded-xl text-sm font-semibold text-white transition-all cursor-pointer flex items-center gap-2"
            >
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Generate Draft
            </button>
          </form>

          {/* Generated Result Output */}
          {generating && (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-zinc-400 border border-zinc-900/60 rounded-3xl bg-zinc-900/10">
              <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
              <p className="text-sm font-semibold">Gemini is drafting your content...</p>
            </div>
          )}

          {result && (
            <div className="p-6 bg-zinc-900/20 border border-zinc-900/60 rounded-3xl space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4" /> Generated Content
                </h3>

                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-950 border border-zinc-850 hover:border-zinc-700 rounded-lg text-[10px] font-bold text-zinc-400 hover:text-zinc-200 transition-all cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-400" /> Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" /> Copy to Clipboard
                    </>
                  )}
                </button>
              </div>

              <div className="bg-zinc-950 p-5 rounded-2xl border border-zinc-900 font-sans text-sm text-zinc-200 whitespace-pre-wrap leading-relaxed">
                {result.type === 'email' ? (
                  <div className="space-y-4">
                    <div>
                      <span className="text-xs text-zinc-550 font-bold uppercase tracking-wider block mb-1">Subject</span>
                      <p className="text-sm font-bold text-zinc-100">{result.subject}</p>
                    </div>
                    <div className="border-t border-zinc-900 pt-4">
                      <span className="text-xs text-zinc-550 font-bold uppercase tracking-wider block mb-2">Message Body</span>
                      <p className="text-sm">{result.body}</p>
                    </div>
                  </div>
                ) : (
                  result.body
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
