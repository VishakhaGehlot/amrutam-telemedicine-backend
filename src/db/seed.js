const bcrypt = require('bcryptjs');
const { pool } = require('./pool');
(async () => {
  try {
    const email = 'admin@example.test';
    const hash = await bcrypt.hash('ChangeMe123!ChangeMe', 12);
    const result = await pool.query(
      `INSERT INTO users(email,password_hash,role) VALUES($1,$2,'admin')
       ON CONFLICT(email) DO UPDATE SET password_hash=EXCLUDED.password_hash
       RETURNING id`,
      [email, hash]
    );
    await pool.query('INSERT INTO profiles(user_id,full_name) VALUES($1,$2) ON CONFLICT(user_id) DO NOTHING', [result.rows[0].id, 'Local Development Admin']);
    console.log('Seeded local admin: admin@example.test / ChangeMe123!ChangeMe');
    console.log('This is a development-only account. Change/remove it before any shared deployment.');
  } catch (err) {
    console.error(err.message); process.exitCode = 1;
  } finally { await pool.end(); }
})();
