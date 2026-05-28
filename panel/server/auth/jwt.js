const jwt = require('jsonwebtoken');

const SECRET  = process.env.CXR_JWT_SECRET || 'cxr-panel-jwt-secret-change-me';
const EXPIRES = process.env.CXR_JWT_EXPIRES || '24h';

if (SECRET === 'cxr-panel-jwt-secret-change-me') {
  console.warn('[auth] WARNING: Using default JWT secret. Set CXR_JWT_SECRET env var in production!');
}

function sign(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: EXPIRES });
}

function verify(token) {
  try { return jwt.verify(token, SECRET); }
  catch (_) { return null; }
}

function extractBearer(req) {
  const auth = req.headers['authorization'];
  if (typeof auth === 'string' && auth.startsWith('Bearer ')) return auth.slice(7);
  return null;
}

module.exports = { sign, verify, extractBearer };
