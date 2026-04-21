import jwt from 'jsonwebtoken';

/**
 * Verifica el token JWT en el header Authorization: Bearer <token>
 * Si es válido, adjunta req.user con { id, username, rol, nombre }
 */
export function authMiddleware(req, res, next) {
  const header = req.headers['authorization'] || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ mensaje: 'Token no proporcionado.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ mensaje: 'Token inválido o expirado.' });
  }
}

/**
 * Solo deja pasar a administradores.
 * Úsalo DESPUÉS de authMiddleware.
 */
export function soloAdmin(req, res, next) {
  if (req.user?.rol !== 'admin') {
    return res.status(403).json({ mensaje: 'Acceso restringido a administradores.' });
  }
  next();
}

/**
 * Deja pasar a admin Y contadores.
 * Úsalo DESPUÉS de authMiddleware.
 * Permisos del contador: ver todo, ocultar/restaurar requisiciones.
 * NO puede purgar ni gestionar usuarios.
 */
export function adminOContador(req, res, next) {
  const rol = req.user?.rol;
  if (rol !== 'admin' && rol !== 'contador') {
    return res.status(403).json({ mensaje: 'Acceso restringido.' });
  }
  next();
}