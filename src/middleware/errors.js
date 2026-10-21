function notFound(req, res) {
  res.status(404).json({ error: 'not_found', message: 'Route not found', requestId: req.id });
}
function errorHandler(err, req, res, next) {
  const status = Number(err.statusCode || 500);
  const safe = status >= 500 ? 'Internal server error' : err.message;
  if (status >= 500) console.error(JSON.stringify({ level: 'error', requestId: req.id, message: err.message, stack: process.env.NODE_ENV === 'development' ? err.stack : undefined }));
  res.status(status).json({ error: err.code || 'request_failed', message: safe, requestId: req.id });
}
module.exports = { notFound, errorHandler };
