const express = require('express');
const router = express.Router();
const documentsController = require('../controllers/documents.controller');
const authMiddleware = require('../middleware/auth.middleware');

// All document endpoints are protected
router.use(authMiddleware);

// Upload endpoint uses multer middleware
router.post('/', documentsController.uploadMiddleware, documentsController.uploadDocument);
router.get('/', documentsController.getDocuments);
router.post('/:id/summarize', documentsController.summarizeDocument);

module.exports = router;
