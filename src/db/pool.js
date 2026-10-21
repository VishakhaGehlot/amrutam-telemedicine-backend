const { Pool } = require('pg');
const { loadConfig } = require('../config');
const config = loadConfig();
const pool = new Pool({
  connectionString: config.databaseUrl,
  max: Number(process.env.DB_POOL_MAX || 10),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 3000,
  application_name: 'amrutam-api',
  ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: true } : undefined
});
pool.on('error', (err) => console.error(JSON.stringify({ level: 'error', event: 'pg_idle_client_error', message: err.message })));
module.exports = { pool };
