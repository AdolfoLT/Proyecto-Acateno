import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Layout from './components/Layout';
import Home from './pages/Home';
import Historial from './pages/Historial';
import AdminPanel from './pages/AdminPanel';
import { ReactNode } from 'react';

function RutaProtegida({ children }: { children: ReactNode }) {
  const { usuario } = useAuth();
  if (!usuario) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RutaAdmin({ children }: { children: ReactNode }) {
  const { usuario } = useAuth();
  if (!usuario)               return <Navigate to="/login" replace />;
  if (usuario.rol !== 'admin') return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  const { usuario } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={usuario ? <Navigate to="/" replace /> : <Login />}
      />

      <Route
        path="/"
        element={
          <RutaProtegida>
            <Layout />
          </RutaProtegida>
        }
      >
        <Route index element={<Home />} />
        <Route path="historial" element={<Historial />} />
        <Route
          path="admin"
          element={
            <RutaAdmin>
              <AdminPanel />
            </RutaAdmin>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
