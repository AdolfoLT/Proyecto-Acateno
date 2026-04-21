import { useState, useEffect } from 'react'
import { api } from '../context/AuthContext'
import { useAuth } from '../context/AuthContext'
import Swal from 'sweetalert2'

// ── Iconos SVG ───────────────────────────────────────────────
const IcoFolder    = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
const IcoUsers     = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
const IcoClipboard = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg>
const IcoTrash2    = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
const IcoRotateCcw = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.75"/></svg>
const IcoKey       = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>
const IcoUserX     = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="18" y1="8" x2="23" y2="13"/><line x1="23" y1="8" x2="18" y2="13"/></svg>
const IcoUserCheck = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><polyline points="17 11 19 13 23 9"/></svg>
const IcoPlus      = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
const IcoShield    = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
const IcoUser      = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
const IcoCalculator= () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="10" y2="10"/><line x1="12" y1="10" x2="14" y2="10"/><line x1="16" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="10" y2="14"/><line x1="12" y1="14" x2="14" y2="14"/><line x1="16" y1="14" x2="16" y2="18"/><line x1="8" y1="18" x2="10" y2="18"/><line x1="12" y1="18" x2="14" y2="18"/></svg>
const IcoCheck     = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
const IcoAlertTri  = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
const IcoBomb      = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="13" r="7"/><path d="M14.35 4.65L16 3"/><path d="M18 2l-2 2"/><path d="M11 6V2"/><line x1="8" y1="10" x2="11" y2="13"/></svg>

