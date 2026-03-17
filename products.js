const { getSQL } = require('./_db.js');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido.' });

  try {
    const sql = getSQL();
    const rows = await sql`SELECT codigo, producto, precio_lista, porcentaje_costo, porcentaje_ganancia FROM products ORDER BY codigo ASC`;
    return res.status(200).json({
      ok: true,
      count: rows.length,
      products: rows.map(r => ({
        codigo: r.codigo, producto: r.producto,
        precio_lista: Number(r.precio_lista),
        porcentaje_costo: Number(r.porcentaje_costo),
        porcentaje_ganancia: Number(r.porcentaje_ganancia)
      }))
    });
  } catch (err) {
    console.error('Error products:', err);
    return res.status(500).json({ error: err.message });
  }
};
