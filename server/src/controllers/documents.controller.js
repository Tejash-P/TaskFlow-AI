const path = require('path');
const fs = require('fs');
const multer = require('multer');
const prisma = require('../services/prisma.service');
const genaiService = require('../services/genai.service');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
  ];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only PDF, DOCX, and TXT files are allowed.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
});

// Export multer middleware for use in routes
exports.uploadMiddleware = upload.single('file');

// Extract text from an uploaded file based on its type
async function extractText(filePath, mimetype) {
  if (mimetype === 'text/plain') {
    return fs.readFileSync(filePath, 'utf-8');
  }

  if (mimetype === 'application/pdf') {
    const pdfParse = require('pdf-parse');
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdfParse(dataBuffer);
    return data.text;
  }

  if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const mammoth = require('mammoth');
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
  }

  throw new Error(`Unsupported file type: ${mimetype}`);
}

// Upload a document and extract text
exports.uploadDocument = async (req, res) => {
  try {
    const userId = req.user.userId;

    if (!req.file) {
      return res.status(400).json({ error: 'No file was uploaded.' });
    }

    const { organizationId } = req.body;
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

    // Extract text from the file
    let extractedTextContent;
    try {
      extractedTextContent = await extractText(req.file.path, req.file.mimetype);
    } catch (extractError) {
      console.error('Text extraction error:', extractError);
      return res.status(400).json({ error: `Failed to extract text from file: ${extractError.message}` });
    }

    if (!extractedTextContent || extractedTextContent.trim().length === 0) {
      return res.status(400).json({ error: 'Could not extract any text from the uploaded file.' });
    }

    const document = await prisma.document.create({
      data: {
        userId,
        fileName: req.file.originalname,
        fileUrl: `/uploads/${req.file.filename}`,
        extractedText: extractedTextContent,
        organizationId: parsedOrgId,
      },
    });

    res.status(201).json(document);
  } catch (error) {
    console.error('uploadDocument error:', error);
    res.status(500).json({ error: 'An error occurred while uploading the document.' });
  }
};

// List all documents for the current user (or org)
exports.getDocuments = async (req, res) => {
  try {
    const userId = req.user.userId;

    const memberships = await prisma.membership.findMany({
      where: { userId },
      select: { organizationId: true },
    });
    const orgIds = memberships.map((m) => m.organizationId);

    const documents = await prisma.document.findMany({
      where: {
        OR: [
          { userId },
          { organizationId: { in: orgIds } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        fileName: true,
        fileUrl: true,
        summary: true,
        organizationId: true,
        createdAt: true,
      },
    });

    res.status(200).json(documents);
  } catch (error) {
    console.error('getDocuments error:', error);
    res.status(500).json({ error: 'An error occurred while fetching documents.' });
  }
};

// Summarize a document using Gemini
exports.summarizeDocument = async (req, res) => {
  try {
    const userId = req.user.userId;
    const documentId = parseInt(req.params.id, 10);

    if (isNaN(documentId)) {
      return res.status(400).json({ error: 'Invalid document ID.' });
    }

    const document = await prisma.document.findFirst({
      where: { id: documentId, userId },
    });

    if (!document) {
      return res.status(404).json({ error: 'Document not found or access denied.' });
    }

    // Call Gemini to summarize
    const result = await genaiService.summarizeDocument(document.fileName, document.extractedText);

    // Store the summary (key points are returned to the client but summary field stores the combined text)
    const summaryText = result.summary + '\n\nKey Points:\n' + (result.keyPoints || []).map((kp, i) => `${i + 1}. ${kp}`).join('\n');

    const updated = await prisma.document.update({
      where: { id: documentId },
      data: {
        summary: summaryText,
      },
    });

    // Log the AI interaction (non-blocking)
    prisma.aiLog.create({ data: { userId, prompt: `Summarize document: "${document.fileName}"`, response: JSON.stringify(result) } }).catch(() => {});

    res.status(200).json({
      ...updated,
      keyPoints: result.keyPoints,
      summaryText: result.summary,
    });
  } catch (error) {
    console.error('summarizeDocument error:', error);
    if (error.name === 'GenAiServiceError') {
      return res.status(502).json({ error: error.message });
    }
    res.status(500).json({ error: 'An error occurred while summarizing the document.' });
  }
};
