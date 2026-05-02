import { useState, useEffect, useCallback } from 'react';
import { api } from '../context/AuthContext';
import { useAuth } from '../context/AuthContext';
import { generarPDF } from '../services/pdf';
import Swal from 'sweetalert2';
import { Requisicion, RespuestaPaginada, FormaPago } from '../types';

const IcoEye     = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>;
const IcoDl      = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>;
const IcoEdit    = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
const IcoHide    = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>;
const IcoX       = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
const IcoRestore = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.75"/></svg>;
const IcoSave    = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>;
const IcoDoc     = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>;
const IcoSpin    = () => <span style={{ display: 'inline-block', width: 13, height: 13, border: '2px solid #ccc', borderTopColor: 'currentColor', borderRadius: '50%', animation: 'spin .6s linear infinite', flexShrink: 0 }} />;

interface Plantilla { id: number; nombre: string; }
const PLANTILLAS: Plantilla[] = [
  { id: 1, nombre: 'Orden de Pago' },
  { id: 2, nombre: 'Solicitud de Suficiencia' },
  { id: 3, nombre: 'Autorización de Suficiencia' },
  { id: 4, nombre: 'Oficio de Solicitud' },
  { id: 5, nombre: 'Requisición de Materiales' },
  { id: 6, nombre: 'Formato de Recepción de Bien' },
];

interface PdfCargando { id: number; plantillaId: number; }

type CampoEditable = Partial<Requisicion> & { id: number; folio: string };

const LIMIT = 15;

