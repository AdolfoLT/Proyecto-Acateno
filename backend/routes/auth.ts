import { Router, Request, Response } from 'express'
import bcrypt from 'bcrypt'
import jwt, { type SignOptions } from 'jsonwebtoken'
import mysql from 'mysql2/promise'
import pool from '../config/db.js'
import { authMiddleware } from '../middleware/auth.js'
import { Usuario } from '../types.js'
import rateLimit from 'express-rate-limit'

const router = Router()

const loginLimiter = rateLimit({
  windowMs:        15 * 60 * 1000,
  max:             10,
  message:         { mensaje: 'Demasiados intentos. Espera 15 minutos.' },
  standardHeaders: true,
  legacyHeaders:   false,
})

// ── POST /api/auth/login ─────────────────────────────────────
router.post('/login', loginLimiter, async (req: Request, res: Response): Promise<void> => {
  const { username, password } = req.body as { username?: string; password?: string }

  if (!username || !password) {
    res.status(400).json({ mensaje: 'Usuario y contraseña requeridos.' })
    return
  }

  try {
    const [rows] = await pool.query<Usuario[] & mysql.RowDataPacket[]>(
      'SELECT * FROM usuarios WHERE username = ? AND activo = 1 LIMIT 1',
      [username.trim().toLowerCase()]
    )

    const usuario = rows[0]
    if (!usuario) {
      res.status(401).json({ mensaje: 'Credenciales incorrectas.' })
      return
    }

    const valida = await bcrypt.compare(password, usuario.password_hash)
    if (!valida) {
      res.status(401).json({ mensaje: 'Credenciales incorrectas.' })
      return
    }

    // expiresIn requiere StringValue — lo casteamos explícitamente
    const jwtOptions: SignOptions = {
      expiresIn: (process.env.JWT_EXPIRES_IN ?? '8h') as SignOptions['expiresIn'],
    }

    const token = jwt.sign(
      { id: usuario.id, username: usuario.username, rol: usuario.rol, nombre: usuario.nombre },
      process.env.JWT_SECRET as string,
      jwtOptions
    )

    await pool.query(
      'INSERT INTO auditoria (usuario_id, username, accion, tabla, ip) VALUES (?,?,?,?,?)',
      [usuario.id, usuario.username, 'login', 'usuarios', req.ip]
    )

    res.json({
      token,
      usuario: {
        id:       usuario.id,
        nombre:   usuario.nombre,
        username: usuario.username,
        rol:      usuario.rol,
      },
    })
  } catch (err) {
    console.error('[AUTH] Login error:', err)
    res.status(500).json({ mensaje: 'Error interno del servidor.' })
  }
})

// ── POST /api/auth/logout ────────────────────────────────────
router.post('/logout', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  await pool.query(
    'INSERT INTO auditoria (usuario_id, username, accion, tabla, ip) VALUES (?,?,?,?,?)',
    [req.user.id, req.user.username, 'logout', 'usuarios', req.ip]
  )
  res.json({ mensaje: 'Sesión cerrada.' })
})

// ── GET /api/auth/me ─────────────────────────────────────────
router.get('/me', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const [rows] = await pool.query(
      'SELECT id, nombre, username, rol FROM usuarios WHERE id = ? AND activo = 1',
      [req.user.id]
    )
    const fila = (rows as Usuario[])[0]
    if (!fila) {
      res.status(404).json({ mensaje: 'Usuario no encontrado.' })
      return
    }
    res.json(fila)
  } catch {
    res.status(500).json({ mensaje: 'Error interno.' })
  }
})

export default router