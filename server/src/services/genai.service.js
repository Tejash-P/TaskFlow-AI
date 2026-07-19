const { GoogleGenerativeAI, SchemaType } = require('@google/generative-ai');
const prisma = require('./prisma.service');

// Custom service error wrapper
class GenAiServiceError extends Error {
  constructor(message, originalError = null) {
    super(message);
    this.name = 'GenAiServiceError';
    this.originalError = originalError;
  }
}

let hasWarnedAboutDemoMode = false;

function logDemoModeOnce() {
  if (!hasWarnedAboutDemoMode) {
    hasWarnedAboutDemoMode = true;
    console.warn('[GenAI] Gemini is unavailable or misconfigured. Falling back to local demo mode.');
  }
}

// Accept any reasonably long key string — let the Gemini API reject it if invalid
function getApiKey() {
  const apiKey = process.env.GENAI_API_KEY || process.env.GEMINI_API_KEY;
  const trimmed = typeof apiKey === 'string' ? apiKey.trim() : '';
  if (!trimmed || trimmed === 'YOUR_GEMINI_API_KEY' || trimmed.length < 10) {
    return null;
  }
  return trimmed;
}

// Retry helper with exponential backoff
async function retryWithBackoff(fn, retries = 3, delay = 1000) {
  try {
    return await fn();
  } catch (error) {
    if (retries <= 0) throw error;
    console.warn(`Gemini API call failed. Retrying in ${delay}ms... Error: ${error.message}`);
    await new Promise((resolve) => setTimeout(resolve, delay));
    return retryWithBackoff(fn, retries - 1, delay * 2);
  }
}

function getCurrentModelName() {
  return process.env.GENAI_MODEL || 'gemini-2.0-flash';
}

function getGenAI() {
  const apiKey = getApiKey();
  return apiKey ? new GoogleGenerativeAI(apiKey) : null;
}

function isGeminiAvailable() {
  return Boolean(getApiKey());
}

