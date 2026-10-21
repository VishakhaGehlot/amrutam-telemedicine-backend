const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const { pool } = require('../db/pool');
const { loadConfig } = require('../config');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { audit } = require('../services/audit');

const router = express.Router();
const config = loadConfig();
const registerSchema = z.object({
  email: z.string().email().max(254).transform(v => v.toLowerCase()),
  password: z.string().min(12).max(128),
  fullName: z.string().trim().min(2).max(120),
  role: z.enum(['patient','doctor']).default('patient')
}).strict();
const loginSchema = z.object({ email: z.string().email().max(254).transform(v => v.toLowerCase()), password: z.string().min(1).max(128) }).strict();

router.post('/register', validate(registerSchema), async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const hash = await bcrypt.hash(req.body.password, 12);
    const result = await client.query(
      'INSERT INTO users(email,password_hash,role) VALUES($1,$2,$3) RETURNING id,email,role,created_at',
      [req.body.email, hash, req.body.role]
    );
    const user = result.rows[0];
    await client.query('INSERT INTO profiles(user_id,full_name) VALUES($1,$2)', [user.id, req.body.fullName]);
    if (user.role === 'doctor') {
      await client.query('INSERT INTO doctors(user_id,specialization) VALUES($1,$2)', [user.id, 'General Medicine']);
    }
    await client.query('INSERT INTO audit_logs(actor_id,action,resource_type,resource_id,request_id) VALUES($1,$2,$3,$4,$5)', [user.id, 'user.registered', 'user', user.id, req.id]);
    await client.query('COMMIT');
    return res.status(201).json({ user });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') return res.status(409).json({ error: 'conflict', message: 'Email already registered', requestId: req.id });
    next(err);
  } finally { client.release(); }
});

router.post('/login', validate(loginSchema), async (req, res, next) => {
  try {
    const result = await pool.query('SELECT id,email,password_hash,role,is_active FROM users WHERE email=$1', [req.body.email]);
    const user = result.rows[0];
    if (!user || !user.is_active || !(await bcrypt.compare(req.body.password, user.password_hash))) {
      return res.status(401).json({ error: 'invalid_credentials', message: 'Email or password is incorrect', requestId: req.id });
    }
    const token = jwt.sign({ role: user.role }, config.jwtSecret, { subject: user.id, expiresIn: config.jwtExpiresIn, algorithm: 'HS256' });
    await audit({ actorId: user.id, action: 'user.login', resourceType: 'user', resourceId: user.id, requestId: req.id });
    res.json({ accessToken: token, tokenType: 'Bearer', expiresIn: config.jwtExpiresIn, user: { id: user.id, email: user.email, role: user.role } });
  } catch (err) { next(err); }
});

router.get('/me', authenticate, async (req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT u.id,u.email,u.role,p.full_name,p.phone,u.created_at FROM users u JOIN profiles p ON p.user_id=u.id WHERE u.id=$1 AND u.is_active=true',
      [req.user.id]
    );
    if (!result.rowCount) return res.status(404).json({ error: 'not_found', message: 'User not found', requestId: req.id });
    res.json({ user: result.rows[0] });
  } catch (err) { next(err); }
});
module.exports = router;
