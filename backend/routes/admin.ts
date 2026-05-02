import { Router, Request, Response } from 'express'
import bcrypt from 'bcrypt'
import mysql from 'mysql2/promise'
import pool from '../config/db.js'
import { authMiddleware, soloAdmin, adminOContador } from '../middleware/auth.js'
import { Requisicion, Usuario, RegistroAuditoria } from '../types.js'

const router = Router()
router.use(authMiddleware)

// ── GET /api/admin/requisiciones-ocultas ─────────────────────
router.get(
  '/requisiciones-ocultas',
  adminOContador,
  async (_req: Request, res: Response): Promise<void> => {
    const [rows] = await pool.query<(Requisicion & { oculta_por_nombre: string | null })[] & mysql.RowDataPacket[]>(
      `SELECT r.*, u.nombre AS oculta_por_nombre
       FROM requisiciones r
       LEFT JOIN usuarios u ON u.id = r.oculta_por
       WHERE r.estado = 'oculta'
       ORDER BY r.oculta_en DESC`
    )
    res.json(rows)
  }
)

// ── DELETE /api/admin/requisiciones/:id ──────────────────────
router.delete(
  '/requisiciones/:id',
  soloAdmin,
  async (req: Request, res: Response): Promise<void> => {
    const id = Number(req.params.id)
    if (!id) {
      res.status(400).json({ mensaje: 'ID inválido.' })
      return
    }

    try {
      const [rows] = await pool.query(
        `SELECT id, folio, estado FROM requisiciones WHERE id = ? AND estado != 'eliminada'`,
        [id]
      )
      const fila = (rows as Pick<Requisicion, 'id' | 'folio' | 'estado'>[])[0]
      if (!fila) {
        res.status(404).json({ mensaje: 'Requisición no encontrada o ya eliminada.' })
        return
      }

      await pool.query(
        `UPDATE requisiciones SET estado = 'eliminada' WHERE id = ?`,
        [id]
      )

      await pool.query(
        `INSERT INTO auditoria (usuario_id, username, accion, tabla, registro_id, detalle, ip)
         VALUES (?,?,?,?,?,?,?)`,
        [
          req.user.id,
          req.user.username,
          'eliminar',
          'requisiciones',
          id,
          JSON.stringify({ folio: fila.folio, estado_previo: fila.estado }),
          req.ip,
        ]
      )

      res.json({
        mensaje: `Requisición ${fila.folio} eliminada definitivamente.`,
        id,
        folio: fila.folio,
      })
    } catch (err) {
      console.error('[ADMIN] Error al eliminar requisición:', err)
      res.status(500).json({ mensaje: 'Error al eliminar la requisición.' })
    }
  }
)

// ── GET /api/admin/auditoria ─────────────────────────────────
router.get(
  '/auditoria',
  soloAdmin,
  async (req: Request, res: Response): Promise<void> => {
    const page   = Number(req.query.page  ?? 1)
    const limit  = Number(req.query.limit ?? 50)
    const offset = (page - 1) * limit

    const [rows] = await pool.query<RegistroAuditoria[] & mysql.RowDataPacket[]>(
      `SELECT * FROM auditoria ORDER BY fecha DESC LIMIT ? OFFSET ?`,
      [limit, offset]
    )
    const [[{ total }]] = await pool.query<[{ total: number }] & mysql.RowDataPacket[]>(
      'SELECT COUNT(*) as total FROM auditoria'
    )
    res.json({ datos: rows, total, pagina: page })
  }
)

// ── GET /api/admin/usuarios ──────────────────────────────────
router.get(
  '/usuarios',
  soloAdmin,
  async (_req: Request, res: Response): Promise<void> => {
    const [rows] = await pool.query<Usuario[] & mysql.RowDataPacket[]>(
      'SELECT id, nombre, username, rol, activo, creado_en FROM usuarios ORDER BY id'
    )
    res.json(rows)
  }
)

