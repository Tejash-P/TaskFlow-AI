const express = require('express');
const router = express.Router();
const calendarController = require('../controllers/calendar.controller');
const authMiddleware = require('../middleware/auth.middleware');

// All calendar endpoints are protected
router.use(authMiddleware);

router.get('/', calendarController.getEvents);
router.post('/', calendarController.createEvent);
router.put('/:id', calendarController.updateEvent);
router.delete('/:id', calendarController.deleteEvent);
router.post('/suggest', calendarController.suggestTime);
router.get('/google/connect', calendarController.googleConnect);
router.get('/google/sync', calendarController.googleSync);

module.exports = router;
