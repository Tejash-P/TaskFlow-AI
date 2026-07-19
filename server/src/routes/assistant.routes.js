const express = require('express');
const router = express.Router();
const assistantController = require('../controllers/assistant.controller');
const authMiddleware = require('../middleware/auth.middleware');

// All assistant endpoints are protected
router.use(authMiddleware);

router.get('/summary', assistantController.getSummary);
router.post('/chat', assistantController.chatAssistant);

module.exports = router;
