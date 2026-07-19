const prisma = require('../services/prisma.service');
const genaiService = require('../services/genai.service');

// Get calendar events for authenticated user
exports.getEvents = async (req, res) => {
  try {
    const userId = req.user.userId;
    const events = await prisma.calendarEvent.findMany({
      where: { userId },
      orderBy: { startTime: 'asc' },
    });
    res.status(200).json(events);
  } catch (error) {
    console.error('getEvents error:', error);
    res.status(500).json({ error: 'An error occurred while fetching calendar events.' });
  }
};

// Create a new calendar event
exports.createEvent = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { title, startTime, endTime, source, externalEventId } = req.body;

    if (!title || !startTime || !endTime) {
      return res.status(400).json({ error: 'Title, start time, and end time are required.' });
    }

    const event = await prisma.calendarEvent.create({
      data: {
        userId,
        title,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        source: source || 'MANUAL',
        externalEventId,
      },
    });

    res.status(201).json(event);
  } catch (error) {
    console.error('createEvent error:', error);
    res.status(500).json({ error: 'An error occurred while creating the calendar event.' });
  }
};

// Update an existing calendar event
exports.updateEvent = async (req, res) => {
  try {
    const userId = req.user.userId;
    const eventId = parseInt(req.params.id, 10);

    if (isNaN(eventId)) {
      return res.status(400).json({ error: 'Invalid event ID.' });
    }

    const existingEvent = await prisma.calendarEvent.findFirst({
      where: { id: eventId, userId },
    });

    if (!existingEvent) {
      return res.status(404).json({ error: 'Calendar event not found or access denied.' });
    }

    const { title, startTime, endTime, source } = req.body;
    const updatedData = {};
    if (title !== undefined) updatedData.title = title;
    if (startTime !== undefined) updatedData.startTime = new Date(startTime);
    if (endTime !== undefined) updatedData.endTime = new Date(endTime);
    if (source !== undefined) updatedData.source = source;

    const event = await prisma.calendarEvent.update({
      where: { id: eventId },
      data: updatedData,
    });

    res.status(200).json(event);
  } catch (error) {
    console.error('updateEvent error:', error);
    res.status(500).json({ error: 'An error occurred while updating the calendar event.' });
  }
};

// Delete a calendar event
exports.deleteEvent = async (req, res) => {
  try {
    const userId = req.user.userId;
    const eventId = parseInt(req.params.id, 10);

    if (isNaN(eventId)) {
      return res.status(400).json({ error: 'Invalid event ID.' });
    }

    const existingEvent = await prisma.calendarEvent.findFirst({
      where: { id: eventId, userId },
    });

    if (!existingEvent) {
      return res.status(404).json({ error: 'Calendar event not found or access denied.' });
    }

    await prisma.calendarEvent.delete({
      where: { id: eventId },
    });

    res.status(200).json({ message: 'Calendar event deleted successfully.' });
  } catch (error) {
    console.error('deleteEvent error:', error);
    res.status(500).json({ error: 'An error occurred while deleting the calendar event.' });
  }
};

// Suggest 2-3 open slots to schedule a task
exports.suggestTime = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { taskId } = req.body;

    if (!taskId) {
      return res.status(400).json({ error: 'Task ID is required.' });
    }

    const task = await prisma.task.findFirst({
      where: { id: parseInt(taskId, 10), userId },
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found or access denied.' });
    }

    // Fetch existing calendar events for the next 7 days to evaluate open slots
    const now = new Date();
    const nextWeek = new Date();
    nextWeek.setDate(now.getDate() + 7);

    const existingEvents = await prisma.calendarEvent.findMany({
      where: {
        userId,
        startTime: { gte: now },
        endTime: { lte: nextWeek },
      },
    });

    // Call GenAI to suggest times
    const suggestions = await genaiService.suggestTimeSlots(task.title, task.dueDate, existingEvents);

    res.status(200).json(suggestions);
  } catch (error) {
    console.error('suggestTime error:', error);
    if (error.name === 'GenAiServiceError') {
      return res.status(502).json({ error: error.message });
    }
    res.status(500).json({ error: 'An error occurred while suggesting time slots.' });
  }
};

// Google Calendar OAuth connect stub
exports.googleConnect = async (req, res) => {
  res.status(200).json({
    message: 'Google Calendar OAuth integration is active under the backend flag.',
    connectUrl: '#',
    status: 'STUBBED',
  });
};

// Google Calendar OAuth mock sync job
exports.googleSync = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Create a couple of mock Google Calendar events to make the stub demo-ready!
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const event1Start = new Date(tomorrow);
    event1Start.setHours(10, 0, 0, 0);
    const event1End = new Date(tomorrow);
    event1End.setHours(11, 30, 0, 0);

    const event2Start = new Date(tomorrow);
    event2Start.setHours(15, 0, 0, 0);
    const event2End = new Date(tomorrow);
    event2End.setHours(16, 0, 0, 0);

    const createdEvents = [];

    // Check if they already exist to avoid duplicate mock events
    const exists1 = await prisma.calendarEvent.findFirst({
      where: { userId, externalEventId: 'mock-google-1' },
    });
    if (!exists1) {
      const e1 = await prisma.calendarEvent.create({
        data: {
          userId,
          title: '📞 Team Sync (Google Calendar)',
          startTime: event1Start,
          endTime: event1End,
          source: 'GOOGLE',
          externalEventId: 'mock-google-1',
        },
      });
      createdEvents.push(e1);
    }

    const exists2 = await prisma.calendarEvent.findFirst({
      where: { userId, externalEventId: 'mock-google-2' },
    });
    if (!exists2) {
      const e2 = await prisma.calendarEvent.create({
        data: {
          userId,
          title: '🎯 Roadmap Discussion (Google Calendar)',
          startTime: event2Start,
          endTime: event2End,
          source: 'GOOGLE',
          externalEventId: 'mock-google-2',
        },
      });
      createdEvents.push(e2);
    }

    res.status(200).json({
      message: `Google Calendar synced successfully! Synced ${createdEvents.length} new event(s).`,
      events: createdEvents,
    });
  } catch (error) {
    console.error('googleSync error:', error);
    res.status(500).json({ error: 'An error occurred while syncing Google Calendar.' });
  }
};
