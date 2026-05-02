import { Router, Request, Response } from 'express'
import mysql from 'mysql2/promise'
import pool from '../config/db.js'
import { authMiddleware, adminOContador } from '../middleware/auth.js'
import { Requisicion, Area, Clasificacion, FormaPago } from '../types.js'

const router = Router()
router.use(authMiddleware)

async function auditar(
  usuario:    { id: number; username: string },
  accion:     string,
  registroId: number,
  detalle:    Record<string, unknown>,
  ip:         string | undefined
): Promise<void> {
  await pool.query(
    `INSERT INTO auditoria (usuario_id, username, accion, tabla, registro_id, detalle, ip)
     VALUES (?,?,?,?,?,?,?)`,
    [usuario.id, usuario.username, accion, 'requisiciones', registroId,
     JSON.stringify(detalle), ip]
  )
}

// ── GET /api/requisiciones/catalogos/areas ────────────────────
router.get('/catalogos/areas', async (_req: Request, res: Response): Promise<void> => {
  try {
    const [rows] = await pool.query<Area[] & mysql.RowDataPacket[]>(
      'SELECT * FROM areas ORDER BY nombre'
    )
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ mensaje: 'Error al obtener áreas.' })
  }
})

// ── GET /api/requisiciones/catalogos/clasificaciones ──────────
router.get('/catalogos/clasificaciones', async (_req: Request, res: Response): Promise<void> => {
  try {
    const [rows] = await pool.query<Clasificacion[] & mysql.RowDataPacket[]>(
      'SELECT * FROM clasificaciones ORDER BY clave'
    )
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ mensaje: 'Error al obtener clasificaciones.' })
  }
})

