const { getSQL } = require('../../_db.js');
const { requireAdmin } = require('../_auth.js');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const auth = requireAdmin(req);
  if (auth.error) return res.status(auth.status).json({ error: auth.error });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido.' });

  const { products } = req.body || {};
  if (!Array.isArray(products) || !products.length) return res.status(400).json({ error: 'No se recibieron productos.' });

  try {
    const sql = getSQL();

    // Upsert: actualiza solo precio y nombre, preserva los porcentajes existentes
    let inserted = 0;
    const codigos = [];
    for (const p of products) {
      const codigo = String(p.codigo || '').trim();
      const producto = String(p.producto || '').trim();
      if (!codigo || !producto) continue;
      await sql`
        INSERT INTO products (codigo, producto, precio_lista)
        VALUES (${codigo}, ${producto}, ${Number(p.precio_lista)||0})
        ON CONFLICT (codigo) DO UPDATE SET
          producto = EXCLUDED.producto,
          precio_lista = EXCLUDED.precio_lista,
          updated_at = NOW()
      `;
      codigos.push(codigo);
      inserted++;
    }

    // Elimina productos que ya no están en el Excel
    if (codigos.length > 0) {
      await sql`DELETE FROM products WHERE codigo != ALL(${codigos})`;
    }

    return res.status(200).json({ ok: true, message: `${inserted} productos actualizados.`, count: inserted });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};

module.exports.config = { api: { bodyParser: { sizeLimit: '10mb' } } };
