const { getSQL } = require('../../_db.js');
const { requireAdmin } = require('../_auth.js');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const auth = requireAdmin(req);
  if (auth.error) return res.status(auth.status).json({ error: auth.error });
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido.' });

  try {
    const sql = getSQL();
    const brands = await sql`
      SELECT
        SPLIT_PART(codigo, '-', 1) AS prefix,
        COUNT(*) AS product_count,
        ROUND(AVG(precio_lista)::numeric, 2) AS avg_price,
        CASE WHEN MIN(porcentaje_costo) = MAX(porcentaje_costo) THEN MIN(porcentaje_costo) ELSE NULL END AS uniform_pct_costo,
        CASE WHEN MIN(porcentaje_ganancia) = MAX(porcentaje_ganancia) THEN MIN(porcentaje_ganancia) ELSE NULL END AS uniform_pct_ganancia
      FROM products GROUP BY SPLIT_PART(codigo, '-', 1) ORDER BY COUNT(*) DESC
    `;
    const total = await sql`SELECT COUNT(*) AS t FROM products`;
    return res.status(200).json({
      ok: true,
      totalProducts: Number(total[0].t),
      brands: brands.map(b => ({
        prefix: b.prefix, count: Number(b.product_count), avgPrice: Number(b.avg_price),
        pctCosto: b.uniform_pct_costo !== null ? Number(b.uniform_pct_costo) : null,
        pctGanancia: b.uniform_pct_ganancia !== null ? Number(b.uniform_pct_ganancia) : null
      }))
    });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};
