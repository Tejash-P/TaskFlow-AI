import React, { useState, useEffect } from 'react';
import api from '../lib/api';
import Navigation from '../components/Navigation';
import { FileText, Upload, Sparkles, Loader2, CheckCircle2, ChevronDown, ChevronUp, File, AlertCircle } from 'lucide-react';

export default function Documents() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  // Upload state
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  // Summarize state
  const [summarizing, setSummarizing] = useState(null);
  const [summaryResults, setSummaryResults] = useState({});

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const res = await api.get('/documents');
      setDocuments(res.data);
    } catch (err) {
      console.error('Error fetching documents:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!selectedFile) return;

    setUploading(true);
    setUploadError('');

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const res = await api.post('/documents', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setDocuments(prev => [res.data, ...prev]);
      setSelectedFile(null);
      setExpandedId(res.data.id);
      // Reset file input
      const fileInput = document.getElementById('doc-file-input');
      if (fileInput) fileInput.value = '';
    } catch (err) {
      console.error(err);
      setUploadError(err.response?.data?.error || 'Failed to upload document.');
    } finally {
      setUploading(false);
    }
  };

  const handleSummarize = async (docId) => {
    setSummarizing(docId);
    try {
      const res = await api.post(`/documents/${docId}/summarize`);
      setDocuments(prev => prev.map(d => d.id === docId ? { ...d, summary: res.data.summary } : d));
      setSummaryResults(prev => ({
        ...prev,
        [docId]: {
          summaryText: res.data.summaryText,
          keyPoints: res.data.keyPoints || [],
        },
      }));
    } catch (err) {
      console.error(err);
    } finally {
      setSummarizing(null);
    }
  };

  const getFileIcon = (fileName) => {
    const ext = fileName?.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return '📄';
    if (ext === 'docx') return '📝';
    return '📃';
  };

  return (
    <div className="flex min-h-screen bg-zinc-950 text-zinc-100 pb-20 md:pb-0">
      <Navigation />

      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
        <header className="flex items-center justify-between px-6 md:px-8 py-5 border-b border-zinc-900 sticky top-0 bg-zinc-950/80 backdrop-blur-md z-30">
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white">Document Summarizer</h1>
            <p className="text-xs text-zinc-400 font-medium">Upload PDF, DOCX, or TXT files and extract AI-powered summaries.</p>
          </div>
        </header>

        <div className="flex-1 p-6 md:p-8 space-y-8 max-w-5xl w-full mx-auto">
          {/* Upload Area */}
          <div className="p-6 bg-zinc-900/20 border border-zinc-900/60 rounded-3xl space-y-4">
            <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2 border-b border-zinc-900 pb-3">
              <Upload className="h-4.5 w-4.5 text-purple-400" /> Upload Document
            </h3>

            <form onSubmit={handleUpload} className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <label
                  htmlFor="doc-file-input"
                  className="flex-1 flex items-center gap-3 px-4 py-3 bg-zinc-950 border-2 border-dashed border-zinc-800 hover:border-purple-500/40 rounded-xl cursor-pointer transition-all group"
                >
                  <File className="h-5 w-5 text-zinc-500 group-hover:text-purple-400 transition-colors shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm text-zinc-300 font-medium truncate">
                      {selectedFile ? selectedFile.name : 'Choose a file to upload...'}
                    </p>
                    <p className="text-[10px] text-zinc-600 mt-0.5">PDF, DOCX, or TXT — up to 10MB</p>
                  </div>
                  <input
                    id="doc-file-input"
                    type="file"
                    accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                    onChange={(e) => {
                      setSelectedFile(e.target.files[0] || null);
                      setUploadError('');
                    }}
                    className="hidden"
                  />
                </label>

                <button
                  type="submit"
                  disabled={uploading || !selectedFile}
                  className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-950/60 disabled:text-zinc-600 rounded-xl text-sm font-semibold text-white transition-all cursor-pointer flex items-center gap-2 shrink-0"
                >
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  Upload & Extract
                </button>
              </div>

              {uploadError && (
                <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 p-3 rounded-xl flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {uploadError}
                </div>
              )}
            </form>
          </div>

          {/* Documents List */}
          {loading ? (
            <div className="flex flex-col items-center py-12 gap-3 text-zinc-400">
              <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
              <p className="text-sm font-semibold">Loading documents...</p>
            </div>
          ) : documents.length > 0 ? (
            <div className="space-y-4">
              {documents.map((doc) => {
                const result = summaryResults[doc.id];
                return (
                  <div key={doc.id} className="bg-zinc-900/20 border border-zinc-900/60 rounded-2xl overflow-hidden transition-all">
                    {/* Document Header */}
                    <button
                      onClick={() => setExpandedId(expandedId === doc.id ? null : doc.id)}
                      className="w-full flex items-center justify-between p-5 text-left hover:bg-zinc-900/30 transition-all cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-xl shrink-0">{getFileIcon(doc.fileName)}</span>
                        <div className="min-w-0">
                          <h4 className="text-sm font-bold text-zinc-100 truncate">{doc.fileName}</h4>
                          <p className="text-[10px] text-zinc-500 font-medium mt-0.5">
                            {new Date(doc.createdAt).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            {doc.summary && <span className="text-emerald-400 ml-2">• Summarized</span>}
                          </p>
                        </div>
                      </div>
                      {expandedId === doc.id ? <ChevronUp className="h-4 w-4 text-zinc-500 shrink-0" /> : <ChevronDown className="h-4 w-4 text-zinc-500 shrink-0" />}
                    </button>

                    {/* Expanded Content */}
                    {expandedId === doc.id && (
                      <div className="px-5 pb-5 space-y-5 border-t border-zinc-900">
                        <div className="flex flex-wrap gap-3 pt-4">
                          <button
                            onClick={() => handleSummarize(doc.id)}
                            disabled={summarizing === doc.id}
                            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-950/60 rounded-xl text-xs font-semibold text-white transition-all cursor-pointer flex items-center gap-2"
                          >
                            {summarizing === doc.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                            {doc.summary ? 'Re-summarize' : 'Summarize with AI'}
                          </button>
                        </div>

                        {/* Summary */}
                        {(result?.summaryText || doc.summary) && (
                          <div className="p-4 bg-zinc-950 border border-zinc-900 rounded-xl space-y-3">
                            <h5 className="text-xs font-bold uppercase tracking-wider text-purple-400">AI Summary</h5>
                            <p className="text-sm text-zinc-300 leading-relaxed">
                              {result?.summaryText || doc.summary?.split('\n\nKey Points:')[0]}
                            </p>

                            {/* Key Points */}
                            {result?.keyPoints?.length > 0 && (
                              <div className="space-y-2 pt-2 border-t border-zinc-900">
                                <h6 className="text-xs font-bold uppercase tracking-wider text-emerald-400">Key Points</h6>
                                <ul className="space-y-1.5">
                                  {result.keyPoints.map((kp, idx) => (
                                    <li key={idx} className="flex items-start gap-2 text-xs text-zinc-300">
                                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 mt-0.5 shrink-0" />
                                      <span>{kp}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-16 border border-dashed border-zinc-900 rounded-3xl p-8 bg-zinc-950">
              <FileText className="h-10 w-10 text-zinc-700 mx-auto mb-3" />
              <h3 className="text-base font-bold text-zinc-300">No Documents</h3>
              <p className="text-xs text-zinc-500 max-w-xs mx-auto mt-1 leading-normal">
                Upload a PDF, DOCX, or TXT file above and get an AI-generated summary with key points.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
