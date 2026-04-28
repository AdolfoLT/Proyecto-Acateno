import { Router } from 'express';
import bcrypt from 'bcrypt';
import pool from '../config/db.js';
import { authMiddleware, soloAdmin, adminOContador } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

// ── GET /api/admin/requisiciones-ocultas ─────────────────────
// Admin y Contador pueden ver las ocultas
router.get('/requisiciones-ocultas', adminOContador, async (_req, res) => {
  const [rows] = await pool.query(
    `SELECT r.*, u.nombre AS oculta_por_nombre
     FROM requisiciones r
     LEFT JOIN usuarios u ON u.id = r.oculta_por
     WHERE r.estado = 'oculta'
     ORDER BY r.oculta_en DESC`
  );
  res.json(rows);
});

// ── DELETE /api/admin/requisiciones/:id ──────────────────────
// SOLO ADMIN — elimina definitivamente UNA requisición por ID
// La requisición puede estar en cualquier estado (activa u oculta)
router.delete('/requisiciones/:id', soloAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ mensaje: 'ID inválido.' });

  try {
    const [rows] = await pool.query(
      `SELECT id, folio, estado FROM requisiciones WHERE id = ? AND estado != 'eliminada'`,
      [id]
    );
    if (!rows[0]) {
      return res.status(404).json({ mensaje: 'Requisición no encontrada o ya eliminada.' });
    }

    await pool.query(
      `UPDATE requisiciones SET estado = 'eliminada' WHERE id = ?`,
      [id]
    );

    // Auditoría
    await pool.query(
      `INSERT INTO auditoria (usuario_id, username, accion, tabla, registro_id, detalle, ip)
       VALUES (?,?,?,?,?,?,?)`,
      [
        req.user.id,
        req.user.username,
        'eliminar',
        'requisiciones',
        id,
        JSON.stringify({ folio: rows[0].folio, estado_previo: rows[0].estado }),
        req.ip,
      ]
    );

    res.json({
      mensaje: `Requisición ${rows[0].folio} eliminada definitivamente.`,
      id,
      folio: rows[0].folio,
    });
  } catch (err) {
    console.error('[ADMIN] Error al eliminar requisición:', err);
    res.status(500).json({ mensaje: 'Error al eliminar la requisición.' });
  }
});

// ── GET /api/admin/auditoria ─────────────────────────────────
// Solo admin
router.get('/auditoria', soloAdmin, async (req, res) => {
  const { page = 1, limit = 50 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);
  const [rows] = await pool.query(
    `SELECT * FROM auditoria ORDER BY fecha DESC LIMIT ? OFFSET ?`,
    [Number(limit), offset]
  );
  const [[{ total }]] = await pool.query('SELECT COUNT(*) as total FROM auditoria');
  res.json({ datos: rows, total, pagina: Number(page) });
});

// ── GET /api/admin/usuarios ──────────────────────────────────
// Solo admin
router.get('/usuarios', soloAdmin, async (_req, res) => {
  const [rows] = await pool.query(
    'SELECT id, nombre, username, rol, activo, creado_en FROM usuarios ORDER BY id'
  );
  res.json(rows);
});

// ── POST /api/admin/usuarios ─────────────────────────────────
// Solo admin
router.post('/usuarios', soloAdmin, async (req, res) => {
  const { nombre, username, password, rol = 'usuario' } = req.body;
  if (!nombre || !username || !password) {
    return res.status(400).json({ mensaje: 'Nombre, usuario y contraseña requeridos.' });
  }
  const rolesValidos = ['usuario', 'contador', 'admin'];
  const rolFinal = rolesValidos.includes(rol) ? rol : 'usuario';
  try {
    const hash = await bcrypt.hash(password, 10);
    await pool.query(
      'INSERT INTO usuarios (nombre, username, password_hash, rol) VALUES (?,?,?,?)',
      [nombre, username.toLowerCase(), hash, rolFinal]
    );
    res.status(201).json({ mensaje: 'Usuario creado.' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ mensaje: 'Ese nombre de usuario ya existe.' });
    }
    res.status(500).json({ mensaje: 'Error al crear usuario.' });
  }
});

// ── PATCH /api/admin/usuarios/:id/toggle ─────────────────────
// Solo admin
router.patch('/usuarios/:id/toggle', soloAdmin, async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM usuarios WHERE id=?', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ mensaje: 'Usuario no encontrado.' });
  const nuevoEstado = rows[0].activo ? 0 : 1;
  await pool.query('UPDATE usuarios SET activo=? WHERE id=?', [nuevoEstado, req.params.id]);
  res.json({ mensaje: nuevoEstado ? 'Usuario activado.' : 'Usuario desactivado.' });
});

// ── PATCH /api/admin/usuarios/:id/password ───────────────────
// Solo admin
router.patch('/usuarios/:id/password', soloAdmin, async (req, res) => {
  const { password } = req.body;
  if (!password || password.length < 6) {
    return res.status(400).json({ mensaje: 'La contraseña debe tener al menos 6 caracteres.' });
  }
  const hash = await bcrypt.hash(password, 10);
  await pool.query('UPDATE usuarios SET password_hash=? WHERE id=?', [hash, req.params.id]);
  res.json({ mensaje: 'Contraseña actualizada.' });
});

// ── DELETE /api/admin/purgar ──────────────────────────────────
// SOLO ADMIN — elimina definitivamente TODAS las requisiciones (o por año)
router.delete('/purgar', soloAdmin, async (req, res) => {
  const { anio } = req.query;
  try {
    let query = `UPDATE requisiciones SET estado='eliminada' WHERE estado != 'eliminada'`;
    const params = [];
    if (anio && !isNaN(Number(anio))) {
      query += ` AND YEAR(creado_en) = ?`;
      params.push(Number(anio));
    }
    const [result] = await pool.query(query, params);

    await pool.query(
      `INSERT INTO auditoria (usuario_id, username, accion, tabla, detalle, ip)
       VALUES (?,?,?,?,?,?)`,
      [
        req.user.id,
        req.user.username,
        'purgar',
        'requisiciones',
        JSON.stringify({ afectadas: result.affectedRows, anio: anio || 'todos' }),
        req.ip,
      ]
    );

    res.json({
      mensaje: `${result.affectedRows} requisición(es) purgadas definitivamente.`,
      afectadas: result.affectedRows,
    });
  } catch (err) {
    console.error('[PURGAR]', err);
    res.status(500).json({ mensaje: 'Error al purgar datos.' });
  }
});

export default router;