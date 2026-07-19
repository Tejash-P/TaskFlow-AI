const express = require('express');
const router = express.Router();
const organizationsController = require('../controllers/organizations.controller');
const authMiddleware = require('../middleware/auth.middleware');

// All organization endpoints are protected
router.use(authMiddleware);

router.post('/', organizationsController.createOrganization);
router.get('/', organizationsController.getOrganizations);
router.get('/:id/members', organizationsController.getOrganizationMembers);
router.post('/:id/invite', organizationsController.inviteMember);
router.delete('/:id/members/:userId', organizationsController.removeMember);

module.exports = router;
