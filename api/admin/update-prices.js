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

  const { mode, pctCosto, pctGanancia, brands, search } = req.body || {};
  const hasCosto = pctCosto !== undefined && pctCosto !== null && pctCosto !== '';
  const hasGanancia = pctGanancia !== undefined && pctGanancia !== null && pctGanancia !== '';
  if (!hasCosto && !hasGanancia) return res.status(400).json({ error: 'Ingresá al menos un %.' });

  // Calcula el factor multiplicador sobre precio_lista
  // Si se ingresa pctCosto: factor = (1 + pctCosto/100)
  // Si se ingresa pctGanancia: factor = (1 + pctGanancia/100)
  // Si se ingresan ambos: se aplican en secuencia
  let factor = 1;
  if (hasCosto) factor *= (1 + Number(pctCosto) / 100);
  if (hasGanancia) factor *= (1 + Number(pctGanancia) / 100);

  try {
    const sql = getSQL();

    if (mode === 'all') {
      await sql`UPDATE products SET precio_lista = ROUND(precio_lista * ${factor}, 2), updated_at = NOW()`;
    } else if (mode === 'brands' && Array.isArray(brands) && brands.length) {
      await sql`UPDATE products SET precio_lista = ROUND(precio_lista * ${factor}, 2), updated_at = NOW() WHERE SPLIT_PART(codigo, '-', 1) = ANY(${brands})`;
    } else if (mode === 'search' && search) {
      const pat = `%${search}%`;
      await sql`UPDATE products SET precio_lista = ROUND(precio_lista * ${factor}, 2), updated_at = NOW() WHERE LOWER(producto) LIKE LOWER(${pat}) OR LOWER(codigo) LIKE LOWER(${pat})`;
    } else {
      return res.status(400).json({ error: 'Modo inválido: all, brands, o search.' });
    }

    return res.status(200).json({ ok: true, message: 'Precio de lista actualizado.' });
  } catch (err) { return res.status(500).json({ error: err.message }); }
};
