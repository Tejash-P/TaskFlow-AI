const prisma = require('../services/prisma.service');

// Returns the last 30 days of productivity metrics for the authenticated user
exports.getMyAnalytics = async (req, res) => {
  try {
    const userId = req.user.userId;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    const metrics = await prisma.productivityMetric.findMany({
      where: {
        userId,
        date: { gte: thirtyDaysAgo },
      },
      orderBy: { date: 'asc' },
    });

    // Summary aggregates
    const totals = metrics.reduce(
      (acc, m) => ({
        tasksCompleted: acc.tasksCompleted + m.tasksCompleted,
        workflowsTriggered: acc.workflowsTriggered + m.workflowsTriggered,
        aiActionsUsed: acc.aiActionsUsed + m.aiActionsUsed,
      }),
      { tasksCompleted: 0, workflowsTriggered: 0, aiActionsUsed: 0 }
    );

    // Count of tasks by status snapshot
    const taskStatusCounts = await prisma.task.groupBy({
      by: ['status'],
      where: { userId },
      _count: { id: true },
    });

    // Count of tasks by priority
    const taskPriorityCounts = await prisma.task.groupBy({
      by: ['priority'],
      where: { userId },
      _count: { id: true },
    });

    // Count of AI-generated tasks
    const aiTaskCount = await prisma.task.count({
      where: { userId, aiGenerated: true },
    });

    // Count of meetings and documents
    const meetingCount = await prisma.meeting.count({ where: { userId } });
    const documentCount = await prisma.document.count({ where: { userId } });

    // Recent AI log activity (last 5)
    const recentAiLogs = await prisma.aiLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { prompt: true, createdAt: true },
    });

    res.status(200).json({
      dailyMetrics: metrics,
      totals,
      taskStatusCounts,
      taskPriorityCounts,
      aiTaskCount,
      meetingCount,
      documentCount,
      recentAiLogs,
    });
  } catch (error) {
    console.error('getMyAnalytics error:', error);
    res.status(500).json({ error: 'An error occurred while fetching analytics.' });
  }
};
