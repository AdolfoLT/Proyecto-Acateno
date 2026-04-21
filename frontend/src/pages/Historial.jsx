import { useState, useEffect, useCallback, useRef } from 'react'
import { api } from '../context/AuthContext'
import { useAuth } from '../context/AuthContext'
import { generarPDF } from '../services/pdf'
import Swal from 'sweetalert2'
import * as XLSX from 'xlsx'

// ── Iconos SVG ───────────────────────────────────────────────
const IcoEye     = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
const IcoDl      = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
const IcoEdit    = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
const IcoHide    = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
const IcoX       = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
const IcoRestore = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.75"/></svg>
const IcoSave    = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
const IcoSearch  = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
const IcoExcel   = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><polyline points="8 13 10.5 17 13 13"/><line x1="8" y1="17" x2="13" y2="13"/></svg>
const IcoFilter  = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
const IcoFile    = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
const IcoLoader  = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14" style={{ animation: 'spin 1s linear infinite' }}><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg>

const PLANTILLAS = [
  { id: 1, nombre: 'Orden de Pago' },
  { id: 2, nombre: 'Solicitud de Suficiencia' },
  { id: 3, nombre: 'Autorización de Suficiencia' },
  { id: 4, nombre: 'Oficio de Solicitud' },
  { id: 5, nombre: 'Requisición de Materiales' },
  { id: 6, nombre: 'Formato de Recepción de Bien' },
]

const fmt = n => Number(n || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })

