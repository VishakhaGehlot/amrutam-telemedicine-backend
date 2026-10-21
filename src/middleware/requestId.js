const { randomUUID } = require('node:crypto');
function requestId(req, res, next) {
  req.id = req.get('x-request-id') || randomUUID();
  res.setHeader('x-request-id', req.id);
  next();
}
module.exports = { requestId };