function normalizeWhitespace(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function titleCase(text) {
  const normalized = normalizeWhitespace(text);
  if (!normalized) return '';
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function setTimeOnDate(baseDate, hours, minutes = 0) {
  const d = new Date(baseDate);
  d.setHours(hours, minutes, 0, 0);
  return d;
}

function addDays(baseDate, days) {
  const d = new Date(baseDate);
  d.setDate(d.getDate() + days);
  return d;
}

function nextWeekday(baseDate, targetDayIndex) {
  const d = new Date(baseDate);
  const current = d.getDay();
  let delta = (targetDayIndex - current + 7) % 7;
  if (delta === 0) delta = 7;
  return addDays(d, delta);
}

function extractPriority(text) {
  const lower = String(text || '').toLowerCase();
  if (/\b(urgent|asap|high priority|priority\s*high|important)\b/.test(lower)) return 'HIGH';
  if (/\b(low priority|whenever|someday|later)\b/.test(lower)) return 'LOW';
  return 'MEDIUM';
}

function extractDueDate(text) {
  const lower = String(text || '').toLowerCase();
  const now = new Date();

  if (/\btonight\b/.test(lower)) {
    const candidate = setTimeOnDate(now, 19, 0);
    return candidate <= now ? setTimeOnDate(addDays(now, 1), 19, 0) : candidate;
  }

  if (/\btomorrow\b/.test(lower)) {
    return setTimeOnDate(addDays(now, 1), 9, 0);
  }

  if (/\btoday\b/.test(lower)) {
    const candidate = setTimeOnDate(now, 18, 0);
    return candidate <= now ? setTimeOnDate(addDays(now, 1), 18, 0) : candidate;
  }

  const weekdayMatch = lower.match(/\b(?:next|this)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/);
  if (weekdayMatch) {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const targetIndex = days.indexOf(weekdayMatch[1]);
    if (targetIndex >= 0) {
      const candidate = nextWeekday(now, targetIndex);
      return setTimeOnDate(candidate, 9, 0);
    }
  }

  const explicitDateMatch = text.match(/\b(?:on|by|before)\s+([A-Za-z]{3,9}\s+\d{1,2}(?:,\s*\d{4})?|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\b/i);
  if (explicitDateMatch) {
    const parsed = new Date(explicitDateMatch[1]);
    if (!Number.isNaN(parsed.getTime())) {
      return setTimeOnDate(parsed, 9, 0);
    }
  }

  return null;
}

function extractFallbackTitle(text) {
  const original = normalizeWhitespace(text);
  if (!original) return 'Untitled task';

  let title = original;
  title = title.replace(/^(please\s+)?(remind me to|create (?:a )?task to|add (?:a )?task to|make sure to|schedule to|task:)\s+/i, '');
  title = title.replace(/\b(high|medium|low)\s+priority\b/ig, '');
  title = title.replace(/\b(priority\s*(?:is|:)?\s*)(high|medium|low)\b/ig, '');
  title = title.replace(/\b(?:today|tomorrow|tonight|next\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b/ig, '');
  title = title.replace(/\b(?:by|before|due|on)\s+.+$/i, '');
  title = normalizeWhitespace(title).replace(/^[,:\-\s]+|[,:\-\s]+$/g, '');

  if (!title || title.length < 3) {
    title = original;
  }

  return titleCase(title);
}

function fallbackParseTaskFromText(text) {
  const dueDate = extractDueDate(text);
  return {
    title: extractFallbackTitle(text),
    description: normalizeWhitespace(text),
    dueDate: dueDate ? dueDate.toISOString() : null,
    priority: extractPriority(text),
  };
}

function fallbackSuggestSubtasks(title, description) {
  const safeTitle = normalizeWhitespace(title) || 'this task';
  const detail = normalizeWhitespace(description);

  return [
    `Clarify what success looks like for ${safeTitle.toLowerCase()}.`,
    detail
      ? `Break down the key step hidden in "${detail.slice(0, 80)}${detail.length > 80 ? '...' : ''}".`
      : `Identify the next concrete step for ${safeTitle.toLowerCase()}.`,
    `Finish ${safeTitle.toLowerCase()} and verify the result.`,
  ];
}

function fallbackGenerateDailySummary(tasks) {
  const activeTasks = Array.isArray(tasks) ? tasks : [];
  const overdue = activeTasks.filter(task => task.dueDate && new Date(task.dueDate) < new Date());
  const highPriority = activeTasks.filter(task => task.priority === 'HIGH');
  const soon = activeTasks
    .filter(task => task.dueDate && new Date(task.dueDate) >= new Date())
    .slice(0, 3);

  const intro = activeTasks.length
    ? `You have ${activeTasks.length} active task${activeTasks.length === 1 ? '' : 's'} right now.`
    : 'You have no active tasks at the moment.';

  const focusLine = overdue.length
    ? `${overdue.length} task${overdue.length === 1 ? '' : 's'} are overdue, so prioritize those first.`
    : highPriority.length
      ? `${highPriority.length} high-priority task${highPriority.length === 1 ? '' : 's'} deserve attention next.`
      : 'Your workload looks balanced, so keep moving through the next visible task.';

  const nextUpLine = soon.length
    ? `Next up: ${soon.map(task => task.title).join(', ')}.`
    : 'No imminent due dates are queued up.';

  return `${intro} ${focusLine} ${nextUpLine}`;
}

function fallbackParseWorkflowFromText(text) {
  const lower = String(text || '').toLowerCase();

  let triggerType = 'TASK_CREATED';
  if (lower.includes('completed') || lower.includes('done')) {
    triggerType = 'TASK_COMPLETED';
  } else if (lower.includes('overdue')) {
    triggerType = 'TASK_OVERDUE';
  } else if (lower.includes('priority')) {
    triggerType = 'PRIORITY_CHANGED';
  }

  let actionType = 'CREATE_TASK';
  if (lower.includes('email') || lower.includes('summary')) {
    actionType = 'SEND_SUMMARY_EMAIL';
  } else if (lower.includes('mark') || lower.includes('status')) {
    actionType = 'MARK_STATUS';
  } else if (lower.includes('priority')) {
    actionType = 'SET_PRIORITY';
  }

  const actionConfig = actionType === 'SET_PRIORITY'
    ? { priority: lower.includes('high') ? 'HIGH' : lower.includes('low') ? 'LOW' : 'MEDIUM' }
    : actionType === 'MARK_STATUS'
      ? { status: lower.includes('done') ? 'DONE' : 'IN_PROGRESS' }
      : actionType === 'CREATE_TASK'
        ? { title: extractFallbackTitle(text) }
        : {};

  return {
    triggerType,
    triggerCondition: {},
    actionType,
    actionConfig,
  };
}

function formatTaskListResponse(tasks) {
  if (!tasks.length) {
    return 'You do not have any tasks yet.';
  }

  return tasks
    .map(task => {
      const status = task.status ? task.status.replace('_', ' ') : 'UNKNOWN';
      return `${task.id}. ${task.title} [${status}]`;
    })
    .join('\n');
}

function isCreateIntent(message) {
  const lower = String(message || '').toLowerCase();
  return /\b(add|create|remind|schedule|buy|call|email|write|prepare|plan|book|send|finish|complete|review|update)\b/.test(lower);
}

function isListIntent(message) {
  const lower = String(message || '').toLowerCase();
  return /\b(list|show|what(?:'s| is) left|my tasks|all tasks|tasks)\b/.test(lower);
}

function isCompleteIntent(message) {
  const lower = String(message || '').toLowerCase();
  return /\b(complete|mark done|done|finish)\b/.test(lower);
}

function isDeleteIntent(message) {
  const lower = String(message || '').toLowerCase();
  return /\b(delete|remove)\b/.test(lower);
}

function extractTaskId(message) {
  const match = String(message || '').match(/\b(?:task\s*)?#?(\d+)\b/);
  return match ? parseInt(match[1], 10) : null;
}

async function runWithFallback(operationName, geminiOperation, fallbackOperation) {
  const apiKey = getApiKey();
  if (!apiKey) {
    logDemoModeOnce();
    return fallbackOperation();
  }

  try {
    return await retryWithBackoff(geminiOperation);
  } catch (error) {
    console.warn(`[GenAI] ${operationName} failed, switching to fallback mode: ${error.message}`);
    logDemoModeOnce();
    return fallbackOperation(error);
  }
}

/**
 * Uses Gemini to parse a natural-language task instruction.
 * Returns structured task fields.
 */
async function parseTaskFromText(text) {
  return runWithFallback(
    'parseTaskFromText',
    async () => {
    const genAI = getGenAI();
    if (!genAI) {
      throw new GenAiServiceError('Gemini is unavailable.');
    }
    // Use gemini-1.5-flash as default, or configure via env
    const modelName = getCurrentModelName();
    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            title: { type: SchemaType.STRING, description: 'Short summary or title of the task' },
            description: { type: SchemaType.STRING, description: 'Details or explanation of the task' },
            dueDate: { type: SchemaType.STRING, description: 'ISO 8601 formatted date-time string (e.g. 2026-07-20T18:00:00Z) representing when the task is due, or null if no due date is mentioned. Assume current date-time is ' + new Date().toISOString() },
            priority: { type: SchemaType.STRING, enum: ['LOW', 'MEDIUM', 'HIGH'], description: 'Priority level of the task based on content, defaulting to MEDIUM if unclear' }
          },
          required: ['title', 'priority']
        }
      }
    });

    const prompt = `Parse the following task instruction into structured JSON. Extrapolate relative dates (like "Friday 6pm" or "tomorrow") using the current time context.
Instruction: "${text}"`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    
    try {
      return JSON.parse(responseText);
    } catch (parseError) {
      throw new GenAiServiceError('Failed to parse Gemini JSON response.', parseError);
    }
  },
    () => fallbackParseTaskFromText(text)
  );
}

/**
 * Uses Gemini to generate 3-5 subtask suggestions for a given task.
 */
async function suggestSubtasks(title, description) {
  return runWithFallback(
    'suggestSubtasks',
    async () => {
    const genAI = getGenAI();
    if (!genAI) {
      throw new GenAiServiceError('Gemini is unavailable.');
    }
    const modelName = getCurrentModelName();
    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              title: { type: SchemaType.STRING, description: 'Short, actionable subtask title' }
            },
            required: ['title']
          }
        }
      }
    });

    const prompt = `Generate 3 to 5 clear, actionable subtasks for the following parent task:
Title: "${title}"
Description: "${description || 'No description provided'}"`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    try {
      const parsed = JSON.parse(responseText);
      return parsed.map(item => item.title);
    } catch (parseError) {
      throw new GenAiServiceError('Failed to parse Gemini subtasks response.', parseError);
    }
  },
    () => fallbackSuggestSubtasks(title, description)
  );
}

