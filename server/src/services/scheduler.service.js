const cron = require('node-cron');
const prisma = require('./prisma.service');
const analyticsService = require('./analytics.service');

let cronJob = null;

/**
 * Initializes the cron scheduler for background workflows.
 */
function initScheduler() {
  if (cronJob) return;

  console.log('Initializing Workflow Scheduler (cron)...');
  
  // Evaluates overdue workflows every minute
  cronJob = cron.schedule('*/1 * * * *', async () => {
    console.log('Running background workflow evaluation...');
    try {
      await evaluateTimeBasedWorkflows();
    } catch (error) {
      console.error('Error during scheduled workflow evaluation:', error);
    }
  });
}

/**
 * Evaluates active workflows configured for TASK_OVERDUE.
 */
async function evaluateTimeBasedWorkflows() {
  const now = new Date();

  const activeWorkflows = await prisma.workflow.findMany({
    where: {
      isActive: true,
      triggerType: 'TASK_OVERDUE',
    },
  });

  for (const workflow of activeWorkflows) {
    try {
      // Find overdue tasks for this user (dueDate in the past and not completed)
      const overdueTasks = await prisma.task.findMany({
        where: {
          userId: workflow.userId,
          status: { not: 'DONE' },
          dueDate: { lt: now },
        },
      });

      for (const task of overdueTasks) {
        await executeWorkflowAction(workflow, task);
      }
    } catch (error) {
      console.error(`Error processing workflow ID ${workflow.id}:`, error);
    }
  }
}

/**
 * Executes the configured action of a workflow against a triggering task.
 */
async function executeWorkflowAction(workflow, triggeringTask) {
  const { actionType, actionConfig, userId } = workflow;

  try {
    if (actionType === 'SET_PRIORITY') {
      const targetPriority = actionConfig.priority;
      if (triggeringTask.priority !== targetPriority) {
        console.log(`[Workflow ${workflow.id}] Updating task ${triggeringTask.id} priority to ${targetPriority}`);
        await prisma.task.update({
          where: { id: triggeringTask.id },
          data: { priority: targetPriority },
        });

        // Log AI/Automation interaction
        await prisma.aiLog.create({
          data: {
            userId,
            prompt: `Workflow Automation [${workflow.triggerType} -> ID ${workflow.id}] -> SET_PRIORITY(${targetPriority})`,
            response: `Updated task "${triggeringTask.title}" (ID: ${triggeringTask.id}) priority to ${targetPriority}.`,
          },
        });
      }
    } else if (actionType === 'MARK_STATUS') {
      const targetStatus = actionConfig.status;
      if (triggeringTask.status !== targetStatus) {
        console.log(`[Workflow ${workflow.id}] Updating task ${triggeringTask.id} status to ${targetStatus}`);
        await prisma.task.update({
          where: { id: triggeringTask.id },
          data: { status: targetStatus },
        });

        // Log AI/Automation interaction
        await prisma.aiLog.create({
          data: {
            userId,
            prompt: `Workflow Automation [${workflow.triggerType} -> ID ${workflow.id}] -> MARK_STATUS(${targetStatus})`,
            response: `Updated task "${triggeringTask.title}" (ID: ${triggeringTask.id}) status to ${targetStatus}.`,
          },
        });
      }
    } else if (actionType === 'CREATE_TASK') {
      // Deduplicate: avoid creating the exact same active task repeatedly for the same triggering task
      const targetTitle = actionConfig.title || `Follow up: ${triggeringTask.title}`;
      const exists = await prisma.task.findFirst({
        where: {
          userId,
          title: targetTitle,
          status: { not: 'DONE' },
        },
      });

      if (!exists) {
        console.log(`[Workflow ${workflow.id}] Creating task "${targetTitle}"`);
        await prisma.task.create({
          data: {
            userId,
            title: targetTitle,
            description: actionConfig.description || `Auto-generated follow up for: ${triggeringTask.title}`,
            dueDate: actionConfig.dueDateDays ? new Date(Date.now() + actionConfig.dueDateDays * 86400000) : null,
            priority: actionConfig.priority || 'MEDIUM',
            status: 'TODO',
            aiGenerated: true,
          },
        });

        // Log AI/Automation interaction
        await prisma.aiLog.create({
          data: {
            userId,
            prompt: `Workflow Automation [${workflow.triggerType} -> ID ${workflow.id}] -> CREATE_TASK("${targetTitle}")`,
            response: `Created new task "${targetTitle}" as follow up.`,
          },
        });
      }
    }
  } catch (err) {
    console.error(`Failed to execute action for workflow ID ${workflow.id}:`, err);
  }
}

/**
 * Evaluates active event-driven workflows reactively.
 * Called from task controllers when state transitions occur.
 */
async function executeEventWorkflows(userId, eventType, task) {
  try {
    const workflows = await prisma.workflow.findMany({
      where: {
        userId,
        isActive: true,
        triggerType: eventType,
      },
    });

    for (const workflow of workflows) {
      console.log(`Evaluating event workflow ID ${workflow.id} for event ${eventType}`);
      await executeWorkflowAction(workflow, task);
      analyticsService.trackWorkflowTriggered(userId);
    }
  } catch (error) {
    console.error(`Error executing event workflows for event ${eventType}:`, error);
  }
}

module.exports = {
  initScheduler,
  executeEventWorkflows,
};