// ── POST /api/admin/usuarios ─────────────────────────────────
router.post(
  '/usuarios',
  soloAdmin,
  async (req: Request, res: Response): Promise<void> => {
    const { nombre, username, password, rol = 'usuario' } = req.body as {
      nombre?: string
      username?: string
      password?: string
      rol?: string
    }

    if (!nombre || !username || !password) {
      res.status(400).json({ mensaje: 'Nombre, usuario y contraseña requeridos.' })
      return
    }

    const rolesValidos = ['usuario', 'contador', 'admin']
    const rolFinal     = rolesValidos.includes(rol) ? rol : 'usuario'

    try {
      const hash = await bcrypt.hash(password, 10)
      await pool.query(
        'INSERT INTO usuarios (nombre, username, password_hash, rol) VALUES (?,?,?,?)',
        [nombre, username.toLowerCase(), hash, rolFinal]
      )
      res.status(201).json({ mensaje: 'Usuario creado.' })
    } catch (err) {
      const dbErr = err as { code?: string }
      if (dbErr.code === 'ER_DUP_ENTRY') {
        res.status(409).json({ mensaje: 'Ese nombre de usuario ya existe.' })
        return
      }
      res.status(500).json({ mensaje: 'Error al crear usuario.' })
    }
  }
)

// ── PATCH /api/admin/usuarios/:id/toggle ─────────────────────
router.patch(
  '/usuarios/:id/toggle',
  soloAdmin,
  async (req: Request, res: Response): Promise<void> => {
    const [rows] = await pool.query('SELECT * FROM usuarios WHERE id=?', [req.params.id])
    const usuario = (rows as Usuario[])[0]
    if (!usuario) {
      res.status(404).json({ mensaje: 'Usuario no encontrado.' })
      return
    }
    const nuevoEstado = usuario.activo ? 0 : 1
    await pool.query('UPDATE usuarios SET activo=? WHERE id=?', [nuevoEstado, req.params.id])
    res.json({ mensaje: nuevoEstado ? 'Usuario activado.' : 'Usuario desactivado.' })
  }
)

// ── PATCH /api/admin/usuarios/:id/password ───────────────────
router.patch(
  '/usuarios/:id/password',
  soloAdmin,
  async (req: Request, res: Response): Promise<void> => {
    const { password } = req.body as { password?: string }
    if (!password || password.length < 6) {
      res.status(400).json({ mensaje: 'La contraseña debe tener al menos 6 caracteres.' })
      return
    }
    const hash = await bcrypt.hash(password, 10)
    await pool.query('UPDATE usuarios SET password_hash=? WHERE id=?', [hash, req.params.id])
    res.json({ mensaje: 'Contraseña actualizada.' })
  }
)

// ── DELETE /api/admin/purgar ──────────────────────────────────
router.delete(
  '/purgar',
  soloAdmin,
  async (req: Request, res: Response): Promise<void> => {
    const anio = req.query.anio as string | undefined

    try {
      let query         = `UPDATE requisiciones SET estado='eliminada' WHERE estado != 'eliminada'`
      const params: unknown[] = []

      if (anio && !isNaN(Number(anio))) {
        query += ` AND YEAR(creado_en) = ?`
        params.push(Number(anio))
      }

      const [result]    = await pool.query(query, params)
      const affectedRows = (result as { affectedRows: number }).affectedRows

      await pool.query(
        `INSERT INTO auditoria (usuario_id, username, accion, tabla, detalle, ip)
         VALUES (?,?,?,?,?,?)`,
        [
          req.user.id,
          req.user.username,
          'purgar',
          'requisiciones',
          JSON.stringify({ afectadas: affectedRows, anio: anio ?? 'todos' }),
          req.ip,
        ]
      )

      res.json({
        mensaje:   `${affectedRows} requisición(es) purgadas definitivamente.`,
        afectadas: affectedRows,
      })
    } catch (err) {
      console.error('[PURGAR]', err)
      res.status(500).json({ mensaje: 'Error al purgar datos.' })
    }
  }
)

export default router