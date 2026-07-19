import React, { useState, useEffect } from 'react';
import api from '../lib/api';
import Navigation from '../components/Navigation';
import DailySummary from '../components/DailySummary';
import QuickAdd from '../components/QuickAdd';
import ChatAssistant from '../components/ChatAssistant';
import TaskDetailsDrawer from '../components/TaskDetailsDrawer';
import { Calendar, AlertCircle, MessageSquare, CheckCircle2, Circle, Loader2, Sparkles, Filter, SlidersHorizontal } from 'lucide-react';

export default function Dashboard() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ status: '', priority: '', due: '' });
  const [selectedTask, setSelectedTask] = useState(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(true);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams(filters).toString();
      const response = await api.get(`/tasks?${query}`);
      setTasks(response.data);
    } catch (err) {
      console.error('Error fetching tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [filters]);

  const handleTaskCreated = (newTask) => {
    setTasks((prev) => [newTask, ...prev]);
  };

  const handleTaskUpdated = (updatedTask, isNewAddition = false) => {
    if (isNewAddition) {
      // Add to list immediately (e.g. subtask generated as new task)
      setTasks((prev) => [updatedTask, ...prev]);
    } else {
      // Standard modification update
      setTasks((prev) => prev.map((t) => (t.id === updatedTask.id ? updatedTask : t)));
      if (selectedTask?.id === updatedTask.id) {
        setSelectedTask(updatedTask);
      }
    }
  };

  const handleTaskDeleted = (taskId) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
  };

  const toggleTaskStatus = async (task) => {
    const nextStatus = task.status === 'DONE' ? 'TODO' : 'DONE';
    // Update local state immediately for snappy UX
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: nextStatus } : t));
    
    try {
      const response = await api.put(`/tasks/${task.id}`, { status: nextStatus });
      handleTaskUpdated(response.data);
    } catch (err) {
      console.error(err);
      // Revert state on error
      setTasks(prev => prev.map(t => t.id === task.id ? task : t));
    }
  };

  const getPriorityBadgeColor = (priority) => {
    switch (priority) {
      case 'HIGH': return 'bg-red-500/10 text-red-400 border-red-500/20';
      case 'MEDIUM': return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
      case 'LOW': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      default: return 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20';
    }
  };

  return (
    <div className="flex min-h-screen bg-zinc-950 text-zinc-100 pb-20 md:pb-0">
      <Navigation />

      {/* Main Panel Content */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
        <header className="flex items-center justify-between px-6 md:px-8 py-5 border-b border-zinc-900 sticky top-0 bg-zinc-950/80 backdrop-blur-md z-30">
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white">Productivity Dashboard</h1>
            <p className="text-xs text-zinc-400 font-medium">Create tasks naturally and let AI automate workflows.</p>
          </div>

          {/* Toggle chat assistant button */}
          {!isChatOpen && (
            <button
              onClick={() => setIsChatOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-purple-600/15 border border-purple-500/30 rounded-xl text-purple-400 text-xs font-semibold hover:bg-purple-600/25 transition-all cursor-pointer shadow-md"
            >
              <MessageSquare className="h-4 w-4" />
              Open Assistant
            </button>
          )}
        </header>

        <div className="flex-1 p-6 md:p-8 space-y-6 max-w-5xl w-full mx-auto">
          {/* AI Quick Add Input */}
          <QuickAdd onTaskCreated={handleTaskCreated} />

          {/* AI Workload Summary Widget */}
          <DailySummary />

          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-zinc-900/30 border border-zinc-900 rounded-2xl">
            <div className="flex items-center gap-2 text-zinc-300 font-bold text-sm">
              <SlidersHorizontal className="h-4 w-4 text-purple-400" />
              Filter & Sort Workload
            </div>
            
            <div className="flex flex-wrap gap-2.5">
              <select
                value={filters.status}
                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-zinc-300 focus:outline-hidden focus:border-purple-500 cursor-pointer font-medium"
              >
                <option value="">All Statuses</option>
                <option value="TODO">To Do</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="DONE">Completed</option>
              </select>

              <select
                value={filters.priority}
                onChange={(e) => setFilters(prev => ({ ...prev, priority: e.target.value }))}
                className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-zinc-300 focus:outline-hidden focus:border-purple-500 cursor-pointer font-medium"
              >
                <option value="">All Priorities</option>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
              </select>

              <select
                value={filters.due}
                onChange={(e) => setFilters(prev => ({ ...prev, due: e.target.value }))}
                className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-zinc-300 focus:outline-hidden focus:border-purple-500 cursor-pointer font-medium"
              >
                <option value="">Any Timeframe</option>
                <option value="overdue">Overdue</option>
                <option value="today">Due Today</option>
                <option value="upcoming">Upcoming</option>
              </select>
            </div>
          </div>

          {/* Tasks Grid */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-zinc-400">
              <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
              <p className="text-sm font-semibold">Syncing tasks database...</p>
            </div>
          ) : tasks.length > 0 ? (
            <div className="grid gap-3">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between p-4 bg-zinc-900/20 border border-zinc-900/60 hover:border-purple-500/30 rounded-2xl hover:bg-zinc-900/40 transition-all duration-200 shadow-sm"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <button
                      onClick={() => toggleTaskStatus(task)}
                      className="text-zinc-500 hover:text-purple-400 transition-all shrink-0 cursor-pointer"
                    >
                      {task.status === 'DONE' ? (
                        <CheckCircle2 className="h-5.5 w-5.5 text-purple-500 fill-purple-500/10" />
                      ) : (
                        <Circle className="h-5.5 w-5.5" />
                      )}
                    </button>
                    <div
                      className="min-w-0 cursor-pointer"
                      onClick={() => {
                        setSelectedTask(task);
                        setIsDetailsOpen(true);
                      }}
                    >
                      <h4 className={`text-sm font-bold tracking-tight truncate ${task.status === 'DONE' ? 'line-through text-zinc-500' : 'text-zinc-100'}`}>
                        {task.title}
                      </h4>
                      <p className="text-xs text-zinc-500 truncate mt-0.5 max-w-lg">
                        {task.description || 'No description notes'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {task.aiGenerated && (
                      <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded-md border border-purple-500/20">
                        <Sparkles className="h-2.5 w-2.5" /> AI
                      </span>
                    )}
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-md border ${getPriorityBadgeColor(task.priority)}`}>
                      {task.priority}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 border border-dashed border-zinc-900 rounded-3xl p-8 bg-zinc-950">
              <Sparkles className="h-10 w-10 text-zinc-700 mx-auto mb-3" />
              <h3 className="text-base font-bold text-zinc-300">No tasks in this workload</h3>
              <p className="text-xs text-zinc-500 max-w-xs mx-auto mt-1 leading-normal">
                Type something like "Remind me to update my resume today at 4pm" above, and let the AI compile it.
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Collapsible Chat Assistant Drawer */}
      <ChatAssistant
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        onTasksMutated={fetchTasks}
      />

      {/* Slide-over details drawer */}
      <TaskDetailsDrawer
        task={selectedTask}
        isOpen={isDetailsOpen}
        onClose={() => {
          setIsDetailsOpen(false);
          setSelectedTask(null);
        }}
        onTaskUpdated={handleTaskUpdated}
        onTaskDeleted={handleTaskDeleted}
      />
    </div>
  );
}
