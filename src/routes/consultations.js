const express = require('express');
const { z } = require('zod');
const { pool } = require('../db/pool');
const { authenticate, allowRoles } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { audit } = require('../services/audit');
const router = express.Router();
const bookingSchema = z.object({ slotId: z.string().uuid(), reason: z.string().trim().max(1000).optional() }).strict();
const transitions = {
  booked: ['confirmed','cancelled'],
  confirmed: ['in_progress','cancelled','no_show'],
  in_progress: ['completed'],
  completed: [], cancelled: [], no_show: []
};

router.post('/', authenticate, allowRoles('patient'), validate(bookingSchema), async (req, res, next) => {
  const key = req.get('idempotency-key');
  if (!key || key.length < 8 || key.length > 128) return res.status(400).json({ error: 'idempotency_key_required', message: 'Provide an Idempotency-Key header (8-128 chars)', requestId: req.id });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const prior = await client.query('SELECT response_status,response_body FROM idempotency_keys WHERE user_id=$1 AND key=$2 FOR UPDATE', [req.user.id, key]);
    if (prior.rowCount && prior.rows[0].response_body) {
      await client.query('COMMIT');
      return res.status(prior.rows[0].response_status || 201).json(prior.rows[0].response_body);
    }
    if (!prior.rowCount) await client.query('INSERT INTO idempotency_keys(user_id,key) VALUES($1,$2) ON CONFLICT DO NOTHING', [req.user.id, key]);
    const slotResult = await client.query(
      `SELECT s.id,s.doctor_id,s.starts_at,s.ends_at,d.consultation_fee
       FROM availability_slots s JOIN doctors d ON d.user_id=s.doctor_id
       WHERE s.id=$1 AND s.status='available' AND s.starts_at > now() AND d.is_verified=true
       FOR UPDATE OF s`,
      [req.body.slotId]
    );
    if (!slotResult.rowCount) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'slot_unavailable', message: 'Slot is not available', requestId: req.id });
    }
    const slot = slotResult.rows[0];
    const created = await client.query(
      `INSERT INTO consultations(patient_id,doctor_id,slot_id,status,reason,idempotency_key)
       VALUES($1,$2,$3,'booked',$4,$5)
       RETURNING id,patient_id,doctor_id,slot_id,status,reason,created_at`,
      [req.user.id, slot.doctor_id, slot.id, req.body.reason || null, key]
    );
    await client.query("UPDATE availability_slots SET status='booked' WHERE id=$1", [slot.id]);
    await client.query('INSERT INTO payments(consultation_id,amount,currency,status) VALUES($1,$2,$3,$4)', [created.rows[0].id, slot.consultation_fee, 'INR', 'pending']);
    const body = { consultation: created.rows[0] };
    await client.query('UPDATE idempotency_keys SET response_status=201,response_body=$3 WHERE user_id=$1 AND key=$2', [req.user.id, key, JSON.stringify(body)]);
    await client.query('INSERT INTO audit_logs(actor_id,action,resource_type,resource_id,request_id) VALUES($1,$2,$3,$4,$5)', [req.user.id, 'consultation.booked', 'consultation', created.rows[0].id, req.id]);
    await client.query('COMMIT');
    res.status(201).json(body);
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') return res.status(409).json({ error: 'booking_conflict', message: 'Slot or idempotency key already used', requestId: req.id });
    next(err);
  } finally { client.release(); }
});

router.get('/mine', authenticate, async (req, res, next) => {
  try {
    const status = req.query.status ? String(req.query.status) : '';
    const limit = Math.min(Math.max(parseInt(req.query.limit || '20', 10) || 20, 1), 100);
    const result = await pool.query(
      `SELECT c.id,c.patient_id,c.doctor_id,c.slot_id,c.status,c.reason,c.created_at,s.starts_at,s.ends_at
       FROM consultations c JOIN availability_slots s ON s.id=c.slot_id
       WHERE ($1='admin' OR c.patient_id=$2 OR c.doctor_id=$2)
       AND ($3='' OR c.status=$3) ORDER BY c.created_at DESC LIMIT $4`,
      [req.user.role, req.user.id, status, limit]
    );
    res.json({ data: result.rows });
  } catch (err) { next(err); }
});

router.patch('/:id/status', authenticate, allowRoles('doctor','admin'), async (req, res, next) => {
  const schema = z.object({ status: z.enum(['confirmed','in_progress','completed','cancelled','no_show']) }).strict();
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'validation_error', message: 'Invalid status', requestId: req.id });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const found = await client.query('SELECT * FROM consultations WHERE id=$1 FOR UPDATE', [req.params.id]);
    if (!found.rowCount) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'not_found', message: 'Consultation not found', requestId: req.id }); }
    const consultation = found.rows[0];
    if (req.user.role === 'doctor' && consultation.doctor_id !== req.user.id) { await client.query('ROLLBACK'); return res.status(403).json({ error: 'forbidden', message: 'Not your consultation', requestId: req.id }); }
    if (!transitions[consultation.status].includes(parsed.data.status)) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'invalid_transition', message: `Cannot transition from ${consultation.status} to ${parsed.data.status}`, requestId: req.id }); }
    const updated = await client.query('UPDATE consultations SET status=$1,updated_at=now() WHERE id=$2 RETURNING *', [parsed.data.status, req.params.id]);
    if (parsed.data.status === 'cancelled') await client.query("UPDATE availability_slots SET status='available' WHERE id=$1 AND starts_at > now()", [consultation.slot_id]);
    await client.query('INSERT INTO audit_logs(actor_id,action,resource_type,resource_id,request_id) VALUES($1,$2,$3,$4,$5)', [req.user.id, `consultation.${parsed.data.status}`, 'consultation', req.params.id, req.id]);
    await client.query('COMMIT');
    res.json({ consultation: updated.rows[0] });
  } catch (err) { await client.query('ROLLBACK'); next(err); }
  finally { client.release(); }
});

router.post('/:id/prescriptions', authenticate, allowRoles('doctor'), async (req, res, next) => {
  const schema = z.object({ items: z.array(z.object({ name: z.string().min(1).max(160), dosage: z.string().min(1).max(160), duration: z.string().max(100).optional() }).strict()).min(1).max(50), notes: z.string().max(2000).optional() }).strict();
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'validation_error', message: 'Invalid prescription input', requestId: req.id });
  try {
    const consultation = await pool.query('SELECT id,patient_id,doctor_id,status FROM consultations WHERE id=$1', [req.params.id]);
    if (!consultation.rowCount) return res.status(404).json({ error: 'not_found', message: 'Consultation not found', requestId: req.id });
    const c = consultation.rows[0];
    if (c.doctor_id !== req.user.id) return res.status(403).json({ error: 'forbidden', message: 'Not your consultation', requestId: req.id });
    if (!['confirmed','in_progress','completed'].includes(c.status)) return res.status(409).json({ error: 'invalid_consultation_state', message: 'Prescription is not allowed in this state', requestId: req.id });
    const result = await pool.query('INSERT INTO prescriptions(consultation_id,doctor_id,patient_id,items,notes) VALUES($1,$2,$3,$4,$5) RETURNING id,consultation_id,doctor_id,patient_id,items,notes,created_at', [c.id,c.doctor_id,c.patient_id,JSON.stringify(parsed.data.items),parsed.data.notes || null]);
    await audit({ actorId: req.user.id, action: 'prescription.created', resourceType: 'prescription', resourceId: result.rows[0].id, requestId: req.id });
    res.status(201).json({ prescription: result.rows[0] });
  } catch (err) { next(err); }
});
module.exports = router;
