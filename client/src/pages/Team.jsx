import React, { useState, useEffect } from 'react';
import api from '../lib/api';
import Navigation from '../components/Navigation';
import { Users, Plus, Mail, Trash2, Shield, User, Loader2, Play, Sparkles, CheckCircle2, ChevronRight, AlertCircle } from 'lucide-react';

export default function Team() {
  const [organizations, setOrganizations] = useState([]);
  const [selectedOrg, setSelectedOrg] = useState(null);
  const [members, setMembers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [orgLoading, setOrgLoading] = useState(false);
  const [membersLoading, setMembersLoading] = useState(false);
  const [tasksLoading, setTasksLoading] = useState(false);

  // Forms
  const [newOrgName, setNewOrgName] = useState('');
  const [creatingOrg, setCreatingOrg] = useState(false);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState('');

  // Task Form
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskPriority, setTaskPriority] = useState('MEDIUM');
  const [taskAssignee, setTaskAssignee] = useState('');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [addingTask, setAddingTask] = useState(false);

  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

  const fetchOrganizations = async (selectFirst = true) => {
    setOrgLoading(true);
    try {
      const response = await api.get('/organizations');
      setOrganizations(response.data);
      if (selectFirst && response.data.length > 0) {
        setSelectedOrg(response.data[0]);
      } else if (response.data.length === 0) {
        setSelectedOrg(null);
      } else if (selectedOrg) {
        // Refresh selected org data
        const updated = response.data.find(o => o.id === selectedOrg.id);
        if (updated) setSelectedOrg(updated);
      }
    } catch (err) {
      console.error('Error fetching organizations:', err);
    } finally {
      setOrgLoading(false);
    }
  };

  const fetchOrgMembersAndTasks = async () => {
    if (!selectedOrg) {
      setMembers([]);
      setTasks([]);
      return;
    }

    setMembersLoading(true);
    setTasksLoading(true);

    try {
      const membersRes = await api.get(`/organizations/${selectedOrg.id}/members`);
      setMembers(membersRes.data);
    } catch (err) {
      console.error('Error fetching members:', err);
    } finally {
      setMembersLoading(false);
    }

    try {
      const tasksRes = await api.get(`/tasks?organizationId=${selectedOrg.id}`);
      setTasks(tasksRes.data);
    } catch (err) {
      console.error('Error fetching org tasks:', err);
    } finally {
      setTasksLoading(false);
    }
  };

  useEffect(() => {
    fetchOrganizations(true);
  }, []);

  useEffect(() => {
    fetchOrgMembersAndTasks();
    // Reset invite messages when switching orgs
    setInviteError('');
    setInviteSuccess('');
  }, [selectedOrg]);

  const handleCreateOrg = async (e) => {
    e.preventDefault();
    if (!newOrgName.trim()) return;

    setCreatingOrg(true);
    try {
      const response = await api.post('/organizations', { name: newOrgName });
      setNewOrgName('');
      // Fetch organizations and select the new one
      await fetchOrganizations(false);
      setSelectedOrg(response.data);
    } catch (err) {
      console.error('Error creating organization:', err);
    } finally {
      setCreatingOrg(false);
    }
  };

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !selectedOrg) return;

    setInviting(true);
    setInviteError('');
    setInviteSuccess('');

    try {
      const response = await api.post(`/organizations/${selectedOrg.id}/invite`, { email: inviteEmail });
      setInviteSuccess(response.data.message || 'Invitation sent successfully!');
      setInviteEmail('');
      // Refresh members list
      const membersRes = await api.get(`/organizations/${selectedOrg.id}/members`);
      setMembers(membersRes.data);
    } catch (err) {
      console.error(err);
      setInviteError(err.response?.data?.error || 'Failed to invite user.');
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveMember = async (targetUserId) => {
    if (!selectedOrg) return;
    if (!window.confirm('Are you sure you want to remove this member from the organization?')) return;

    try {
      await api.delete(`/organizations/${selectedOrg.id}/members/${targetUserId}`);
      setMembers(prev => prev.filter(m => m.id !== targetUserId));
      // Refresh tasks in case of assignee changes
      fetchOrgMembersAndTasks();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || 'Failed to remove member.');
    }
  };

  const handleAddTask = async (e) => {
    e.preventDefault();
    if (!taskTitle.trim() || !selectedOrg) return;

    setAddingTask(true);
    try {
      const taskData = {
        title: taskTitle,
        description: taskDesc,
        priority: taskPriority,
        dueDate: taskDueDate || null,
        organizationId: selectedOrg.id,
        assigneeId: taskAssignee ? parseInt(taskAssignee, 10) : null,
      };

      const response = await api.post('/tasks', taskData);
      setTasks(prev => [...prev, response.data]);
      
      // Reset Form
      setTaskTitle('');
      setTaskDesc('');
      setTaskPriority('MEDIUM');
      setTaskAssignee('');
      setTaskDueDate('');
    } catch (err) {
      console.error('Error adding team task:', err);
    } finally {
      setAddingTask(false);
    }
  };

  const handleMoveTask = async (task, targetStatus) => {
    // Optimistic Update
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: targetStatus } : t));

    try {
      const response = await api.put(`/tasks/${task.id}`, { status: targetStatus });
      setTasks(prev => prev.map(t => t.id === task.id ? response.data : t));
    } catch (err) {
      console.error('Failed to move task:', err);
      // Revert state
      setTasks(prev => prev.map(t => t.id === task.id ? task : t));
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (!window.confirm('Delete this task?')) return;

    try {
      await api.delete(`/tasks/${taskId}`);
      setTasks(prev => prev.filter(t => t.id !== taskId));
    } catch (err) {
      console.error('Failed to delete task:', err);
    }
  };

  const handleAssigneeChange = async (task, assigneeId) => {
    const parsedId = assigneeId ? parseInt(assigneeId, 10) : null;
    try {
      const response = await api.put(`/tasks/${task.id}`, { assigneeId: parsedId });
      setTasks(prev => prev.map(t => t.id === task.id ? response.data : t));
    } catch (err) {
      console.error('Failed to update assignee:', err);
    }
  };

  // Check if current user is admin of selected org
  const isCurrentUserAdmin = () => {
    if (!selectedOrg) return false;
    const membership = members.find(m => m.id === currentUser.id);
    return membership ? membership.role === 'ADMIN' : selectedOrg.role === 'ADMIN';
  };

  // Helper to split tasks into columns
  const getTasksByStatus = (status) => {
    return tasks.filter(t => t.status === status);
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'HIGH': return 'text-red-400 bg-red-500/10 border-red-500/20';
      case 'MEDIUM': return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20';
      case 'LOW': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
      default: return 'text-zinc-400 bg-zinc-500/10 border-zinc-500/20';
    }
  };

  return (
    <div className="flex min-h-screen bg-zinc-950 text-zinc-100 pb-20 md:pb-0">
      <Navigation />

      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
        <header className="flex items-center justify-between px-6 md:px-8 py-5 border-b border-zinc-900 sticky top-0 bg-zinc-950/80 backdrop-blur-md z-30">
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white">Team Collaboration</h1>
            <p className="text-xs text-zinc-400 font-medium">Manage organizations, invite coworkers, and assign task workloads.</p>
          </div>
        </header>

        <div className="flex-1 p-6 md:p-8 space-y-8 max-w-7xl w-full mx-auto">
          {/* Org Selector & Creation Bar */}
          <div className="grid md:grid-cols-3 gap-6">
            <div className="md:col-span-2 p-5 bg-zinc-900/30 border border-zinc-900 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Active Organization</label>
                {orgLoading ? (
                  <div className="flex items-center gap-2 text-sm text-zinc-400">
                    <Loader2 className="h-4 w-4 animate-spin text-purple-500" /> Loaded organizations...
                  </div>
                ) : organizations.length > 0 ? (
                  <select
                    value={selectedOrg?.id || ''}
                    onChange={(e) => {
                      const org = organizations.find(o => o.id === parseInt(e.target.value, 10));
                      if (org) setSelectedOrg(org);
                    }}
                    className="bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-sm text-zinc-200 focus:outline-hidden focus:border-purple-500 cursor-pointer font-semibold block w-full sm:w-64"
                  >
                    {organizations.map((org) => (
                      <option key={org.id} value={org.id}>
                        {org.name} ({org.role})
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-sm text-zinc-400 font-medium">You don't belong to any organizations yet.</p>
                )}
              </div>

              {selectedOrg && (
                <div className="text-left sm:text-right shrink-0">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-bold rounded-lg uppercase tracking-wider">
                    <Shield className="h-3.5 w-3.5" /> {selectedOrg.role} ROLE
                  </span>
                </div>
              )}
            </div>

            {/* Create Org Form */}
            <div className="p-5 bg-zinc-900/30 border border-zinc-900 rounded-2xl">
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 block mb-2">Create Organization</label>
              <form onSubmit={handleCreateOrg} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Organization name"
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                  className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-hidden focus:border-purple-500 flex-1"
                />
                <button
                  type="submit"
                  disabled={creatingOrg || !newOrgName.trim()}
                  className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-950/60 disabled:text-zinc-600 rounded-xl text-xs font-semibold text-white transition-all cursor-pointer flex items-center justify-center gap-1"
                >
                  {creatingOrg ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                  Create
                </button>
              </form>
            </div>
          </div>

          {selectedOrg ? (
            <div className="grid lg:grid-cols-4 gap-8">
              {/* Left sidebar: Members & Invites */}
              <div className="lg:col-span-1 space-y-6">
                {/* Members list */}
                <div className="p-6 bg-zinc-900/20 border border-zinc-900/60 rounded-3xl space-y-4">
                  <div className="flex items-center gap-2 border-b border-zinc-900 pb-3">
                    <Users className="h-4.5 w-4.5 text-purple-400" />
                    <h3 className="text-sm font-bold text-white tracking-tight">Team Members</h3>
                  </div>

                  {membersLoading ? (
                    <div className="flex justify-center py-6">
                      <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {members.map((member) => (
                        <div key={member.id} className="flex items-center justify-between p-2 rounded-xl bg-zinc-900/40 border border-zinc-800/40">
                          <div className="min-w-0 flex items-center gap-2.5">
                            <div className="h-7 w-7 rounded-full bg-purple-600/10 border border-purple-500/20 text-purple-400 flex items-center justify-center text-xs font-bold shrink-0">
                              {member.email.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-zinc-200 truncate">{member.email}</p>
                              <p className="text-[10px] text-zinc-500 font-semibold uppercase">{member.role}</p>
                            </div>
                          </div>

                          {isCurrentUserAdmin() && member.id !== currentUser.id && (
                            <button
                              onClick={() => handleRemoveMember(member.id)}
                              className="text-zinc-500 hover:text-red-400 p-1 rounded-md hover:bg-red-500/5 transition-all cursor-pointer"
                              title="Remove member"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Invite Teammate Form */}
                <div className="p-6 bg-zinc-900/20 border border-zinc-900/60 rounded-3xl space-y-4">
                  <div className="flex items-center gap-2 border-b border-zinc-900 pb-3">
                    <Mail className="h-4.5 w-4.5 text-purple-400" />
                    <h3 className="text-sm font-bold text-white tracking-tight">Invite Coworker</h3>
                  </div>

                  <form onSubmit={handleInvite} className="space-y-3">
                    <div>
                      <input
                        type="email"
                        placeholder="co-worker@email.com"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        className="bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-hidden focus:border-purple-500 w-full"
                        required
                      />
                    </div>
                    
                    {inviteError && (
                      <div className="text-[11px] text-red-400 bg-red-500/10 border border-red-500/20 p-2.5 rounded-lg flex items-center gap-1.5">
                        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                        <span className="leading-tight">{inviteError}</span>
                      </div>
                    )}
                    {inviteSuccess && (
                      <div className="text-[11px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-lg flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                        <span className="leading-tight">{inviteSuccess}</span>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={inviting || !inviteEmail.trim()}
                      className="w-full py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-950/60 disabled:text-zinc-600 rounded-xl text-xs font-semibold text-white transition-all cursor-pointer flex items-center justify-center gap-1"
                    >
                      {inviting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                      Send Invitation
                    </button>
                  </form>
                </div>
              </div>

              {/* Right side: Kanban board & new task */}
              <div className="lg:col-span-3 space-y-6">
                {/* Add team task */}
                <div className="p-6 bg-zinc-900/20 border border-zinc-900/60 rounded-3xl space-y-4">
                  <h3 className="text-sm font-bold text-white tracking-tight border-b border-zinc-900 pb-3 flex items-center gap-2">
                    <Sparkles className="h-4.5 w-4.5 text-purple-400" /> Create Shared Task
                  </h3>

                  <form onSubmit={handleAddTask} className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <div>
                        <input
                          type="text"
                          placeholder="Task title"
                          value={taskTitle}
                          onChange={(e) => setTaskTitle(e.target.value)}
                          className="bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-hidden focus:border-purple-500 w-full"
                          required
                        />
                      </div>
                      <div>
                        <textarea
                          placeholder="Task description..."
                          value={taskDesc}
                          onChange={(e) => setTaskDesc(e.target.value)}
                          rows="2.5"
                          className="bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-hidden focus:border-purple-500 w-full resize-none"
                        />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <select
                            value={taskPriority}
                            onChange={(e) => setTaskPriority(e.target.value)}
                            className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-300 focus:outline-hidden focus:border-purple-500 cursor-pointer font-medium w-full"
                          >
                            <option value="LOW">Low Priority</option>
                            <option value="MEDIUM">Medium Priority</option>
                            <option value="HIGH">High Priority</option>
                          </select>
                        </div>

                        <div>
                          <select
                            value={taskAssignee}
                            onChange={(e) => setTaskAssignee(e.target.value)}
                            className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-300 focus:outline-hidden focus:border-purple-500 cursor-pointer font-medium w-full"
                          >
                            <option value="">Unassigned</option>
                            {members.map(m => (
                              <option key={m.id} value={m.id}>{m.email}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <input
                            type="date"
                            value={taskDueDate}
                            onChange={(e) => setTaskDueDate(e.target.value)}
                            className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-zinc-300 focus:outline-hidden focus:border-purple-500 cursor-pointer font-medium w-full"
                          />
                        </div>
                        
                        <button
                          type="submit"
                          disabled={addingTask || !taskTitle.trim()}
                          className="py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-950/60 disabled:text-zinc-600 rounded-xl text-xs font-semibold text-white transition-all cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          {addingTask ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                          Add Task
                        </button>
                      </div>
                    </div>
                  </form>
                </div>

                {/* Kanban board columns */}
                {tasksLoading ? (
                  <div className="flex flex-col items-center py-12 gap-3 text-zinc-400 bg-zinc-900/10 border border-zinc-900/60 rounded-3xl">
                    <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
                    <p className="text-sm font-semibold">Updating shared board...</p>
                  </div>
                ) : (
                  <div className="grid md:grid-cols-3 gap-6">
                    {/* TO DO COLUMN */}
                    <div className="flex flex-col p-4 bg-zinc-900/20 border border-zinc-900/60 rounded-2xl min-h-[500px]">
                      <div className="flex items-center justify-between pb-3 border-b border-zinc-900 mb-4">
                        <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">To Do</span>
                        <span className="px-2 py-0.5 bg-zinc-900 border border-zinc-800 rounded-md text-[10px] font-bold text-zinc-400">
                          {getTasksByStatus('TODO').length}
                        </span>
                      </div>

                      <div className="flex-1 space-y-3 overflow-y-auto max-h-[600px]">
                        {getTasksByStatus('TODO').map(task => (
                          <KanbanCard
                            key={task.id}
                            task={task}
                            members={members}
                            onMove={handleMoveTask}
                            onDelete={handleDeleteTask}
                            onAssign={handleAssigneeChange}
                            getPriorityColor={getPriorityColor}
                          />
                        ))}
                      </div>
                    </div>

                    {/* IN PROGRESS COLUMN */}
                    <div className="flex flex-col p-4 bg-zinc-900/20 border border-zinc-900/60 rounded-2xl min-h-[500px]">
                      <div className="flex items-center justify-between pb-3 border-b border-zinc-900 mb-4">
                        <span className="text-xs font-bold uppercase tracking-wider text-yellow-400">In Progress</span>
                        <span className="px-2 py-0.5 bg-zinc-900 border border-zinc-800 rounded-md text-[10px] font-bold text-yellow-400">
                          {getTasksByStatus('IN_PROGRESS').length}
                        </span>
                      </div>

                      <div className="flex-1 space-y-3 overflow-y-auto max-h-[600px]">
                        {getTasksByStatus('IN_PROGRESS').map(task => (
                          <KanbanCard
                            key={task.id}
                            task={task}
                            members={members}
                            onMove={handleMoveTask}
                            onDelete={handleDeleteTask}
                            onAssign={handleAssigneeChange}
                            getPriorityColor={getPriorityColor}
                          />
                        ))}
                      </div>
                    </div>

                    {/* DONE COLUMN */}
                    <div className="flex flex-col p-4 bg-zinc-900/20 border border-zinc-900/60 rounded-2xl min-h-[500px]">
                      <div className="flex items-center justify-between pb-3 border-b border-zinc-900 mb-4">
                        <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">Completed</span>
                        <span className="px-2 py-0.5 bg-zinc-900 border border-zinc-800 rounded-md text-[10px] font-bold text-emerald-400">
                          {getTasksByStatus('DONE').length}
                        </span>
                      </div>

                      <div className="flex-1 space-y-3 overflow-y-auto max-h-[600px]">
                        {getTasksByStatus('DONE').map(task => (
                          <KanbanCard
                            key={task.id}
                            task={task}
                            members={members}
                            onMove={handleMoveTask}
                            onDelete={handleDeleteTask}
                            onAssign={handleAssigneeChange}
                            getPriorityColor={getPriorityColor}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-20 border border-dashed border-zinc-900 rounded-3xl p-8 bg-zinc-950">
              <Users className="h-12 w-12 text-zinc-700 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-zinc-300">Welcome to Team Workspaces</h3>
              <p className="text-xs text-zinc-500 max-w-sm mx-auto mt-2 leading-relaxed">
                Create an organization above or ask an administrator to invite your email. Then, you can collaborate on tasks and share workflows.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function KanbanCard({ task, members, onMove, onDelete, onAssign, getPriorityColor }) {
  const getMoveOptions = () => {
    if (task.status === 'TODO') {
      return [{ status: 'IN_PROGRESS', label: 'Start Work' }, { status: 'DONE', label: 'Complete' }];
    } else if (task.status === 'IN_PROGRESS') {
      return [{ status: 'TODO', label: 'Move to Todo' }, { status: 'DONE', label: 'Complete' }];
    } else {
      return [{ status: 'TODO', label: 'Reopen' }, { status: 'IN_PROGRESS', label: 'Put In Progress' }];
    }
  };

  return (
    <div className="p-4 bg-zinc-950 border border-zinc-900 hover:border-zinc-800 rounded-xl space-y-3 shadow-sm transition-all">
      <div className="flex justify-between items-start gap-2">
        <h4 className={`text-xs font-bold text-zinc-100 leading-tight ${task.status === 'DONE' ? 'line-through text-zinc-500' : ''}`}>
          {task.title}
        </h4>
        <button
          onClick={() => onDelete(task.id)}
          className="text-zinc-600 hover:text-red-400 p-0.5 transition-all cursor-pointer shrink-0"
          title="Delete Task"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>

      {task.description && (
        <p className="text-[11px] text-zinc-500 leading-normal line-clamp-2">
          {task.description}
        </p>
      )}

      {/* Date & Priority Row */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-900/60 pt-2.5">
        {task.dueDate ? (
          <span className="text-[10px] text-zinc-500 font-semibold">
            Due: {new Date(task.dueDate).toLocaleDateString()}
          </span>
        ) : (
          <span className="text-[10px] text-zinc-600 font-medium">No due date</span>
        )}

        <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-md border ${getPriorityColor(task.priority)}`}>
          {task.priority}
        </span>
      </div>

      {/* Assignee select */}
      <div className="flex items-center gap-1.5 bg-zinc-900/40 p-1.5 rounded-lg border border-zinc-900/30">
        <User className="h-3 w-3 text-zinc-500 shrink-0" />
        <select
          value={task.assigneeId || ''}
          onChange={(e) => onAssign(task, e.target.value)}
          className="bg-transparent border-0 text-[10px] text-zinc-400 hover:text-zinc-200 focus:outline-hidden cursor-pointer font-bold w-full"
        >
          <option value="" className="bg-zinc-950">Unassigned</option>
          {members.map(m => (
            <option key={m.id} value={m.id} className="bg-zinc-950">{m.email}</option>
          ))}
        </select>
      </div>

      {/* Action Buttons to Move */}
      <div className="flex gap-1.5 pt-1.5 border-t border-zinc-900/60">
        {getMoveOptions().map((opt) => (
          <button
            key={opt.status}
            onClick={() => onMove(task, opt.status)}
            className="flex-1 py-1 px-2 bg-zinc-900 hover:bg-zinc-800 hover:text-white rounded-lg text-[9px] font-bold text-zinc-400 transition-all cursor-pointer border border-zinc-850"
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
