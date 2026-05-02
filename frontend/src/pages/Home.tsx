import { useState, useEffect, useRef, FormEvent, DragEvent, ChangeEvent } from 'react';
import { api } from '../context/AuthContext';
import Swal from 'sweetalert2';
import * as XLSX from 'xlsx';
import { Area, Clasificacion, FormularioRequisicion, FormaPago } from '../types';

const IcoFileText = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>;
const IcoDollar   = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>;
const IcoCalendar = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;
const IcoSave     = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>;
const IcoRefresh  = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.75"/></svg>;
const IcoUpload   = () => <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>;
const IcoEdit     = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
const IcoTable    = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/></svg>;
const IcoLoader   = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg>;

// ── Hojas a ignorar ───────────────────────────────────────────
const HOJAS_IGNORAR = new Set([
  'ORDEN PAGO','Jtas Auxiliar','Hoja1','Hoja2','Hoja3','Hoja4','Hoja5','Hoja6',
  'fortamun 2019','fortamun2020','fism 2019','fism 2020',
  'DEUDORES','comisiones','uma','gastos pagados en efectivo',
]);

const CANCELADO_RE = /cancelado|c\s*a\s*n\s*c\s*e\s*l/i;
const norm = (s: unknown): string => String(s ?? '').toUpperCase().trim().replace(/\s+/g, ' ');

const COL_MAP: Record<string, string> = {
  'FECHA':                     'fecha',
  'BENEFICIARIO':              'proveedor',
  'R.F.C.':                    'rfc',
  'RFC':                       'rfc',
  'CFDI':                      'no_factura',
  'FACTURA: CFDI':             'no_factura',
  'CONCEPTO':                  'concepto',
  'IMPORTE DEL CHEQUE':        'monto_cheque',
  'MONTO DE LA TRANSFERENCIA': 'monto_transf',
  'MONTO DE LA TRANFERENCIA':  'monto_transf',
  'EFECTIVO':                  'monto_efect',
  'TOTAL':                     'monto_total',
  'FORMA DE PAGO':             'forma_pago',
};

function parsearFecha(val: unknown): string {
  if (!val) return new Date().toISOString().split('T')[0];
  if (val instanceof Date && !isNaN(val.getTime())) return val.toISOString().split('T')[0];
  if (typeof val === 'number') {
    const d = new Date(Math.round((val - 25569) * 86400 * 1000));
    return d.toISOString().split('T')[0];
  }
  const limpio = String(val).trim().replace(/\/+/g, '/');
  const d = new Date(limpio);
  if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  return new Date().toISOString().split('T')[0];
}

function parsearMonto(val: unknown): number {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return val;
  return Number(String(val).replace(/[^0-9.]/g, '')) || 0;
}

interface Stats {
  total: number;
  monto: number;
  hoy:   number;
}

type ModoVista = 'manual' | 'excel';

const VACÍO: FormularioRequisicion = {
  area_id: '', area_nombre: '', clasificacion_id: '',
  concepto: '', proveedor: '', rfc: '',
  monto: '', forma_pago: 'CHEQUE',
  cuenta_bancaria: '', no_factura: '', no_contrato: '',
  fecha: new Date().toISOString().split('T')[0],
};

