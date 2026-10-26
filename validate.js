// Checks req.body (or req.query) against a Zod schema. Clean data ends up in req.valid.
module.exports = (schema, where = 'body') => (req, res, next) => {
  const result = schema.safeParse(req[where]);
  if (!result.success) {
    const msg = result.error.issues.map((i) => `${i.path.join('.') || 'input'}: ${i.message}`).join('; ');
    return res.status(400).json({ error: msg });
  }
  req.valid = result.data;
  next();
};
