const { createHmac } = require('crypto');

const SECRET = process.env.TOKEN_SECRET || 'autopiezas-default-secret-change-me';

function createToken(payload) {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = createHmac('sha256', SECRET).update(data).digest('base64url');
  return `${data}.${sig}`;
}

function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [data, sig] = parts;
  const expectedSig = createHmac('sha256', SECRET).update(data).digest('base64url');
  if (sig !== expectedSig) return null;
  try { return JSON.parse(Buffer.from(data, 'base64url').toString()); }
  catch { return null; }
}

function getTokenFromRequest(req) {
  const auth = req.headers.authorization || req.headers.Authorization || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7);
  return null;
}

module.exports = { createToken, verifyToken, getTokenFromRequest };
