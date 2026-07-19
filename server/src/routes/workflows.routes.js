const express = require('express');
const router = express.Router();
const workflowsController = require('../controllers/workflows.controller');
const authMiddleware = require('../middleware/auth.middleware');

// Protect all workflows endpoints
router.use(authMiddleware);

// AI parse workflow route
router.post('/parse', workflowsController.parseWorkflow);

// CRUD workflows routes
router.get('/', workflowsController.getWorkflows);
router.post('/', workflowsController.createWorkflow);
router.put('/:id', workflowsController.updateWorkflow);
router.delete('/:id', workflowsController.deleteWorkflow);

module.exports = router;
