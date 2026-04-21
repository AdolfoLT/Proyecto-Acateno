import { Router } from 'express';
import pool from '../config/db.js';
import { authMiddleware, soloAdmin, adminOContador } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

async function auditar(usuario, accion, registroId, detalle, ip) {
  await pool.query(
    `INSERT INTO auditoria (usuario_id, username, accion, tabla, registro_id, detalle, ip)
     VALUES (?,?,?,?,?,?,?)`,
    [usuario.id, usuario.username, accion, 'requisiciones', registroId,
     JSON.stringify(detalle), ip]
  );
}

// ══════════════════════════════════════════════════════════════
// CATÁLOGOS — SIEMPRE ANTES DE /:id
// ══════════════════════════════════════════════════════════════
router.get('/catalogos/areas', async (_req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM areas ORDER BY nombre');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al obtener áreas.' });
  }
});

router.get('/catalogos/clasificaciones', async (_req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM clasificaciones ORDER BY clave');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al obtener clasificaciones.' });
  }
});

// ── GET /api/requisiciones ───────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 20, buscar = '', area_id, clasificacion_id, verOcultas } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    const esPrivilegiado = req.user.rol === 'admin' || req.user.rol === 'contador';

    let estadoFiltro;
    if (esPrivilegiado && verOcultas === '1') {
      estadoFiltro = `r.estado IN ('activa','oculta')`;
    } else {
      estadoFiltro = `r.estado = 'activa'`;
    }

    const params = [];
    let where = `WHERE ${estadoFiltro}`;

    if (buscar) {
      where += ` AND (r.folio LIKE ? OR r.proveedor LIKE ? OR r.concepto LIKE ?)`;
      params.push(`%${buscar}%`, `%${buscar}%`, `%${buscar}%`);
    }
    if (area_id)          { where += ` AND r.area_id = ?`;          params.push(area_id); }
    if (clasificacion_id) { where += ` AND r.clasificacion_id = ?`; params.push(clasificacion_id); }

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) as total FROM requisiciones r ${where}`, params
    );

    const [rows] = await pool.query(
      `SELECT r.*,
              a.nombre AS area_catalogo,
              c.clave  AS clasificacion_clave,
              c.nombre AS clasificacion_nombre,
              u.nombre AS creado_por_nombre
       FROM requisiciones r
       LEFT JOIN areas           a ON a.id = r.area_id
       LEFT JOIN clasificaciones c ON c.id = r.clasificacion_id
       LEFT JOIN usuarios        u ON u.id = r.creado_por
       ${where}
       ORDER BY r.creado_en DESC
       LIMIT ? OFFSET ?`,
      [...params, Number(limit), offset]
    );

    res.json({
      datos: rows,
      total,
      pagina: Number(page),
      paginas: Math.ceil(total / Number(limit)),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al obtener requisiciones.' });
  }
});

// ── GET /api/requisiciones/:id ───────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT r.*, c.clave AS clasificacion_clave, c.nombre AS clasificacion_nombre
       FROM requisiciones r
       LEFT JOIN clasificaciones c ON c.id = r.clasificacion_id
       WHERE r.id = ? AND r.estado != 'eliminada'`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ mensaje: 'Requisición no encontrada.' });
    const esPrivilegiado = req.user.rol === 'admin' || req.user.rol === 'contador';
    if (rows[0].estado === 'oculta' && !esPrivilegiado) {
      return res.status(403).json({ mensaje: 'Sin acceso.' });
    }
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ mensaje: 'Error al obtener requisición.' });
  }
});