export default function Historial() {
  const { esAdmin } = useAuth();
  const [datos, setDatos]               = useState<Requisicion[]>([]);
  const [total, setTotal]               = useState(0);
  const [pagina, setPagina]             = useState(1);
  const [buscar, setBuscar]             = useState('');
  const [loading, setLoading]           = useState(false);
  const [seleccionada, setSeleccionada] = useState<Requisicion | null>(null);
  const [editando, setEditando]         = useState<CampoEditable | null>(null);
  const [verOcultas, setVerOcultas]     = useState(false);
  const [guardando, setGuardando]       = useState(false);
  const [pdfCargando, setPdfCargando]   = useState<PdfCargando | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page: pagina, limit: LIMIT, buscar };
      if (esAdmin && verOcultas) params.verOcultas = '1';
      const { data } = await api.get<RespuestaPaginada<Requisicion>>('/requisiciones', { params });
      setDatos(data.datos ?? []);
      setTotal(data.total ?? 0);
    } catch (err) {
      console.error('Error cargando requisiciones:', err);
    } finally {
      setLoading(false);
    }
  }, [pagina, buscar, verOcultas, esAdmin]);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => { setPagina(1); }, [buscar, verOcultas]);

  async function ocultar(r: Requisicion) {
    const resultado = await Swal.fire({
      title:             'Ocultar Requisición',
      html:              `<small style="color:#666">La requisición <b>${r.folio}</b> no se eliminará,<br>solo se ocultará. El admin puede restaurarla.</small>`,
      input:             'textarea',
      inputPlaceholder:  'Motivo (opcional)…',
      inputAttributes:   { rows: '3' },
      showCancelButton:  true,
      confirmButtonText: 'Sí, ocultar',
      cancelButtonText:  'Cancelar',
      confirmButtonColor: '#c0392b',
    });
    if (!resultado.isConfirmed) return;

    try {
      await api.delete(`/requisiciones/${r.id}`, { data: { motivo: resultado.value || '' } });
      await Swal.fire({ title: 'Ocultada', icon: 'success', timer: 1800, showConfirmButton: false });
      cargar();
    } catch (err) {
      const msg = (err as { response?: { data?: { mensaje?: string } } }).response?.data?.mensaje;
      Swal.fire('Error', msg ?? 'No se pudo ocultar.', 'error');
    }
  }

  async function restaurar(r: Requisicion) {
    const conf = await Swal.fire({
      title: '¿Restaurar requisición?',
      html: `<small>El folio <b>${r.folio}</b> volverá a estar activo.</small>`,
      icon: 'question', showCancelButton: true,
      confirmButtonText: 'Sí, restaurar', cancelButtonText: 'Cancelar',
      confirmButtonColor: '#1a3a2a',
    });
    if (!conf.isConfirmed) return;
    try {
      await api.patch(`/requisiciones/${r.id}/restaurar`);
      await Swal.fire({ title: 'Restaurada', icon: 'success', timer: 1800, showConfirmButton: false });
      cargar();
    } catch (err) {
      const msg = (err as { response?: { data?: { mensaje?: string } } }).response?.data?.mensaje;
      Swal.fire('Error', msg ?? 'Error al restaurar.', 'error');
    }
  }

  async function guardarEdicion(e: React.FormEvent) {
    e.preventDefault();
    if (!editando) return;
    if (!editando.monto || isNaN(Number(editando.monto))) {
      Swal.fire('Error', 'El monto no es válido.', 'error'); return;
    }
    setGuardando(true);
    try {
      const payload = {
        area_id:          editando.area_id          ?? null,
        area_nombre:      editando.area_nombre       ?? null,
        clasificacion_id: editando.clasificacion_id  ?? null,
        concepto:         editando.concepto          ?? null,
        proveedor:        editando.proveedor         ?? null,
        rfc:              editando.rfc               ?? null,
        monto:            Number(editando.monto),
        forma_pago:       editando.forma_pago        ?? 'CHEQUE',
        cuenta_bancaria:  editando.cuenta_bancaria   ?? null,
        no_factura:       editando.no_factura        ?? null,
        no_contrato:      editando.no_contrato       ?? null,
        fecha:            editando.fecha?.slice(0, 10) ?? null,
      };
      await api.put(`/requisiciones/${editando.id}`, payload);
      await Swal.fire({ title: 'Guardado', text: `${editando.folio} actualizado.`, icon: 'success', timer: 1800, showConfirmButton: false });
      setEditando(null);
      cargar();
    } catch (err) {
      const msg = (err as { response?: { data?: { mensaje?: string } } }).response?.data?.mensaje;
      Swal.fire('Error al guardar', msg ?? 'Error desconocido.', 'error');
    } finally {
      setGuardando(false);
    }
  }

  async function handlePDF(req: Requisicion, prev: boolean, plantillaId: number) {
    setPdfCargando({ id: req.id, plantillaId });
    try { await generarPDF(req, prev, plantillaId); }
    finally { setPdfCargando(null); }
  }

  const fmt     = (n: number) => Number(n || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
  const paginas = Math.ceil(total / LIMIT);

  if (!document.getElementById('spin-keyframes')) {
    const s = document.createElement('style');
    s.id = 'spin-keyframes';
    s.textContent = '@keyframes spin{to{transform:rotate(360deg)}}';
    document.head.appendChild(s);
  }

  return (
    <>
      <div className="topbar">
        <div className="topbar-titulo">Historial de Requisiciones</div>
        <div className="topbar-breadcrumb">Tesorería · <span>Historial</span></div>
      </div>

      <div className="page-body fade-in">
        <div className="card">
          <div className="card-header">
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flex: 1, flexWrap: 'wrap' }}>
              <input
                placeholder="🔍 Buscar folio, beneficiario o concepto…"
                value={buscar}
                onChange={e => setBuscar(e.target.value)}
                style={{ maxWidth: 360, flex: 1 }}
              />
              {esAdmin && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '.82rem', cursor: 'pointer', color: 'var(--texto-medio)', padding: '6px 12px', border: '1.5px solid var(--gris-40)', borderRadius: 8, background: verOcultas ? 'var(--dorado-suave)' : 'transparent', transition: 'all .2s' }}>
                  <input type="checkbox" checked={verOcultas} onChange={e => setVerOcultas(e.target.checked)} />
                  Ver ocultadas {verOcultas && <span style={{ color: 'var(--dorado)', fontWeight: 600 }}>● activo</span>}
                </label>
              )}
            </div>
            <div style={{ fontSize: '.78rem', color: 'var(--texto-claro)', whiteSpace: 'nowrap' }}>
              {total} registro{total !== 1 ? 's' : ''}
            </div>
          </div>

          {loading ? (
            <div className="loading-center"><div className="spinner" /><span>Cargando…</span></div>
          ) : datos.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📋</div>
              <h3>{verOcultas ? 'No hay requisiciones ocultadas' : 'Sin requisiciones'}</h3>
              <p>{verOcultas ? 'Todas las requisiciones están activas.' : 'Aún no hay registros.'}</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Folio</th><th>Área</th><th>Beneficiario</th><th>Concepto</th>
                    <th>Monto</th><th>Fecha</th>
                    {esAdmin && <th>Estado</th>}
                    <th style={{ textAlign: 'center' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {datos.map(r => (
                    <tr key={r.id} style={r.estado === 'oculta' ? { opacity: .65, background: 'rgba(255,251,235,.7)' } : {}}>
                      <td><span className="folio-badge">{r.folio}</span></td>
                      <td style={{ fontSize: '.8rem', color: 'var(--texto-medio)' }}>{r.area_nombre ?? r.area_catalogo ?? '—'}</td>
                      <td style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.proveedor ?? '—'}</td>
                      <td style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '.82rem', color: 'var(--texto-medio)' }}>{r.concepto ?? '—'}</td>
                      <td className="monto-cell">{fmt(r.monto)}</td>
                      <td style={{ fontSize: '.8rem', whiteSpace: 'nowrap' }}>{r.fecha?.slice(0, 10)}</td>
                      {esAdmin && (
                        <td><span className={`estado-badge ${r.estado}`}>{r.estado === 'activa' ? '● Activa' : '○ Oculta'}</span></td>
                      )}
                      <td>
                        <div className="acciones-cell" style={{ justifyContent: 'center' }}>
                          <button className="btn-icon verde" title="Ver documentos" onClick={() => setSeleccionada(r)}><IcoEye /></button>
                          <button className="btn-icon dorado" title="Editar" onClick={() => setEditando({ ...r })}><IcoEdit /></button>
                          {r.estado === 'activa' && (
                            <button className="btn-icon rojo" title="Ocultar" onClick={() => ocultar(r)}><IcoHide /></button>
                          )}
                          {esAdmin && r.estado === 'oculta' && (
                            <button className="btn-icon verde" title="Restaurar" onClick={() => restaurar(r)}><IcoRestore /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {paginas > 1 && (
            <div className="pagination">
              <span>Página {pagina} de {paginas}</span>
              <div className="pagination-btns">
                <button className="page-btn" disabled={pagina <= 1} onClick={() => setPagina(p => p - 1)}>‹</button>
                {Array.from({ length: Math.min(5, paginas) }, (_, i) => {
                  const n = Math.max(1, Math.min(paginas - 4, pagina - 2)) + i;
                  return <button key={n} className={`page-btn ${n === pagina ? 'activo' : ''}`} onClick={() => setPagina(n)}>{n}</button>;
                })}
                <button className="page-btn" disabled={pagina >= paginas} onClick={() => setPagina(p => p + 1)}>›</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal — Documentos PDF */}
      {seleccionada && (
        <div className="modal-overlay" onClick={() => setSeleccionada(null)}>
          <div className="modal" style={{ maxWidth: 580 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <div className="modal-title">{seleccionada.folio}</div>
                <div style={{ fontSize: '.8rem', color: 'var(--texto-claro)', marginTop: 2 }}>
                  {seleccionada.proveedor ?? 'Sin beneficiario'} · {fmt(seleccionada.monto)}
                </div>
              </div>
              <button className="btn-icon gris" onClick={() => setSeleccionada(null)}><IcoX /></button>
            </div>

            <div style={{ padding: '16px 24px', background: 'var(--gris-10)', borderBottom: '1px solid var(--gris-20)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 24px', fontSize: '.82rem' }}>
                {([
                  ['Fecha',        seleccionada.fecha?.slice(0, 10) ?? '—'],
                  ['Forma de pago', seleccionada.forma_pago ?? '—'],
                  ['RFC',          seleccionada.rfc ?? '—'],
                  ['No. Factura',  seleccionada.no_factura ?? '—'],
                  ['Área',         seleccionada.area_nombre ?? seleccionada.area_catalogo ?? '—'],
                ] as [string, string][]).map(([lbl, val]) => (
                  <div key={lbl}>
                    <span style={{ color: 'var(--texto-claro)' }}>{lbl}: </span>
                    <strong style={{ color: 'var(--texto)' }}>{val}</strong>
                  </div>
                ))}
              </div>
              {seleccionada.concepto && (
                <div style={{ marginTop: 8, fontSize: '.82rem' }}>
                  <span style={{ color: 'var(--texto-claro)' }}>Concepto: </span>
                  <strong style={{ color: 'var(--texto)' }}>{seleccionada.concepto}</strong>
                </div>
              )}
            </div>

            <div className="modal-body">
              <div className="docs-grid">
                {PLANTILLAS.map(p => {
                  const cargando = pdfCargando?.id === seleccionada.id && pdfCargando?.plantillaId === p.id;
                  return (
                    <div key={p.id} className="doc-row">
                      <span className="doc-nombre" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        {cargando ? <IcoSpin /> : <IcoDoc />}
                        {p.nombre}
                      </span>
                      <div className="doc-acciones">
                        <button className="btn-icon verde" title="Previsualizar" disabled={!!pdfCargando} onClick={() => handlePDF(seleccionada, true, p.id)}><IcoEye /></button>
                        <button className="btn-icon gris"  title="Descargar"    disabled={!!pdfCargando} onClick={() => handlePDF(seleccionada, false, p.id)}><IcoDl /></button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setSeleccionada(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal — Editar Requisición */}
      {editando && (
        <div className="modal-overlay" onClick={() => !guardando && setEditando(null)}>
          <div className="modal" style={{ maxWidth: 660 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <div className="modal-title">Editar — {editando.folio}</div>
                <div style={{ fontSize: '.78rem', color: 'var(--texto-claro)', marginTop: 2 }}>Modifica los campos y guarda</div>
              </div>
              <button className="btn-icon gris" onClick={() => setEditando(null)} disabled={guardando}><IcoX /></button>
            </div>

            <form onSubmit={guardarEdicion}>
              <div className="modal-body">
                <div className="form-grid">
                  <div className="form-group full">
                    <label>Concepto</label>
                    <textarea rows={3} value={editando.concepto ?? ''} onChange={e => setEditando(f => f ? { ...f, concepto: e.target.value } : f)} placeholder="Describe el concepto del gasto…" />
                  </div>
                  <div className="form-group">
                    <label>Beneficiario *</label>
                    <input value={editando.proveedor ?? ''} onChange={e => setEditando(f => f ? { ...f, proveedor: e.target.value } : f)} placeholder="Nombre o razón social" required />
                  </div>
                  <div className="form-group">
                    <label>RFC</label>
                    <input value={editando.rfc ?? ''} onChange={e => setEditando(f => f ? { ...f, rfc: e.target.value.toUpperCase() } : f)} maxLength={13} placeholder="RFC del beneficiario" />
                  </div>
                  <div className="form-group">
                    <label>Monto *</label>
                    <input type="number" step="0.01" min="0.01" value={editando.monto ?? ''} onChange={e => setEditando(f => f ? { ...f, monto: Number(e.target.value) } : f)} required />
                  </div>
                  <div className="form-group">
                    <label>Forma de pago</label>
                    <select value={editando.forma_pago ?? 'CHEQUE'} onChange={e => setEditando(f => f ? { ...f, forma_pago: e.target.value as FormaPago } : f)}>
                      <option value="CHEQUE">Cheque</option>
                      <option value="TRANSFERENCIA">Transferencia</option>
                      <option value="EFECTIVO">Efectivo</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Fecha</label>
                    <input type="date" value={editando.fecha?.slice(0, 10) ?? ''} onChange={e => setEditando(f => f ? { ...f, fecha: e.target.value } : f)} />
                  </div>
                  <div className="form-group">
                    <label>No. Factura / UUID</label>
                    <input value={editando.no_factura ?? ''} onChange={e => setEditando(f => f ? { ...f, no_factura: e.target.value } : f)} placeholder="Opcional" />
                  </div>
                  <div className="form-group">
                    <label>No. Contrato</label>
                    <input value={editando.no_contrato ?? ''} onChange={e => setEditando(f => f ? { ...f, no_contrato: e.target.value } : f)} placeholder="Opcional" />
                  </div>
                  <div className="form-group">
                    <label>Cuenta Bancaria</label>
                    <input value={editando.cuenta_bancaria ?? ''} onChange={e => setEditando(f => f ? { ...f, cuenta_bancaria: e.target.value } : f)} placeholder="Opcional" />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setEditando(null)} disabled={guardando}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={guardando}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {guardando ? <><IcoSpin /> Guardando…</> : <><IcoSave /> Guardar cambios</>}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
