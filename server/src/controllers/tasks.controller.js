const prisma = require('../services/prisma.service');
const genaiService = require('../services/genai.service');
const { executeEventWorkflows } = require('../services/scheduler.service');
const analyticsService = require('../services/analytics.service');

// Fire-and-forget AI log helper
function logAi(userId, prompt, response) {
  prisma.aiLog.create({ data: { userId, prompt, response } }).catch(() => {});
}

// Get all tasks for the authenticated user, with optional filters
exports.getTasks = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { status, priority, due, organizationId } = req.query;

    const andConditions = [];

    if (organizationId) {
      const orgId = parseInt(organizationId, 10);
      // Verify current user is member of the organization
      const membership = await prisma.membership.findFirst({
        where: { userId, organizationId: orgId },
      });
      if (!membership) {
        return res.status(403).json({ error: 'Access denied. You are not a member of this organization.' });
      }
      andConditions.push({ organizationId: orgId });
    } else {
      // Get all memberships of current user
      const memberships = await prisma.membership.findMany({
        where: { userId },
        select: { organizationId: true },
      });
      const orgIds = memberships.map((m) => m.organizationId);

      andConditions.push({
        OR: [
          { userId, organizationId: null },
          { organizationId: { in: orgIds } },
        ],
      });
    }

    if (status) {
      andConditions.push({ status });
    }
    if (priority) {
      andConditions.push({ priority });
    }

    const now = new Date();
    if (due === 'overdue') {
      andConditions.push({ dueDate: { lt: now }, status: { not: 'DONE' } });
    } else if (due === 'today') {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const endOfToday = new Date();
      endOfToday.setHours(23, 59, 59, 999);
      andConditions.push({
        dueDate: {
          gte: startOfToday,
          lte: endOfToday,
        },
      });
    } else if (due === 'upcoming') {
      andConditions.push({ dueDate: { gt: now } });
    }

    const where = andConditions.length > 0 ? { AND: andConditions } : {};

    const tasks = await prisma.task.findMany({
      where,
      include: {
        assignee: {
          select: {
            id: true,
            email: true,
          },
        },
      },
      orderBy: { dueDate: 'asc' },
    });

    res.status(200).json(tasks);
  } catch (error) {
    console.error('getTasks error:', error);
    res.status(500).json({ error: 'An error occurred while fetching tasks.' });
  }
};

