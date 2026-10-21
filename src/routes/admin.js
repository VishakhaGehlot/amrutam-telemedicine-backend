const express = require('express');
const { pool } = require('../db/pool');
const { authenticate, allowRoles } = require('../middleware/auth');
const router = express.Router();
router.get('/analytics', authenticate, allowRoles('admin'), async (req, res, next) => {
  try {
    const [total, byStatus, daily] = await Promise.all([
      pool.query('SELECT count(*)::int AS total FROM consultations'),
      pool.query('SELECT status,count(*)::int AS count FROM consultations GROUP BY status ORDER BY status'),
      pool.query(`SELECT date_trunc('day',created_at)::date AS day,count(*)::int AS count
                  FROM consultations WHERE created_at >= now() - interval '30 days'
                  GROUP BY 1 ORDER BY 1`)
    ]);
    res.json({ totalConsultations: total.rows[0].total, byStatus: byStatus.rows, last30Days: daily.rows });
  } catch (err) { next(err); }
});
router.get('/audit-logs', authenticate, allowRoles('admin'), async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit || '50',10) || 50,1),200);
    const result = await pool.query('SELECT id,actor_id,action,resource_type,resource_id,request_id,created_at FROM audit_logs ORDER BY created_at DESC LIMIT $1', [limit]);
    res.json({ data: result.rows });
  } catch (err) { next(err); }
});
router.post('/doctors/:id/verify', authenticate, allowRoles('admin'), async (req, res, next) => {
  try {
    const result = await pool.query('UPDATE doctors SET is_verified=true WHERE user_id=$1 RETURNING user_id,is_verified', [req.params.id]);
    if (!result.rowCount) return res.status(404).json({ error: 'not_found', message: 'Doctor not found', requestId: req.id });
    res.json({ doctor: result.rows[0] });
  } catch (err) { next(err); }
});
module.exports = router;
