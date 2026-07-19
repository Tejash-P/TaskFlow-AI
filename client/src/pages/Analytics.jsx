import React, { useState, useEffect } from 'react';
import api from '../lib/api';
import Navigation from '../components/Navigation';
import { BarChart2, Zap, Sparkles, CheckSquare, Loader2, CalendarDays, TrendingUp, FileText, MessageSquare } from 'lucide-react';

// Mini bar chart using divs (no charting library needed)
function MiniBarChart({ data, valueKey, labelKey, color }) {
  const max = Math.max(...data.map((d) => d[valueKey] || 0), 1);
  return (
    <div className="flex items-end gap-1 h-20">
      {data.map((d, i) => {
        const height = Math.max(2, ((d[valueKey] || 0) / max) * 100);
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
            <div
              className={`w-full rounded-sm transition-all ${color}`}
              style={{ height: `${height}%` }}
              title={`${d[labelKey]}: ${d[valueKey] || 0}`}
            />
          </div>
        );
      })}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, accent }) {
  return (
    <div className={`p-5 bg-zinc-900/20 border border-zinc-900/60 rounded-2xl space-y-2`}>
      <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${accent || 'bg-purple-500/10'}`}>
        <Icon className="h-4 w-4 text-purple-400" />
      </div>
      <div>
        <p className="text-2xl font-bold text-white tracking-tight">{value ?? '—'}</p>
        <p className="text-xs font-semibold text-zinc-400 mt-0.5">{label}</p>
        {sub && <p className="text-[10px] text-zinc-600 mt-1">{sub}</p>}
      </div>
    </div>
  );
}

export default function Analytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/analytics/me')
      .then((res) => setData(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen bg-zinc-950 text-zinc-100 pb-20 md:pb-0">
        <Navigation />
        <main className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-zinc-400">
            <Loader2 className="h-10 w-10 animate-spin text-purple-500" />
            <p className="text-sm font-semibold">Loading analytics…</p>
          </div>
        </main>
      </div>
    );
  }

  // Derived data
  const totals = data?.totals || {};
  const daily = data?.dailyMetrics || [];
  const statusCounts = data?.taskStatusCounts || [];
  const priorityCounts = data?.taskPriorityCounts || [];
  const aiLogs = data?.recentAiLogs || [];

  const statusMap = {};
  statusCounts.forEach((s) => (statusMap[s.status] = s._count.id));

  const priorityMap = {};
  priorityCounts.forEach((p) => (priorityMap[p.priority] = p._count.id));

  // Prepare daily chart data (last 14 days for readability)
  const last14 = daily.slice(-14);
  const chartDateLabels = last14.map((d) =>
    new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  );

  return (
    <div className="flex min-h-screen bg-zinc-950 text-zinc-100 pb-20 md:pb-0">
      <Navigation />

      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
        <header className="flex items-center justify-between px-6 md:px-8 py-5 border-b border-zinc-900 sticky top-0 bg-zinc-950/80 backdrop-blur-md z-30">
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white">Productivity Analytics</h1>
            <p className="text-xs text-zinc-400 font-medium">Your 30-day productivity overview, powered by real usage data.</p>
          </div>
        </header>

        <div className="flex-1 p-6 md:p-8 space-y-8 max-w-6xl w-full mx-auto">

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard icon={CheckSquare} label="Tasks Completed" value={totals.tasksCompleted} sub="Last 30 days" accent="bg-emerald-500/10" />
            <StatCard icon={Zap} label="Workflows Triggered" value={totals.workflowsTriggered} sub="Last 30 days" accent="bg-yellow-500/10" />
            <StatCard icon={Sparkles} label="AI Actions Used" value={totals.aiActionsUsed} sub="Last 30 days" accent="bg-purple-500/10" />
            <StatCard icon={TrendingUp} label="AI-Created Tasks" value={data?.aiTaskCount} sub="All time" accent="bg-indigo-500/10" />
          </div>

          {/* Secondary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard icon={MessageSquare} label="Meetings Recorded" value={data?.meetingCount} sub="All time" accent="bg-pink-500/10" />
            <StatCard icon={FileText} label="Documents Uploaded" value={data?.documentCount} sub="All time" accent="bg-sky-500/10" />
            <StatCard icon={CalendarDays} label="Active Tasks" value={statusMap['IN_PROGRESS']} sub="In progress" accent="bg-orange-500/10" />
            <StatCard icon={CheckSquare} label="Backlog Tasks" value={statusMap['TODO']} sub="Waiting to start" accent="bg-zinc-700/20" />
          </div>

          {/* Daily activity charts */}
          {last14.length > 0 && (
            <div className="grid md:grid-cols-3 gap-6">
              <div className="p-5 bg-zinc-900/20 border border-zinc-900/60 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Tasks Completed</h4>
                  <CheckSquare className="h-3.5 w-3.5 text-emerald-400" />
                </div>
                <MiniBarChart
                  data={last14}
                  valueKey="tasksCompleted"
                  labelKey="date"
                  color="bg-emerald-500"
                />
                <div className="flex justify-between text-[9px] text-zinc-600 font-semibold">
                  <span>{chartDateLabels[0]}</span>
                  <span>{chartDateLabels[chartDateLabels.length - 1]}</span>
                </div>
              </div>

              <div className="p-5 bg-zinc-900/20 border border-zinc-900/60 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-yellow-400 uppercase tracking-wider">Workflows Triggered</h4>
                  <Zap className="h-3.5 w-3.5 text-yellow-400" />
                </div>
                <MiniBarChart
                  data={last14}
                  valueKey="workflowsTriggered"
                  labelKey="date"
                  color="bg-yellow-500"
                />
                <div className="flex justify-between text-[9px] text-zinc-600 font-semibold">
                  <span>{chartDateLabels[0]}</span>
                  <span>{chartDateLabels[chartDateLabels.length - 1]}</span>
                </div>
              </div>

              <div className="p-5 bg-zinc-900/20 border border-zinc-900/60 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-purple-400 uppercase tracking-wider">AI Actions Used</h4>
                  <Sparkles className="h-3.5 w-3.5 text-purple-400" />
                </div>
                <MiniBarChart
                  data={last14}
                  valueKey="aiActionsUsed"
                  labelKey="date"
                  color="bg-purple-500"
                />
                <div className="flex justify-between text-[9px] text-zinc-600 font-semibold">
                  <span>{chartDateLabels[0]}</span>
                  <span>{chartDateLabels[chartDateLabels.length - 1]}</span>
                </div>
              </div>
            </div>
          )}

          {/* Task breakdown */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Status breakdown */}
            <div className="p-5 bg-zinc-900/20 border border-zinc-900/60 rounded-2xl space-y-4">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider border-b border-zinc-900 pb-2">Task Status Breakdown</h4>
              {['TODO', 'IN_PROGRESS', 'DONE'].map((status) => {
                const count = statusMap[status] || 0;
                const total = Object.values(statusMap).reduce((a, b) => a + b, 0) || 1;
                const pct = Math.round((count / total) * 100);
                const colors = { TODO: 'bg-zinc-600', IN_PROGRESS: 'bg-orange-500', DONE: 'bg-emerald-500' };
                const labels = { TODO: 'To Do', IN_PROGRESS: 'In Progress', DONE: 'Done' };
                return (
                  <div key={status} className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-zinc-300">{labels[status]}</span>
                      <span className="text-zinc-500">{count} ({pct}%)</span>
                    </div>
                    <div className="h-1.5 bg-zinc-900 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${colors[status]}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Priority breakdown */}
            <div className="p-5 bg-zinc-900/20 border border-zinc-900/60 rounded-2xl space-y-4">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider border-b border-zinc-900 pb-2">Task Priority Breakdown</h4>
              {['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map((priority) => {
                const count = priorityMap[priority] || 0;
                const total = Object.values(priorityMap).reduce((a, b) => a + b, 0) || 1;
                const pct = Math.round((count / total) * 100);
                const colors = { LOW: 'bg-sky-500', MEDIUM: 'bg-yellow-500', HIGH: 'bg-orange-500', URGENT: 'bg-red-500' };
                return (
                  <div key={priority} className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-zinc-300 capitalize">{priority.toLowerCase()}</span>
                      <span className="text-zinc-500">{count} ({pct}%)</span>
                    </div>
                    <div className="h-1.5 bg-zinc-900 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${colors[priority]}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent AI Activity */}
          {aiLogs.length > 0 && (
            <div className="p-5 bg-zinc-900/20 border border-zinc-900/60 rounded-2xl space-y-3">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider border-b border-zinc-900 pb-2 flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-purple-400" /> Recent AI Activity
              </h4>
              <div className="space-y-2">
                {aiLogs.map((log, i) => (
                  <div key={i} className="flex items-start justify-between gap-4 p-2.5 bg-zinc-950 border border-zinc-900 rounded-lg">
                    <p className="text-[11px] text-zinc-300 font-medium truncate">{log.prompt}</p>
                    <p className="text-[10px] text-zinc-600 shrink-0">
                      {new Date(log.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
