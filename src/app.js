const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { loadConfig } = require('./config');
const { requestId } = require('./middleware/requestId');
const { notFound, errorHandler } = require('./middleware/errors');
const authRoutes = require('./routes/auth');
const doctorRoutes = require('./routes/doctors');
const consultationRoutes = require('./routes/consultations');
const adminRoutes = require('./routes/admin');
const { pool } = require('./db/pool');

const config = loadConfig();
const app = express();
app.disable('x-powered-by');
app.use(requestId);
app.use(helmet());
app.use(cors({ origin: config.corsOrigin.split(',').map(v => v.trim()), credentials: false }));
app.use(express.json({ limit: '1mb', strict: true }));
app.use(rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: 'draft-7', legacyHeaders: false }));
app.get('/health/live', (req, res) => res.json({ status: 'ok', requestId: req.id }));
app.get('/health/ready', async (req, res) => {
  try { await pool.query('SELECT 1'); res.json({ status: 'ready', requestId: req.id }); }
  catch { res.status(503).json({ status: 'not_ready', requestId: req.id }); }
});
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/doctors', doctorRoutes);
app.use('/api/v1/consultations', consultationRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use(notFound);
app.use(errorHandler);
module.exports = { app };
