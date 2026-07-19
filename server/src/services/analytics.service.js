const prisma = require('./prisma.service');

async function trackMetric(userId, field, increment = 1) {
  try {
    // Standardize to UTC midnight date to keep one row per user per day
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await prisma.productivityMetric.upsert({
      where: {
        userId_date: {
          userId,
          date: today,
        },
      },
      update: {
        [field]: { increment },
      },
      create: {
        userId,
        date: today,
        [field]: increment,
      },
    });
  } catch (error) {
    console.error(`Error tracking metric ${field} for user ${userId}:`, error);
  }
}

exports.trackTaskCompleted = (userId) => trackMetric(userId, 'tasksCompleted');
exports.trackWorkflowTriggered = (userId) => trackMetric(userId, 'workflowsTriggered');
exports.trackAiActionUsed = (userId) => trackMetric(userId, 'aiActionsUsed');
