const { verifyToken, getTokenFromRequest } = require('../_token.js');

function requireAdmin(req) {
  const token = getTokenFromRequest(req);
  if (!token) return { error: 'No autenticado.', status: 401 };
  const payload = verifyToken(token);
  if (!payload || !payload.id) return { error: 'Token inválido.', status: 401 };
  if (payload.role !== 'admin') return { error: 'Acceso denegado.', status: 403 };
  return { user: payload };
}

module.exports = { requireAdmin };