/**
 * Uses Gemini to generate a daily or weekly executive summary of tasks.
 */
async function generateDailySummary(tasks) {
  return runWithFallback(
    'generateDailySummary',
    async () => {
    const genAI = getGenAI();
    if (!genAI) {
      throw new GenAiServiceError('Gemini is unavailable.');
    }
    const modelName = getCurrentModelName();
    const model = genAI.getGenerativeModel({ model: modelName });

    const taskListText = tasks.map(t => {
      const dueStr = t.dueDate ? `due ${new Date(t.dueDate).toLocaleDateString()}` : 'no due date';
      return `- [${t.status}] ${t.title} (${t.priority} priority, ${dueStr})`;
    }).join('\n');

    const prompt = `You are a helpful personal productivity assistant. Below is the list of tasks current in the user's workload.
Generate a concise, professional, and encouraging daily briefing (1-2 short paragraphs).
Prioritize overdue, high-priority, or today's tasks, and outline a recommended order of focus.

Tasks:
${taskListText || 'No current tasks. Invite the user to add some!'}

Briefing:`;

    const result = await model.generateContent(prompt);
    return result.response.text();
  },
    () => fallbackGenerateDailySummary(tasks)
  );
}

/**
 * Uses Gemini to parse a workflow description into triggers and actions.
 */