// ── GET /api/requisiciones ────────────────────────────────────
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const page             = Number(req.query.page  ?? 1)
    const limit            = Number(req.query.limit ?? 20)
    const buscar           = String(req.query.buscar ?? '')
    const area_id          = req.query.area_id          as string | undefined
    const clasificacion_id = req.query.clasificacion_id as string | undefined
    const verOcultas       = req.query.verOcultas       as string | undefined
    const offset           = (page - 1) * limit

    const esPrivilegiado = req.user.rol === 'admin' || req.user.rol === 'contador'

    let estadoFiltro: string
    if (esPrivilegiado && verOcultas === '1') {
      estadoFiltro = `r.estado IN ('activa','oculta')`
    } else {
      estadoFiltro = `r.estado = 'activa'`
    }

    const params: unknown[] = []
    let where = `WHERE ${estadoFiltro}`

    if (buscar) {
      where += ` AND (r.folio LIKE ? OR r.proveedor LIKE ? OR r.concepto LIKE ?)`
      params.push(`%${buscar}%`, `%${buscar}%`, `%${buscar}%`)
    }
    if (area_id)          { where += ` AND r.area_id = ?`;          params.push(area_id) }
    if (clasificacion_id) { where += ` AND r.clasificacion_id = ?`; params.push(clasificacion_id) }

    const [[{ total }]] = await pool.query<[{ total: number }] & mysql.RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM requisiciones r ${where}`, params
    )

    const [rows] = await pool.query<Requisicion[] & mysql.RowDataPacket[]>(
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
      [...params, limit, offset]
    )

    res.json({
      datos:   rows,
      total,
      pagina:  page,
      paginas: Math.ceil(total / limit),
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ mensaje: 'Error al obtener requisiciones.' })
  }
})

// ── GET /api/requisiciones/:id ────────────────────────────────
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const [rows] = await pool.query<Requisicion[] & mysql.RowDataPacket[]>(
      `SELECT r.*, c.clave AS clasificacion_clave, c.nombre AS clasificacion_nombre
       FROM requisiciones r
       LEFT JOIN clasificaciones c ON c.id = r.clasificacion_id
       WHERE r.id = ? AND r.estado != 'eliminada'`,
      [req.params.id]
    )
    const fila = rows[0]
    if (!fila) {
      res.status(404).json({ mensaje: 'Requisición no encontrada.' })
      return
    }
    const esPrivilegiado = req.user.rol === 'admin' || req.user.rol === 'contador'
    if (fila.estado === 'oculta' && !esPrivilegiado) {
      res.status(403).json({ mensaje: 'Sin acceso.' })
      return
    }
    res.json(fila)
  } catch {
    res.status(500).json({ mensaje: 'Error al obtener requisición.' })
  }
})

// ── POST /api/requisiciones ───────────────────────────────────
router.post('/', async (req: Request, res: Response): Promise<void> => {
  const {
    area_id, area_nombre, clasificacion_id,
    concepto, proveedor, rfc, monto,
    forma_pago, cuenta_bancaria, no_factura, no_contrato, fecha,
  } = req.body as {
    area_id?:          number
    area_nombre?:      string
    clasificacion_id?: number
    concepto?:         string
    proveedor?:        string
    rfc?:              string
    monto?:            number | string
    forma_pago?:       FormaPago
    cuenta_bancaria?:  string
    no_factura?:       string
    no_contrato?:      string
    fecha?:            string
  }

  if (!monto || isNaN(Number(monto))) {
    res.status(400).json({ mensaje: 'El monto es requerido.' })
    return
  }

  try {
    const [[{ total }]] = await pool.query<[{ total: number }] & mysql.RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM requisiciones WHERE YEAR(creado_en) = YEAR(NOW())`
    )
    const folio = `REQ-${new Date().getFullYear()}-${String(total + 1).padStart(4, '0')}`

    const [result] = await pool.query(
      `INSERT INTO requisiciones
         (folio, area_id, area_nombre, clasificacion_id, concepto, proveedor, rfc,
          monto, forma_pago, cuenta_bancaria, no_factura, no_contrato, fecha, creado_por)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [folio, area_id ?? null, area_nombre ?? null, clasificacion_id ?? null,
       concepto ?? null, proveedor ?? null, rfc ?? null,
       Number(monto), forma_pago ?? 'CHEQUE', cuenta_bancaria ?? null,
       no_factura ?? null, no_contrato ?? null,
       fecha ?? new Date().toISOString().split('T')[0],
       req.user.id]
    )

    const insertId = (result as { insertId: number }).insertId
    await auditar(req.user, 'crear', insertId, { folio, monto }, req.ip)
    res.status(201).json({ id: insertId, folio, mensaje: 'Requisición creada.' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ mensaje: 'Error al crear requisición.' })
  }
})

// ── PUT /api/requisiciones/:id ────────────────────────────────
router.put('/:id', async (req: Request, res: Response): Promise<void> => {
  const {
    area_id, area_nombre, clasificacion_id,
    concepto, proveedor, rfc, monto,
    forma_pago, cuenta_bancaria, no_factura, no_contrato, fecha,
  } = req.body as Partial<Requisicion>

  try {
    const [rows] = await pool.query<Requisicion[] & mysql.RowDataPacket[]>(
      `SELECT * FROM requisiciones WHERE id = ? AND estado != 'eliminada'`,
      [req.params.id]
    )
    const original = rows[0]
    if (!original) {
      res.status(404).json({ mensaje: 'No encontrada.' })
      return
    }

    await pool.query(
      `UPDATE requisiciones SET
         area_id=?, area_nombre=?, clasificacion_id=?, concepto=?,
         proveedor=?, rfc=?, monto=?, forma_pago=?,
         cuenta_bancaria=?, no_factura=?, no_contrato=?, fecha=?
       WHERE id=?`,
      [
        area_id          ?? null,
        area_nombre      ?? null,
        clasificacion_id ?? null,
        concepto         ?? null,
        proveedor        ?? null,
        rfc              ?? null,
        Number(monto)    || original.monto,
        forma_pago       || original.forma_pago,
        cuenta_bancaria  ?? null,
        no_factura       ?? null,
        no_contrato      ?? null,
        fecha            || original.fecha,
        req.params.id,
      ]
    )

    await auditar(req.user, 'editar', Number(req.params.id), req.body as Record<string, unknown>, req.ip)
    res.json({ mensaje: 'Requisición actualizada.' })
  } catch {
    res.status(500).json({ mensaje: 'Error al actualizar.' })
  }
})

// ── DELETE /api/requisiciones/:id — soft delete ───────────────
router.delete(
  '/:id',
  adminOContador,
  async (req: Request, res: Response): Promise<void> => {
    const { motivo } = req.body as { motivo?: string }
    try {
      const [rows] = await pool.query<Requisicion[] & mysql.RowDataPacket[]>(
        `SELECT * FROM requisiciones WHERE id = ? AND estado = 'activa'`,
        [req.params.id]
      )
      if (!rows[0]) {
        res.status(404).json({ mensaje: 'No encontrada o ya oculta.' })
        return
      }

      await pool.query(
        `UPDATE requisiciones
         SET estado='oculta', oculta_por=?, oculta_en=NOW(), oculta_motivo=?
         WHERE id=?`,
        [req.user.id, motivo ?? null, req.params.id]
      )

      await auditar(req.user, 'ocultar', Number(req.params.id), { motivo: motivo ?? null }, req.ip)
      res.json({ mensaje: 'Requisición ocultada. El administrador puede restaurarla.' })
    } catch {
      res.status(500).json({ mensaje: 'Error al ocultar.' })
    }
  }
)

// ── PATCH /api/requisiciones/:id/restaurar ────────────────────
router.patch(
  '/:id/restaurar',
  adminOContador,
  async (req: Request, res: Response): Promise<void> => {
    try {
      await pool.query(
        `UPDATE requisiciones
         SET estado='activa', oculta_por=NULL, oculta_en=NULL, oculta_motivo=NULL
         WHERE id=? AND estado='oculta'`,
        [req.params.id]
      )
      await auditar(req.user, 'restaurar', Number(req.params.id), {}, req.ip)
      res.json({ mensaje: 'Requisición restaurada.' })
    } catch {
      res.status(500).json({ mensaje: 'Error al restaurar.' })
    }
  }
)

export default router