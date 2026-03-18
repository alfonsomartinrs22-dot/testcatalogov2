const { getSQL } = require('../_db.js');
const { requireAdmin } = require('./_auth.js');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const auth = requireAdmin(req);
  if (auth.error) return res.status(auth.status).json({ error: auth.error });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido.' });

  const { mode, pctCosto, pctGanancia, brands, search } = req.body || {};
  const hasCosto = pctCosto !== undefined && pctCosto !== null && pctCosto !== '';
  const hasGanancia = pctGanancia !== undefined && pctGanancia !== null && pctGanancia !== '';
  if (!hasCosto && !hasGanancia) return res.status(400).json({ error: 'Ingresá al menos un %.' });

  try {
    const sql = getSQL();
    const cv = hasCosto ? Number(pctCosto) : null;
    const gv = hasGanancia ? Number(pctGanancia) : null;

    if (mode === 'all') {
      if (hasCosto && hasGanancia) await sql`UPDATE products SET porcentaje_costo=${cv}, porcentaje_ganancia=${gv}, updated_at=NOW()`;
      else if (hasCosto) await sql`UPDATE products SET porcentaje_costo=${cv}, updated_at=NOW()`;
      else await sql`UPDATE products SET porcentaje_ganancia=${gv}, updated_at=NOW()`;
    } else if (mode === 'brands' && Array.isArray(brands) && brands.length) {
      if (hasCosto && hasGanancia) await sql`UPDATE products SET porcentaje_costo=${cv}, porcentaje_ganancia=${gv}, updated_at=NOW() WHERE SPLIT_PART(codigo,'-',1)=ANY(${brands})`;
      else if (hasCosto) await sql`UPDATE products SET porcentaje_costo=${cv}, updated_at=NOW() WHERE SPLIT_PART(codigo,'-',1)=ANY(${brands})`;
      else await sql`UPDATE products SET porcentaje_ganancia=${gv}, updated_at=NOW() WHERE SPLIT_PART(codigo,'-',1)=ANY(${brands})`;
    } else if (mode === 'search' && search) {
      const pat = `%${search}%`;
      if (hasCosto && hasGanancia) await sql`UPDATE products SET porcentaje_costo=${cv}, porcentaje_ganancia=${gv}, updated_at=NOW() WHERE LOWER(producto) LIKE LOWER(${pat}) OR LOWER(codigo) LIKE LOWER(${pat})`;
      else if (hasCosto) await sql`UPDATE products SET porcentaje_costo=${cv}, updated_at=NOW() WHERE LOWER(producto) LIKE LOWER(${pat}) OR LOWER(codigo) LIKE LOWER(${pat})`;
      else await sql`UPDATE products SET porcentaje_ganancia=${gv}, updated_at=NOW() WHERE LOWER(producto) LIKE LOWER(${pat}) OR LOWER(codigo) LIKE LOWER(${pat})`;
    } else {
      return res.status(400).json({ error: 'Modo inválido: all, brands, o search.' });
    }

    return res.status(200).json({ ok: true, message: 'Porcentajes actualizados.' });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};
