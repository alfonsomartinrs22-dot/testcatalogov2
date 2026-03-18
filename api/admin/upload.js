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

  const valid = products.filter(p => String(p.codigo || '').trim() && String(p.producto || '').trim());
  if (!valid.length) return res.status(400).json({ error: 'No se recibieron productos válidos.' });

  const codigos  = valid.map(p => String(p.codigo).trim());
  const nombres  = valid.map(p => String(p.producto).trim());
  const precios  = valid.map(p => Number(p.precio_lista) || 0);

  try {
    const sql = getSQL();

    // Un solo INSERT masivo: solo toca codigo, producto y precio_lista
    // Los porcentajes NO se incluyen → los existentes se preservan automáticamente
    await sql`
      INSERT INTO products (codigo, producto, precio_lista)
      SELECT unnest(${codigos}::text[]), unnest(${nombres}::text[]), unnest(${precios}::numeric[])
      ON CONFLICT (codigo) DO UPDATE SET
        producto    = EXCLUDED.producto,
        precio_lista = EXCLUDED.precio_lista,
        updated_at  = NOW()
    `;

    // Elimina productos que ya no están en el Excel
    await sql`DELETE FROM products WHERE NOT (codigo = ANY(${codigos}::text[]))`;

    return res.status(200).json({ ok: true, message: `${valid.length} productos actualizados.`, count: valid.length });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

module.exports.config = { api: { bodyParser: { sizeLimit: '10mb' } } };