export default function Historial() {
  const { esAdmin } = useAuth()
  const [datos, setDatos]               = useState([])
  const [total, setTotal]               = useState(0)
  const [pagina, setPagina]             = useState(1)
  const [buscar, setBuscar]             = useState('')
  const [buscarInput, setBuscarInput]   = useState('') // input inmediato
  const [loading, setLoading]           = useState(false)
  const [seleccionada, setSeleccionada] = useState(null)
  const [editando, setEditando]         = useState(null)
  const [verOcultas, setVerOcultas]     = useState(false)
  const [guardando, setGuardando]       = useState(false)
  const [generandoPDF, setGenerandoPDF] = useState(null)
  const [stats, setStats]               = useState({ montoTotal: 0, hoy: 0 })
  const debounceRef = useRef(null)
  const LIMIT = 15

  // ── Debounce de búsqueda ─────────────────────────────────────
  function handleBuscar(val) {
    setBuscarInput(val)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setBuscar(val)
      setPagina(1)
    }, 400)
  }

  // ── Carga de datos ───────────────────────────────────────────
  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const params = { page: pagina, limit: LIMIT, buscar }
      if (esAdmin && verOcultas) params.verOcultas = '1'
      const { data } = await api.get('/requisiciones', { params })
      const rows = data.datos || []
      setDatos(rows)
      setTotal(data.total || 0)

      // Stats de la página actual
      const hoy = new Date().toISOString().split('T')[0]
      setStats({
        montoTotal: rows.reduce((s, r) => s + Number(r.monto || 0), 0),
        hoy: rows.filter(r => r.fecha?.slice(0, 10) === hoy).length,
      })
    } catch (err) {
      console.error('Error cargando requisiciones:', err)
    } finally {
      setLoading(false)
    }
  }, [pagina, buscar, verOcultas, esAdmin])

  useEffect(() => { cargar() }, [cargar])
  useEffect(() => { setPagina(1) }, [buscar, verOcultas])

  // ── OCULTAR ──────────────────────────────────────────────────
  async function ocultar(r) {
    const resultado = await Swal.fire({
      title: 'Ocultar Requisición',
      html: `<small style="color:#666">La requisición <b>${r.folio}</b> no se eliminará,<br>solo se ocultará. El admin puede restaurarla.</small>`,
      input: 'textarea',
      inputPlaceholder: 'Motivo (opcional)…',
      inputAttributes: { rows: 3 },
      showCancelButton: true,
      confirmButtonText: 'Sí, ocultar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#c0392b',
    })
    if (!resultado.isConfirmed) return

    try {
      await api.delete(`/requisiciones/${r.id}`, { data: { motivo: resultado.value || '' } })
      await Swal.fire({ title: 'Ocultada', icon: 'success', confirmButtonColor: '#1a3a2a', timer: 1800, showConfirmButton: false })
      cargar()
    } catch (err) {
      Swal.fire({ title: 'Error', text: err.response?.data?.mensaje || 'No se pudo ocultar.', icon: 'error', confirmButtonColor: '#1a3a2a' })
    }
  }

  // ── RESTAURAR ────────────────────────────────────────────────
  async function restaurar(r) {
    const conf = await Swal.fire({
      title: '¿Restaurar requisición?',
      html: `<small>El folio <b>${r.folio}</b> volverá a estar activo.</small>`,
      icon: 'question', showCancelButton: true,
      confirmButtonText: 'Sí, restaurar', cancelButtonText: 'Cancelar',
      confirmButtonColor: '#1a3a2a',
    })
    if (!conf.isConfirmed) return
    try {
      await api.patch(`/requisiciones/${r.id}/restaurar`)
      await Swal.fire({ title: 'Restaurada', icon: 'success', confirmButtonColor: '#1a3a2a', timer: 1800, showConfirmButton: false })
      cargar()
    } catch (err) {
      Swal.fire({ title: 'Error', text: err.response?.data?.mensaje || 'No se pudo restaurar.', icon: 'error', confirmButtonColor: '#1a3a2a' })
    }
  }

  // ── GUARDAR EDICIÓN ──────────────────────────────────────────
  async function guardarEdicion(e) {
    e.preventDefault()
    if (!editando.monto || isNaN(Number(editando.monto))) {
      Swal.fire({ title: 'Error', text: 'El monto no es válido.', icon: 'error', confirmButtonColor: '#1a3a2a' })
      return
    }
    setGuardando(true)
    try {
      const payload = {
        area_id:          editando.area_id         || null,
        area_nombre:      editando.area_nombre      || null,
        clasificacion_id: editando.clasificacion_id || null,
        concepto:         editando.concepto         || null,
        proveedor:        editando.proveedor        || null,
        rfc:              editando.rfc              || null,
        monto:            Number(editando.monto),
        forma_pago:       editando.forma_pago       || 'CHEQUE',
        cuenta_bancaria:  editando.cuenta_bancaria  || null,
        no_factura:       editando.no_factura       || null,
        no_contrato:      editando.no_contrato      || null,
        fecha:            editando.fecha?.slice(0, 10) || null,
      }
      await api.put(`/requisiciones/${editando.id}`, payload)
      await Swal.fire({ title: 'Guardado', text: `${editando.folio} actualizado.`, icon: 'success', confirmButtonColor: '#1a3a2a', timer: 1800, showConfirmButton: false })
      setEditando(null)
      cargar()
    } catch (err) {
      Swal.fire({ title: 'Error', text: err.response?.data?.mensaje || 'No se pudieron guardar los cambios.', icon: 'error', confirmButtonColor: '#1a3a2a' })
    } finally {
      setGuardando(false)
    }
  }

  // ── GENERAR PDF ──────────────────────────────────────────────
  async function handleGenerarPDF(req, preview, plantillaId) {
    setGenerandoPDF({ id: req.id, plantillaId })
    try { await generarPDF(req, preview, plantillaId) }
    finally { setGenerandoPDF(null) }
  }

  // ── EXPORTAR EXCEL ───────────────────────────────────────────
  async function exportarExcel() {
    try {
      // Cargar todos los datos sin paginación
      const { data } = await api.get('/requisiciones', { params: { page: 1, limit: 9999, buscar } })
      const filas = (data.datos || []).map(r => ({
        'Folio':        r.folio,
        'Fecha':        r.fecha?.slice(0, 10),
        'Beneficiario': r.proveedor,
        'RFC':          r.rfc,
        'Concepto':     r.concepto,
        'Área':         r.area_nombre || r.area_catalogo,
        'Monto':        Number(r.monto),
        'Forma Pago':   r.forma_pago,
        'No. Factura':  r.no_factura,
        'No. Contrato': r.no_contrato,
        'Estado':       r.estado,
      }))

      const ws = XLSX.utils.json_to_sheet(filas)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Requisiciones')

      // Ancho de columnas
      ws['!cols'] = [12,12,30,15,40,20,14,14,20,16,10].map(w => ({ wch: w }))

      const fecha = new Date().toISOString().split('T')[0]
      XLSX.writeFile(wb, `Requisiciones_Acateno_${fecha}.xlsx`)
    } catch (err) {
      Swal.fire({ title: 'Error', text: 'No se pudo exportar.', icon: 'error', confirmButtonColor: '#1a3a2a' })
    }
  }

  const paginas = Math.ceil(total / LIMIT)

  return (
    <>
      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>

      <div className="topbar">
        <div className="topbar-titulo">Historial de Requisiciones</div>
        <div className="topbar-breadcrumb">Tesorería · <span>Historial</span></div>
      </div>

      <div className="page-body fade-in">

        {/* ── Mini stats de la vista actual ─────────────────── */}
        {!loading && datos.length > 0 && (
          <div style={{
            display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap',
          }}>
            <div style={{
              background: 'var(--verde-suave)', border: '1px solid rgba(61,122,86,.2)',
              borderRadius: 10, padding: '10px 18px', fontSize: '.82rem',
              color: 'var(--verde-oscuro)', display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <IcoFile />
              <span><b>{total}</b> registro{total !== 1 ? 's' : ''} en total</span>
            </div>
            <div style={{
              background: 'var(--dorado-suave)', border: '1px solid rgba(184,148,42,.2)',
              borderRadius: 10, padding: '10px 18px', fontSize: '.82rem',
              color: 'var(--dorado)', display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span style={{ fontWeight: 700 }}>{fmt(stats.montoTotal)}</span>
              <span style={{ color: 'var(--texto-claro)' }}>en esta página</span>
            </div>
            {stats.hoy > 0 && (
              <div style={{
                background: '#eff6ff', border: '1px solid rgba(59,130,246,.2)',
                borderRadius: 10, padding: '10px 18px', fontSize: '.82rem',
                color: '#1d4ed8', display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <span><b>{stats.hoy}</b> registradas hoy</span>
              </div>
            )}
          </div>
        )}

        <div className="card">

          {/* ── Toolbar ───────────────────────────────────────── */}
          <div className="card-header" style={{ flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flex: 1, flexWrap: 'wrap' }}>
              {/* Búsqueda con icono */}
              <div style={{ position: 'relative', flex: 1, maxWidth: 340 }}>
                <span style={{
                  position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)',
                  color: 'var(--gris-60)', pointerEvents: 'none',
                }}>
                  <IcoSearch />
                </span>
                <input
                  placeholder="Buscar folio, beneficiario o concepto…"
                  value={buscarInput}
                  onChange={e => handleBuscar(e.target.value)}
                  style={{ paddingLeft: 34, width: '100%' }}
                />
              </div>

              {/* Filtro ocultadas (solo admin) */}
              {esAdmin && (
                <label style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  fontSize: '.82rem', cursor: 'pointer', color: 'var(--texto-medio)',
                  padding: '6px 12px', border: '1.5px solid var(--gris-40)',
                  borderRadius: 8,
                  background: verOcultas ? 'var(--dorado-suave)' : 'transparent',
                  borderColor: verOcultas ? 'var(--dorado)' : 'var(--gris-40)',
                  transition: 'all .2s', whiteSpace: 'nowrap',
                }}>
                  <IcoFilter />
                  <input
                    type="checkbox"
                    checked={verOcultas}
                    onChange={e => setVerOcultas(e.target.checked)}
                    style={{ display: 'none' }}
                  />
                  Ver ocultadas
                  {verOcultas && <span style={{ color: 'var(--dorado)', fontWeight: 600, fontSize: '.75rem' }}>● activo</span>}
                </label>
              )}
            </div>

            {/* Exportar Excel */}
            <button className="btn btn-secondary" onClick={exportarExcel}
              style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
              <IcoExcel /> Exportar Excel
            </button>
          </div>

          {/* ── Tabla ─────────────────────────────────────────── */}
          {loading ? (
            <div className="loading-center">
              <div className="spinner" />
              <span>Cargando requisiciones…</span>
            </div>
          ) : datos.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon"><IcoFile /></div>
              <h3>{verOcultas ? 'No hay requisiciones ocultadas' : buscar ? 'Sin resultados' : 'Sin requisiciones'}</h3>
              <p>
                {verOcultas
                  ? 'Todas las requisiciones están activas.'
                  : buscar
                    ? `No se encontró nada para "${buscar}".`
                    : 'Aún no hay registros que mostrar.'}
              </p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Folio</th>
                    <th>Área</th>
                    <th>Beneficiario</th>
                    <th>Concepto</th>
                    <th>Monto</th>
                    <th>Fecha</th>
                    {esAdmin && <th>Estado</th>}
                    <th style={{ textAlign: 'center' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {datos.map(r => (
                    <tr key={r.id} style={r.estado === 'oculta'
                      ? { opacity: .65, background: 'rgba(255,251,235,.7)' } : {}
                    }>
                      <td><span className="folio-badge">{r.folio}</span></td>
                      <td style={{ fontSize: '.8rem', color: 'var(--texto-medio)' }}>
                        {r.area_nombre || r.area_catalogo || '—'}
                      </td>
                      <td style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.proveedor || '—'}
                      </td>
                      <td style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '.82rem', color: 'var(--texto-medio)' }}>
                        {r.concepto || '—'}
                      </td>
                      <td className="monto-cell">{fmt(r.monto)}</td>
                      <td style={{ fontSize: '.8rem', whiteSpace: 'nowrap' }}>{r.fecha?.slice(0, 10)}</td>
                      {esAdmin && (
                        <td>
                          <span className={`estado-badge ${r.estado}`}>
                            {r.estado === 'activa' ? '● Activa' : '○ Oculta'}
                          </span>
                        </td>
                      )}
                      <td>
                        <div className="acciones-cell" style={{ justifyContent: 'center' }}>
                          <button className="btn-icon verde" title="Ver documentos PDF" onClick={() => setSeleccionada(r)}>
                            <IcoEye />
                          </button>
                          <button className="btn-icon dorado" title="Editar" onClick={() => setEditando({ ...r })}>
                            <IcoEdit />
                          </button>
                          {r.estado === 'activa' && (
                            <button className="btn-icon rojo" title="Ocultar" onClick={() => ocultar(r)}>
                              <IcoHide />
                            </button>
                          )}
                          {esAdmin && r.estado === 'oculta' && (
                            <button className="btn-icon verde" title="Restaurar" onClick={() => restaurar(r)}>
                              <IcoRestore />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Paginación ────────────────────────────────────── */}
          {paginas > 1 && (
            <div className="pagination">
              <span>Página {pagina} de {paginas}</span>
              <div className="pagination-btns">
                <button className="page-btn" disabled={pagina <= 1} onClick={() => setPagina(p => p - 1)}>‹</button>
                {Array.from({ length: Math.min(5, paginas) }, (_, i) => {
                  const n = Math.max(1, Math.min(paginas - 4, pagina - 2)) + i
                  return (
                    <button key={n} className={`page-btn ${n === pagina ? 'activo' : ''}`}
                      onClick={() => setPagina(n)}>{n}</button>
                  )
                })}
                <button className="page-btn" disabled={pagina >= paginas} onClick={() => setPagina(p => p + 1)}>›</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════
          MODAL — Ver documentos PDF
          ════════════════════════════════════════════════════════ */}
      {seleccionada && (
        <div className="modal-overlay" onClick={() => setSeleccionada(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <div className="modal-title">{seleccionada.folio}</div>
                <div style={{ fontSize: '.8rem', color: 'var(--texto-claro)', marginTop: 2 }}>
                  {seleccionada.proveedor || 'Sin beneficiario'} · {fmt(seleccionada.monto)}
                </div>
              </div>
              <button className="btn-icon gris" onClick={() => setSeleccionada(null)}><IcoX /></button>
            </div>

            <div className="modal-body">
              {/* Info de la requisición seleccionada */}
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16,
                padding: '12px 14px', background: 'var(--gris-10)', borderRadius: 8, fontSize: '.8rem',
              }}>
                {[
                  ['Fecha', seleccionada.fecha?.slice(0, 10)],
                  ['Forma de pago', seleccionada.forma_pago],
                  ['RFC', seleccionada.rfc || '—'],
                  ['No. Factura', seleccionada.no_factura || '—'],
                ].map(([k, v]) => (
                  <div key={k}>
                    <span style={{ color: 'var(--texto-claro)' }}>{k}: </span>
                    <span style={{ fontWeight: 500 }}>{v}</span>
                  </div>
                ))}
                {seleccionada.concepto && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <span style={{ color: 'var(--texto-claro)' }}>Concepto: </span>
                    <span style={{ fontWeight: 500 }}>{seleccionada.concepto}</span>
                  </div>
                )}
              </div>

              <div style={{ fontSize: '.78rem', color: 'var(--texto-claro)', marginBottom: 12 }}>
                Selecciona el documento a generar:
              </div>

              <div className="docs-grid">
                {PLANTILLAS.map(p => {
                  const cargando = generandoPDF?.id === seleccionada.id && generandoPDF?.plantillaId === p.id
                  return (
                    <div key={p.id} className="doc-row">
                      <span className="doc-nombre" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        {cargando ? <IcoLoader /> : <IcoFile />} {p.nombre}
                      </span>
                      <div className="doc-acciones">
                        <button className="btn-icon verde" title="Previsualizar"
                          disabled={!!generandoPDF}
                          onClick={() => handleGenerarPDF(seleccionada, true, p.id)}>
                          <IcoEye />
                        </button>
                        <button className="btn-icon gris" title="Descargar"
                          disabled={!!generandoPDF}
                          onClick={() => handleGenerarPDF(seleccionada, false, p.id)}>
                          <IcoDl />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setSeleccionada(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
          MODAL — Editar requisición
          ════════════════════════════════════════════════════════ */}
      {editando && (
        <div className="modal-overlay" onClick={() => !guardando && setEditando(null)}>
          <div className="modal" style={{ maxWidth: 660 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <div className="modal-title">Editar — {editando.folio}</div>
                <div style={{ fontSize: '.78rem', color: 'var(--texto-claro)', marginTop: 2 }}>
                  Modifica los campos y guarda los cambios
                </div>
              </div>
              <button className="btn-icon gris" onClick={() => setEditando(null)} disabled={guardando}><IcoX /></button>
            </div>

            <form onSubmit={guardarEdicion}>
              <div className="modal-body">
                <div className="form-grid">
                  <div className="form-group full">
                    <label>Concepto</label>
                    <textarea rows={3}
                      value={editando.concepto || ''}
                      onChange={e => setEditando(f => ({ ...f, concepto: e.target.value }))}
                      placeholder="Describe el concepto del gasto…" />
                  </div>

                  <div className="form-group">
                    <label>Beneficiario *</label>
                    <input value={editando.proveedor || ''}
                      onChange={e => setEditando(f => ({ ...f, proveedor: e.target.value }))}
                      placeholder="Nombre o razón social" required />
                  </div>

                  <div className="form-group">
                    <label>RFC</label>
                    <input value={editando.rfc || ''}
                      onChange={e => setEditando(f => ({ ...f, rfc: e.target.value.toUpperCase() }))}
                      maxLength={13} placeholder="RFC del beneficiario" />
                  </div>

                  <div className="form-group">
                    <label>Monto *</label>
                    <input type="number" step="0.01" min="0.01"
                      value={editando.monto || ''}
                      onChange={e => setEditando(f => ({ ...f, monto: e.target.value }))} required />
                  </div>

                  <div className="form-group">
                    <label>Forma de pago</label>
                    <select value={editando.forma_pago || 'CHEQUE'}
                      onChange={e => setEditando(f => ({ ...f, forma_pago: e.target.value }))}>
                      <option value="CHEQUE">Cheque</option>
                      <option value="TRANSFERENCIA">Transferencia</option>
                      <option value="EFECTIVO">Efectivo</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Fecha</label>
                    <input type="date" value={editando.fecha?.slice(0, 10) || ''}
                      onChange={e => setEditando(f => ({ ...f, fecha: e.target.value }))} />
                  </div>

                  <div className="form-group">
                    <label>No. Factura / UUID</label>
                    <input value={editando.no_factura || ''}
                      onChange={e => setEditando(f => ({ ...f, no_factura: e.target.value }))}
                      placeholder="Opcional" />
                  </div>

                  <div className="form-group">
                    <label>No. Contrato</label>
                    <input value={editando.no_contrato || ''}
                      onChange={e => setEditando(f => ({ ...f, no_contrato: e.target.value }))}
                      placeholder="Opcional" />
                  </div>

                  <div className="form-group">
                    <label>Cuenta Bancaria</label>
                    <input value={editando.cuenta_bancaria || ''}
                      onChange={e => setEditando(f => ({ ...f, cuenta_bancaria: e.target.value }))}
                      placeholder="Opcional" />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary"
                  onClick={() => setEditando(null)} disabled={guardando}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={guardando}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {guardando
                      ? <><IcoLoader />Guardando…</>
                      : <><IcoSave />Guardar cambios</>
                    }
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}