import React, { useState, useEffect } from 'react';
import api from '../lib/api';
import Navigation from '../components/Navigation';
import { Zap, Play, Trash2, Cpu, CheckCircle2, AlertTriangle, Loader2, Sparkles, Plus, ToggleLeft, ToggleRight } from 'lucide-react';

export default function Workflows() {
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [nlText, setNlText] = useState('');
  const [parsing, setParsing] = useState(false);
  const [parsedPreview, setParsedPreview] = useState(null);
  const [error, setError] = useState('');

  const fetchWorkflows = async () => {
    setLoading(true);
    try {
      const response = await api.get('/workflows');
      setWorkflows(response.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkflows();
  }, []);

  const handleParse = async (e) => {
    e.preventDefault();
    if (!nlText.trim()) return;

    setParsing(true);
    setError('');
    setParsedPreview(null);

    try {
      const response = await api.post('/workflows/parse', { text: nlText });
      setParsedPreview(response.data);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Could not parse automation rule. Please refine your instruction.');
    } finally {
      setParsing(false);
    }
  };

  const handleSaveWorkflow = async () => {
    if (!parsedPreview) return;
    try {
      const response = await api.post('/workflows', parsedPreview);
      setWorkflows((prev) => [response.data, ...prev]);
      setParsedPreview(null);
      setNlText('');
    } catch (err) {
      console.error(err);
      setError('Failed to save the automation workflow.');
    }
  };

  const handleToggleActive = async (workflow) => {
    const nextActive = !workflow.isActive;
    // Optimistic UI updates
    setWorkflows(prev => prev.map(w => w.id === workflow.id ? { ...w, isActive: nextActive } : w));

    try {
      const response = await api.put(`/workflows/${workflow.id}`, { isActive: nextActive });
      setWorkflows(prev => prev.map(w => w.id === workflow.id ? response.data : w));
    } catch (err) {
      console.error(err);
      // Revert on error
      setWorkflows(prev => prev.map(w => w.id === workflow.id ? workflow : w));
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Delete this automation workflow?')) {
      try {
        await api.delete(`/workflows/${id}`);
        setWorkflows((prev) => prev.filter((w) => w.id !== id));
      } catch (err) {
        console.error(err);
      }
    }
  };

  return (
    <div className="flex min-h-screen bg-zinc-950 text-zinc-100 pb-20 md:pb-0">
      <Navigation />

      {/* Main Panel Content */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
        <header className="flex items-center justify-between px-6 md:px-8 py-5 border-b border-zinc-900 sticky top-0 bg-zinc-950/80 backdrop-blur-md z-30">
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white">Workflows Automation</h1>
            <p className="text-xs text-zinc-400 font-medium">Automate task updates and notifications in real time.</p>
          </div>
        </header>

        <div className="flex-1 p-6 md:p-8 space-y-8 max-w-4xl w-full mx-auto">
          {/* Create Workflow via NL Form */}
          <div className="glass-panel p-6 rounded-2xl border border-zinc-900 shadow-xl space-y-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-purple-500/20 text-purple-400">
                <Cpu className="h-5 w-5" />
              </div>
              <h2 className="text-lg font-bold text-white tracking-tight">AI Automation Builder</h2>
            </div>
            <p className="text-xs text-zinc-400 leading-normal">
              Type an instruction in plain English. Gemini will extract triggers, matching states, and target execution updates.
            </p>

            <form onSubmit={handleParse} className="flex gap-2">
              <input
                type="text"
                value={nlText}
                onChange={(e) => setNlText(e.target.value)}
                placeholder="e.g. 'When a task becomes overdue, set its priority to HIGH'..."
                className="flex-1 px-4 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-white placeholder-zinc-500 focus:outline-hidden focus:ring-2 focus:ring-purple-500/30 text-sm font-medium"
                disabled={parsing}
              />
              <button
                type="submit"
                disabled={parsing || !nlText.trim()}
                className="px-5 py-2.5 bg-linear-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold rounded-xl text-xs flex items-center gap-2 cursor-pointer transition-all shadow-md shrink-0"
              >
                {parsing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {parsing ? 'Analyzing...' : 'Parse'}
              </button>
            </form>

            {error && (
              <p className="text-xs text-red-400 font-semibold">{error}</p>
            )}

            {/* AI Parsed Results Preview Card */}
            {parsedPreview && (
              <div className="p-5 bg-purple-950/20 border border-purple-500/20 rounded-2xl animate-slide-in space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-widest bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded-sm">
                    AI Extraction Preview
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div className="space-y-1">
                    <p className="text-zinc-500 font-bold uppercase">Trigger Condition</p>
                    <p className="text-zinc-200 font-bold">{parsedPreview.triggerType}</p>
                    <pre className="text-[10px] text-zinc-400 bg-zinc-950/50 p-2 rounded-lg font-mono overflow-x-auto">
                      {JSON.stringify(parsedPreview.triggerCondition, null, 2)}
                    </pre>
                  </div>
                  <div className="space-y-1">
                    <p className="text-zinc-500 font-bold uppercase">Automated Action</p>
                    <p className="text-zinc-200 font-bold">{parsedPreview.actionType}</p>
                    <pre className="text-[10px] text-zinc-400 bg-zinc-950/50 p-2 rounded-lg font-mono overflow-x-auto">
                      {JSON.stringify(parsedPreview.actionConfig, null, 2)}
                    </pre>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSaveWorkflow}
                  className="w-full py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-xl transition-all cursor-pointer shadow-md"
                >
                  Activate & Save Automation
                </button>
              </div>
            )}
          </div>

          {/* Active Workflows List */}
          <div className="space-y-4">
            <h3 className="text-md font-bold text-white tracking-tight flex items-center gap-2">
              <Zap className="h-4.5 w-4.5 text-purple-500" />
              Active Automations ({workflows.length})
            </h3>

            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
              </div>
            ) : workflows.length > 0 ? (
              <div className="grid gap-3">
                {workflows.map((wf) => (
                  <div
                    key={wf.id}
                    className="flex items-center justify-between p-4 bg-zinc-900/20 border border-zinc-900/60 rounded-2xl"
                  >
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex items-center gap-2.5">
                        <span className="text-xs font-bold text-white uppercase bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded-md">
                          {wf.triggerType}
                        </span>
                        <span className="text-zinc-500 text-xs font-semibold">→</span>
                        <span className="text-xs font-bold text-purple-400 uppercase bg-purple-500/10 border border-purple-500/10 px-2 py-0.5 rounded-md">
                          {wf.actionType}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-400 truncate max-w-xl font-medium">
                        Condition: {JSON.stringify(wf.triggerCondition)} | Config: {JSON.stringify(wf.actionConfig)}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <button
                        onClick={() => handleToggleActive(wf)}
                        className="text-zinc-500 hover:text-white transition-all cursor-pointer"
                      >
                        {wf.isActive ? (
                          <ToggleRight className="h-7 w-7 text-purple-500" />
                        ) : (
                          <ToggleLeft className="h-7 w-7 text-zinc-600" />
                        )}
                      </button>
                      <button
                        onClick={() => handleDelete(wf.id)}
                        className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all cursor-pointer"
                        title="Delete Workflow"
                      >
                        <Trash2 className="h-4.5 w-4.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 border border-dashed border-zinc-900 rounded-3xl p-6 bg-zinc-950/40">
                <Cpu className="h-8 w-8 text-zinc-700 mx-auto mb-2" />
                <p className="text-xs text-zinc-500 font-semibold">No workflows configured.</p>
                <p className="text-[10px] text-zinc-600 mt-0.5">Use the parser above to configure an automated trigger rule.</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
