import React, { useState, useEffect } from 'react';
import api from '../lib/api';
import { X, Calendar, AlertCircle, Trash2, CheckCircle2, Circle, Loader2, Sparkles, Plus } from 'lucide-react';

export default function TaskDetailsDrawer({ task, isOpen, onClose, onTaskUpdated, onTaskDeleted }) {
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [description, setDescription] = useState('');
  const [subtasks, setSubtasks] = useState([]);
  const [loadingSubtasks, setLoadingSubtasks] = useState(false);
  const [addingSubtaskIdx, setAddingSubtaskIdx] = useState(null);

  useEffect(() => {
    if (task) {
      setStatus(task.status);
      setPriority(task.priority);
      setDescription(task.description || '');
      setSubtasks([]); // Reset subtasks on task switch
    }
  }, [task]);

  if (!isOpen || !task) return null;

  const handleStatusChange = async (newStatus) => {
    setStatus(newStatus);
    try {
      const response = await api.put(`/tasks/${task.id}`, { status: newStatus });
      onTaskUpdated(response.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handlePriorityChange = async (newPriority) => {
    setPriority(newPriority);
    try {
      const response = await api.put(`/tasks/${task.id}`, { priority: newPriority });
      onTaskUpdated(response.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDescriptionBlur = async () => {
    if (description === task.description) return;
    try {
      const response = await api.put(`/tasks/${task.id}`, { description });
      onTaskUpdated(response.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this task?')) {
      try {
        await api.delete(`/tasks/${task.id}`);
        onTaskDeleted(task.id);
        onClose();
      } catch (err) {
        console.error(err);
      }
    }
  };

  const fetchSubtasks = async () => {
    setLoadingSubtasks(true);
    try {
      const response = await api.post(`/tasks/${task.id}/subtasks`);
      setSubtasks(response.data.suggestions || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingSubtasks(false);
    }
  };

  const addSubtaskAsTask = async (subtaskTitle, index) => {
    setAddingSubtaskIdx(index);
    try {
      // Calculate due date (same as parent task, or null)
      const response = await api.post('/tasks', {
        title: subtaskTitle,
        description: `Subtask of: ${task.title}`,
        dueDate: task.dueDate,
        priority: task.priority,
        status: 'TODO',
      });
      // Callback to refresh dashboard tasks list
      onTaskUpdated(response.data, true); // True flag represents it's a new task addition
      // Remove from suggestions list
      setSubtasks(prev => prev.filter((_, i) => i !== index));
    } catch (err) {
      console.error(err);
    } finally {
      setAddingSubtaskIdx(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity" onClick={onClose} />

      {/* Drawer Panel */}
      <div className="relative w-full max-w-md h-full bg-zinc-950 border-l border-zinc-900 shadow-2xl flex flex-col z-10 animate-slide-in">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-zinc-900">
          <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
            {task.aiGenerated ? 'AI Generated Task' : 'Task Details'}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDelete}
              className="p-2 text-zinc-400 hover:text-red-400 hover:bg-zinc-900 rounded-xl transition-all cursor-pointer"
              title="Delete Task"
            >
              <Trash2 className="h-4.5 w-4.5" />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-xl transition-all cursor-pointer"
            >
              <X className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Title */}
          <div>
            <h3 className="text-xl font-bold text-white tracking-tight leading-snug">{task.title}</h3>
            {task.dueDate && (
              <div className="flex items-center gap-2 text-xs text-zinc-400 mt-2 font-medium">
                <Calendar className="h-4 w-4 text-purple-400" />
                Due {new Date(task.dueDate).toLocaleDateString()} at{' '}
                {new Date(task.dueDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            )}
          </div>

          {/* Status & Priority Controls */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-zinc-500 text-xs font-semibold uppercase tracking-wider mb-2">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => handleStatusChange(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-200 focus:outline-hidden focus:border-purple-500 cursor-pointer"
              >
                <option value="TODO">To Do</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="DONE">Completed</option>
              </select>
            </div>
            <div>
              <label className="block text-zinc-500 text-xs font-semibold uppercase tracking-wider mb-2">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => handlePriorityChange(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-200 focus:outline-hidden focus:border-purple-500 cursor-pointer"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-zinc-500 text-xs font-semibold uppercase tracking-wider mb-2">
              Notes
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={handleDescriptionBlur}
              placeholder="Add description or notes here..."
              rows={4}
              className="w-full bg-zinc-900/50 border border-zinc-900 rounded-xl p-3 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-hidden focus:border-purple-500/50 resize-none"
            />
          </div>

          {/* AI Subtasks Suggestions Section */}
          <div className="pt-6 border-t border-zinc-900">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4.5 w-4.5 text-purple-400" />
                <span className="text-sm font-bold text-white tracking-tight">AI Subtask Suggestions</span>
              </div>
              {subtasks.length === 0 && (
                <button
                  onClick={fetchSubtasks}
                  disabled={loadingSubtasks}
                  className="px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50 disabled:pointer-events-none"
                >
                  {loadingSubtasks ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    'Suggest'
                  )}
                </button>
              )}
            </div>

            {loadingSubtasks ? (
              <div className="space-y-2 py-2">
                <div className="h-8 bg-zinc-900/50 border border-zinc-900 animate-pulse rounded-lg w-full"></div>
                <div className="h-8 bg-zinc-900/50 border border-zinc-900 animate-pulse rounded-lg w-full"></div>
              </div>
            ) : subtasks.length > 0 ? (
              <ul className="space-y-2">
                {subtasks.map((sub, idx) => (
                  <li
                    key={idx}
                    className="flex items-center justify-between bg-zinc-900/50 border border-zinc-900 rounded-xl p-3 hover:border-zinc-800 transition-all text-xs font-semibold text-zinc-300"
                  >
                    <span>{sub}</span>
                    <button
                      onClick={() => addSubtaskAsTask(sub, idx)}
                      disabled={addingSubtaskIdx === idx}
                      className="p-1 rounded-md bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 transition-all cursor-pointer"
                      title="Add as task"
                    >
                      {addingSubtaskIdx === idx ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Plus className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-zinc-600 text-xs italic">
                No suggestions loaded yet. Click Suggest to analyze the task context.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