async function parseWorkflowFromText(text) {
  return runWithFallback(
    'parseWorkflowFromText',
    async () => {
    const genAI = getGenAI();
    if (!genAI) {
      throw new GenAiServiceError('Gemini is unavailable.');
    }
    const modelName = getCurrentModelName();
    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            triggerType: { 
              type: SchemaType.STRING, 
              enum: ['TASK_OVERDUE', 'TASK_COMPLETED', 'TASK_CREATED', 'PRIORITY_CHANGED'], 
              description: 'The event type that triggers the workflow' 
            },
            triggerCondition: {
              type: SchemaType.OBJECT,
              description: 'JSON object describing conditions. E.g. for TASK_OVERDUE, it could be empty or have parameters like threshold days. For PRIORITY_CHANGED, custom old/new values.'
            },
            actionType: { 
              type: SchemaType.STRING, 
              enum: ['SET_PRIORITY', 'MARK_STATUS', 'CREATE_TASK', 'SEND_SUMMARY_EMAIL'], 
              description: 'The automated action to perform when trigger conditions are met' 
            },
            actionConfig: {
              type: SchemaType.OBJECT,
              description: 'JSON object specifying parameters for the action. E.g. for SET_PRIORITY, config is { "priority": "HIGH" }. For MARK_STATUS, { "status": "DONE" }.'
            }
          },
          required: ['triggerType', 'triggerCondition', 'actionType', 'actionConfig']
        }
      }
    });

    const prompt = `Parse the following automation request into a structured trigger and action workflow.
Request: "${text}"`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    try {
      return JSON.parse(responseText);
    } catch (parseError) {
      throw new GenAiServiceError('Failed to parse Gemini workflow response.', parseError);
    }
  },
    () => fallbackParseWorkflowFromText(text)
  );
}

/**
 * Handles tool execution based on function calls from Gemini.
 */
