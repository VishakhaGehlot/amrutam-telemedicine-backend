const { pool } = require('../db/pool');
async function audit({ actorId, action, resourceType, resourceId, metadata = {}, requestId }) {
  await pool.query(
    'INSERT INTO audit_logs(actor_id, action, resource_type, resource_id, metadata, request_id) VALUES($1,$2,$3,$4,$5,$6)',
    [actorId || null, action, resourceType, resourceId || null, JSON.stringify(metadata), requestId || null]
  );
}
module.exports = { audit };
