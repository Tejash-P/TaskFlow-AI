const express = require('express');
const router = express.Router();
const contentController = require('../controllers/content.controller');
const authMiddleware = require('../middleware/auth.middleware');

// Protect all content endpoints
router.use(authMiddleware);

router.post('/email', contentController.generateEmail);
router.post('/generate', contentController.generateGeneralContent);

module.exports = router;