async function handleToolCall(name, args, userId) {
  console.log(`[Assistant Tool] executing function "${name}" for user ${userId} with args:`, args);
  // Import scheduler service dynamically to avoid circular references
  const { executeEventWorkflows } = require('./scheduler.service');

  try {
    switch (name) {
      case 'listTasks': {
        const { status, priority, due } = args;
        const where = { userId };
        if (status) where.status = status;
        if (priority) where.priority = priority;

        const now = new Date();
        if (due === 'overdue') {
          where.dueDate = { lt: now };
          where.status = { not: 'DONE' };
        } else if (due === 'today') {
          const startOfToday = new Date();
          startOfToday.setHours(0, 0, 0, 0);
          const endOfToday = new Date();
          endOfToday.setHours(23, 59, 59, 999);
          where.dueDate = { gte: startOfToday, lte: endOfToday };
        } else if (due === 'upcoming') {
          where.dueDate = { gt: now };
        }

        const tasks = await prisma.task.findMany({
          where,
          orderBy: { dueDate: 'asc' },
        });

        // Map tasks for easy LLM parsing
        return { 
          tasks: tasks.map(t => ({
            id: t.id,
            title: t.title,
            description: t.description,
            dueDate: t.dueDate ? t.dueDate.toISOString() : null,
            priority: t.priority,
            status: t.status,
            aiGenerated: t.aiGenerated,
            createdAt: t.createdAt.toISOString()
          }))
        };
      }

      case 'createTask': {
        const { title, description, dueDate, priority } = args;
        const task = await prisma.task.create({
          data: {
            userId,
            title,
            description: description || '',
            dueDate: dueDate ? new Date(dueDate) : null,
            priority: priority || 'MEDIUM',
            status: 'TODO',
            aiGenerated: true,
          },
        });

        // Trigger reactive workflows
        executeEventWorkflows(userId, 'TASK_CREATED', task);

        return { 
          success: true, 
          task: {
            id: task.id,
            title: task.title,
            priority: task.priority,
            status: task.status,
            dueDate: task.dueDate
          }
        };
      }

      case 'updateTask': {
        const { id, title, description, dueDate, priority, status } = args;
        const taskId = parseInt(id, 10);
        if (isNaN(taskId)) {
          return { error: 'Invalid task ID.' };
        }

        const existingTask = await prisma.task.findFirst({
          where: { id: taskId, userId },
        });

        if (!existingTask) {
          return { error: `Task with ID ${taskId} not found or access denied.` };
        }

        const updatedData = {};
        if (title !== undefined) updatedData.title = title;
        if (description !== undefined) updatedData.description = description;
        if (dueDate !== undefined) updatedData.dueDate = dueDate ? new Date(dueDate) : null;
        if (priority !== undefined) updatedData.priority = priority;
        if (status !== undefined) updatedData.status = status;

        const task = await prisma.task.update({
          where: { id: taskId },
          data: updatedData,
        });

        // Trigger reactive workflows
        if (updatedData.status === 'DONE' && existingTask.status !== 'DONE') {
          executeEventWorkflows(userId, 'TASK_COMPLETED', task);
        }
        if (updatedData.priority && updatedData.priority !== existingTask.priority) {
          executeEventWorkflows(userId, 'PRIORITY_CHANGED', task);
        }

        return { 
          success: true, 
          task: {
            id: task.id,
            title: task.title,
            priority: task.priority,
            status: task.status,
            dueDate: task.dueDate
          }
        };
      }

      case 'deleteTask': {
        const { id } = args;
        const taskId = parseInt(id, 10);
        if (isNaN(taskId)) {
          return { error: 'Invalid task ID.' };
        }

        const existingTask = await prisma.task.findFirst({
          where: { id: taskId, userId },
        });

        if (!existingTask) {
          return { error: `Task with ID ${taskId} not found or access denied.` };
        }

        await prisma.task.delete({
          where: { id: taskId },
        });

        return { success: true, message: 'Task deleted successfully.' };
      }

      default:
        return { error: `Unknown function: ${name}` };
    }
  } catch (error) {
    console.error(`Tool call error inside "${name}":`, error);
    return { error: `Database or internal error while executing "${name}": ${error.message}` };
  }
}

/**
 * Runs a multi-turn chat with Gemini, supporting tool use for tasks.
 */
