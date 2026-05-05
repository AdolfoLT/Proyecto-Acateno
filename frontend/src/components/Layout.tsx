import { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import logoAcateno from '../assets/hero.png';
import Swal from 'sweetalert2';
import type { ReactElement } from 'react';

const IcoNueva      = () => <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>;
const IcoLista      = () => <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>;
const IcoAdmin      = () => <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;
const IcoLogout     = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>;
const IcoShield     = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;
const IcoCalculator = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="10" y2="10"/><line x1="12" y1="10" x2="14" y2="10"/><line x1="8" y1="14" x2="10" y2="14"/><line x1="12" y1="14" x2="14" y2="14"/><line x1="16" y1="14" x2="16" y2="18"/><line x1="8" y1="18" x2="10" y2="18"/><line x1="12" y1="18" x2="14" y2="18"/></svg>;
const IcoMenu       = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>;
const IcoX          = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;

interface NavItem {
  to:    string;
  label: string;
  icon:  ReactElement;
}

export default function Layout() {
  const { usuario, logout, esAdmin, esContador, esPrivilegiado } = useAuth();
  const navigate      = useNavigate();
  const { pathname }  = useLocation();
  const [open, setOpen] = useState<boolean>(false);

  // Cerrar sidebar al navegar
  useEffect(() => { setOpen(false); }, [pathname]);

  // Cerrar sidebar si se amplía la pantalla a desktop
  useEffect(() => {
    const onResize = () => { if (window.innerWidth > 900) setOpen(false); };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Bloquear scroll del body cuando sidebar está abierto en móvil
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const initiales = usuario?.nombre
    ? usuario.nombre.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  async function handleLogout(): Promise<void> {
    const r = await Swal.fire({
      title:             '¿Cerrar sesión?',
      icon:              'question',
      showCancelButton:  true,
      confirmButtonText: 'Sí, salir',
      cancelButtonText:  'Cancelar',
      confirmButtonColor: '#1a3a2a',
    });
    if (r.isConfirmed) { await logout(); navigate('/login'); }
  }

  const navItems: NavItem[] = [
    { to: '/',          label: 'Nueva Requisición', icon: <IcoNueva /> },
    { to: '/historial', label: 'Historial',          icon: <IcoLista /> },
    ...(esPrivilegiado ? [{ to: '/admin', label: 'Administración', icon: <IcoAdmin /> }] : []),
  ];

  const bannerInfo = esAdmin
    ? { icon: <IcoShield />, texto: 'Sesión de Administrador — Panel de control habilitado' }
    : esContador
      ? { icon: <IcoCalculator />, texto: 'Sesión de Contador — Acceso a gestión de requisiciones' }
      : null;

  return (
    <div className="app-layout">

      {/* Overlay oscuro detrás del sidebar en móvil */}
      {open && (
        <div className="sidebar-overlay" onClick={() => setOpen(false)} aria-hidden="true" />
      )}

      {/* ── Sidebar ───────────────────────────────────────────── */}
      <aside className={`sidebar${open ? ' open' : ''}`}>
        <div className="sidebar-brand">
          <img src={logoAcateno} alt="Municipio de Acateno" />
          <div>
            <div className="sidebar-titulo">ACATENO</div>
            <div className="sidebar-sub">Tesorería · 2024-2027</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section-label">Menú</div>
          {navItems.map(item => (
            <button
              key={item.to}
              className={`nav-item${pathname === item.to ? ' activo' : ''}`}
              onClick={() => navigate(item.to)}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-avatar">{initiales}</div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{usuario?.nombre}</div>
              <div className="sidebar-user-rol">{usuario?.rol}</div>
            </div>
          </div>
          <button className="btn-logout" onClick={handleLogout}>
            <IcoLogout /> Cerrar sesión
          </button>
        </div>
      </aside>

      {/* ── Contenido principal ───────────────────────────────── */}
      <div className="main-content">

        {/* Topbar móvil con hamburguesa — solo visible en ≤900px via CSS */}
        <header className="mobile-topbar">
          <button
            className="hamburger-btn"
            onClick={() => setOpen(s => !s)}
            aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
          >
            {open ? <IcoX /> : <IcoMenu />}
          </button>
          <span className="mobile-topbar-title">ACATENO · Tesorería</span>
          <div className="mobile-avatar">{initiales}</div>
        </header>

        {bannerInfo && (
          <div className="admin-banner">
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {bannerInfo.icon} {bannerInfo.texto}
            </span>
          </div>
        )}

        <Outlet />
      </div>
    </div>
  );
}