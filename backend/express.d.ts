// backend/express.d.ts
// Extiende el tipo Request de Express globalmente para incluir `user`
// Esto elimina la necesidad de usar RequestAutenticado en los handlers

import { UsuarioJWT } from './types.js'

declare global {
  namespace Express {
    interface Request {
      user: UsuarioJWT
    }
  }
}
