const express = require('express');
const { z } = require('zod');
const { pool } = require('../db/pool');
const { authenticate, allowRoles } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { audit } = require('../services/audit');
const router = express.Router();

const slotSchema = z.object({
  startsAt: z.string().datetime({ offset: true }),
  endsAt: z.string().datetime({ offset: true })
}).strict();

router.get('/', async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit || '20', 10) || 20, 1), 100);
    const offset = Math.max(parseInt(req.query.offset || '0', 10) || 0, 0);
    const search = String(req.query.search || '').trim().slice(0, 80);
    const spec = String(req.query.specialization || '').trim().slice(0, 80);
    const result = await pool.query(
      `SELECT d.user_id AS id,p.full_name,d.specialization,d.bio,d.consultation_fee
       FROM doctors d JOIN profiles p ON p.user_id=d.user_id JOIN users u ON u.id=d.user_id
       WHERE d.is_verified=true AND u.is_active=true
       AND ($1='' OR p.full_name ILIKE '%'||$1||'%')
       AND ($2='' OR d.specialization ILIKE '%'||$2||'%')
       ORDER BY p.full_name LIMIT $3 OFFSET $4`,
      [search, spec, limit, offset]
    );
    res.json({ data: result.rows, pagination: { limit, offset } });
  } catch (err) { next(err); }
});

router.post('/me/availability', authenticate, allowRoles('doctor'), validate(slotSchema), async (req, res, next) => {
  try {
    const starts = new Date(req.body.startsAt), ends = new Date(req.body.endsAt);
    if (starts <= new Date() || ends <= starts || ends - starts > 8 * 60 * 60 * 1000) {
      return res.status(400).json({ error: 'invalid_slot', message: 'Slot must be in the future, end after start, and be at most 8 hours', requestId: req.id });
    }
    const overlap = await pool.query(
      `SELECT 1 FROM availability_slots WHERE doctor_id=$1 AND status <> 'blocked'
       AND starts_at < $3 AND ends_at > $2 LIMIT 1`,
      [req.user.id, starts.toISOString(), ends.toISOString()]
    );
    if (overlap.rowCount) return res.status(409).json({ error: 'slot_overlap', message: 'Slot overlaps an existing slot', requestId: req.id });
    const result = await pool.query(
      'INSERT INTO availability_slots(doctor_id,starts_at,ends_at) VALUES($1,$2,$3) RETURNING *',
      [req.user.id, starts.toISOString(), ends.toISOString()]
    );
    await audit({ actorId: req.user.id, action: 'availability.created', resourceType: 'availability_slot', resourceId: result.rows[0].id, requestId: req.id });
    res.status(201).json({ slot: result.rows[0] });
  } catch (err) { next(err); }
});

router.get('/:id/availability', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id,starts_at,ends_at FROM availability_slots
       WHERE doctor_id=$1 AND status='available' AND starts_at > now() ORDER BY starts_at LIMIT 100`,
      [req.params.id]
    );
    res.json({ data: result.rows });
  } catch (err) { next(err); }
});
module.exports = router;
