function validate(schema, source = 'body') {
  return (req, res, next) => {
    const parsed = schema.safeParse(req[source]);
    if (!parsed.success) return res.status(400).json({
      error: 'validation_error',
      message: 'Invalid request input',
      details: parsed.error.issues.map(i => ({ path: i.path.join('.'), message: i.message })),
      requestId: req.id
    });
    req[source] = parsed.data;
    next();
  };
}
module.exports = { validate };
