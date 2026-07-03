function requireApiKey(req, res, next) {
  const provided = req.header('x-api-key');
  const allowed = (process.env.INTERNAL_API_KEYS || '')
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);

  if (!provided || !allowed.includes(provided)) {
    return res.status(401).json({ error: 'Missing or invalid API key' });
  }
  next();
}

module.exports = { requireApiKey };
