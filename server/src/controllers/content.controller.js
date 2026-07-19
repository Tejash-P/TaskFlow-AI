const prisma = require('../services/prisma.service');
const genaiService = require('../services/genai.service');

// Generate email and save in EmailDraft
exports.generateEmail = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required.' });
    }

    const result = await genaiService.generateEmail(prompt);

    // Save in database
    const draft = await prisma.emailDraft.create({
      data: {
        userId,
        prompt,
        generatedSubject: result.subject,
        generatedBody: result.body,
      },
    });

    res.status(201).json(draft);
  } catch (error) {
    console.error('generateEmail error:', error);
    if (error.name === 'GenAiServiceError') {
      return res.status(502).json({ error: error.message });
    }
    res.status(500).json({ error: 'An error occurred while generating the email.' });
  }
};

// General-purpose content generator
exports.generateGeneralContent = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { prompt, type } = req.body;

    if (!prompt || !type) {
      return res.status(400).json({ error: 'Prompt and type are required.' });
    }

    const allowedTypes = ['email', 'social-post', 'report-snippet', 'message'];
    if (!allowedTypes.includes(type)) {
      return res.status(400).json({ error: `Invalid content type. Allowed types: ${allowedTypes.join(', ')}` });
    }

    const result = await genaiService.generateContent(prompt, type);

    // Log the AI interaction (non-blocking)
    prisma.aiLog.create({ data: { userId, prompt: `Generate ${type} content: ${prompt.slice(0, 100)}`, response: JSON.stringify(result) } }).catch(() => {});

    res.status(200).json(result);
  } catch (error) {
    console.error('generateGeneralContent error:', error);
    if (error.name === 'GenAiServiceError') {
      return res.status(502).json({ error: error.message });
    }
    res.status(500).json({ error: 'An error occurred while generating content.' });
  }
};