// Get a single task by ID
exports.getTaskById = async (req, res) => {
  try {
    const userId = req.user.userId;
    const taskId = parseInt(req.params.id, 10);

    if (isNaN(taskId)) {
      return res.status(400).json({ error: 'Invalid task ID.' });
    }

    // Get all memberships of current user
    const memberships = await prisma.membership.findMany({
      where: { userId },
      select: { organizationId: true },
    });
    const orgIds = memberships.map((m) => m.organizationId);

    const task = await prisma.task.findFirst({
      where: {
        id: taskId,
        OR: [
          { userId },
          { organizationId: { in: orgIds } },
        ],
      },
      include: {
        assignee: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found.' });
    }

    res.status(200).json(task);
  } catch (error) {
    console.error('getTaskById error:', error);
    res.status(500).json({ error: 'An error occurred while fetching the task.' });
  }
};

// Create a new task
exports.createTask = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { title, description, dueDate, priority, status, aiGenerated, organizationId, assigneeId } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Task title is required.' });
    }

    let parsedOrgId = null;
    let parsedAssigneeId = null;

    if (organizationId) {
      parsedOrgId = parseInt(organizationId, 10);
      // Verify creator is member of the organization
      const membership = await prisma.membership.findFirst({
        where: { userId, organizationId: parsedOrgId },
      });
      if (!membership) {
        return res.status(403).json({ error: 'Access denied. You are not a member of this organization.' });
      }

      if (assigneeId) {
        parsedAssigneeId = parseInt(assigneeId, 10);
        // Verify assignee is member of the organization
        const assigneeMembership = await prisma.membership.findFirst({
          where: { userId: parsedAssigneeId, organizationId: parsedOrgId },
        });
        if (!assigneeMembership) {
          return res.status(400).json({ error: 'Assignee is not a member of this organization.' });
        }
      }
    }

    const task = await prisma.task.create({
      data: {
        userId,
        title,
        description: description || '',
        dueDate: dueDate ? new Date(dueDate) : null,
        priority: priority || 'MEDIUM',
        status: status || 'TODO',
        aiGenerated: aiGenerated || false,
        organizationId: parsedOrgId,
        assigneeId: parsedAssigneeId,
      },
      include: {
        assignee: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    // Run workflows reactively in the background
    executeEventWorkflows(userId, 'TASK_CREATED', task);

    res.status(201).json(task);
  } catch (error) {
    console.error('createTask error:', error);
    res.status(500).json({ error: 'An error occurred while creating the task.' });
  }
};

// Update an existing task
exports.updateTask = async (req, res) => {
  try {
    const userId = req.user.userId;
    const taskId = parseInt(req.params.id, 10);

    if (isNaN(taskId)) {
      return res.status(400).json({ error: 'Invalid task ID.' });
    }

    // Get all memberships of current user
    const memberships = await prisma.membership.findMany({
      where: { userId },
      select: { organizationId: true },
    });
    const orgIds = memberships.map((m) => m.organizationId);

    const existingTask = await prisma.task.findFirst({
      where: {
        id: taskId,
        OR: [
          { userId },
          { organizationId: { in: orgIds } },
        ],
      },
    });

    if (!existingTask) {
      return res.status(404).json({ error: 'Task not found or access denied.' });
    }

    const { title, description, dueDate, priority, status, aiGenerated, assigneeId, organizationId } = req.body;

    const updatedData = {};
    if (title !== undefined) updatedData.title = title;
    if (description !== undefined) updatedData.description = description;
    if (dueDate !== undefined) updatedData.dueDate = dueDate ? new Date(dueDate) : null;
    if (priority !== undefined) updatedData.priority = priority;
    if (status !== undefined) updatedData.status = status;
    if (aiGenerated !== undefined) updatedData.aiGenerated = aiGenerated;
    
    // Allow updating assignee if it belongs to organization
    if (assigneeId !== undefined) {
      if (assigneeId === null) {
        updatedData.assigneeId = null;
      } else {
        const parsedAssigneeId = parseInt(assigneeId, 10);
        const taskOrgId = organizationId !== undefined ? (organizationId ? parseInt(organizationId, 10) : null) : existingTask.organizationId;
        if (!taskOrgId) {
          return res.status(400).json({ error: 'Cannot assign a personal task.' });
        }
        // Verify assignee is in organization of the task
        const assigneeMembership = await prisma.membership.findFirst({
          where: { userId: parsedAssigneeId, organizationId: taskOrgId },
        });
        if (!assigneeMembership) {
          return res.status(400).json({ error: 'Assignee is not a member of this organization.' });
        }
        updatedData.assigneeId = parsedAssigneeId;
      }
    }

    if (organizationId !== undefined) {
      if (organizationId === null) {
        updatedData.organizationId = null;
        updatedData.assigneeId = null; // Unassign if task becomes personal
      } else {
        const parsedOrgId = parseInt(organizationId, 10);
        // Verify member of organization
        const membership = await prisma.membership.findFirst({
          where: { userId, organizationId: parsedOrgId },
        });
        if (!membership) {
          return res.status(403).json({ error: 'Access denied. You are not a member of that organization.' });
        }
        updatedData.organizationId = parsedOrgId;
      }
    }

    const task = await prisma.task.update({
      where: { id: taskId },
      data: updatedData,
      include: {
        assignee: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    // Evaluate workflows reactively
    if (updatedData.status === 'DONE' && existingTask.status !== 'DONE') {
      executeEventWorkflows(userId, 'TASK_COMPLETED', task);
      analyticsService.trackTaskCompleted(userId);
    }
    if (updatedData.priority && updatedData.priority !== existingTask.priority) {
      executeEventWorkflows(userId, 'PRIORITY_CHANGED', task);
    }

    res.status(200).json(task);
  } catch (error) {
    console.error('updateTask error:', error);
    res.status(500).json({ error: 'An error occurred while updating the task.' });
  }
};

// Delete a task
exports.deleteTask = async (req, res) => {
  try {
    const userId = req.user.userId;
    const taskId = parseInt(req.params.id, 10);

    if (isNaN(taskId)) {
      return res.status(400).json({ error: 'Invalid task ID.' });
    }

    // Get all memberships of current user
    const memberships = await prisma.membership.findMany({
      where: { userId },
      select: { organizationId: true },
    });
    const orgIds = memberships.map((m) => m.organizationId);

    const existingTask = await prisma.task.findFirst({
      where: {
        id: taskId,
        OR: [
          { userId },
          { organizationId: { in: orgIds } },
        ],
      },
    });

    if (!existingTask) {
      return res.status(404).json({ error: 'Task not found or access denied.' });
    }

    await prisma.task.delete({
      where: { id: taskId },
    });

    res.status(200).json({ message: 'Task deleted successfully.' });
  } catch (error) {
    console.error('deleteTask error:', error);
    res.status(500).json({ error: 'An error occurred while deleting the task.' });
  }
};

// Parse natural language and create task
exports.parseTask = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { text, organizationId } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text prompt is required.' });
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

    // Call GenAI service
    const parsedData = await genaiService.parseTaskFromText(text);

    // Save task to database
    const task = await prisma.task.create({
      data: {
        userId,
        title: parsedData.title,
        description: parsedData.description || '',
        dueDate: parsedData.dueDate ? new Date(parsedData.dueDate) : null,
        priority: parsedData.priority || 'MEDIUM',
        status: 'TODO',
        aiGenerated: true,
        organizationId: parsedOrgId,
      },
      include: {
        assignee: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    // Log the AI interaction (non-blocking)
    logAi(userId, `Parse task: ${text}`, JSON.stringify(parsedData));

    // Track AI usage
    analyticsService.trackAiActionUsed(userId);

    // Run workflows reactively in the background
    executeEventWorkflows(userId, 'TASK_CREATED', task);

    res.status(201).json(task);
  } catch (error) {
    console.error('parseTask error:', error);
    if (error.name === 'GenAiServiceError') {
      return res.status(502).json({ error: error.message });
    }
    res.status(500).json({ error: 'An error occurred while parsing the task.' });
  }
};

// Generate AI suggested subtasks for a task
exports.getSubtasksSuggestions = async (req, res) => {
  try {
    const userId = req.user.userId;
    const taskId = parseInt(req.params.id, 10);

    if (isNaN(taskId)) {
      return res.status(400).json({ error: 'Invalid task ID.' });
    }

    const task = await prisma.task.findFirst({
      where: { id: taskId, userId },
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found or access denied.' });
    }

    // Call GenAI service
    const suggestions = await genaiService.suggestSubtasks(task.title, task.description);

    logAi(userId, `Suggest subtasks for task ID ${taskId}: "${task.title}"`, JSON.stringify(suggestions));

    analyticsService.trackAiActionUsed(userId);

    res.status(200).json({ suggestions });
  } catch (error) {
    console.error('getSubtasksSuggestions error:', error);
    if (error.name === 'GenAiServiceError') {
      return res.status(502).json({ error: error.message });
    }
    res.status(500).json({ error: 'An error occurred while generating subtasks.' });
  }
};