async function executeChatWithTools(userId, messageHistory, userMessage) {
  return runWithFallback(
    'executeChatWithTools',
    async () => {
    const genAI = getGenAI();
    if (!genAI) {
      throw new GenAiServiceError('Gemini is unavailable.');
    }
    const modelName = getCurrentModelName();

    // Tool declarations
    const taskTools = {
      functionDeclarations: [
        {
          name: 'listTasks',
          description: 'List tasks for the current user. Supports filtering by status, priority, or due date status (overdue, today, upcoming).',
          parameters: {
            type: SchemaType.OBJECT,
            properties: {
              status: { type: SchemaType.STRING, enum: ['TODO', 'IN_PROGRESS', 'DONE'], description: 'Filter by status' },
              priority: { type: SchemaType.STRING, enum: ['LOW', 'MEDIUM', 'HIGH'], description: 'Filter by priority' },
              due: { type: SchemaType.STRING, enum: ['overdue', 'today', 'upcoming'], description: 'Filter by due date status' }
            }
          }
        },
        {
          name: 'createTask',
          description: 'Create a new task for the user.',
          parameters: {
            type: SchemaType.OBJECT,
            properties: {
              title: { type: SchemaType.STRING, description: 'Title of the task' },
              description: { type: SchemaType.STRING, description: 'Optional detailed description' },
              dueDate: { type: SchemaType.STRING, description: 'Optional ISO date-time string for when the task is due. Always compute relative dates using current date context.' },
              priority: { type: SchemaType.STRING, enum: ['LOW', 'MEDIUM', 'HIGH'], description: 'Priority level (default: MEDIUM)' }
            },
            required: ['title']
          }
        },
        {
          name: 'updateTask',
          description: 'Update an existing task by its numeric ID. Can update title, description, status, priority, or due date. Use status DONE to complete a task.',
          parameters: {
            type: SchemaType.OBJECT,
            properties: {
              id: { type: SchemaType.NUMBER, description: 'The numeric ID of the task to update' },
              title: { type: SchemaType.STRING, description: 'New title of the task' },
              description: { type: SchemaType.STRING, description: 'New description' },
              dueDate: { type: SchemaType.STRING, description: 'New ISO date-time string' },
              priority: { type: SchemaType.STRING, enum: ['LOW', 'MEDIUM', 'HIGH'], description: 'New priority level' },
              status: { type: SchemaType.STRING, enum: ['TODO', 'IN_PROGRESS', 'DONE'], description: 'New status' }
            },
            required: ['id']
          }
        },
        {
          name: 'deleteTask',
          description: 'Delete a task by its numeric ID.',
          parameters: {
            type: SchemaType.OBJECT,
            properties: {
              id: { type: SchemaType.NUMBER, description: 'The numeric ID of the task to delete' }
            },
            required: ['id']
          }
        }
      ]
    };

    const model = genAI.getGenerativeModel({
      model: modelName,
      tools: [taskTools],
      systemInstruction: 'You are a premium, intelligent personal productivity assistant. You have function-calling access to the task API. ' +
        'Help the user manage their tasks. Make task updates and listings directly. ' +
        'Assume current date-time is ' + new Date().toISOString() + '. Respond politely, concisely, and confirm what actions you performed using tools.'
    });

    // Format message history for Gemini (filtering and renaming roles)
    let formattedHistory = messageHistory
      .filter(msg => msg.role === 'user' || msg.role === 'assistant')
      .map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      }));

    // Google API constraint: first message in chat history must have role 'user'
    if (formattedHistory.length > 0 && formattedHistory[0].role === 'model') {
      formattedHistory.unshift({
        role: 'user',
        parts: [{ text: 'Hello' }]
      });
    }

    // Start Gemini Chat session
    const chat = model.startChat({
      history: formattedHistory,
    });

    // Send the user message
    let result = await chat.sendMessage(userMessage);
    let responseText = '';
    
    // Check if Gemini requested any function call
    let functionCalls = result.response.functionCalls;
    
    while (functionCalls && functionCalls.length > 0) {
      const call = functionCalls[0];
      const { name, args } = call;
      
      // Execute the database/system operation
      const toolOutput = await handleToolCall(name, args, userId);
      
      // Feed the tool output back into the Gemini chat session
      result = await chat.sendMessage([{
        functionResponse: {
          name,
          response: toolOutput
        }
      }]);
      
      // Check for further function calls (chaining)
      functionCalls = result.response.functionCalls;
    }

    // Get the final text response from the model
    responseText = result.response.text();
    return responseText;
  },
    async () => {
      const message = normalizeWhitespace(userMessage);
      const lower = message.toLowerCase();

      if (isListIntent(message)) {
        const listResult = await handleToolCall('listTasks', {}, userId);
        return formatTaskListResponse(listResult.tasks || []);
      }

      const taskId = extractTaskId(message);

      if (isCompleteIntent(message) && taskId !== null) {
        const updateResult = await handleToolCall('updateTask', { id: taskId, status: 'DONE' }, userId);
        if (updateResult.error) return updateResult.error;
        return `Marked task ${taskId} as done.`;
      }

      if (isDeleteIntent(message) && taskId !== null) {
        const deleteResult = await handleToolCall('deleteTask', { id: taskId }, userId);
        if (deleteResult.error) return deleteResult.error;
        return `Deleted task ${taskId}.`;
      }

      if (isCreateIntent(message)) {
        const parsedTask = fallbackParseTaskFromText(message);
        const createResult = await handleToolCall('createTask', parsedTask, userId);
        if (createResult.error) return createResult.error;
        return `Created task "${createResult.task.title}".`;
      }

      if (lower.includes('help') || lower === 'hi' || lower === 'hello') {
        return 'Gemini is unavailable right now, but I can still help with simple task actions. Try "buy milk", "list tasks", or "complete task 3".';
      }

      return 'Gemini is unavailable right now. Try a task command like "buy milk", "list tasks", or "complete task 3".';
    }
  );
}

/**
 * Summarizes a meeting transcript, extracting a summary and structured action items.
 */
