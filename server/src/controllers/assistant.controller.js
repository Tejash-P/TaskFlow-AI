const prisma = require('../services/prisma.service');
const genaiService = require('../services/genai.service');

// Fire-and-forget AI log helper — never throws, never blocks the response
function logAiInteraction(userId, prompt, response) {
  prisma.aiLog.create({ data: { userId, prompt, response } }).catch(() => {});
}

exports.getSummary = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Fetch all active/uncompleted tasks for the user
    const tasks = await prisma.task.findMany({
      where: {
        userId,
        status: { not: 'DONE' },
      },
      orderBy: [
        { priority: 'asc' },
        { dueDate: 'asc' },
      ],
    });

    // Call GenAI service to get executive summary
    const summary = await genaiService.generateDailySummary(tasks);

    // Log non-blocking
    logAiInteraction(userId, `Generate daily briefing. Active tasks count: ${tasks.length}`, summary);

    res.status(200).json({ summary });
  } catch (error) {
    console.error('getSummary error:', error);
    if (error.name === 'GenAiServiceError') {
      return res.status(502).json({ error: error.message });
    }
    res.status(500).json({ error: 'An error occurred while generating the daily summary.' });
  }
};

exports.chatAssistant = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { message, history } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required.' });
    }

    // Call GenAI service
    const response = await genaiService.executeChatWithTools(userId, history || [], message);

    // Log non-blocking
    logAiInteraction(userId, `Chat Assistant: ${message}`, response);

    res.status(200).json({ response });
  } catch (error) {
    console.error('chatAssistant error:', error);
    if (error.name === 'GenAiServiceError') {
      return res.status(502).json({ error: error.message });
    }
    res.status(500).json({ error: 'An error occurred during the assistant chat.' });
  }
};