// ── POST /api/requisiciones ──────────────────────────────────
router.post('/', async (req, res) => {
  const {
    area_id, area_nombre, clasificacion_id,
    concepto, proveedor, rfc, monto,
    forma_pago, cuenta_bancaria, no_factura, no_contrato, fecha,
  } = req.body;

  if (!monto || isNaN(Number(monto))) {
    return res.status(400).json({ mensaje: 'El monto es requerido.' });
  }

  try {
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) as total FROM requisiciones WHERE YEAR(creado_en) = YEAR(NOW())`
    );
    const folio = `REQ-${new Date().getFullYear()}-${String(total + 1).padStart(4, '0')}`;

    const [result] = await pool.query(
      `INSERT INTO requisiciones
         (folio, area_id, area_nombre, clasificacion_id, concepto, proveedor, rfc,
          monto, forma_pago, cuenta_bancaria, no_factura, no_contrato, fecha, creado_por)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [folio, area_id || null, area_nombre || null, clasificacion_id || null,
       concepto || null, proveedor || null, rfc || null,
       Number(monto), forma_pago || 'CHEQUE', cuenta_bancaria || null,
       no_factura || null, no_contrato || null,
       fecha || new Date().toISOString().split('T')[0],
       req.user.id]
    );

    await auditar(req.user, 'crear', result.insertId, { folio, monto }, req.ip);
    res.status(201).json({ id: result.insertId, folio, mensaje: 'Requisición creada.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al crear requisición.' });
  }
});

// ── PUT /api/requisiciones/:id ───────────────────────────────
router.put('/:id', async (req, res) => {
  const {
    area_id, area_nombre, clasificacion_id,
    concepto, proveedor, rfc, monto,
    forma_pago, cuenta_bancaria, no_factura, no_contrato, fecha,
  } = req.body;

  try {
    const [rows] = await pool.query(
      `SELECT * FROM requisiciones WHERE id = ? AND estado != 'eliminada'`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ mensaje: 'No encontrada.' });

    await pool.query(
      `UPDATE requisiciones SET
         area_id=?, area_nombre=?, clasificacion_id=?, concepto=?,
         proveedor=?, rfc=?, monto=?, forma_pago=?,
         cuenta_bancaria=?, no_factura=?, no_contrato=?, fecha=?
       WHERE id=?`,
      [area_id || null, area_nombre || null, clasificacion_id || null, concepto || null,
       proveedor || null, rfc || null,
       Number(monto) || rows[0].monto,
       forma_pago || rows[0].forma_pago,
       cuenta_bancaria || null, no_factura || null, no_contrato || null,
       fecha || rows[0].fecha,
       req.params.id]
    );

    await auditar(req.user, 'editar', Number(req.params.id), req.body, req.ip);
    res.json({ mensaje: 'Requisición actualizada.' });
  } catch (err) {
    res.status(500).json({ mensaje: 'Error al actualizar.' });
  }
});

// ── DELETE /api/requisiciones/:id → SOFT DELETE ──────────────
// Admin y Contador pueden ocultar
router.delete('/:id', adminOContador, async (req, res) => {
  const { motivo } = req.body;
  try {
    const [rows] = await pool.query(
      `SELECT * FROM requisiciones WHERE id = ? AND estado = 'activa'`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ mensaje: 'No encontrada o ya oculta.' });

    await pool.query(
      `UPDATE requisiciones
       SET estado='oculta', oculta_por=?, oculta_en=NOW(), oculta_motivo=?
       WHERE id=?`,
      [req.user.id, motivo || null, req.params.id]
    );

    await auditar(req.user, 'ocultar', Number(req.params.id), { motivo }, req.ip);
    res.json({ mensaje: 'Requisición ocultada. El administrador puede restaurarla.' });
  } catch (err) {
    res.status(500).json({ mensaje: 'Error al ocultar.' });
  }
});

// ── PATCH /api/requisiciones/:id/restaurar ───────────────────
// Admin y Contador pueden restaurar
router.patch('/:id/restaurar', adminOContador, async (req, res) => {
  try {
    await pool.query(
      `UPDATE requisiciones
       SET estado='activa', oculta_por=NULL, oculta_en=NULL, oculta_motivo=NULL
       WHERE id=? AND estado='oculta'`,
      [req.params.id]
    );
    await auditar(req.user, 'restaurar', Number(req.params.id), {}, req.ip);
    res.json({ mensaje: 'Requisición restaurada.' });
  } catch (err) {
    res.status(500).json({ mensaje: 'Error al restaurar.' });
  }
});

export default router;