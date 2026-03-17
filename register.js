const { getSQL } = require('./_db.js');
const bcrypt = require('bcryptjs');
const { createToken } = require('./_token.js');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido.' });

  const { email, password, businessName } = req.body || {};
  if (!email || !password || !businessName) return res.status(400).json({ error: 'Todos los campos son obligatorios.' });

  const cleanEmail = email.trim().toLowerCase();
  if (password.length < 4) return res.status(400).json({ error: 'Contraseña mínima: 4 caracteres.' });

  try {
    const sql = getSQL();
    const existing = await sql`SELECT id FROM users WHERE email = ${cleanEmail}`;
    if (existing.length > 0) return res.status(409).json({ error: 'Ese email ya está registrado.' });

    const hash = await bcrypt.hash(password, 10);
    const result = await sql`INSERT INTO users (email, password_hash, business_name, role) VALUES (${cleanEmail}, ${hash}, ${businessName.trim()}, 'client') RETURNING id, email, business_name, role`;
    const user = result[0];
    const token = createToken({ id: user.id, email: user.email, role: user.role, businessName: user.business_name });
    return res.status(201).json({ ok: true, token, user: { id: user.id, email: user.email, role: user.role, businessName: user.business_name } });
  } catch (err) {
    return res.status(500).json({ error: 'Error interno.' });
  }
};