async function summarizeMeeting(title, rawTranscript) {
  return runWithFallback(
    'summarizeMeeting',
    async () => {
      const genAI = getGenAI();
      if (!genAI) throw new GenAiServiceError('Gemini is unavailable.');

      const modelName = getCurrentModelName();
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: SchemaType.OBJECT,
            properties: {
              summary: { type: SchemaType.STRING, description: 'A concise summary of the meeting (2-4 sentences)' },
              actionItems: {
                type: SchemaType.ARRAY,
                items: {
                  type: SchemaType.OBJECT,
                  properties: {
                    text: { type: SchemaType.STRING, description: 'The action item description' },
                    suggestedAssignee: { type: SchemaType.STRING, description: 'Name or email of the person responsible, or empty if unclear' },
                    dueDate: { type: SchemaType.STRING, description: 'Suggested due date in ISO 8601 format, or null if not mentioned' },
                  },
                  required: ['text'],
                },
              },
            },
            required: ['summary', 'actionItems'],
          },
        },
      });

      const prompt = `Analyze the following meeting transcript titled "${title}". 
Extract a concise summary (2-4 sentences) and a list of action items. 
For each action item, identify the responsible person (if mentioned) and any due dates.
Current date-time context: ${new Date().toISOString()}

Transcript:
${rawTranscript}`;

      const result = await model.generateContent(prompt);
      const responseText = result.response.text();

      try {
        return JSON.parse(responseText);
      } catch (parseError) {
        throw new GenAiServiceError('Failed to parse Gemini meeting summary response.', parseError);
      }
    },
    () => {
      // Fallback: simple extraction
      const sentences = rawTranscript.split(/[.!?]+/).filter(s => s.trim().length > 10);
      const summary = sentences.slice(0, 3).join('. ').trim() + '.';
      const actionItems = sentences
        .filter(s => /\b(need|should|will|must|todo|action|task)\b/i.test(s))
        .slice(0, 5)
        .map(s => ({ text: s.trim(), suggestedAssignee: '', dueDate: null }));

      if (actionItems.length === 0) {
        actionItems.push({ text: `Review meeting notes from "${title}"`, suggestedAssignee: '', dueDate: null });
      }

      return { summary, actionItems };
    }
  );
}

/**
 * Summarizes a document's extracted text, chunking if necessary.
 * Returns { summary, keyPoints: string[] }.
 */
async function summarizeDocument(fileName, extractedText) {
  const CHUNK_SIZE = 20000;

  return runWithFallback(
    'summarizeDocument',
    async () => {
      const genAI = getGenAI();
      if (!genAI) throw new GenAiServiceError('Gemini is unavailable.');

      const modelName = getCurrentModelName();

      // If text is short enough, summarize in one shot
      if (extractedText.length <= CHUNK_SIZE) {
        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: SchemaType.OBJECT,
              properties: {
                summary: { type: SchemaType.STRING, description: 'A concise summary of the document (3-5 sentences)' },
                keyPoints: {
                  type: SchemaType.ARRAY,
                  items: { type: SchemaType.STRING },
                  description: '3-5 key takeaways or important points from the document',
                },
              },
              required: ['summary', 'keyPoints'],
            },
          },
        });

        const prompt = `Summarize the following document titled "${fileName}". Provide a concise summary (3-5 sentences) and 3-5 key points.

Document content:
${extractedText}`;

        const result = await model.generateContent(prompt);
        return JSON.parse(result.response.text());
      }

      // Chunk the text and summarize each chunk, then combine
      const chunks = [];
      for (let i = 0; i < extractedText.length; i += CHUNK_SIZE) {
        chunks.push(extractedText.slice(i, i + CHUNK_SIZE));
      }

      const model = genAI.getGenerativeModel({ model: modelName });
      const chunkSummaries = [];

      for (let i = 0; i < chunks.length; i++) {
        const chunkPrompt = `Summarize this section (part ${i + 1} of ${chunks.length}) of the document "${fileName}" in 2-3 sentences:\n\n${chunks[i]}`;
        const result = await model.generateContent(chunkPrompt);
        chunkSummaries.push(result.response.text());
      }

      // Combine chunk summaries into a final summary
      const combinedModel = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: SchemaType.OBJECT,
            properties: {
              summary: { type: SchemaType.STRING, description: 'Final combined summary of the entire document (3-5 sentences)' },
              keyPoints: {
                type: SchemaType.ARRAY,
                items: { type: SchemaType.STRING },
                description: '3-5 key takeaways from the entire document',
              },
            },
            required: ['summary', 'keyPoints'],
          },
        },
      });

      const combinePrompt = `The following are summaries of different sections of the document "${fileName}". Combine them into a single cohesive summary (3-5 sentences) and extract 3-5 key points.

Section summaries:
${chunkSummaries.map((s, i) => `Part ${i + 1}: ${s}`).join('\n\n')}`;

      const finalResult = await combinedModel.generateContent(combinePrompt);
      return JSON.parse(finalResult.response.text());
    },
    () => {
      // Fallback: simple extraction
      const sentences = extractedText.split(/[.!?]+/).filter(s => s.trim().length > 15);
      const summary = sentences.slice(0, 4).join('. ').trim() + '.';
      const keyPoints = sentences.slice(0, 5).map(s => s.trim());

      return { summary, keyPoints };
    }
  );
}

