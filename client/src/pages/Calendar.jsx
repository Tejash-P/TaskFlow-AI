import React, { useState, useEffect } from 'react';
import api from '../lib/api';
import Navigation from '../components/Navigation';
import { Calendar as CalendarIcon, Sparkles, Loader2, Plus, Clock, AlertCircle, RefreshCw, Check } from 'lucide-react';

export default function Calendar() {
  const [events, setEvents] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Form State
  const [eventTitle, setEventTitle] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventStart, setEventStart] = useState('');
  const [eventEnd, setEventEnd] = useState('');
  const [addingEvent, setAddingEvent] = useState(false);

  // Time suggestion state
  const [suggestingForTaskId, setSuggestingForTaskId] = useState(null);
  const [timeSuggestions, setTimeSuggestions] = useState([]);
  const [suggestError, setSuggestError] = useState('');

  const fetchCalendarData = async () => {
    setLoading(true);
    try {
      const eventsRes = await api.get('/calendar');
      setEvents(eventsRes.data);
      const tasksRes = await api.get('/tasks?status=TODO');
      setTasks(tasksRes.data);
    } catch (err) {
      console.error('Error fetching calendar data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCalendarData();
  }, []);

  const handleAddEvent = async (e) => {
    e.preventDefault();
    if (!eventTitle || !eventDate || !eventStart || !eventEnd) return;

    setAddingEvent(true);
    try {
      const startTime = new Date(`${eventDate}T${eventStart}:00`);
      const endTime = new Date(`${eventDate}T${eventEnd}:00`);

      if (endTime <= startTime) {
        alert('End time must be after start time.');
        setAddingEvent(false);
        return;
      }

      const res = await api.post('/calendar', {
        title: eventTitle,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        source: 'MANUAL',
      });

      setEvents(prev => [...prev, res.data].sort((a, b) => new Date(a.startTime) - new Date(b.startTime)));
      setEventTitle('');
      setEventDate('');
      setEventStart('');
      setEventEnd('');
    } catch (err) {
      console.error(err);
      alert('Failed to save event.');
    } finally {
      setAddingEvent(false);
    }
  };

  const handleSyncGoogle = async () => {
    setSyncing(true);
    try {
      const res = await api.get('/calendar/google/sync');
      alert(res.data.message);
      // Refresh events
      const eventsRes = await api.get('/calendar');
      setEvents(eventsRes.data);
    } catch (err) {
      console.error(err);
      alert('Failed to sync Google Calendar.');
    } finally {
      setSyncing(false);
    }
  };

  const handleSuggestTime = async (taskId) => {
    setSuggestingForTaskId(taskId);
    setTimeSuggestions([]);
    setSuggestError('');

    try {
      const res = await api.post('/calendar/suggest', { taskId });
      setTimeSuggestions(res.data);
    } catch (err) {
      console.error(err);
      setSuggestError('Could not compute suggestions.');
    }
  };

  const handleBookSuggestedSlot = async (slot, task) => {
    try {
      const res = await api.post('/calendar', {
        title: `🔧 Work on: ${task.title}`,
        startTime: slot.startTime,
        endTime: slot.endTime,
        source: 'MANUAL',
      });

      setEvents(prev => [...prev, res.data].sort((a, b) => new Date(a.startTime) - new Date(b.startTime)));
      // Clear suggestions
      setSuggestingForTaskId(null);
      setTimeSuggestions([]);
      alert(`Booked: "${task.title}" has been scheduled!`);
    } catch (err) {
      console.error(err);
      alert('Failed to book slot.');
    }
  };

  // Group events by date for rendering
  const getGroupedEvents = () => {
    const grouped = {};
    events.forEach(event => {
      const dateStr = new Date(event.startTime).toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
      if (!grouped[dateStr]) grouped[dateStr] = [];
      grouped[dateStr].push(event);
    });
    return grouped;
  };

  const grouped = getGroupedEvents();

  return (
    <div className="flex min-h-screen bg-zinc-950 text-zinc-100 pb-20 md:pb-0">
      <Navigation />

      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
        <header className="flex items-center justify-between px-6 md:px-8 py-5 border-b border-zinc-900 sticky top-0 bg-zinc-950/80 backdrop-blur-md z-30">
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white">Smart Calendar</h1>
            <p className="text-xs text-zinc-400 font-medium">Manage your schedule and get Gemini suggestions for booking tasks.</p>
          </div>

          <button
            onClick={handleSyncGoogle}
            disabled={syncing}
            className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-300 text-xs font-semibold hover:bg-zinc-850 transition-all cursor-pointer shadow-md"
          >
            {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Sync Google Calendar
          </button>
        </header>

        <div className="flex-1 p-6 md:p-8 grid lg:grid-cols-3 gap-8 max-w-7xl w-full mx-auto">
          {/* Calendar View */}
          <div className="lg:col-span-2 space-y-6">
            <div className="p-6 bg-zinc-900/20 border border-zinc-900/60 rounded-3xl space-y-4">
              <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2 border-b border-zinc-900 pb-3">
                <CalendarIcon className="h-4.5 w-4.5 text-purple-400" /> Weekly Schedule
              </h3>

              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
                </div>
              ) : Object.keys(grouped).length > 0 ? (
                <div className="space-y-6">
                  {Object.keys(grouped).map(dateStr => (
                    <div key={dateStr} className="space-y-2.5">
                      <h4 className="text-xs font-bold text-purple-400 tracking-wider uppercase">{dateStr}</h4>
                      <div className="grid gap-2.5">
                        {grouped[dateStr].map(event => (
                          <div key={event.id} className="flex items-center justify-between p-3.5 bg-zinc-950 border border-zinc-900 rounded-xl">
                            <div className="min-w-0">
                              <h5 className="text-xs font-bold text-zinc-100">{event.title}</h5>
                              <p className="text-[10px] text-zinc-500 font-semibold mt-1 flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {new Date(event.startTime).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })} - {new Date(event.endTime).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                            {event.source === 'GOOGLE' && (
                              <span className="text-[8px] font-extrabold bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-md uppercase tracking-wider">
                                Google
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-16">
                  <CalendarIcon className="h-10 w-10 text-zinc-700 mx-auto mb-3" />
                  <p className="text-xs text-zinc-500">Your calendar is completely clear! Book a manual event or sync with Google.</p>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar Forms / Suggestion panel */}
          <div className="space-y-6">
            {/* Book Event Form */}
            <div className="p-6 bg-zinc-900/20 border border-zinc-900/60 rounded-3xl space-y-4">
              <h3 className="text-sm font-bold text-white tracking-tight border-b border-zinc-900 pb-3">Book Manual Event</h3>
              <form onSubmit={handleAddEvent} className="space-y-3">
                <input
                  type="text"
                  placeholder="Event title"
                  value={eventTitle}
                  onChange={(e) => setEventTitle(e.target.value)}
                  className="bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-zinc-200 placeholder-zinc-650 focus:outline-hidden focus:border-purple-500 w-full"
                  required
                />
                <input
                  type="date"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  className="bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-zinc-350 focus:outline-hidden focus:border-purple-500 w-full cursor-pointer"
                  required
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="time"
                    value={eventStart}
                    onChange={(e) => setEventStart(e.target.value)}
                    className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-350 focus:outline-hidden focus:border-purple-500 w-full cursor-pointer"
                    required
                  />
                  <input
                    type="time"
                    value={eventEnd}
                    onChange={(e) => setEventEnd(e.target.value)}
                    className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-350 focus:outline-hidden focus:border-purple-500 w-full cursor-pointer"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={addingEvent}
                  className="w-full py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-950/60 rounded-xl text-xs font-semibold text-white transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {addingEvent ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                  Schedule Event
                </button>
              </form>
            </div>

            {/* Smart scheduling suggestions */}
            <div className="p-6 bg-zinc-900/20 border border-zinc-900/60 rounded-3xl space-y-4">
              <h3 className="text-sm font-bold text-white tracking-tight border-b border-zinc-900 pb-3 flex items-center gap-1.5">
                <Sparkles className="h-4.5 w-4.5 text-purple-400" /> AI Scheduler Suggestions
              </h3>
              
              <div className="space-y-3">
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Unscheduled Tasks</label>
                {tasks.length > 0 ? (
                  <div className="space-y-2">
                    {tasks.map(task => (
                      <div key={task.id} className="p-3 bg-zinc-950 border border-zinc-900 rounded-xl space-y-2">
                        <div className="flex justify-between items-start gap-1">
                          <h5 className="text-[11px] font-bold text-zinc-200 line-clamp-1">{task.title}</h5>
                          <button
                            onClick={() => handleSuggestTime(task.id)}
                            disabled={suggestingForTaskId === task.id}
                            className="text-[9px] font-extrabold uppercase bg-purple-500/10 hover:bg-purple-500/25 border border-purple-500/20 text-purple-400 px-2 py-0.5 rounded-md transition-all cursor-pointer shrink-0 flex items-center gap-1"
                          >
                            {suggestingForTaskId === task.id && <Loader2 className="h-2.5 w-2.5 animate-spin" />}
                            Suggest Slots
                          </button>
                        </div>

                        {/* Suggestion slots dropdown */}
                        {suggestingForTaskId === task.id && (
                          <div className="pt-2 border-t border-zinc-900 space-y-2">
                            {suggestError && (
                              <p className="text-[10px] text-red-400 flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" /> {suggestError}
                              </p>
                            )}
                            {timeSuggestions.map((slot, index) => (
                              <button
                                key={index}
                                onClick={() => handleBookSuggestedSlot(slot, task)}
                                className="w-full text-left p-2 bg-zinc-900/50 hover:bg-zinc-900 border border-zinc-800/80 rounded-lg transition-all cursor-pointer space-y-1 block hover:border-purple-500/30"
                              >
                                <p className="text-[10px] font-bold text-zinc-200">
                                  {new Date(slot.startTime).toLocaleDateString()} @ {new Date(slot.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </p>
                                <p className="text-[9px] text-zinc-500 leading-normal">{slot.reason}</p>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] text-zinc-500">No active TODO tasks to schedule.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
