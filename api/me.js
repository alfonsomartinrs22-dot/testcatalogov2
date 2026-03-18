const { getSQL } = require('../_db.js');
const { verifyToken, getTokenFromRequest } = require('../_token.js');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido.' });

  const token = getTokenFromRequest(req);
  if (!token) return res.status(401).json({ error: 'Token no proporcionado.' });
  const payload = verifyToken(token);
  if (!payload || !payload.id) return res.status(401).json({ error: 'Token inválido.' });

  try {
    const sql = getSQL();
    const rows = await sql`SELECT id, email, business_name, role FROM users WHERE id = ${payload.id}`;
    if (rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado.' });
    const user = rows[0];
    return res.status(200).json({ ok: true, user: { id: user.id, email: user.email, role: user.role, businessName: user.business_name } });
  } catch (err) {
    return res.status(500).json({ error: 'Error interno.' });
  }
};