import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import pool from '../config/db.js';
import { authMiddleware } from '../middleware/auth.js';
import rateLimit from 'express-rate-limit';

const router = Router();

// Limitar intentos de login: máx 10 por IP cada 15 min
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { mensaje: 'Demasiados intentos. Espera 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── POST /api/auth/login ─────────────────────────────────────
router.post('/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ mensaje: 'Usuario y contraseña requeridos.' });
  }

  try {
    const [rows] = await pool.query(
      'SELECT * FROM usuarios WHERE username = ? AND activo = 1 LIMIT 1',
      [username.trim().toLowerCase()]
    );

    const usuario = rows[0];
    if (!usuario) {
      return res.status(401).json({ mensaje: 'Credenciales incorrectas.' });
    }

    const valida = await bcrypt.compare(password, usuario.password_hash);
    if (!valida) {
      return res.status(401).json({ mensaje: 'Credenciales incorrectas.' });
    }

    // JWT — múltiples sesiones simultáneas sin problema (stateless)
    const token = jwt.sign(
      { id: usuario.id, username: usuario.username, rol: usuario.rol, nombre: usuario.nombre },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    // Auditoría
    await pool.query(
      'INSERT INTO auditoria (usuario_id, username, accion, tabla, ip) VALUES (?,?,?,?,?)',
      [usuario.id, usuario.username, 'login', 'usuarios', req.ip]
    );

    res.json({
      token,
      usuario: {
        id:       usuario.id,
        nombre:   usuario.nombre,
        username: usuario.username,
        rol:      usuario.rol,
      },
    });
  } catch (err) {
    console.error('[AUTH] Login error:', err);
    res.status(500).json({ mensaje: 'Error interno del servidor.' });
  }
});

// ── POST /api/auth/logout ────────────────────────────────────
// JWT es stateless, pero registramos el evento
router.post('/logout', authMiddleware, async (req, res) => {
  await pool.query(
    'INSERT INTO auditoria (usuario_id, username, accion, tabla, ip) VALUES (?,?,?,?,?)',
    [req.user.id, req.user.username, 'logout', 'usuarios', req.ip]
  );
  res.json({ mensaje: 'Sesión cerrada.' });
});

// ── GET /api/auth/me ─────────────────────────────────────────
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, nombre, username, rol FROM usuarios WHERE id = ? AND activo = 1',
      [req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ mensaje: 'Usuario no encontrado.' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ mensaje: 'Error interno.' });
  }
});

export default router;
