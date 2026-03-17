const { getSQL } = require('./_db.js');
const bcrypt = require('bcryptjs');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Usá POST para inicializar.' });
  }

  const { secret } = req.body || {};
  if (secret !== (process.env.INIT_SECRET || 'autopiezas-init-2024')) {
    return res.status(403).json({ error: 'Clave incorrecta.' });
  }

  try {
    const sql = getSQL();

    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        business_name VARCHAR(255) NOT NULL DEFAULT '',
        role VARCHAR(50) NOT NULL DEFAULT 'client',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_users_email ON users (email)`;

    await sql`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        codigo VARCHAR(100) UNIQUE NOT NULL,
        producto TEXT NOT NULL,
        precio_lista NUMERIC(14,2) NOT NULL DEFAULT 0,
        porcentaje_costo NUMERIC(6,2) NOT NULL DEFAULT 0,
        porcentaje_ganancia NUMERIC(6,2) NOT NULL DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_products_codigo ON products (codigo)`;

    const existing = await sql`SELECT id FROM users WHERE email = 'salamanca'`;
    if (existing.length === 0) {
      const hash = await bcrypt.hash('salta2097', 10);
      await sql`INSERT INTO users (email, password_hash, business_name, role) VALUES ('salamanca', ${hash}, 'Autopiezas Salamanca', 'admin')`;
    }

    const pc = await sql`SELECT COUNT(*) as c FROM products`;
    return res.status(200).json({ ok: true, message: 'DB inicializada.', productsInDB: Number(pc[0].c) });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
