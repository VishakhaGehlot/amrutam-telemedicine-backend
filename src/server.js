const { app } = require('./app');
const { pool } = require('./db/pool');
const { loadConfig } = require('./config');
const config = loadConfig();
const server = app.listen(config.port, () => console.log(JSON.stringify({ level: 'info', event: 'server_started', port: config.port, env: config.nodeEnv })));
async function shutdown(signal) {
  console.log(JSON.stringify({ level: 'info', event: 'shutdown', signal }));
  server.close(async () => { await pool.end(); process.exit(0); });
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
