const { getSQL } = require('./_db.js');
const bcrypt = require('bcryptjs');
const { createToken } = require('./_token.js');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido.' });

  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email y contraseña son obligatorios.' });

  try {
    const sql = getSQL();
    const rows = await sql`SELECT id, email, password_hash, business_name, role FROM users WHERE email = ${email.trim().toLowerCase()}`;
    if (rows.length === 0) return res.status(401).json({ error: 'Credenciales inválidas.' });

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Credenciales inválidas.' });

    const token = createToken({ id: user.id, email: user.email, role: user.role, businessName: user.business_name });
    return res.status(200).json({ ok: true, token, user: { id: user.id, email: user.email, role: user.role, businessName: user.business_name } });
  } catch (err) {
    return res.status(500).json({ error: 'Error interno.' });
  }
};
