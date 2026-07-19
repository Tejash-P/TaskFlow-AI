const express = require('express');
const router = express.Router();
const meetingsController = require('../controllers/meetings.controller');
const authMiddleware = require('../middleware/auth.middleware');

// All meeting endpoints are protected
router.use(authMiddleware);

router.post('/', meetingsController.createMeeting);
router.get('/', meetingsController.getMeetings);
router.get('/:id', meetingsController.getMeetingById);
router.post('/:id/summarize', meetingsController.summarizeMeeting);
router.post('/:id/convert-actions', meetingsController.convertActionsToTasks);

module.exports = router;
