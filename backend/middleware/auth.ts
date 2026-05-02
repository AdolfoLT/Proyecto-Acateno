import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { RequestAutenticado, UsuarioJWT } from '../types.js';

export function authMiddleware(
  req: RequestAutenticado,
  res: Response,
  next: NextFunction
): void {
  const header = req.headers['authorization'] || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    res.status(401).json({ mensaje: 'Token no proporcionado.' });
    return;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as UsuarioJWT;
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ mensaje: 'Token inválido o expirado.' });
  }
}

export function soloAdmin(
  req: RequestAutenticado,
  res: Response,
  next: NextFunction
): void {
  if (req.user?.rol !== 'admin') {
    res.status(403).json({ mensaje: 'Acceso restringido a administradores.' });
    return;
  }
  next();
}

export function adminOContador(
  req: RequestAutenticado,
  res: Response,
  next: NextFunction
): void {
  const rol = req.user?.rol;
  if (rol !== 'admin' && rol !== 'contador') {
    res.status(403).json({ mensaje: 'Acceso restringido.' });
    return;
  }
  next();
}
