import { useState, FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import logoAcateno from '../assets/hero.png';

const IcoEyeOn  = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>);
const IcoEyeOff = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>);
const IcoAlert  = () => (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>);
const IcoLock   = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>);
const IcoLoader = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg>);

interface LoginForm {
  username: string;
  password: string;
}

export default function Login() {
  const { login, cargando } = useAuth();
  const [form,  setForm]  = useState<LoginForm>({ username: '', password: '' });
  const [error, setError] = useState('');
  const [show,  setShow]  = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    const r = await login(form.username, form.password);
    if (!r.ok) setError(r.mensaje);
  }

  return (
    <div className="login-page">
      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
      <div className="login-bg" />

      <div className="login-left">
        <img src={logoAcateno} alt="Municipio de Acateno" className="login-logo" />
        <div className="login-brand-text">
          <h1>ACATENO</h1>
          <p>H. Ayuntamiento · Unidad y Transformación</p>
        </div>
        <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 280 }}>
          {['Sistema de Requisiciones', 'Control Presupuestal', 'Gestión Documental'].map(t => (
            <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'rgba(255,255,255,.55)', fontSize: '.82rem' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--dorado-claro)', flexShrink: 0 }} />
              {t}
            </div>
          ))}
        </div>
      </div>

      <div className="login-right">
        <div className="login-form-wrap fade-in">
          <h2>Iniciar sesión</h2>
          <p>Ingresa tus credenciales para continuar</p>

          {error && (
            <div className="login-error" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <IcoAlert /> {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="login-input-group">
              <label>Usuario</label>
              <input
                type="text"
                autoComplete="username"
                placeholder="tu.usuario"
                value={form.username}
                onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                required
              />
            </div>

            <div className="login-input-group">
              <label>Contraseña</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={show ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  style={{ paddingRight: 44, width: '100%' }}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShow(s => !s)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gris-60)', padding: 0, display: 'flex', alignItems: 'center' }}
                  title={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {show ? <IcoEyeOff /> : <IcoEyeOn />}
                </button>
              </div>
            </div>

            <button type="submit" className="btn-login" disabled={cargando}>
              {cargando
                ? <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}><IcoLoader /> Verificando...</span>
                : 'Entrar al sistema'
              }
            </button>
          </form>

          <div style={{ marginTop: 28, padding: '14px 16px', background: 'var(--gris-10)', borderRadius: 10, fontSize: '.74rem', color: 'var(--texto-claro)', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <IcoLock />
            <span>Acceso restringido al personal autorizado del H. Ayuntamiento de Acateno, Puebla.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