export default function Home() {
  const [modo, setModo]     = useState<ModoVista>('manual');
  const [drag, setDrag]     = useState(false);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const [areas, setAreas]                     = useState<Area[]>([]);
  const [clasificaciones, setClasificaciones] = useState<Clasificacion[]>([]);
  const [stats, setStats]                     = useState<Stats>({ total: 0, monto: 0, hoy: 0 });
  const [form, setForm]                       = useState<FormularioRequisicion>(VACÍO);

  useEffect(() => {
    api.get<Area[]>('/requisiciones/catalogos/areas').then(r => setAreas(r.data)).catch(() => {});
    api.get<Clasificacion[]>('/requisiciones/catalogos/clasificaciones').then(r => setClasificaciones(r.data)).catch(() => {});
    cargarStats();
  }, []);

  async function cargarStats() {
    try {
      const r = await api.get<{ datos: { monto: number; fecha: string }[]; total: number }>('/requisiciones?limit=1000');
      const datos = r.data.datos ?? [];
      const hoy = new Date().toISOString().split('T')[0];
      setStats({
        total: r.data.total,
        monto: datos.reduce((s, d) => s + Number(d.monto), 0),
        hoy:   datos.filter(d => d.fecha?.slice(0, 10) === hoy).length,
      });
    } catch {}
  }

  function set<K extends keyof FormularioRequisicion>(field: K, value: FormularioRequisicion[K]) {
    setForm(f => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!form.monto || isNaN(Number(form.monto))) {
      Swal.fire({ title: 'Error', text: 'Ingresa un monto válido.', icon: 'error', confirmButtonColor: '#1a3a2a' });
      return;
    }
    setSaving(true);
    try {
      const { data } = await api.post<{ folio: string }>('/requisiciones', form);
      Swal.fire({ title: 'Guardado', html: `Requisición <b>${data.folio}</b> creada con éxito.`, icon: 'success', confirmButtonColor: '#1a3a2a' });
      setForm(VACÍO);
      cargarStats();
    } catch (err) {
      const msg = (err as { response?: { data?: { mensaje?: string } } }).response?.data?.mensaje;
      Swal.fire({ title: 'Error', text: msg ?? 'No se pudo guardar.', icon: 'error', confirmButtonColor: '#1a3a2a' });
    } finally {
      setSaving(false);
    }
  }

  async function procesarExcel(file: File | undefined) {
    if (!file) return;

    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(new Uint8Array(buffer), { type: 'array', cellDates: true, raw: false, dateNF: 'yyyy-mm-dd' });

    let totalOk = 0, totalFilas = 0;
    const errores: string[] = [];

    for (const nombreHoja of wb.SheetNames) {
      if (HOJAS_IGNORAR.has(nombreHoja)) continue;
      const ws = wb.Sheets[nombreHoja];
      if (!ws) continue;

      const raw = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null, raw: false, dateNF: 'yyyy-mm-dd' });
      if (raw.length < 2) continue;

      let headerIdx = -1;
      let colIdx: Record<string, number> = {};

      for (let i = 0; i < Math.min(raw.length, 5); i++) {
        const fila = raw[i] as unknown[];
        if (!fila) continue;
        const tentativo: Record<string, number> = {};
        for (let c = 0; c < fila.length; c++) {
          const key = norm(fila[c]);
          if (COL_MAP[key]) tentativo[COL_MAP[key]] = c;
        }
        const tieneMonto = 'monto_cheque' in tentativo || 'monto_transf' in tentativo
                        || 'monto_efect'  in tentativo || 'monto_total'  in tentativo;
        if ('proveedor' in tentativo || tieneMonto) {
          headerIdx = i; colIdx = tentativo; break;
        }
      }

      if (headerIdx === -1) continue;

      const get = (fila: unknown[], campo: string): unknown => {
        const idx = colIdx[campo];
        return idx !== undefined ? fila[idx] : null;
      };

      for (let i = headerIdx + 1; i < raw.length; i++) {
        const fila = raw[i] as unknown[];
        if (!fila || fila.every(v => v === null || v === '')) continue;

        const beneficiario = String(get(fila, 'proveedor') ?? '').trim();
        if (!beneficiario || CANCELADO_RE.test(beneficiario)) continue;

        let monto = parsearMonto(get(fila, 'monto_cheque'));
        let formaPago: FormaPago = 'CHEQUE';
        if (!monto) { monto = parsearMonto(get(fila, 'monto_transf')); formaPago = 'TRANSFERENCIA'; }
        if (!monto) { monto = parsearMonto(get(fila, 'monto_efect'));  formaPago = 'EFECTIVO'; }
        if (!monto) { monto = parsearMonto(get(fila, 'monto_total')); }
        if (!monto || monto <= 0) continue;

        if (colIdx['forma_pago'] !== undefined) {
          const fp = norm(get(fila, 'forma_pago')) as FormaPago;
          if (['CHEQUE', 'TRANSFERENCIA', 'EFECTIVO'].includes(fp)) formaPago = fp;
        }

        totalFilas++;
        try {
          await api.post('/requisiciones', {
            proveedor:  beneficiario,
            concepto:   String(get(fila, 'concepto')   ?? '').trim(),
            rfc:        String(get(fila, 'rfc')         ?? '').trim().toUpperCase(),
            no_factura: String(get(fila, 'no_factura')  ?? '').trim(),
            monto,
            forma_pago: formaPago,
            fecha:      parsearFecha(get(fila, 'fecha')),
          });
          totalOk++;
        } catch (err) {
          const msg = (err as { response?: { data?: { mensaje?: string }; }; message?: string }).response?.data?.mensaje
            ?? (err as Error).message;
          errores.push(`Fila ${i + 1} — ${beneficiario}: ${msg}`);
        }
      }
    }

    if (totalFilas === 0) {
      Swal.fire({ title: 'Sin datos reconocidos', html: 'No se encontraron filas con monto válido.', icon: 'warning', confirmButtonColor: '#1a3a2a' });
      return;
    }

    let html = `<b>${totalOk}</b> de <b>${totalFilas}</b> requisición(es) importadas correctamente.`;
    if (errores.length) {
      html += `<br><small style="color:#b91c1c">${errores.slice(0, 5).join('<br>')}</small>`;
      if (errores.length > 5) html += `<br><small>...y ${errores.length - 5} más</small>`;
    }
    Swal.fire({ title: 'Importación completada', html, icon: totalOk > 0 ? 'success' : 'warning', confirmButtonColor: '#1a3a2a' });
    cargarStats();
  }

  const fmt = (n: number) => Number(n || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

  return (
    <>
      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>

      <div className="topbar">
        <div className="topbar-titulo">Nueva Requisición</div>
        <div className="topbar-breadcrumb">Tesorería · <span>Registro</span></div>
      </div>

      <div className="page-body fade-in">
        <div className="stats-grid stagger">
          <div className="stat-card verde">
            <div className="stat-icon"><IcoFileText /></div>
            <div className="stat-label">Total requisiciones</div>
            <div className="stat-value">{stats.total}</div>
            <div className="stat-meta">Este año</div>
          </div>
          <div className="stat-card dorado">
            <div className="stat-icon"><IcoDollar /></div>
            <div className="stat-label">Monto total</div>
            <div className="stat-value" style={{ fontSize: '1.25rem' }}>{fmt(stats.monto)}</div>
            <div className="stat-meta">Suma acumulada</div>
          </div>
          <div className="stat-card azul">
            <div className="stat-icon"><IcoCalendar /></div>
            <div className="stat-label">Registradas hoy</div>
            <div className="stat-value">{stats.hoy}</div>
            <div className="stat-meta">{new Date().toLocaleDateString('es-MX', { weekday: 'long' })}</div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">Datos de la Requisición</div>
            <div className="tabs" style={{ marginBottom: 0 }}>
              {([
                { id: 'manual' as ModoVista, label: 'Manual',         icon: <IcoEdit /> },
                { id: 'excel'  as ModoVista, label: 'Importar Excel', icon: <IcoTable /> },
              ]).map(m => (
                <button key={m.id} className={`tab-btn ${modo === m.id ? 'activo' : ''}`} onClick={() => setModo(m.id)}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{m.icon}{m.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="card-body">
            {modo === 'manual' ? (
              <form onSubmit={handleSubmit}>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Área</label>
                    <select value={form.area_id} onChange={e => {
                      const op = areas.find(a => a.id === Number(e.target.value));
                      set('area_id', e.target.value);
                      set('area_nombre', op?.nombre ?? '');
                    }}>
                      <option value="">Seleccionar…</option>
                      {areas.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Clasificación Presupuestal</label>
                    <select value={form.clasificacion_id} onChange={e => set('clasificacion_id', e.target.value)}>
                      <option value="">Seleccionar…</option>
                      {clasificaciones.map(c => (
                        <option key={c.id} value={c.id}>{c.clave} — {c.nombre}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group full">
                    <label>Concepto *</label>
                    <textarea placeholder="Describe el concepto del gasto…" value={form.concepto} onChange={e => set('concepto', e.target.value)} />
                  </div>

                  <div className="form-group">
                    <label>Beneficiario *</label>
                    <input placeholder="Nombre completo o razón social" value={form.proveedor} onChange={e => set('proveedor', e.target.value)} required />
                  </div>

                  <div className="form-group">
                    <label>RFC</label>
                    <input placeholder="RFC del beneficiario" value={form.rfc} onChange={e => set('rfc', e.target.value.toUpperCase())} maxLength={13} />
                  </div>

                  <div className="form-group">
                    <label>Monto *</label>
                    <input type="number" step="0.01" min="0" placeholder="0.00" value={form.monto} onChange={e => set('monto', e.target.value)} required />
                  </div>

                  <div className="form-group">
                    <label>Forma de Pago</label>
                    <select value={form.forma_pago} onChange={e => set('forma_pago', e.target.value as FormaPago)}>
                      <option value="CHEQUE">Cheque</option>
                      <option value="TRANSFERENCIA">Transferencia</option>
                      <option value="EFECTIVO">Efectivo</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Fecha</label>
                    <input type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)} />
                  </div>

                  <div className="form-group">
                    <label>No. de Factura / UUID</label>
                    <input placeholder="Opcional" value={form.no_factura} onChange={e => set('no_factura', e.target.value)} />
                  </div>

                  <div className="form-group">
                    <label>No. de Contrato</label>
                    <input placeholder="Opcional" value={form.no_contrato} onChange={e => set('no_contrato', e.target.value)} />
                  </div>

                  <div className="form-group">
                    <label>Cuenta Bancaria</label>
                    <input placeholder="Opcional" value={form.cuenta_bancaria} onChange={e => set('cuenta_bancaria', e.target.value)} />
                  </div>
                </div>

                <div style={{ marginTop: 24, display: 'flex', gap: 12 }}>
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {saving ? <IcoLoader /> : <IcoSave />}
                      {saving ? 'Guardando…' : 'Guardar Requisición'}
                    </span>
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => setForm(VACÍO)}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><IcoRefresh />Limpiar</span>
                  </button>
                </div>
              </form>
            ) : (
              <div
                className={`drop-zone ${drag ? 'activa' : ''}`}
                onDragEnter={(e: DragEvent) => { e.preventDefault(); setDrag(true); }}
                onDragLeave={() => setDrag(false)}
                onDragOver={(e: DragEvent) => e.preventDefault()}
                onDrop={(e: DragEvent) => { e.preventDefault(); setDrag(false); procesarExcel(e.dataTransfer.files[0]); }}
                onClick={() => inputRef.current?.click()}
              >
                <input
                  ref={inputRef}
                  type="file"
                  style={{ display: 'none' }}
                  accept=".xlsx,.xls,.xlsm"
                  onChange={(e: ChangeEvent<HTMLInputElement>) => { procesarExcel(e.target.files?.[0]); e.target.value = ''; }}
                />
                <div className="drop-zone-icon"><IcoUpload /></div>
                <h3>Arrastra tu archivo Excel aquí</h3>
                <p>O haz clic para buscarlo</p>
                <p style={{ marginTop: 8, fontSize: '.72rem', color: 'var(--gris-60)' }}>
                  Compatible con .xlsx · .xls · .xlsm — Lee todas las hojas de movimientos automáticamente
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
