const express = require('express');
const router = express.Router();
const tasksController = require('../controllers/tasks.controller');
const authMiddleware = require('../middleware/auth.middleware');

// All task endpoints are protected
router.use(authMiddleware);

// AI Task routes
router.post('/parse', tasksController.parseTask);
router.post('/:id/subtasks', tasksController.getSubtasksSuggestions);

// CRUD Task routes
router.get('/', tasksController.getTasks);
router.get('/:id', tasksController.getTaskById);
router.post('/', tasksController.createTask);
router.put('/:id', tasksController.updateTask);
router.delete('/:id', tasksController.deleteTask);

module.exports = router;
