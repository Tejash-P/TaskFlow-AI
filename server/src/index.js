require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth.routes');
const tasksRoutes = require('./routes/tasks.routes');
const workflowsRoutes = require('./routes/workflows.routes');
const assistantRoutes = require('./routes/assistant.routes');
const organizationsRoutes = require('./routes/organizations.routes');
const meetingsRoutes = require('./routes/meetings.routes');
const documentsRoutes = require('./routes/documents.routes');
const contentRoutes = require('./routes/content.routes');
const calendarRoutes = require('./routes/calendar.routes');
const analyticsRoutes = require('./routes/analytics.routes');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: 'task-flow-ai-rose.vercel.app',
  credentials: true
}));
app.use(express.json());

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/workflows', workflowsRoutes);
app.use('/api/assistant', assistantRoutes);
app.use('/api/organizations', organizationsRoutes);
app.use('/api/meetings', meetingsRoutes);
app.use('/api/documents', documentsRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/analytics', analyticsRoutes);

// Root route
app.get('/', (req, res) => {
  res.status(200).json({
    message: 'TaskFlow AI API is running',
    health: '/health'
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date() });
});

const { initScheduler } = require('./services/scheduler.service');

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong on the server.' });
});

app.listen(PORT, () => {
  console.log(`TaskFlow AI server running on port ${PORT}`);
  initScheduler();
});
