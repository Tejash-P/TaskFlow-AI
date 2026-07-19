import React, { useState, useEffect } from 'react';
import api from '../lib/api';
import Navigation from '../components/Navigation';
import { MessageSquare, Sparkles, Loader2, CheckCircle2, ChevronDown, ChevronUp, Plus, ListChecks, FileText, ArrowRight } from 'lucide-react';

export default function Meetings() {
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  // Create meeting form
  const [title, setTitle] = useState('');
  const [transcript, setTranscript] = useState('');
  const [creating, setCreating] = useState(false);

  // Summarize state
  const [summarizing, setSummarizing] = useState(null);
  const [converting, setConverting] = useState(null);
  const [convertResult, setConvertResult] = useState(null);

  const fetchMeetings = async () => {
    setLoading(true);
    try {
      const res = await api.get('/meetings');
      setMeetings(res.data);
    } catch (err) {
      console.error('Error fetching meetings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMeetings();
  }, []);

  const handleCreateMeeting = async (e) => {
    e.preventDefault();
    if (!title.trim() || !transcript.trim()) return;

    setCreating(true);
    try {
      const res = await api.post('/meetings', { title, rawTranscript: transcript });
      setMeetings(prev => [res.data, ...prev]);
      setTitle('');
      setTranscript('');
      setExpandedId(res.data.id);
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  const handleSummarize = async (meetingId) => {
    setSummarizing(meetingId);
    try {
      const res = await api.post(`/meetings/${meetingId}/summarize`);
      setMeetings(prev => prev.map(m => m.id === meetingId ? { ...m, summary: res.data.summary, actionItems: res.data.actionItems } : m));
    } catch (err) {
      console.error(err);
    } finally {
      setSummarizing(null);
    }
  };

  const handleConvertToTasks = async (meetingId) => {
    setConverting(meetingId);
    setConvertResult(null);
    try {
      const res = await api.post(`/meetings/${meetingId}/convert-actions`);
      setConvertResult({ meetingId, message: res.data.message, count: res.data.tasks.length });
    } catch (err) {
      console.error(err);
    } finally {
      setConverting(null);
    }
  };

  return (
    <div className="flex min-h-screen bg-zinc-950 text-zinc-100 pb-20 md:pb-0">
      <Navigation />

      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
        <header className="flex items-center justify-between px-6 md:px-8 py-5 border-b border-zinc-900 sticky top-0 bg-zinc-950/80 backdrop-blur-md z-30">
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white">Meeting Notes</h1>
            <p className="text-xs text-zinc-400 font-medium">Paste meeting transcripts and let AI extract action items.</p>
          </div>
        </header>

        <div className="flex-1 p-6 md:p-8 space-y-8 max-w-5xl w-full mx-auto">
          {/* Create Meeting */}
          <div className="p-6 bg-zinc-900/20 border border-zinc-900/60 rounded-3xl space-y-4">
            <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2 border-b border-zinc-900 pb-3">
              <MessageSquare className="h-4.5 w-4.5 text-purple-400" /> Add Meeting Transcript
            </h3>

            <form onSubmit={handleCreateMeeting} className="space-y-4">
              <input
                type="text"
                placeholder="Meeting title (e.g. Sprint Planning - July 19)"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-hidden focus:border-purple-500 w-full"
                required
              />
              <textarea
                placeholder="Paste your meeting transcript or notes here..."
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                rows="6"
                className="bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-hidden focus:border-purple-500 w-full resize-none font-mono text-xs leading-relaxed"
                required
              />
              <button
                type="submit"
                disabled={creating || !title.trim() || !transcript.trim()}
                className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-950/60 disabled:text-zinc-600 rounded-xl text-sm font-semibold text-white transition-all cursor-pointer flex items-center gap-2"
              >
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Save Transcript
              </button>
            </form>
          </div>

          {/* Meetings List */}
          {loading ? (
            <div className="flex flex-col items-center py-12 gap-3 text-zinc-400">
              <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
              <p className="text-sm font-semibold">Loading meetings...</p>
            </div>
          ) : meetings.length > 0 ? (
            <div className="space-y-4">
              {meetings.map((meeting) => (
                <div key={meeting.id} className="bg-zinc-900/20 border border-zinc-900/60 rounded-2xl overflow-hidden transition-all">
                  {/* Meeting Header */}
                  <button
                    onClick={() => setExpandedId(expandedId === meeting.id ? null : meeting.id)}
                    className="w-full flex items-center justify-between p-5 text-left hover:bg-zinc-900/30 transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${meeting.summary ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-zinc-900 border border-zinc-800'}`}>
                        {meeting.summary ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <FileText className="h-4 w-4 text-zinc-500" />}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-sm font-bold text-zinc-100 truncate">{meeting.title}</h4>
                        <p className="text-[10px] text-zinc-500 font-medium mt-0.5">
                          {new Date(meeting.createdAt).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          {meeting.summary && <span className="text-emerald-400 ml-2">• Summarized</span>}
                          {meeting.actionItems?.length > 0 && <span className="text-purple-400 ml-2">• {meeting.actionItems.length} action items</span>}
                        </p>
                      </div>
                    </div>
                    {expandedId === meeting.id ? <ChevronUp className="h-4 w-4 text-zinc-500 shrink-0" /> : <ChevronDown className="h-4 w-4 text-zinc-500 shrink-0" />}
                  </button>

                  {/* Expanded Content */}
                  {expandedId === meeting.id && (
                    <div className="px-5 pb-5 space-y-5 border-t border-zinc-900">
                      {/* Action Buttons */}
                      <div className="flex flex-wrap gap-3 pt-4">
                        <button
                          onClick={() => handleSummarize(meeting.id)}
                          disabled={summarizing === meeting.id}
                          className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-950/60 rounded-xl text-xs font-semibold text-white transition-all cursor-pointer flex items-center gap-2"
                        >
                          {summarizing === meeting.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                          {meeting.summary ? 'Re-summarize' : 'Summarize with AI'}
                        </button>

                        {meeting.actionItems?.length > 0 && (
                          <button
                            onClick={() => handleConvertToTasks(meeting.id)}
                            disabled={converting === meeting.id}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-950/60 rounded-xl text-xs font-semibold text-white transition-all cursor-pointer flex items-center gap-2"
                          >
                            {converting === meeting.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ListChecks className="h-3.5 w-3.5" />}
                            Convert to Tasks
                          </button>
                        )}
                      </div>

                      {/* Convert Success */}
                      {convertResult && convertResult.meetingId === meeting.id && (
                        <div className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 shrink-0" />
                          {convertResult.message}
                        </div>
                      )}

                      {/* Summary */}
                      {meeting.summary && (
                        <div className="p-4 bg-zinc-950 border border-zinc-900 rounded-xl space-y-2">
                          <h5 className="text-xs font-bold uppercase tracking-wider text-purple-400">AI Summary</h5>
                          <p className="text-sm text-zinc-300 leading-relaxed">{meeting.summary}</p>
                        </div>
                      )}

                      {/* Action Items */}
                      {meeting.actionItems?.length > 0 && (
                        <div className="p-4 bg-zinc-950 border border-zinc-900 rounded-xl space-y-3">
                          <h5 className="text-xs font-bold uppercase tracking-wider text-emerald-400">Action Items</h5>
                          <div className="space-y-2">
                            {meeting.actionItems.map((item, idx) => (
                              <div key={idx} className="flex items-start gap-2.5 p-2.5 bg-zinc-900/30 border border-zinc-800/40 rounded-lg">
                                <ArrowRight className="h-3.5 w-3.5 text-emerald-400 mt-0.5 shrink-0" />
                                <div className="min-w-0">
                                  <p className="text-xs text-zinc-200 font-medium">{item.text}</p>
                                  <div className="flex flex-wrap gap-2 mt-1">
                                    {item.suggestedAssignee && (
                                      <span className="text-[10px] text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded font-semibold">
                                        @{item.suggestedAssignee}
                                      </span>
                                    )}
                                    {item.dueDate && (
                                      <span className="text-[10px] text-yellow-400 bg-yellow-500/10 px-1.5 py-0.5 rounded font-semibold">
                                        Due: {new Date(item.dueDate).toLocaleDateString()}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 border border-dashed border-zinc-900 rounded-3xl p-8 bg-zinc-950">
              <MessageSquare className="h-10 w-10 text-zinc-700 mx-auto mb-3" />
              <h3 className="text-base font-bold text-zinc-300">No Meeting Notes</h3>
              <p className="text-xs text-zinc-500 max-w-xs mx-auto mt-1 leading-normal">
                Paste a transcript above and use AI to extract a summary and action items.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
