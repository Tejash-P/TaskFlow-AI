const prisma = require('../services/prisma.service');
const genaiService = require('../services/genai.service');

// Create a new meeting (paste or upload transcript)
exports.createMeeting = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { title, rawTranscript, organizationId } = req.body;

    if (!title || !rawTranscript) {
      return res.status(400).json({ error: 'Title and transcript are required.' });
    }

    let parsedOrgId = null;
    if (organizationId) {
      parsedOrgId = parseInt(organizationId, 10);
      const membership = await prisma.membership.findFirst({
        where: { userId, organizationId: parsedOrgId },
      });
      if (!membership) {
        return res.status(403).json({ error: 'Access denied. You are not a member of this organization.' });
      }
    }

    const meeting = await prisma.meeting.create({
      data: {
        userId,
        title,
        rawTranscript,
        organizationId: parsedOrgId,
      },
    });

    res.status(201).json(meeting);
  } catch (error) {
    console.error('createMeeting error:', error);
    res.status(500).json({ error: 'An error occurred while creating the meeting.' });
  }
};

// Get all meetings for the authenticated user (or org)
exports.getMeetings = async (req, res) => {
  try {
    const userId = req.user.userId;

    const memberships = await prisma.membership.findMany({
      where: { userId },
      select: { organizationId: true },
    });
    const orgIds = memberships.map((m) => m.organizationId);

    const meetings = await prisma.meeting.findMany({
      where: {
        OR: [
          { userId },
          { organizationId: { in: orgIds } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        summary: true,
        actionItems: true,
        organizationId: true,
        createdAt: true,
      },
    });

    res.status(200).json(meetings);
  } catch (error) {
    console.error('getMeetings error:', error);
    res.status(500).json({ error: 'An error occurred while fetching meetings.' });
  }
};

// Get a single meeting by ID (includes full transcript)
exports.getMeetingById = async (req, res) => {
  try {
    const userId = req.user.userId;
    const meetingId = parseInt(req.params.id, 10);

    if (isNaN(meetingId)) {
      return res.status(400).json({ error: 'Invalid meeting ID.' });
    }

    const memberships = await prisma.membership.findMany({
      where: { userId },
      select: { organizationId: true },
    });
    const orgIds = memberships.map((m) => m.organizationId);

    const meeting = await prisma.meeting.findFirst({
      where: {
        id: meetingId,
        OR: [
          { userId },
          { organizationId: { in: orgIds } },
        ],
      },
    });

    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found.' });
    }

    res.status(200).json(meeting);
  } catch (error) {
    console.error('getMeetingById error:', error);
    res.status(500).json({ error: 'An error occurred while fetching the meeting.' });
  }
};

// Summarize a meeting transcript using Gemini
exports.summarizeMeeting = async (req, res) => {
  try {
    const userId = req.user.userId;
    const meetingId = parseInt(req.params.id, 10);

    if (isNaN(meetingId)) {
      return res.status(400).json({ error: 'Invalid meeting ID.' });
    }

    const meeting = await prisma.meeting.findFirst({
      where: { id: meetingId, userId },
    });

    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found or access denied.' });
    }

    // Call Gemini to summarize
    const result = await genaiService.summarizeMeeting(meeting.title, meeting.rawTranscript);

    // Store the result
    const updated = await prisma.meeting.update({
      where: { id: meetingId },
      data: {
        summary: result.summary,
        actionItems: result.actionItems,
      },
    });

    // Log the AI interaction (non-blocking)
    prisma.aiLog.create({ data: { userId, prompt: `Summarize meeting: "${meeting.title}"`, response: JSON.stringify(result) } }).catch(() => {});

    res.status(200).json(updated);
  } catch (error) {
    console.error('summarizeMeeting error:', error);
    if (error.name === 'GenAiServiceError') {
      return res.status(502).json({ error: error.message });
    }
    res.status(500).json({ error: 'An error occurred while summarizing the meeting.' });
  }
};

// Convert action items from a meeting into real Task rows
exports.convertActionsToTasks = async (req, res) => {
  try {
    const userId = req.user.userId;
    const meetingId = parseInt(req.params.id, 10);

    if (isNaN(meetingId)) {
      return res.status(400).json({ error: 'Invalid meeting ID.' });
    }

    const meeting = await prisma.meeting.findFirst({
      where: { id: meetingId, userId },
    });

    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found or access denied.' });
    }

    if (!meeting.actionItems || !Array.isArray(meeting.actionItems) || meeting.actionItems.length === 0) {
      return res.status(400).json({ error: 'No action items to convert. Run summarization first.' });
    }

    const createdTasks = [];

    for (const item of meeting.actionItems) {
      // Try to resolve assignee by email if suggestedAssignee looks like an email
      let assigneeId = null;
      if (item.suggestedAssignee && meeting.organizationId) {
        const assigneeUser = await prisma.user.findUnique({
          where: { email: item.suggestedAssignee.toLowerCase() },
        });
        if (assigneeUser) {
          // Verify assignee is in the same organization
          const membership = await prisma.membership.findFirst({
            where: { userId: assigneeUser.id, organizationId: meeting.organizationId },
          });
          if (membership) {
            assigneeId = assigneeUser.id;
          }
        }
      }

      const task = await prisma.task.create({
        data: {
          userId,
          title: item.text,
          description: `From meeting: "${meeting.title}"`,
          dueDate: item.dueDate ? new Date(item.dueDate) : null,
          priority: 'MEDIUM',
          status: 'TODO',
          aiGenerated: true,
          organizationId: meeting.organizationId,
          assigneeId,
        },
      });

      createdTasks.push(task);
    }

    res.status(201).json({
      message: `Created ${createdTasks.length} task(s) from meeting action items.`,
      tasks: createdTasks,
    });
  } catch (error) {
    console.error('convertActionsToTasks error:', error);
    res.status(500).json({ error: 'An error occurred while converting action items to tasks.' });
  }
};
