const jwt = require('jsonwebtoken');
const { loadConfig } = require('../config');
const config = loadConfig();

function authenticate(req, res, next) {
  const header = req.get('authorization') || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) return res.status(401).json({ error: 'unauthorized', message: 'Bearer token required', requestId: req.id });
  try {
    const claims = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
    req.user = { id: claims.sub, role: claims.role };
    next();
  } catch {
    return res.status(401).json({ error: 'unauthorized', message: 'Invalid or expired token', requestId: req.id });
  }
}
function allowRoles(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) return res.status(403).json({ error: 'forbidden', message: 'Insufficient role', requestId: req.id });
    next();
  };
}
module.exports = { authenticate, allowRoles };
