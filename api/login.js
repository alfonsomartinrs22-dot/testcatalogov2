const { getSQL } = require('../_db.js');
const bcrypt = require('bcryptjs');
const { createToken } = require('../_token.js');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido.' });

  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email y contraseña son obligatorios.' });

  const cleanEmail = email.trim().toLowerCase();

  // Chequeo directo contra variables de entorno (admin siempre puede entrar)
  const adminEmail = (process.env.ADMIN_EMAIL || 'salamanca').toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD || 'salta2097';
  const adminBusiness = process.env.ADMIN_BUSINESS_NAME || 'Autopiezas Salamanca';

  if (cleanEmail === adminEmail && password === adminPassword) {
    const token = createToken({ id: 0, email: adminEmail, role: 'admin', businessName: adminBusiness });
    return res.status(200).json({ ok: true, token, user: { id: 0, email: adminEmail, role: 'admin', businessName: adminBusiness } });
  }

  // Chequeo contra usuarios definidos en la variable de entorno USERS
  // Formato: "jose:sala232,maria:pass123,pedro:abc456"
  if (process.env.USERS) {
    const entries = process.env.USERS.split(',');
    for (const entry of entries) {
      const colonIdx = entry.indexOf(':');
      if (colonIdx === -1) continue;
      const envUser = entry.slice(0, colonIdx).trim().toLowerCase();
      const envPass = entry.slice(colonIdx + 1).trim();
      if (cleanEmail === envUser && password === envPass) {
        const token = createToken({ id: 0, email: envUser, role: 'client', businessName: envUser });
        return res.status(200).json({ ok: true, token, user: { id: 0, email: envUser, role: 'client', businessName: envUser } });
      }
    }
  }

  // Chequeo contra la base de datos para usuarios normales
  try {
    const sql = getSQL();
    const rows = await sql`SELECT id, email, password_hash, business_name, role FROM users WHERE email = ${cleanEmail}`;
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