export default function AdminPanel() {
  const { usuario } = useAuth()
  const esAdmin = usuario?.rol === 'admin'
  const esContador = usuario?.rol === 'contador'
  const esPrivilegiado = esAdmin || esContador

  const [tab, setTab]           = useState('ocultas')
  const [ocultas, setOcultas]   = useState([])
  const [usuarios, setUsuarios] = useState([])
  const [auditoria, setAuditoria] = useState([])
  const [loading, setLoading]   = useState(false)
  const [newUser, setNewUser]   = useState({ nombre: '', username: '', password: '', rol: 'usuario' })
  const [showForm, setShowForm] = useState(false)
  const [purgando, setPurgando] = useState(false)
  const [anioFiltro, setAnioFiltro] = useState('')

  // Tabs disponibles según rol
  const TABS_BASE = [
    { id: 'ocultas',   label: 'Req. Ocultadas', icon: <IcoFolder />,    visible: esPrivilegiado },
    { id: 'usuarios',  label: 'Usuarios',        icon: <IcoUsers />,    visible: esAdmin },
    { id: 'auditoria', label: 'Auditoría',       icon: <IcoClipboard />, visible: esAdmin },
    { id: 'purgar',    label: 'Purga de Datos',  icon: <IcoBomb />,     visible: esAdmin },
  ]
  const TABS = TABS_BASE.filter(t => t.visible)

  useEffect(() => {
    // Si el tab activo no está disponible para este rol, ir al primero disponible
    if (!TABS.find(t => t.id === tab)) setTab(TABS[0]?.id || 'ocultas')
  }, [])

  useEffect(() => {
    if (tab === 'ocultas')   cargarOcultas()
    if (tab === 'usuarios')  cargarUsuarios()
    if (tab === 'auditoria') cargarAuditoria()
  }, [tab])

  async function cargarOcultas() {
    setLoading(true)
    try { const { data } = await api.get('/admin/requisiciones-ocultas'); setOcultas(data) }
    catch { setOcultas([]) }
    finally { setLoading(false) }
  }
  async function cargarUsuarios() {
    setLoading(true)
    try { const { data } = await api.get('/admin/usuarios'); setUsuarios(data) }
    catch { setUsuarios([]) }
    finally { setLoading(false) }
  }
  async function cargarAuditoria() {
    setLoading(true)
    try { const { data } = await api.get('/admin/auditoria'); setAuditoria(data.datos || []) }
    catch { setAuditoria([]) }
    finally { setLoading(false) }
  }

  async function restaurar(id) {
    try {
      await api.patch(`/requisiciones/${id}/restaurar`)
      Swal.fire({ title: 'Restaurada', icon: 'success', confirmButtonColor: '#1a3a2a', timer: 1800, showConfirmButton: false })
      cargarOcultas()
    } catch {
      Swal.fire({ title: 'Error', icon: 'error', confirmButtonColor: '#1a3a2a' })
    }
  }

  async function toggleUsuario(u) {
    try { await api.patch(`/admin/usuarios/${u.id}/toggle`); cargarUsuarios() } catch {}
  }

  async function resetPassword(u) {
    const { value: pw } = await Swal.fire({
      title: 'Resetear contraseña',
      html: `Usuario: <b>${u.username}</b>`,
      input: 'password',
      inputPlaceholder: 'Nueva contraseña…',
      showCancelButton: true,
      confirmButtonColor: '#1a3a2a',
      inputAttributes: { minlength: 6 },
    })
    if (!pw) return
    try {
      await api.patch(`/admin/usuarios/${u.id}/password`, { password: pw })
      Swal.fire({ title: 'Contraseña actualizada', icon: 'success', confirmButtonColor: '#1a3a2a' })
    } catch {}
  }

  async function crearUsuario(e) {
    e.preventDefault()
    try {
      await api.post('/admin/usuarios', newUser)
      Swal.fire({ title: 'Usuario creado', text: `"${newUser.username}" creado exitosamente.`, icon: 'success', confirmButtonColor: '#1a3a2a' })
      setNewUser({ nombre: '', username: '', password: '', rol: 'usuario' })
      setShowForm(false)
      cargarUsuarios()
    } catch (err) {
      Swal.fire({ title: 'Error', text: err.response?.data?.mensaje || 'Error.', icon: 'error', confirmButtonColor: '#1a3a2a' })
    }
  }

  async function handlePurgar() {
    const anioTexto = anioFiltro ? `del año ${anioFiltro}` : 'de TODOS LOS AÑOS'
    const conf = await Swal.fire({
      title: '⚠️ Purga de datos',
      html: `
        <p>Estás a punto de <b>eliminar definitivamente</b> todas las requisiciones ${anioTexto}.</p>
        <p style="margin-top:10px;color:#b91c1c;font-size:.85rem">
          Esta acción <b>NO SE PUEDE DESHACER</b>. Las requisiciones no podrán recuperarse.
        </p>
        <p style="margin-top:8px;font-size:.8rem;color:#666">
          Para confirmar, escribe: <b>PURGAR</b>
        </p>`,
      input: 'text',
      inputPlaceholder: 'Escribe PURGAR para confirmar',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar definitivamente',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#b91c1c',
      inputValidator: (val) => {
        if (val !== 'PURGAR') return 'Debes escribir exactamente "PURGAR" para confirmar.'
      },
    })
    if (!conf.isConfirmed) return

    setPurgando(true)
    try {
      const params = anioFiltro ? { anio: anioFiltro } : {}
      const { data } = await api.delete('/admin/purgar', { params })
      Swal.fire({
        title: 'Purga completada',
        html: `<b>${data.afectadas}</b> requisición(es) eliminadas definitivamente.`,
        icon: 'success',
        confirmButtonColor: '#1a3a2a',
      })
      setAnioFiltro('')
    } catch (err) {
      Swal.fire({ title: 'Error', text: err.response?.data?.mensaje || 'No se pudo purgar.', icon: 'error', confirmButtonColor: '#1a3a2a' })
    } finally {
      setPurgando(false)
    }
  }

  const fmt = n => Number(n || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })

  const accionColor = a =>
    a === 'ocultar'   ? 'var(--rojo)'       :
    a === 'restaurar' ? 'var(--verde-claro)' :
    a === 'purgar'    ? '#7c3aed'            :
    a === 'crear'     ? '#1d4ed8'            : 'var(--texto-medio)'

  const rolBadgeStyle = (rol) => ({
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: '2px 8px', borderRadius: 20, fontSize: '.72rem', fontWeight: 600,
    background: rol === 'admin' ? 'rgba(26,58,42,.12)' :
                rol === 'contador' ? 'rgba(29,78,216,.1)' : 'var(--gris-20)',
    color: rol === 'admin' ? 'var(--verde-oscuro)' :
           rol === 'contador' ? '#1d4ed8' : 'var(--texto-medio)',
  })

  const anioActual = new Date().getFullYear()
  const aniosDisponibles = Array.from({ length: 5 }, (_, i) => anioActual - i)

  return (
    <>
      <div className="topbar">
        <div className="topbar-titulo">Panel de Administración</div>
        <div className="topbar-breadcrumb">Tesorería · <span>Admin</span></div>
      </div>

      <div className="page-body fade-in">
        <div className="alert warning" style={{ marginBottom: 20 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <IcoAlertTri />
            <span>
              <b>Área de administración</b>
              {esContador
                ? ' — Acceso de Contador: puedes ver y restaurar requisiciones ocultadas.'
                : ' — Los cambios aquí afectan directamente al sistema.'}
            </span>
          </span>
        </div>

        {/* Tabs */}
        <div className="tabs" style={{ maxWidth: 600, marginBottom: 24 }}>
          {TABS.map(t => (
            <button key={t.id} className={`tab-btn ${tab === t.id ? 'activo' : ''}`}
              onClick={() => setTab(t.id)}
              style={t.id === 'purgar' ? { color: tab === t.id ? '#b91c1c' : undefined } : {}}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{t.icon}{t.label}</span>
            </button>
          ))}
        </div>

        {/* ── Requisiciones ocultadas ─────────────────────────── */}
        {tab === 'ocultas' && (
          <div className="card">
            <div className="card-header">
              <div className="card-title">Requisiciones Ocultadas</div>
            </div>
            {loading ? (
              <div className="loading-center"><div className="spinner" /></div>
            ) : ocultas.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon"><IcoCheck /></div>
                <h3>Sin requisiciones ocultadas</h3>
                <p>No hay registros pendientes de revisión.</p>
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Folio</th>
                      <th>Beneficiario</th>
                      <th>Monto</th>
                      <th>Ocultada por</th>
                      <th>Motivo</th>
                      <th>Fecha</th>
                      <th style={{ textAlign: 'center' }}>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ocultas.map(r => (
                      <tr key={r.id} style={{ background: '#fffbeb' }}>
                        <td><span className="folio-badge">{r.folio}</span></td>
                        <td>{r.proveedor || '—'}</td>
                        <td className="monto-cell">{fmt(r.monto)}</td>
                        <td style={{ fontSize: '.8rem' }}>{r.oculta_por_nombre || '—'}</td>
                        <td style={{ fontSize: '.78rem', color: 'var(--texto-claro)', maxWidth: 160 }}>
                          {r.oculta_motivo || '—'}
                        </td>
                        <td style={{ fontSize: '.78rem' }}>{r.oculta_en?.slice(0, 10)}</td>
                        <td style={{ textAlign: 'center' }}>
                          <button className="btn btn-primary" style={{ fontSize: '.75rem', padding: '5px 12px' }}
                            onClick={() => restaurar(r.id)}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                              <IcoRotateCcw />Restaurar
                            </span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Usuarios (solo admin) ───────────────────────────── */}
        {tab === 'usuarios' && esAdmin && (
          <div className="card">
            <div className="card-header">
              <div className="card-title">Gestión de Usuarios</div>
              <button className="btn btn-primary" onClick={() => setShowForm(s => !s)}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <IcoPlus />{showForm ? 'Cancelar' : 'Nuevo usuario'}
                </span>
              </button>
            </div>

            {showForm && (
              <form onSubmit={crearUsuario} style={{
                padding: '20px 24px', borderBottom: '1px solid var(--gris-20)',
                background: 'var(--gris-10)',
              }}>
                <div className="form-grid" style={{ maxWidth: 640 }}>
                  <div className="form-group">
                    <label>Nombre completo</label>
                    <input required value={newUser.nombre}
                      onChange={e => setNewUser(f => ({ ...f, nombre: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label>Usuario (login)</label>
                    <input required value={newUser.username}
                      onChange={e => setNewUser(f => ({ ...f, username: e.target.value.toLowerCase() }))} />
                  </div>
                  <div className="form-group">
                    <label>Contraseña</label>
                    <input type="password" required minLength={6} value={newUser.password}
                      onChange={e => setNewUser(f => ({ ...f, password: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label>Rol</label>
                    <select value={newUser.rol} onChange={e => setNewUser(f => ({ ...f, rol: e.target.value }))}>
                      <option value="usuario">Usuario</option>
                      <option value="contador">Contador</option>
                      <option value="admin">Administrador</option>
                    </select>
                  </div>
                </div>
                <div style={{ marginTop: 14 }}>
                  <button type="submit" className="btn btn-primary">
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><IcoPlus />Crear usuario</span>
                  </button>
                </div>
              </form>
            )}

            {loading ? (
              <div className="loading-center"><div className="spinner" /></div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>#</th><th>Nombre</th><th>Usuario</th><th>Rol</th>
                      <th>Estado</th><th>Creado</th><th style={{ textAlign: 'center' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usuarios.map(u => (
                      <tr key={u.id}>
                        <td style={{ color: 'var(--texto-claro)', fontSize: '.8rem' }}>{u.id}</td>
                        <td><b>{u.nombre}</b></td>
                        <td>
                          <code style={{ fontSize: '.82rem', background: 'var(--gris-20)', padding: '2px 6px', borderRadius: 4 }}>
                            {u.username}
                          </code>
                        </td>
                        <td>
                          <span style={rolBadgeStyle(u.rol)}>
                            {u.rol === 'admin'    ? <><IcoShield /> Admin</>    :
                             u.rol === 'contador' ? <><IcoCalculator /> Contador</> :
                                                   <><IcoUser /> Usuario</>}
                          </span>
                        </td>
                        <td>
                          <span style={{
                            fontSize: '.75rem', display: 'inline-flex', alignItems: 'center', gap: 4,
                            color: u.activo ? 'var(--verde-claro)' : 'var(--rojo)',
                          }}>
                            <span style={{
                              width: 7, height: 7, borderRadius: '50%',
                              background: u.activo ? 'var(--verde-claro)' : 'var(--rojo)',
                              display: 'inline-block',
                            }} />
                            {u.activo ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td style={{ fontSize: '.78rem', color: 'var(--texto-claro)' }}>
                          {u.creado_en?.slice(0, 10)}
                        </td>
                        <td>
                          <div className="acciones-cell" style={{ justifyContent: 'center' }}>
                            <button className="btn btn-secondary"
                              style={{ fontSize: '.72rem', padding: '4px 10px' }}
                              onClick={() => resetPassword(u)}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <IcoKey />Reset
                              </span>
                            </button>
                            <button
                              className={`btn ${u.activo ? 'btn-danger' : 'btn-secondary'}`}
                              style={{ fontSize: '.72rem', padding: '4px 10px' }}
                              onClick={() => toggleUsuario(u)}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                {u.activo ? <><IcoUserX />Desactivar</> : <><IcoUserCheck />Activar</>}
                              </span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Auditoría (solo admin) ──────────────────────────── */}
        {tab === 'auditoria' && esAdmin && (
          <div className="card">
            <div className="card-header">
              <div className="card-title">Log de Auditoría</div>
              <span style={{ fontSize: '.78rem', color: 'var(--texto-claro)' }}>Últimas 50 acciones</span>
            </div>
            {loading ? (
              <div className="loading-center"><div className="spinner" /></div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Fecha</th><th>Usuario</th><th>Acción</th><th>Registro</th><th>IP</th></tr>
                  </thead>
                  <tbody>
                    {auditoria.map(a => (
                      <tr key={a.id}>
                        <td style={{ fontSize: '.78rem', whiteSpace: 'nowrap' }}>
                          {new Date(a.fecha).toLocaleString('es-MX')}
                        </td>
                        <td>
                          <code style={{ fontSize: '.8rem', background: 'var(--gris-20)', padding: '1px 5px', borderRadius: 3 }}>
                            {a.username}
                          </code>
                        </td>
                        <td>
                          <span style={{
                            fontSize: '.72rem', fontWeight: 600, textTransform: 'uppercase',
                            color: accionColor(a.accion),
                          }}>
                            {a.accion}
                          </span>
                        </td>
                        <td style={{ fontSize: '.78rem', color: 'var(--texto-claro)' }}>
                          {a.tabla}{a.registro_id ? ` #${a.registro_id}` : ''}
                        </td>
                        <td style={{ fontSize: '.75rem', color: 'var(--texto-claro)' }}>{a.ip}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Purga de Datos (SOLO ADMIN) ─────────────────────── */}
        {tab === 'purgar' && esAdmin && (
          <div className="card">
            <div className="card-header">
              <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#b91c1c' }}><IcoBomb /></span>
                Purga Definitiva de Datos
              </div>
            </div>
            <div className="card-body">

              {/* Advertencia */}
              <div style={{
                background: '#fef2f2', border: '1px solid #fecaca',
                borderRadius: 12, padding: '16px 20px', marginBottom: 24,
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <span style={{ color: '#b91c1c', flexShrink: 0, marginTop: 1 }}><IcoAlertTri /></span>
                  <div>
                    <div style={{ fontWeight: 700, color: '#7f1d1d', marginBottom: 6 }}>
                      Zona de peligro — Acción irreversible
                    </div>
                    <p style={{ fontSize: '.83rem', color: '#991b1b', margin: 0, lineHeight: 1.6 }}>
                      La purga elimina <b>definitivamente</b> las requisiciones de la base de datos.
                      A diferencia de "ocultar", esta acción <b>no puede deshacerse</b>.
                      Solo úsala para limpiar datos de prueba o al inicio de un nuevo ejercicio fiscal.
                      La acción queda registrada en el log de auditoría.
                    </p>
                  </div>
                </div>
              </div>

              {/* Opciones de purga */}
              <div style={{ maxWidth: 480 }}>
                <div className="form-group" style={{ marginBottom: 20 }}>
                  <label style={{ fontWeight: 600, marginBottom: 8, display: 'block' }}>
                    ¿Qué datos purgar?
                  </label>
                  <select
                    value={anioFiltro}
                    onChange={e => setAnioFiltro(e.target.value)}
                    style={{ width: '100%' }}
                  >
                    <option value="">Todos los años (purga completa)</option>
                    {aniosDisponibles.map(a => (
                      <option key={a} value={a}>Solo año {a}</option>
                    ))}
                  </select>
                  <p style={{ fontSize: '.75rem', color: 'var(--texto-claro)', marginTop: 6 }}>
                    {anioFiltro
                      ? `Se eliminarán todas las requisiciones del ejercicio ${anioFiltro}.`
                      : 'Se eliminarán TODAS las requisiciones sin importar el año.'}
                  </p>
                </div>

                <button
                  className="btn"
                  disabled={purgando}
                  onClick={handlePurgar}
                  style={{
                    background: '#b91c1c', color: '#fff',
                    border: 'none', padding: '10px 22px',
                    display: 'flex', alignItems: 'center', gap: 8,
                    fontSize: '.9rem', fontWeight: 600, borderRadius: 8,
                    cursor: purgando ? 'not-allowed' : 'pointer',
                    opacity: purgando ? 0.7 : 1,
                    transition: 'opacity .2s',
                  }}
                >
                  <IcoTrash2 />
                  {purgando ? 'Purgando…' : anioFiltro ? `Purgar año ${anioFiltro}` : 'Purgar todo'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}