/**
 * Generates an email (subject + body) based on a short user prompt.
 */
async function generateEmail(promptText) {
  return runWithFallback(
    'generateEmail',
    async () => {
      const genAI = getGenAI();
      if (!genAI) throw new GenAiServiceError('Gemini is unavailable.');

      const modelName = getCurrentModelName();
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: SchemaType.OBJECT,
            properties: {
              subject: { type: SchemaType.STRING, description: 'Descriptive subject line for the email' },
              body: { type: SchemaType.STRING, description: 'The complete email body' },
            },
            required: ['subject', 'body'],
          },
        },
      });

      const prompt = `Write a high-quality email based on the following instruction: "${promptText}".`;

      const result = await model.generateContent(prompt);
      return JSON.parse(result.response.text());
    },
    () => {
      return {
        subject: `Follow up: ${promptText.slice(0, 30)}...`,
        body: `Hi Team,\n\nRegarding: "${promptText}"\n\nLet's coordinate on this. Please let me know your thoughts.\n\nBest regards,\nUser`,
      };
    }
  );
}

/**
 * Generates general-purpose content (email / social-post / report-snippet / message) based on prompt and type.
 */
async function generateContent(promptText, type) {
  return runWithFallback(
    'generateContent',
    async () => {
      const genAI = getGenAI();
      if (!genAI) throw new GenAiServiceError('Gemini is unavailable.');

      const modelName = getCurrentModelName();
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: SchemaType.OBJECT,
            properties: {
              text: { type: SchemaType.STRING, description: 'The generated content text' },
            },
            required: ['text'],
          },
        },
      });

      const prompt = `Write a high-quality "${type}" based on the following instruction: "${promptText}".`;

      const result = await model.generateContent(prompt);
      return JSON.parse(result.response.text());
    },
    () => {
      return {
        text: `This is a generated "${type}" snippet. Instruction: ${promptText}`,
      };
    }
  );
}

/**
 * Suggests 2-3 free time slots for a task using Gemini based on busy calendar events.
 */
async function suggestTimeSlots(taskTitle, dueDate, existingEvents) {
  return runWithFallback(
    'suggestTimeSlots',
    async () => {
      const genAI = getGenAI();
      if (!genAI) throw new GenAiServiceError('Gemini is unavailable.');

      const modelName = getCurrentModelName();
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                startTime: { type: SchemaType.STRING, description: 'ISO date-time string for slot start' },
                endTime: { type: SchemaType.STRING, description: 'ISO date-time string for slot end' },
                reason: { type: SchemaType.STRING, description: 'Brief reason why this slot was suggested' },
              },
              required: ['startTime', 'endTime', 'reason'],
            },
          },
        },
      });

      const formattedEvents = existingEvents
        .map((e) => `- "${e.title}": ${new Date(e.startTime).toLocaleString()} to ${new Date(e.endTime).toLocaleString()}`)
        .join('\n');

      const prompt = `Analyze the user's calendar and suggest 2-3 open slots (each 1 hour) to work on the task: "${taskTitle}".
Task due date: ${dueDate ? new Date(dueDate).toLocaleString() : 'Not set'}
Current local time is: ${new Date().toISOString()}

Existing busy events:
${formattedEvents || 'No busy slots scheduled.'}

Suggest open slots in the future, avoiding busy times.`;

      const result = await model.generateContent(prompt);
      return JSON.parse(result.response.text());
    },
    () => {
      // Fallback: 2 hour-long slots tomorrow morning
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const slot1Start = new Date(tomorrow);
      slot1Start.setHours(9, 0, 0, 0);
      const slot1End = new Date(tomorrow);
      slot1End.setHours(10, 0, 0, 0);

      const slot2Start = new Date(tomorrow);
      slot2Start.setHours(14, 0, 0, 0);
      const slot2End = new Date(tomorrow);
      slot2End.setHours(15, 0, 0, 0);

      return [
        {
          startTime: slot1Start.toISOString(),
          endTime: slot1End.toISOString(),
          reason: 'Morning slot when you are free.',
        },
        {
          startTime: slot2Start.toISOString(),
          endTime: slot2End.toISOString(),
          reason: 'Afternoon slot after lunch.',
        },
      ];
    }
  );
}

module.exports = {
  GenAiServiceError,
  parseTaskFromText,
  suggestSubtasks,
  generateDailySummary,
  parseWorkflowFromText,
  executeChatWithTools,
  summarizeMeeting,
  summarizeDocument,
  generateEmail,
  generateContent,
  suggestTimeSlots,
};
