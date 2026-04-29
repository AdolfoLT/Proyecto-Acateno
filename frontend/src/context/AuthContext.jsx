import { createContext, useContext, useState, useCallback } from 'react'
import axios from 'axios'

const AuthCtx = createContext(null)

const api = axios.create({ 
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000/api' 
})

// Inyectar token en cada request
api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('token')
  if (token) cfg.headers.Authorization = `Bearer ${token}`
  return cfg
})

// Si expira token, redirigir a login
api.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('usuario')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export { api }

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(() => {
    try { return JSON.parse(localStorage.getItem('usuario')) } catch { return null }
  })
  const [cargando, setCargando] = useState(false)

  const login = useCallback(async (username, password) => {
    setCargando(true)
    try {
      const { data } = await api.post('/auth/login', { username, password })
      localStorage.setItem('token', data.token)
      localStorage.setItem('usuario', JSON.stringify(data.usuario))
      setUsuario(data.usuario)
      return { ok: true }
    } catch (err) {
      return { ok: false, mensaje: err.response?.data?.mensaje || 'Error al iniciar sesión.' }
    } finally {
      setCargando(false)
    }
  }, [])

  const logout = useCallback(async () => {
    try { await api.post('/auth/logout') } catch {}
    localStorage.removeItem('token')
    localStorage.removeItem('usuario')
    setUsuario(null)
  }, [])

  const esAdmin    = usuario?.rol === 'admin'
  const esContador = usuario?.rol === 'contador'
  // "privilegiado" = acceso al panel de admin (ocultar/restaurar)
  const esPrivilegiado = esAdmin || esContador

  return (
    <AuthCtx.Provider value={{
      usuario, login, logout, cargando,
      esAdmin,
      esContador,
      esPrivilegiado,
    }}>
      {children}
    </AuthCtx.Provider>
  )
}

export const useAuth = () => useContext(AuthCtx)