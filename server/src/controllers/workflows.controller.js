const prisma = require('../services/prisma.service');
const genaiService = require('../services/genai.service');

// Get all workflows for the authenticated user
exports.getWorkflows = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Get all memberships of current user
    const memberships = await prisma.membership.findMany({
      where: { userId },
      select: { organizationId: true },
    });
    const orgIds = memberships.map((m) => m.organizationId);

    const workflows = await prisma.workflow.findMany({
      where: {
        OR: [
          { userId, organizationId: null },
          { organizationId: { in: orgIds } },
        ],
      },
      orderBy: { id: 'desc' },
    });
    res.status(200).json(workflows);
  } catch (error) {
    console.error('getWorkflows error:', error);
    res.status(500).json({ error: 'An error occurred while fetching workflows.' });
  }
};

// Create a new workflow
exports.createWorkflow = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { triggerType, triggerCondition, actionType, actionConfig, isActive, organizationId } = req.body;

    if (!triggerType || !actionType) {
      return res.status(400).json({ error: 'Trigger type and action type are required.' });
    }

    let parsedOrgId = null;
    if (organizationId) {
      parsedOrgId = parseInt(organizationId, 10);
      // Verify current user is member of the organization
      const membership = await prisma.membership.findFirst({
        where: { userId, organizationId: parsedOrgId },
      });
      if (!membership) {
        return res.status(403).json({ error: 'Access denied. You are not a member of this organization.' });
      }
    }

    const workflow = await prisma.workflow.create({
      data: {
        userId,
        triggerType,
        triggerCondition: triggerCondition || {},
        actionType,
        actionConfig: actionConfig || {},
        isActive: isActive !== undefined ? isActive : true,
        organizationId: parsedOrgId,
      },
    });

    res.status(201).json(workflow);
  } catch (error) {
    console.error('createWorkflow error:', error);
    res.status(500).json({ error: 'An error occurred while creating the workflow.' });
  }
};

// Update an existing workflow
exports.updateWorkflow = async (req, res) => {
  try {
    const userId = req.user.userId;
    const workflowId = parseInt(req.params.id, 10);

    if (isNaN(workflowId)) {
      return res.status(400).json({ error: 'Invalid workflow ID.' });
    }

    // Verify ownership or admin access
    const existingWorkflow = await prisma.workflow.findUnique({
      where: { id: workflowId },
    });

    if (!existingWorkflow) {
      return res.status(404).json({ error: 'Workflow not found.' });
    }

    if (existingWorkflow.organizationId) {
      // Check if user is ADMIN in this organization
      const membership = await prisma.membership.findFirst({
        where: { userId, organizationId: existingWorkflow.organizationId, role: 'ADMIN' },
      });
      if (!membership) {
        return res.status(403).json({ error: 'Access denied. Only organization admins can manage organization workflows.' });
      }
    } else {
      // Check ownership
      if (existingWorkflow.userId !== userId) {
        return res.status(403).json({ error: 'Access denied. You do not own this workflow.' });
      }
    }

    const { triggerType, triggerCondition, actionType, actionConfig, isActive } = req.body;

    const updatedData = {};
    if (triggerType !== undefined) updatedData.triggerType = triggerType;
    if (triggerCondition !== undefined) updatedData.triggerCondition = triggerCondition;
    if (actionType !== undefined) updatedData.actionType = actionType;
    if (actionConfig !== undefined) updatedData.actionConfig = actionConfig;
    if (isActive !== undefined) updatedData.isActive = isActive;

    const workflow = await prisma.workflow.update({
      where: { id: workflowId },
      data: updatedData,
    });

    res.status(200).json(workflow);
  } catch (error) {
    console.error('updateWorkflow error:', error);
    res.status(500).json({ error: 'An error occurred while updating the workflow.' });
  }
};

// Delete a workflow
exports.deleteWorkflow = async (req, res) => {
  try {
    const userId = req.user.userId;
    const workflowId = parseInt(req.params.id, 10);

    if (isNaN(workflowId)) {
      return res.status(400).json({ error: 'Invalid workflow ID.' });
    }

    // Verify ownership or admin access
    const existingWorkflow = await prisma.workflow.findUnique({
      where: { id: workflowId },
    });

    if (!existingWorkflow) {
      return res.status(404).json({ error: 'Workflow not found.' });
    }

    if (existingWorkflow.organizationId) {
      // Check if user is ADMIN in this organization
      const membership = await prisma.membership.findFirst({
        where: { userId, organizationId: existingWorkflow.organizationId, role: 'ADMIN' },
      });
      if (!membership) {
        return res.status(403).json({ error: 'Access denied. Only organization admins can delete organization workflows.' });
      }
    } else {
      // Check ownership
      if (existingWorkflow.userId !== userId) {
        return res.status(403).json({ error: 'Access denied. You do not own this workflow.' });
      }
    }

    await prisma.workflow.delete({
      where: { id: workflowId },
    });

    res.status(200).json({ message: 'Workflow deleted successfully.' });
  } catch (error) {
    console.error('deleteWorkflow error:', error);
    res.status(500).json({ error: 'An error occurred while deleting the workflow.' });
  }
};

// Parse workflow text into structured trigger/action
exports.parseWorkflow = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text description is required.' });
    }

    // Call GenAI service to parse the automation request
    const parsedData = await genaiService.parseWorkflowFromText(text);

    // Log the AI interaction (non-blocking)
    prisma.aiLog.create({ data: { userId, prompt: `Parse workflow: ${text}`, response: JSON.stringify(parsedData) } }).catch(() => {});

    res.status(200).json(parsedData);
  } catch (error) {
    console.error('parseWorkflow error:', error);
    if (error.name === 'GenAiServiceError') {
      return res.status(502).json({ error: error.message });
    }
    res.status(500).json({ error: 'An error occurred while parsing the workflow.' });
  }
};
