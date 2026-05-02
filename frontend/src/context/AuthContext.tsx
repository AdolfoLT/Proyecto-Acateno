import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from 'react';
import axios, { AxiosInstance } from 'axios';
import { UsuarioSesion } from '../types';

interface AuthContextValue {
  usuario:        UsuarioSesion | null;
  cargando:       boolean;
  esAdmin:        boolean;
  esContador:     boolean;
  esPrivilegiado: boolean;
  login:          (username: string, password: string) => Promise<{ ok: true } | { ok: false; mensaje: string }>;
  logout:         () => Promise<void>;
}

const AuthCtx = createContext<AuthContextValue | null>(null);

export const api: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000/api',
});

api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('token');
  if (token && cfg.headers) {
    cfg.headers.Authorization = `Bearer ${token}`;
  }
  return cfg;
});

api.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('usuario');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

function parseUsuario(): UsuarioSesion | null {
  try {
    return JSON.parse(localStorage.getItem('usuario') ?? 'null') as UsuarioSesion | null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<UsuarioSesion | null>(parseUsuario);
  const [cargando, setCargando] = useState(false);

  const login = useCallback(
    async (username: string, password: string): Promise<{ ok: true } | { ok: false; mensaje: string }> => {
      setCargando(true);
      try {
        const { data } = await api.post<{ token: string; usuario: UsuarioSesion }>(
          '/auth/login',
          { username, password }
        );
        localStorage.setItem('token', data.token);
        localStorage.setItem('usuario', JSON.stringify(data.usuario));
        setUsuario(data.usuario);
        return { ok: true };
      } catch (err) {
        const mensaje =
          axios.isAxiosError(err)
            ? (err.response?.data as { mensaje?: string })?.mensaje ?? 'Error al iniciar sesión.'
            : 'Error al iniciar sesión.';
        return { ok: false, mensaje };
      } finally {
        setCargando(false);
      }
    },
    []
  );

  const logout = useCallback(async () => {
    try { await api.post('/auth/logout'); } catch {}
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    setUsuario(null);
  }, []);

  const esAdmin        = usuario?.rol === 'admin';
  const esContador     = usuario?.rol === 'contador';
  const esPrivilegiado = esAdmin || esContador;

  return (
    <AuthCtx.Provider value={{ usuario, login, logout, cargando, esAdmin, esContador, esPrivilegiado }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
