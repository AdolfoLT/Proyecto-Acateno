/**
 * pdf.ts — Acateno Tesorería Municipal
 * ─────────────────────────────────────────────────────────────────────────────
 * Genera PDFs con diseño nativo usando pdfmake (sin plantillas externas).
 * También exporta componentes React con @react-pdf/renderer.
 *
 * INSTALACIÓN:
 *   npm install pdfmake
 *   npm install --save-dev @types/pdfmake
 *   npm install @react-pdf/renderer   ← solo si usas el componente React
 *
 * LOGO:
 *   Coloca el logo en: frontend/public/assets/logo_acateno.png
 *   Si no existe, se omite automáticamente.
 *
 * USO:
 *   import { generarPDF } from './pdf'
 *   await generarPDF(data, false, 1)   // descarga
 *   await generarPDF(data, true,  1)   // abre en nueva pestaña
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ── Tipos pdfmake ─────────────────────────────────────────────────────────────
// @types/pdfmake no exporta TDocumentDefinitions directamente en algunas
// versiones; los redefinimos de forma compatible y sin conflictos.
type Alignment = 'left' | 'right' | 'center' | 'justify'

interface ContentText {
  text: string | ContentText[]
  bold?: boolean
  italics?: boolean
  fontSize?: number
  color?: string
  fillColor?: string
  alignment?: Alignment
  margin?: [number, number, number, number]
  decoration?: string
  lineHeight?: number
  width?: number | string
  colSpan?: number
  stack?: never
}

interface ContentStack {
  stack: ContentNode[]
  alignment?: Alignment
  margin?: [number, number, number, number]
  width?: number | string
}

interface ContentColumns {
  columns: (ContentNode & { width?: number | string })[]
  margin?: [number, number, number, number]
}

interface ContentTable {
  table: {
    widths: (number | string)[]
    body: TableCell[][]
    headerRows?: number
  }
  layout?: string
  margin?: [number, number, number, number]
}

interface ContentCanvas {
  canvas: CanvasShape[]
  margin?: [number, number, number, number]
}

interface ContentImage {
  image: string
  width?: number
  height?: number
  alignment?: Alignment
  margin?: [number, number, number, number]
}

type CanvasRect = { type: 'rect'; x: number; y: number; w: number; h: number; color: string }
type CanvasLine = { type: 'line'; x1: number; y1: number; x2: number; y2: number; lineWidth: number; lineColor?: string }
type CanvasShape = CanvasRect | CanvasLine

type TableCell = ContentNode & {
  text?: string | ContentText[]
  bold?: boolean
  fontSize?: number
  color?: string
  fillColor?: string
  alignment?: Alignment
  margin?: [number, number, number, number]
  colSpan?: number
}

type ContentNode =
  | ContentText
  | ContentStack
  | ContentColumns
  | ContentTable
  | ContentCanvas
  | ContentImage
  | Record<string, unknown>

interface DocDefinition {
  pageSize: string
  pageMargins: [number, number, number, number]
  content: ContentNode[]
  defaultStyle: { font: string; fontSize: number; color: string }
}

// ── Tipos de datos de plantillas ──────────────────────────────────────────────

export interface ItemRequisicion {
  articulo: string
  unidad: string
  solicitada: string | number
  autorizada: string | number
}

export interface ItemRecepcion {
  cantidad: number | string
  descripcion: string
  precio_unitario: number | string
}

export interface DatoPDF {
  // Campos comunes
  fecha?: string
  folio?: string
  // Plantilla 1 — Orden de Pago
  concepto?: string
  no_factura?: string
  no_contrato?: string
  fondo?: string
  cuenta_bancaria?: string
  monto?: number | string
  iva?: number | string
  isr?: number | string
  proveedor?: string
  rfc?: string
  forma_pago?: string
  responsable?: string
  // Plantillas 2-4 — Cartas y oficios
  solicitante?: string
  cargo_solicitante?: string
  destinatario?: string
  cargo_destinatario?: string
  // Plantilla 3 — Autorización
  fuente?: string
  partida?: string
  // Plantilla 5 — Requisición
  area?: string
  nombre?: string
  fecha_entrega?: string
  programa?: string
  componente?: string
  actividad?: string
  meta?: string
  items?: ItemRequisicion[] | ItemRecepcion[]
}

interface FechasParseadas {
  larga: string
  corta: string
  obj: Date
}

interface PlantillaMeta {
  nombre: string
  titulo: string
}

// ── Tipos de pdfmake (instancia lazy) ────────────────────────────────────────
interface PdfMakeInstance {
  fonts: Record<string, unknown>
  createPdf: (docDef: DocDefinition) => {
    getBase64: (cb: (b64: string) => void, errCb?: (err: unknown) => void) => void
    download: (nombre: string) => void
  }
}

// ── Tipos para React-PDF (componentes) ───────────────────────────────────────
export interface ReactPDFComponents {
  PDFOrdenDePago: (props: { data: DatoPDF; logoUrl?: string }) => unknown
  PDFSolicitudSuficiencia: (props: { data: DatoPDF }) => unknown
}

// ═════════════════════════════════════════════════════════════════════════════
// pdfmake — carga LAZY (solo al generar el primer PDF)
// Usamos Helvetica (Type-1 estándar) → sin VFS, sin cuelgue, sin bundle gigante
// ═════════════════════════════════════════════════════════════════════════════
let _pdfMakeInstance: PdfMakeInstance | null = null

async function getPdfMake(): Promise<PdfMakeInstance> {
  if (_pdfMakeInstance) return _pdfMakeInstance
  const { default: pdfMake } = await import('pdfmake/build/pdfmake') as {
    default: PdfMakeInstance
  }
  pdfMake.fonts = {
    Helvetica: {
      normal:      'Helvetica',
      bold:        'Helvetica-Bold',
      italics:     'Helvetica-Oblique',
      bolditalics: 'Helvetica-BoldOblique',
    },
  }
  _pdfMakeInstance = pdfMake
  return pdfMake
}

// ── Paleta de colores del Municipio de Acateno ───────────────────────────────
const C = {
  verde:      '#1a3a2a',
  verdeTabla: '#2d6a42',
  verdeClaro: '#e8f2ec',
  negro:      '#111111',
  gris:       '#555555',
  grisCelda:  '#f0f0f0',
} as const

// ── Metadatos de cada plantilla ───────────────────────────────────────────────
const META: Record<number, PlantillaMeta> = {
  1: { nombre: 'Orden_de_Pago',           titulo: 'Orden de Pago'                  },
  2: { nombre: 'Solicitud_Suficiencia',    titulo: 'Solicitud de Suficiencia'       },
  3: { nombre: 'Autorizacion_Suficiencia', titulo: 'Autorización de Suficiencia'    },
  4: { nombre: 'Oficio_Solicitud',         titulo: 'Oficio de Solicitud'            },
  5: { nombre: 'Requisicion_Materiales',   titulo: 'Requisición de Materiales'      },
  6: { nombre: 'Recepcion_Bienes',         titulo: 'Formato de Recepción de Bienes' },
}

// ═════════════════════════════════════════════════════════════════════════════
// MODAL DE PROGRESO
// ═════════════════════════════════════════════════════════════════════════════
function inyectarModal(): void {
  if (document.getElementById('pdf-prog-modal')) return
  const el = document.createElement('div')
  el.id = 'pdf-prog-modal'
  el.style.cssText = [
    'display:none', 'position:fixed', 'inset:0',
    'background:rgba(0,0,0,.52)', 'z-index:99999',
    'align-items:center', 'justify-content:center',
  ].join(';')
  el.innerHTML = `
    <div style="background:#fff;border-radius:16px;padding:36px 40px;width:340px;
                box-shadow:0 12px 48px rgba(0,0,0,.22);text-align:center;">
      <div style="width:54px;height:54px;margin:0 auto 18px;border-radius:50%;
                  background:#e8f2ec;display:flex;align-items:center;justify-content:center;">
        <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24"
             fill="none" stroke="#2d5a3f" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
        </svg>
      </div>
      <h3 id="pdf-prog-titulo" style="font-size:1rem;font-weight:600;color:#1a3a2a;margin-bottom:6px;">
        Generando documento...
      </h3>
      <p id="pdf-prog-estado" style="font-size:.82rem;color:#7a8278;margin-bottom:20px;min-height:18px;">
        Iniciando
      </p>
      <div style="width:100%;height:10px;background:#eef0ec;border-radius:99px;overflow:hidden;margin-bottom:10px;">
        <div id="pdf-prog-barra"
             style="height:100%;width:0%;border-radius:99px;
                    background:linear-gradient(90deg,#1a3a2a,#3d7a56);
                    transition:width .3s cubic-bezier(.4,0,.2,1);"></div>
      </div>
      <span id="pdf-prog-pct" style="font-size:.85rem;font-weight:700;color:#2d5a3f;">0%</span>
    </div>`
  document.body.appendChild(el)
}

function setProgreso(pct: number, estado?: string): void {
  inyectarModal()
  ;(document.getElementById('pdf-prog-modal') as HTMLElement).style.display = 'flex'
  ;(document.getElementById('pdf-prog-barra') as HTMLElement).style.width   = `${pct}%`
  ;(document.getElementById('pdf-prog-pct')   as HTMLElement).textContent   = `${pct}%`
  if (estado) {
    ;(document.getElementById('pdf-prog-estado') as HTMLElement).textContent = estado
  }
}

function cerrarProgreso(): void {
  const m = document.getElementById('pdf-prog-modal') as HTMLElement | null
  const b = document.getElementById('pdf-prog-barra') as HTMLElement | null
  if (m) m.style.display = 'none'
  if (b) b.style.width   = '0%'
}

// ═════════════════════════════════════════════════════════════════════════════
// UTILIDADES
// ═════════════════════════════════════════════════════════════════════════════

/** Convierte monto numérico a texto en español (pesos mexicanos) */
export function numeroALetras(num: number): string {
  if (!num || isNaN(num)) return 'CERO PESOS 00/100 M.N.'

  const u = [
    '', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE',
    'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS',
    'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE',
  ]
  const d = ['', '', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA']
  const c = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS',
             'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS']

  const entero   = Math.floor(Math.abs(num))
  const centavos = Math.round((Math.abs(num) - entero) * 100)

  function g(n: number): string {
    if (!n) return ''
    if (n === 100) return 'CIEN'
    let r = ''
    if (n >= 100) { r += `${c[Math.floor(n / 100)]} `; n %= 100 }
    if (n >= 20)  { r += d[Math.floor(n / 10)]; if (n % 10) r += ` Y ${u[n % 10]}` }
    else if (n)   { r += u[n] }
    return r.trim()
  }

  let res = ''
  if (!entero)            res = 'CERO'
  else if (entero < 1000) res = g(entero)
  else if (entero < 1e6) {
    const miles = Math.floor(entero / 1000), resto = entero % 1000
    res = `${miles === 1 ? 'MIL' : `${g(miles)} MIL`}${resto ? ` ${g(resto)}` : ''}`
  } else if (entero < 1e9) {
    const mill = Math.floor(entero / 1e6), resto = entero % 1e6
    res = mill === 1 ? 'UN MILLÓN' : `${g(mill)} MILLONES`
    if (resto >= 1000) {
      const m = Math.floor(resto / 1000), r = resto % 1000
      res += ` ${m === 1 ? 'MIL' : `${g(m)} MIL`}${r ? ` ${g(r)}` : ''}`
    } else if (resto) res += ` ${g(resto)}`
  } else {
    res = entero.toLocaleString('es-MX')
  }

  return `${res} PESOS ${String(centavos).padStart(2, '0')}/100 M.N.`
}

/** Formatea fecha a partir de 'YYYY-MM-DD' o undefined */
export function parsearFecha(rawFecha?: string): FechasParseadas {
  const str = rawFecha ? String(rawFecha).slice(0, 10) : new Date().toISOString().slice(0, 10)
  const [yr, mo, dy] = str.split('-').map(Number)
  const obj = new Date(yr, mo - 1, dy)
  return {
    larga: obj.toLocaleDateString('es-MX', { day: '2-digit', month: 'long',     year: 'numeric' }),
    corta: obj.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit',  year: 'numeric' }),
    obj,
  }
}

/** Carga el logo como dataURL, intentando varias rutas */
export async function cargarLogo(): Promise<string | null> {
  const rutas = [
    '/assets/logo_acateno.png',
    '/plantillas/logo_acateno.png',
    '/logo_acateno.png',
  ]
  for (const ruta of rutas) {
    try {
      const resp = await fetch(ruta, { cache: 'force-cache' })
      if (!resp.ok) continue
      const blob   = await resp.blob()
      const reader = new FileReader()
      const dataUrl = await new Promise<string>((res, rej) => {
        reader.onload  = () => res(reader.result as string)
        reader.onerror = rej
        reader.readAsDataURL(blob)
      })
      return dataUrl
    } catch { /* siguiente ruta */ }
  }
  return null
}

// ═════════════════════════════════════════════════════════════════════════════
// BLOQUES REUTILIZABLES (pdfmake)
// ═════════════════════════════════════════════════════════════════════════════

const defaultStyle = { font: 'Helvetica', fontSize: 9, color: C.negro }

/** Barra de color sólido */
const barraVerde = (alto = 14): ContentCanvas => ({
  canvas: [{ type: 'rect', x: 0, y: 0, w: 535, h: alto, color: C.verde }],
  margin: [0, 0, 0, 0],
})

/** Celda de encabezado verde */
const thVerde = (texto: string, colSpan = 1): TableCell => ({
  text: texto, bold: true, fontSize: 8, color: 'white',
  fillColor: C.verdeTabla, alignment: 'center', colSpan,
})

/** Celda normal */
const td = (texto: string | number, opts: Partial<TableCell> = {}): TableCell => ({
  text: String(texto ?? ''), fontSize: 8,
  ...opts,
})

/** Encabezado estándar (logo + nombre + tipo de documento) */
function headerMunicipio(
  logo: string | null,
  tipoParte1 = '',
  tipoParte2 = '',
): ContentColumns {
  type Col = ContentNode & { width: number | string }

  const cols: Col[] = []

  cols.push(logo
    ? { image: logo, width: 70, alignment: 'center' } as Col
    : { text: '', width: 70 } as unknown as Col,
  )

  cols.push({
    stack: [
      { text: 'MUNICIPIO DE ACATENO; PUEBLA.', bold: true, fontSize: 11, alignment: 'center' },
      { text: '2024-2027', fontSize: 9, alignment: 'center' },
    ],
    width: '*',
    margin: [0, 8, 0, 0],
  } as unknown as Col)

  cols.push(tipoParte1
    ? {
        stack: [
          { text: tipoParte1, bold: true, fontSize: 9, alignment: 'right' },
          { text: tipoParte2, bold: true, fontSize: 9, alignment: 'right' },
        ],
        width: 150,
        margin: [0, 8, 0, 0],
      } as unknown as Col
    : { text: '', width: 150 } as unknown as Col,
  )

  return { columns: cols, margin: [0, 6, 0, 8] }
}

/** Bloque de dos firmas al pie */
function pieFirmas(
  nombre1: string,
  cargo1: string,
  nombre2: string,
  cargo2: string,
  margenTop = 20,
): ContentColumns {
  const firma = (nombre: string, cargo: string): ContentStack => ({
    stack: [
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 170, y2: 0, lineWidth: 0.8, lineColor: '#333' }] },
      { text: nombre, bold: true, fontSize: 8, alignment: 'center', margin: [0, 3, 0, 0] },
      { text: cargo,  fontSize: 8, alignment: 'center' },
    ],
    margin: [0, 0, 0, 0],
  })

  return {
    columns: [
      { ...firma(nombre1, cargo1), width: 190 } as unknown as ContentNode & { width: number },
      { text: '', width: '*' } as unknown as ContentNode & { width: number },
      { ...firma(nombre2, cargo2), width: 190 } as unknown as ContentNode & { width: number },
    ],
    margin: [0, margenTop, 0, 10],
  }
}

/** Pie de dirección */
const pieDireccion: ContentText = {
  text: 'Calle Cuauhtémoc S/N. Col. Centro.  |  Acateno, Puebla. México.  |  C.P. 73590  |  Tel. 232 324 7021',
  fontSize: 7, color: C.gris, alignment: 'right', margin: [0, 4, 0, 0],
}

// ═════════════════════════════════════════════════════════════════════════════
// PLANTILLA 1 — ORDEN DE PAGO
// ═════════════════════════════════════════════════════════════════════════════
export function defPlantilla1(data: DatoPDF, logo: string | null, fechas: FechasParseadas): DocDefinition {
  const monto    = Number(data.monto || 0)
  const montoStr = monto.toLocaleString('es-MX', { minimumFractionDigits: 2 })
  const enLetra  = numeroALetras(monto)
  const iva      = Number(data.iva  || 0)
  const isr      = Number(data.isr  || 0)
  const ivaStr   = iva.toLocaleString('es-MX',  { minimumFractionDigits: 2 })
  const isrStr   = isr.toLocaleString('es-MX',  { minimumFractionDigits: 2 })
  const total    = monto + iva - isr
  const totalStr = total.toLocaleString('es-MX', { minimumFractionDigits: 2 })

  return {
    pageSize: 'LETTER',
    pageMargins: [40, 16, 40, 16],
    defaultStyle,
    content: [
      { ...barraVerde(14), margin: [0, 0, 0, 6] },
      headerMunicipio(logo, 'ORDEN DE PAGO', 'TESORERÍA MUNICIPAL'),
      {
        columns: [
          { text: 'MUNICIPIO DE ACATENO A:', bold: true, fontSize: 9, width: 175 },
          { text: data.proveedor ?? '', fontSize: 9, width: '*' },
        ],
        margin: [0, 2, 0, 10],
      },
      { text: 'El concepto:', bold: true, fontSize: 9, margin: [0, 0, 0, 3] },
      {
        table: { widths: ['*'], body: [[{ text: data.concepto ?? '', fontSize: 9, margin: [4, 3, 4, 3] }]] },
        margin: [0, 0, 0, 6],
      },
      {
        table: {
          widths: ['*'],
          body: [[{
            text: 'DEL MUNICIPIO DE ACATENO',
            alignment: 'center', color: 'white', bold: true,
            fontSize: 9, fillColor: C.verde, margin: [0, 3, 0, 3],
          }]],
        },
        layout: 'noBorders',
        margin: [0, 0, 0, 6],
      },
      {
        columns: [
          { text: [{ text: 'No. De Factura   ', bold: true, fontSize: 8 },  { text: data.no_factura  ?? '', fontSize: 8 }], width: '*' },
          { text: [{ text: 'No. De Contrato   ', bold: true, fontSize: 8 }, { text: data.no_contrato ?? '', fontSize: 8 }], width: '*' },
        ],
        margin: [0, 0, 0, 6],
      },
      {
        text: [
          { text: 'Fondo o programa con el cual se autoriza el pago:   ', bold: true, fontSize: 8 },
          { text: data.fondo ?? '', fontSize: 8 },
        ],
        margin: [0, 0, 0, 4],
      },
      {
        columns: [
          { text: [{ text: 'Cuenta Bancaria:   ', bold: true, fontSize: 8 }, { text: data.cuenta_bancaria ?? '', fontSize: 8 }], width: '*' },
          { text: [{ text: 'Importe a pagar:   ', bold: true, fontSize: 8 }, { text: `$ ${montoStr}`, fontSize: 8 }], width: '*' },
        ],
        margin: [0, 0, 0, 4],
      },
      { text: [{ text: 'Monto Pagado:   ', bold: true, fontSize: 9 }, { text: `$ ${montoStr}`, fontSize: 9 }], alignment: 'center', margin: [0, 0, 0, 8] },
      {
        columns: [
          { text: '', width: '*' },
          {
            table: {
              widths: [160, 80],
              body: [
                [td('IMPORTE',           { bold: true }),       td(`$ ${montoStr}`, { alignment: 'right' })],
                [td('I.V.A'),                                   td(`$ ${ivaStr}`,   { alignment: 'right' })],
                [td('RETENCION DE I.S.R'),                      td(`$ ${isrStr}`,   { alignment: 'right' })],
                [td('TOTAL A PAGAR',     { bold: true }),       td(`$ ${totalStr}`, { alignment: 'right', bold: true })],
              ],
            },
            width: 244,
          },
        ],
        margin: [0, 0, 0, 10],
      },
      { text: 'EN LETRA:', bold: true, fontSize: 9, alignment: 'center', margin: [0, 0, 0, 3] },
      {
        table: { widths: ['*'], body: [[{ text: enLetra, fontSize: 8, margin: [4, 4, 4, 4] }]] },
        margin: [0, 0, 0, 10],
      },
      {
        table: {
          widths: ['*'],
          body: [[{ text: 'BENEFICIARIO', alignment: 'center', color: 'white', bold: true, fontSize: 9, fillColor: C.verde, margin: [0, 3, 0, 3] }]],
        },
        layout: 'noBorders',
      },
      {
        table: {
          widths: [95, '*'],
          body: [
            [td('A nombre de:',       { bold: true }), td(data.proveedor   ?? '')],
            [td('Responsable legal:', { bold: true }), td(data.responsable ?? '')],
            [td('R.F.C:',             { bold: true }), td(data.rfc         ?? '')],
            [td('Forma de pago:',     { bold: true }), td(data.forma_pago  ?? 'CHEQUE')],
          ],
        },
        margin: [0, 0, 0, 20],
      },
      pieFirmas('C.GERARDO GÓMEZ ALONSO', 'TESORERO MUNICIPAL', 'ING. DIEGO TORRE OSORIO', 'PRESIDENTE MUNICIPAL', 16),
      barraVerde(14),
    ],
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// PLANTILLA 2 — SOLICITUD DE SUFICIENCIA PRESUPUESTAL
// ═════════════════════════════════════════════════════════════════════════════
export function defPlantilla2(data: DatoPDF, _logo: string | null, fechas: FechasParseadas): DocDefinition {
  const { larga }   = fechas
  const solicitante = data.solicitante       ?? 'C. José Hugo García Moreno'
  const cargoSol    = data.cargo_solicitante ?? 'Auxiliar de Tesorería'
  const concepto    = data.concepto          ?? 'materiales de oficina'

  return {
    pageSize: 'LETTER',
    pageMargins: [55, 50, 55, 40],
    defaultStyle,
    content: [
      {
        columns: [
          { text: '', width: '*' },
          {
            stack: [
              { text: [{ text: 'No. de Oficio: ', bold: true, fontSize: 9 }, { text: data.folio ?? 'S/N', fontSize: 9 }] },
              { text: [{ text: 'ASUNTO: ', bold: true, fontSize: 9 }, { text: 'Solicitud de Suficiencia Presupuestal', fontSize: 9 }] },
            ],
            width: 'auto',
          },
        ],
        margin: [0, 0, 0, 16],
      },
      { text: 'C. Gerardo Gómez Alonso', bold: true, fontSize: 10, italics: true },
      { text: 'Tesorero Municipal', fontSize: 9, italics: true },
      { text: 'H. Ayuntamiento de Acateno, Puebla', fontSize: 9, italics: true },
      { text: 'Administración 2024-2027', fontSize: 9, italics: true },
      { text: 'P r e s e n t e', fontSize: 9, italics: true, bold: true, margin: [0, 0, 0, 14] },
      {
        text: `Quien suscribe ${solicitante}, ${cargoSol} del Municipio de Acateno, Puebla, por medio de la presente reciba un cordial saludo y al mismo tiempo me dirijo a usted de la manera más atenta y con Fundamento en el Artículo 45 fracciones I y X, 58 y 60 de la ley de Adquisiciones, Arrendamientos y Servicios del Sector Publico Estatal y Municipal para el Estado de Puebla, Solicito de la manera más atenta Asigne Suficiencia Presupuestal para efectos de llevar a cabo la adquisición de ${concepto}, que son de suma importancia para realizar las actividades diarias de la Administración Municipal de Acateno 2024-2027, atentamente solicito notificarme por escrito la respuesta correspondiente a mi petición.`,
        fontSize: 9, alignment: 'justify', lineHeight: 1.5, margin: [0, 0, 0, 16],
      },
      { text: 'Sin otro particular, quedo de Usted como su seguro colaborador.', fontSize: 9, margin: [0, 0, 0, 24] },
      { text: 'A t e n t a m e n t e', bold: true, fontSize: 9, alignment: 'center' },
      { text: `Acateno, Puebla; a ${larga}`, bold: true, fontSize: 9, alignment: 'center', margin: [0, 4, 0, 48] },
      {
        stack: [
          { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 200, y2: 0, lineWidth: 0.8, lineColor: '#333' }] },
          { text: solicitante, bold: true, fontSize: 9, alignment: 'center', margin: [0, 3, 0, 0] },
          { text: cargoSol, fontSize: 9, alignment: 'center' },
          { text: 'del H Ayuntamiento de Acateno, Puebla.', fontSize: 9, alignment: 'center' },
        ],
        alignment: 'center',
      },
      pieDireccion,
    ],
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// PLANTILLA 3 — AUTORIZACIÓN DE SUFICIENCIA PRESUPUESTAL
// ═════════════════════════════════════════════════════════════════════════════
export function defPlantilla3(data: DatoPDF, logo: string | null, fechas: FechasParseadas): DocDefinition {
  const { larga }    = fechas
  const monto        = Number(data.monto || 0)
  const montoStr     = monto.toLocaleString('es-MX', { minimumFractionDigits: 2 })
  const montoLetras  = numeroALetras(monto)
  const concepto     = data.concepto          ?? 'adquisición de material de oficina'
  const fuente       = data.fuente            ?? 'Participaciones'
  const partida      = data.partida           ?? ''
  const destinatario = data.destinatario      ?? 'C. José Hugo García Moreno'
  const cargoDestino = data.cargo_destinatario ?? 'Auxiliar de Tesorería del H. Ayuntamiento de Acateno, Puebla'

  return {
    pageSize: 'LETTER',
    pageMargins: [55, 50, 55, 40],
    defaultStyle,
    content: [
      ...(logo ? [{ image: logo, width: 80, alignment: 'left' as Alignment, margin: [0, 0, 0, 10] as [number,number,number,number] }] : []),
      {
        columns: [
          { text: '', width: '*' },
          {
            stack: [
              { text: [{ text: 'No. de Oficio: ', bold: true, fontSize: 9 }, { text: data.folio ?? '', fontSize: 9 }] },
              { text: [{ text: 'Asunto: ', bold: true, fontSize: 9 }, { text: 'Autorización de Suficiencia Presupuestal.', fontSize: 9 }] },
            ],
            width: 'auto',
          },
        ],
        margin: [0, 0, 0, 14],
      },
      { text: destinatario, bold: true, fontSize: 10, italics: true },
      { text: cargoDestino, fontSize: 9, italics: true },
      { text: 'Administración 2024-2027', fontSize: 9, italics: true },
      { text: 'P r e s e n t e', bold: true, fontSize: 9, italics: true, margin: [0, 0, 0, 14] },
      {
        text: [
          'Quien suscribe ',
          { text: 'C. Gerardo Gómez Alonso', bold: true },
          ', Tesorero municipal de Acateno, Puebla, por medio del presente escrito y con fundamento en el Artículo 58 de la Ley de Adquisiciones, Arrendamientos y Servicios del Sector Público Estatal y Municipal, en respuesta a su oficio dirigido a esta dependencia con fecha ',
          { text: larga, bold: true },
          ', hago de su conocimiento que el H. Ayuntamiento de Acateno, Puebla; de acuerdo al presupuesto de egresos y a la partida presupuestal ',
          { text: partida || '_______', bold: true },
          ', si cuentan con el recurso económico dentro de la partida para efectuar el pago correspondiente a: ',
          { text: concepto, bold: true },
          ', por un monto de ',
          { text: `$${montoStr}`, bold: true },
          ' (',
          { text: montoLetras, bold: true },
          ') misma que será devengada en una sola exhibición, correspondientes al ejercicio fiscal ',
          { text: String(fechas.obj.getFullYear()), bold: true },
          ' de acuerdo con la siguiente estructura financiera:',
        ],
        fontSize: 9, alignment: 'justify', lineHeight: 1.5, margin: [0, 0, 0, 16],
      },
      {
        table: {
          widths: [80, 100, 100, '*'],
          body: [
            [thVerde('EJERCICIO FISCAL'), thVerde('FUENTE DE FINANCIAMIENTO'), thVerde('PARTIDA PRESUPUESTAL'), thVerde('MONTO AUTORIZADO PARA EL EJERCICIO')],
            [
              td(fechas.obj.getFullYear(), { alignment: 'center', bold: true }),
              td(fuente,   { alignment: 'center' }),
              td(partida,  { alignment: 'center' }),
              td(`$${montoStr}`, { alignment: 'center', bold: true, color: '#0a5c26' }),
            ],
            [td(''), td(''), td(''), td('')],
            [{ text: '', colSpan: 3 } as TableCell, {} as TableCell, {} as TableCell, td(`$${montoStr}`, { alignment: 'center', bold: true })],
          ],
        },
        margin: [0, 0, 0, 14],
      },
      { text: 'Sin otro particular que referir, le expreso la seguridad de mi colaboración.', fontSize: 9, margin: [0, 0, 0, 24] },
      { text: 'A T E N T A M E N T E', bold: true, fontSize: 9, alignment: 'center' },
      { text: `Acateno, Puebla; a ${larga}`, bold: true, fontSize: 9, alignment: 'center', margin: [0, 4, 0, 48] },
      {
        stack: [
          { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 200, y2: 0, lineWidth: 0.8, lineColor: '#333' }] },
          { text: 'C. Gerardo Gómez Alonso', bold: true, fontSize: 9, alignment: 'center', margin: [0, 3, 0, 0] },
          { text: 'Tesorero Municipal de Acateno, Puebla', fontSize: 9, alignment: 'center' },
        ],
        alignment: 'center',
      },
      pieDireccion,
    ],
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// PLANTILLA 4 — OFICIO DE SOLICITUD
// ═════════════════════════════════════════════════════════════════════════════
export function defPlantilla4(data: DatoPDF, logo: string | null, fechas: FechasParseadas): DocDefinition {
  const { larga }    = fechas
  const solicitante  = data.solicitante        ?? 'C. José Hugo García Moreno'
  const cargoSol     = data.cargo_solicitante  ?? 'Auxiliar de Tesorería'
  const destinatario = data.destinatario       ?? 'C. GERARDO GÓMEZ ALONSO'
  const cargoDestino = data.cargo_destinatario ?? 'TESORERO MUNICIPAL DE ACATENO'
  const concepto     = data.concepto           ?? 'la compra de material de papelería, de gran utilidad para la realización de actividades diarias del personal de las diferentes áreas del Ayuntamiento de Acateno, y de esta forma cumplir con los objetivos establecidos por la Administración 2024-2027.'

  return {
    pageSize: 'LETTER',
    pageMargins: [55, 50, 55, 40],
    defaultStyle,
    content: [
      {
        columns: [
          {
            stack: [
              { text: destinatario, bold: true, fontSize: 10 },
              { text: cargoDestino, bold: true, fontSize: 10 },
            ],
            width: '*',
          },
          ...(logo ? [{ image: logo, width: 70, alignment: 'right' as Alignment }] : []),
        ],
        margin: [0, 0, 0, 14],
      },
      {
        columns: [
          { text: '', width: '*' },
          {
            stack: [
              { text: [{ text: 'ASUNTO: ', bold: true, fontSize: 9 }, { text: 'SOLICITUD', fontSize: 9 }] },
              { text: [{ text: 'FECHA: ',  bold: true, fontSize: 9 }, { text: larga.toUpperCase(), fontSize: 9 }] },
            ],
            width: 'auto',
          },
        ],
        margin: [0, 0, 0, 16],
      },
      {
        text: `Sirva la presente para recibir un cordial saludo; asimismo, solicito de su apoyo para ${concepto} Anexo a la presente el formato de requisición con los materiales solicitados.`,
        fontSize: 9, alignment: 'justify', lineHeight: 1.5, margin: [0, 0, 0, 16],
      },
      { text: 'Sin más por el momento, me reitero a sus apreciables órdenes.', fontSize: 9, margin: [0, 0, 0, 32] },
      { text: 'ATENTAMENTE', bold: true, fontSize: 9, alignment: 'center', margin: [0, 0, 0, 36] },
      {
        stack: [
          { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 200, y2: 0, lineWidth: 0.8, lineColor: '#333' }] },
          { text: solicitante, bold: true, fontSize: 9, alignment: 'center', margin: [0, 3, 0, 0] },
          { text: cargoSol, fontSize: 9, alignment: 'center' },
        ],
        alignment: 'center',
      },
    ],
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// PLANTILLA 5 — REQUISICIÓN DE MATERIALES PAPELERÍA
// ═════════════════════════════════════════════════════════════════════════════
export function defPlantilla5(data: DatoPDF, logo: string | null, fechas: FechasParseadas): DocDefinition {
  const { corta } = fechas
  const area   = data.area   ?? 'TESORERÍA'
  const nombre = data.nombre ?? 'JOSÉ HUGO GARCÍA MORENO'
  const rawItems = (data.items ?? []) as ItemRequisicion[]

  const filas: ItemRequisicion[] = [...rawItems]
  while (filas.length < 15) filas.push({ articulo: '', unidad: '', solicitada: '', autorizada: '' })

  const filasTabla = filas.slice(0, 15).map((it, i): TableCell[] => [
    td(i + 1,          { alignment: 'center', fontSize: 8 }),
    td(it.articulo,    { fontSize: 8 }),
    td(it.unidad,      { alignment: 'center', fontSize: 8 }),
    td(it.solicitada,  { alignment: 'center', fontSize: 8 }),
    td(it.autorizada,  { alignment: 'center', fontSize: 8 }),
  ])

  const headerConLogo: ContentNode = {
    columns: [
      { image: logo!, width: 65, alignment: 'center' },
      {
        stack: [
          { text: 'MUNICIPIO DE ACATENO PUEBLA', bold: true, fontSize: 12, alignment: 'center' },
          { text: 'Calle Cuauhtemoc S/N Colonia Centro', fontSize: 8, alignment: 'center' },
          { text: 'C.P. 73590', fontSize: 8, alignment: 'center' },
        ],
        width: '*',
        margin: [0, 6, 0, 0],
      },
      { text: '', width: 65 },
    ],
    margin: [0, 0, 0, 6],
  }

  return {
    pageSize: 'LETTER',
    pageMargins: [30, 20, 30, 20],
    defaultStyle,
    content: [
      ...(logo
        ? [headerConLogo]
        : [
            { text: 'MUNICIPIO DE ACATENO PUEBLA', bold: true, fontSize: 12, alignment: 'center' as Alignment, margin: [0, 0, 0, 4] as [number,number,number,number] },
            { text: 'Calle Cuauhtemoc S/N Colonia Centro  ·  C.P. 73590', fontSize: 8, alignment: 'center' as Alignment, margin: [0, 0, 0, 6] as [number,number,number,number] },
          ]
      ),
      { text: 'REQUISICIÓN DE MATERIALES PAPELERÍA', bold: true, fontSize: 11, alignment: 'center', decoration: 'underline', margin: [0, 0, 0, 8] },
      {
        table: {
          widths: ['*', 80, '*', 70],
          body: [
            [
              { text: [{ text: 'DEPARTAMENTO QUE SOLICITA: ', bold: true, fontSize: 8 }, { text: area.toUpperCase(), fontSize: 8 }], colSpan: 2 } as TableCell,
              {} as TableCell,
              { text: [{ text: 'FECHA DE PEDIDO: ', bold: true, fontSize: 8 }, { text: corta, fontSize: 8 }], colSpan: 2 } as TableCell,
              {} as TableCell,
            ],
            [
              { text: [{ text: 'NOMBRE: ', bold: true, fontSize: 8 }, { text: nombre, fontSize: 8 }], colSpan: 2 } as TableCell,
              {} as TableCell,
              { text: [{ text: 'FECHA DE ENTREGA: ', bold: true, fontSize: 8 }, { text: data.fecha_entrega ?? '', fontSize: 8 }], colSpan: 2 } as TableCell,
              {} as TableCell,
            ],
          ],
        },
        layout: 'lightHorizontalLines',
        margin: [0, 0, 0, 6],
      },
      {
        table: {
          widths: [24, '*', 50, 50, 50],
          headerRows: 2,
          body: [
            [thVerde('No.'), thVerde('ARTÍCULOS'), thVerde('UNIDAD'), { ...thVerde('UNIDAD'), colSpan: 2, text: 'UNIDAD' }, {} as TableCell],
            [td(''), td(''), td(''), thVerde('SOLICITADA'), thVerde('AUTORIZADA')],
            ...filasTabla,
          ],
        },
        margin: [0, 0, 0, 8],
      },
      {
        table: {
          widths: [80, '*'],
          body: [
            [{ text: 'PROGRAMA',   bold: true, fontSize: 8, fillColor: C.grisCelda } as TableCell, td(data.programa   ?? '')],
            [{ text: 'COMPONENTE', bold: true, fontSize: 8, fillColor: C.grisCelda } as TableCell, td(data.componente ?? '')],
            [{ text: 'ACTIVIDAD',  bold: true, fontSize: 8, fillColor: C.grisCelda } as TableCell, td(data.actividad  ?? '')],
            [{ text: 'META',       bold: true, fontSize: 8, fillColor: C.grisCelda } as TableCell, td(data.meta       ?? '')],
          ],
        },
        margin: [0, 0, 0, 12],
      },
      {
        columns: ['ELABORADO POR:', 'PRESIDENTE:', 'TESORERO:', 'RECIBIDO POR:'].map((titulo, i) => ({
          stack: [
            { text: titulo, bold: true, fontSize: 7, alignment: 'center' },
            { canvas: [{ type: 'line', x1: 10, y1: 20, x2: 110, y2: 20, lineWidth: 0.7 }] },
            { text: [nombre, 'Ing. Diego Torre Osorio', 'C. Gerardo Gómez Alonso', ''][i], fontSize: 7, alignment: 'center', margin: [0, 2, 0, 0] },
          ],
        })),
      },
    ],
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// PLANTILLA 6 — FORMATO DE RECEPCIÓN DE BIENES Y/O SERVICIOS
// ═════════════════════════════════════════════════════════════════════════════
export function defPlantilla6(data: DatoPDF, logo: string | null, fechas: FechasParseadas): DocDefinition {
  const { corta }   = fechas
  const area        = data.area      ?? 'TESORERÍA MUNICIPAL'
  const gestiono    = data.nombre    ?? data.solicitante ?? 'JOSÉ HUGO GARCÍA MORENO'
  const proveedor   = data.proveedor ?? ''
  const factura     = data.no_factura ?? ''
  const rawItems    = (data.items ?? []) as ItemRecepcion[]

  const suma  = rawItems.reduce((acc, it) => acc + Number(it.precio_unitario || 0) * Number(it.cantidad || 1), 0)
  const iva   = Number(data.iva  ?? suma * 0.16)
  const isr   = Number(data.isr  ?? 0)
  const total = suma + iva - isr
  const fmt   = (n: number) => n.toLocaleString('es-MX', { minimumFractionDigits: 2 })

  const filasItems = rawItems.map((it, i): TableCell[] => [
    td(i + 1,            { alignment: 'center', fontSize: 7 }),
    td(it.cantidad,      { alignment: 'center', fontSize: 7 }),
    td(it.descripcion,   { fontSize: 7 }),
    td(proveedor,        { fontSize: 7 }),
    td(factura,          { fontSize: 7 }),
    td(it.precio_unitario ? `$ ${fmt(Number(it.precio_unitario))}` : '', { alignment: 'right', fontSize: 7 }),
    td(it.precio_unitario ? `$ ${fmt(Number(it.precio_unitario) * Number(it.cantidad || 1))}` : '', { alignment: 'right', fontSize: 7 }),
  ])

  const vacias = Math.max(0, 8 - rawItems.length)

  return {
    pageSize: 'LETTER',
    pageMargins: [30, 20, 30, 20],
    defaultStyle,
    content: [
      {
        table: {
          widths: ['*'],
          body: [[{
            stack: [
              ...(logo ? [{ image: logo, width: 55, alignment: 'center' as Alignment }] : []),
              { text: 'MUNICIPIO DE ACATENO, PUEBLA',              bold: true, fontSize: 10, alignment: 'center' },
              { text: 'TESORERÍA MUNICIPAL',                        bold: true, fontSize: 9,  alignment: 'center' },
              { text: 'FORMATO DE RECEPCIÓN DE BIENES Y/O SERVICIOS', bold: true, fontSize: 8, alignment: 'center' },
            ],
            margin: [0, 4, 0, 4],
          } as TableCell]],
        },
        layout: 'noBorders',
        margin: [0, 0, 0, 8],
      },
      {
        table: {
          widths: [100, '*', 80, '*'],
          body: [
            [
              { text: 'ÁREA SOLICITANTE DEL BIEN/SERVICIO:', bold: true, fontSize: 7, colSpan: 1 } as TableCell,
              { text: area, fontSize: 7, colSpan: 3 } as TableCell, {} as TableCell, {} as TableCell,
            ],
            [
              { text: 'GESTIONÓ:', bold: true, fontSize: 7 } as TableCell,
              { text: gestiono,     fontSize: 7 } as TableCell,
              { text: 'FECHA:',    bold: true, fontSize: 7 } as TableCell,
              { text: corta,        fontSize: 7 } as TableCell,
            ],
            [
              { text: 'REQUISICIÓN NO.:', bold: true, fontSize: 7 } as TableCell,
              { text: data.folio ?? '',    fontSize: 7 } as TableCell,
              { text: '', colSpan: 2 } as TableCell, {} as TableCell,
            ],
          ],
        },
        layout: 'lightHorizontalLines',
        margin: [0, 0, 0, 6],
      },
      {
        table: {
          widths: [16, 30, '*', 80, 60, 50, 55],
          headerRows: 1,
          body: [
            [thVerde('No.'), thVerde('CANT.'), thVerde('BIENES/SERVICIOS'), thVerde('PROVEEDOR'), thVerde('FACTURA'), thVerde('P. UNIT.'), thVerde('MONTO')],
            ...filasItems,
            ...Array.from({ length: vacias }, (): TableCell[] =>
              [td(''), td(''), td(''), td(''), td(''), td(''), td('')],
            ),
          ],
        },
        margin: [0, 0, 0, 0],
      },
      {
        columns: [
          { text: '', width: '*' },
          {
            table: {
              widths: [80, 60],
              body: [
                [td('SUMA',  { bold: true, alignment: 'right' }), td(`$ ${fmt(suma)}`,  { alignment: 'right' })],
                [td('I.V.A.',{ bold: true, alignment: 'right' }), td(`$ ${fmt(iva)}`,   { alignment: 'right' })],
                [td('I.S.R', { bold: true, alignment: 'right' }), td(`$ ${fmt(isr)}`,   { alignment: 'right' })],
                [td('TOTAL', { bold: true, alignment: 'right' }), td(`$ ${fmt(total)}`, { alignment: 'right', bold: true })],
              ],
            },
            width: 144,
          },
        ],
        margin: [0, 0, 0, 12],
      },
      {
        table: {
          widths: ['*', 160],
          body: [[
            { text: 'No omito mencionar, que los bienes y/o servicios fueron recibidos a entera satisfacción en tiempo y forma.', fontSize: 8, margin: [4, 6, 4, 6] } as TableCell,
            {
              stack: [
                { canvas: [{ type: 'line', x1: 10, y1: 30, x2: 140, y2: 30, lineWidth: 0.7 }] },
                { text: 'NOMBRE Y FIRMA', bold: true, fontSize: 7, alignment: 'center', margin: [0, 4, 0, 0] },
              ],
              margin: [0, 4, 0, 4],
            } as TableCell,
          ]],
        },
      },
    ],
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// FUNCIÓN PRINCIPAL — generarPDF
// ═════════════════════════════════════════════════════════════════════════════
type PlantillaBuilder = (data: DatoPDF, logo: string | null, fechas: FechasParseadas) => DocDefinition

const builders: Record<number, PlantillaBuilder> = {
  1: defPlantilla1,
  2: defPlantilla2,
  3: defPlantilla3,
  4: defPlantilla4,
  5: defPlantilla5,
  6: defPlantilla6,
}

export async function generarPDF(
  data: DatoPDF,
  preview = false,
  plantillaId: 1 | 2 | 3 | 4 | 5 | 6 = 1,
): Promise<void> {
  const meta = META[plantillaId]
  if (!meta) throw new Error(`Plantilla ${plantillaId} no reconocida. IDs válidos: 1-6.`)

  inyectarModal()
  const elTitulo = document.getElementById('pdf-prog-titulo')
  if (elTitulo) elTitulo.textContent = `Generando: ${meta.titulo}`

  try {
    setProgreso(10, 'Cargando recursos...')
    const logo = await cargarLogo()

    setProgreso(30, 'Preparando datos...')
    const fechas = parsearFecha(data.fecha)

    setProgreso(50, 'Construyendo documento...')
    const docDef = builders[plantillaId](data, logo, fechas)

    setProgreso(75, 'Generando PDF...')
    const pdfMake          = await getPdfMake()
    const pdfDocGenerator  = pdfMake.createPdf(docDef)

    setProgreso(90, 'Preparando archivo...')

    await new Promise<void>((resolve, reject) => {
      pdfDocGenerator.getBase64((base64: string) => {
        try {
          const byteChars = atob(base64)
          const byteNums  = new Uint8Array(byteChars.length)
          for (let i = 0; i < byteChars.length; i++) byteNums[i] = byteChars.charCodeAt(i)

          const blob       = new Blob([byteNums], { type: 'application/pdf' })
          const objectUrl  = URL.createObjectURL(blob)
          const nombreBase = `${data.folio ?? 'doc'}_${meta.nombre}`

          setProgreso(100, '¡Documento listo!')
          setTimeout(() => {
            cerrarProgreso()
            const a = document.createElement('a')
            a.href  = objectUrl

            if (preview) {
              const ventana = window.open(objectUrl, '_blank')
              if (!ventana || ventana.closed || typeof ventana.closed === 'undefined') {
                a.download = `${nombreBase}_preview.pdf`
                document.body.appendChild(a); a.click(); document.body.removeChild(a)
              }
              setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000)
            } else {
              a.download = `${nombreBase}.pdf`
              document.body.appendChild(a); a.click(); document.body.removeChild(a)
              setTimeout(() => URL.revokeObjectURL(objectUrl), 15_000)
            }
            resolve()
          }, 400)
        } catch (err) {
          reject(err)
        }
      }, (err: unknown) => reject(err))
    })

  } catch (err) {
    cerrarProgreso()
    console.error('[PDF] Error:', err)

    const mensaje = err instanceof Error ? err.message : String(err)
    if ((window as Window & { Swal?: { fire: (o: object) => void } }).Swal) {
      ;(window as Window & { Swal: { fire: (o: object) => void } }).Swal.fire({
        title:              'Error al generar PDF',
        html:               `<pre style="font-size:.75rem;text-align:left;white-space:pre-wrap;color:#7f1d1d">${mensaje}</pre>`,
        icon:               'error',
        confirmButtonColor: '#1a3a2a',
      })
    } else {
      alert(`Error al generar el PDF:\n\n${mensaje}`)
    }
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// HELPER — descarga directa sin modal
// ═════════════════════════════════════════════════════════════════════════════
export async function descargarPDFRapido(
  docDef: DocDefinition,
  nombreArchivo = 'documento.pdf',
): Promise<void> {
  const pdfMake = await getPdfMake()
  pdfMake.createPdf(docDef).download(nombreArchivo)
}

// ═════════════════════════════════════════════════════════════════════════════
// EXPORTACIÓN REACT — @react-pdf/renderer (carga lazy, sin JSX, sin romper TS)
// ─────────────────────────────────────────────────────────────────────────────
// Usa createElement-style (Document({...})) compatible con .ts puro.
// Solo disponible si @react-pdf/renderer está instalado.
// ═════════════════════════════════════════════════════════════════════════════
let _reactPDFCache: ReactPDFComponents | null = null

export async function cargarComponentesReactPDF(): Promise<ReactPDFComponents | null> {
  if (_reactPDFCache) return _reactPDFCache

  try {
    const { Document, Page, Text, View, StyleSheet, Image } =
      await import('@react-pdf/renderer') as {
        Document: (p: Record<string, unknown>) => unknown
        Page:     (p: Record<string, unknown>) => unknown
        Text:     (p: Record<string, unknown>, ...ch: unknown[]) => unknown
        View:     (p: Record<string, unknown>) => unknown
        Image:    (p: Record<string, unknown>) => unknown
        StyleSheet: { create: <T extends object>(s: T) => T }
      }

    const S = StyleSheet.create({
      page:   { padding: 40, fontFamily: 'Helvetica' },
      barraV: { backgroundColor: '#1a3a2a', height: 14, marginBottom: 6 },
      row:    { flexDirection: 'row' },
      center: { textAlign: 'center' },
      bold:   { fontFamily: 'Helvetica-Bold' },
      f9:     { fontSize: 9 },
      f8:     { fontSize: 8 },
      tdCell: { fontSize: 8, padding: 3 },
      lineaF: { borderBottomWidth: 0.8, borderBottomColor: '#333', width: 160, marginBottom: 3 },
      firma:  { alignItems: 'center', marginTop: 4 },
    })

    const barraTexto = (texto: string) =>
      View({ style: { backgroundColor: '#1a3a2a', padding: 4, marginBottom: 4 }, children: [
        Text({ style: { color: 'white', fontFamily: 'Helvetica-Bold', fontSize: 9, textAlign: 'center' } }, texto),
      ]})

    const labelVal = (lab: string, val?: string, wLab = 95) =>
      View({ style: S.row, children: [
        Text({ style: { ...S.tdCell, ...S.bold, width: wLab } }, lab),
        Text({ style: S.tdCell }, String(val ?? '')),
      ]})

    function PDFOrdenDePago({ data, logoUrl }: { data: DatoPDF; logoUrl?: string }) {
      const monto    = Number(data?.monto || 0)
      const montoStr = monto.toLocaleString('es-MX', { minimumFractionDigits: 2 })
      const enLetra  = numeroALetras(monto)
      const iva      = Number(data?.iva  || 0)
      const isr      = Number(data?.isr  || 0)
      const ivaStr   = iva.toLocaleString('es-MX',  { minimumFractionDigits: 2 })
      const isrStr   = isr.toLocaleString('es-MX',  { minimumFractionDigits: 2 })
      const totalStr = (monto + iva - isr).toLocaleString('es-MX', { minimumFractionDigits: 2 })

      const importesRows: [string, string][] = [
        ['IMPORTE',            `$ ${montoStr}`],
        ['I.V.A',              `$ ${ivaStr}`],
        ['RETENCION DE I.S.R', `$ ${isrStr}`],
        ['TOTAL A PAGAR',      `$ ${totalStr}`],
      ]
      const firmantes: [string, string][] = [
        ['C.GERARDO GÓMEZ ALONSO',  'TESORERO MUNICIPAL'],
        ['ING. DIEGO TORRE OSORIO', 'PRESIDENTE MUNICIPAL'],
      ]

      return Document({ children: [
        Page({ size: 'LETTER', style: S.page, children: [
          View({ style: S.barraV }),
          View({ style: { ...S.row, alignItems: 'center', marginBottom: 8 }, children: [
            ...(logoUrl ? [Image({ src: logoUrl, style: { width: 60, marginRight: 10 } })] : []),
            View({ style: { flex: 1 }, children: [
              Text({ style: { fontFamily: 'Helvetica-Bold', fontSize: 11, textAlign: 'center' } }, 'MUNICIPIO DE ACATENO; PUEBLA.'),
              Text({ style: { ...S.f9, textAlign: 'center' } }, '2024-2027'),
            ]}),
            View({ style: { alignItems: 'flex-end' }, children: [
              Text({ style: { ...S.bold, ...S.f9 } }, 'ORDEN DE PAGO'),
              Text({ style: { ...S.bold, ...S.f9 } }, 'TESORERÍA MUNICIPAL'),
            ]}),
          ]}),
          View({ style: { ...S.row, marginBottom: 8 }, children: [
            Text({ style: { ...S.bold, ...S.f9, width: 175 } }, 'MUNICIPIO DE ACATENO A:'),
            Text({ style: S.f9 }, String(data?.proveedor ?? '')),
          ]}),
          Text({ style: { ...S.bold, ...S.f9, marginBottom: 3 } }, 'El concepto:'),
          View({ style: { borderWidth: 0.5, borderColor: '#bbb', padding: 4, marginBottom: 6 }, children: [
            Text({ style: S.f9 }, String(data?.concepto ?? '')),
          ]}),
          barraTexto('DEL MUNICIPIO DE ACATENO'),
          View({ style: { ...S.row, marginBottom: 6 }, children: [
            Text({ style: { ...S.f8, flex: 1 } }, 'No. De Factura   ' + String(data?.no_factura   ?? '')),
            Text({ style: { ...S.f8, flex: 1 } }, 'No. De Contrato   ' + String(data?.no_contrato ?? '')),
          ]}),
          Text({ style: { ...S.f8, marginBottom: 4 } }, 'Fondo o programa con el cual se autoriza el pago:   ' + String(data?.fondo ?? '')),
          View({ style: { ...S.row, marginBottom: 4 }, children: [
            Text({ style: { ...S.f8, flex: 1 } }, 'Cuenta Bancaria:   ' + String(data?.cuenta_bancaria ?? '')),
            Text({ style: { ...S.f8, flex: 1 } }, `Importe a pagar:   $ ${montoStr}`),
          ]}),
          Text({ style: { ...S.f9, textAlign: 'center', marginBottom: 8 } }, `Monto Pagado:   $ ${montoStr}`),
          View({ style: { alignSelf: 'flex-end', width: 240, marginBottom: 10 }, children:
            importesRows.map(([lab, val]) =>
              View({ key: lab, style: { ...S.row, borderBottomWidth: 0.5, borderColor: '#ccc' }, children: [
                Text({ style: { ...S.tdCell, flex: 1 } }, lab),
                Text({ style: { ...S.tdCell, textAlign: 'right' } }, val),
              ]})
            ),
          }),
          Text({ style: { ...S.bold, ...S.f9, textAlign: 'center', marginBottom: 3 } }, 'EN LETRA:'),
          View({ style: { borderWidth: 0.5, borderColor: '#bbb', padding: 4, marginBottom: 10 }, children: [
            Text({ style: S.f8 }, enLetra),
          ]}),
          barraTexto('BENEFICIARIO'),
          labelVal('A nombre de:',      data?.proveedor),
          labelVal('Responsable legal:', data?.responsable),
          labelVal('R.F.C:',             data?.rfc),
          labelVal('Forma de pago:',     data?.forma_pago || 'CHEQUE'),
          View({ style: { ...S.row, justifyContent: 'space-between', marginTop: 28 }, children:
            firmantes.map(([n, cargo]) =>
              View({ key: n, style: S.firma, children: [
                View({ style: S.lineaF }),
                Text({ style: { ...S.bold, ...S.f8 } }, n),
                Text({ style: S.f8 }, cargo),
              ]})
            ),
          }),
          View({ style: { ...S.barraV, marginTop: 10 } }),
        ]}),
      ]})
    }

    function PDFSolicitudSuficiencia({ data }: { data: DatoPDF }) {
      const fechas      = parsearFecha(data?.fecha)
      const solicitante = data?.solicitante       ?? 'C. José Hugo García Moreno'
      const cargoSol    = data?.cargo_solicitante ?? 'Auxiliar de Tesorería'
      const concepto    = data?.concepto          ?? 'materiales de oficina'

      return Document({ children: [
        Page({ size: 'LETTER', style: S.page, children: [
          View({ style: { ...S.row, justifyContent: 'flex-end', marginBottom: 14 }, children: [
            View({ children: [
              Text({ style: S.f9 }, 'No. de Oficio: ' + (data?.folio ?? 'S/N')),
              Text({ style: S.f9 }, 'ASUNTO: Solicitud de Suficiencia Presupuestal'),
            ]}),
          ]}),
          Text({ style: { ...S.bold, fontSize: 10 } }, 'C. Gerardo Gómez Alonso'),
          Text({ style: S.f9 }, 'Tesorero Municipal'),
          Text({ style: S.f9 }, 'H. Ayuntamiento de Acateno, Puebla'),
          Text({ style: { ...S.f9, ...S.bold, marginBottom: 14 } }, 'P r e s e n t e'),
          Text({
            style: { ...S.f9, textAlign: 'justify', lineHeight: 1.5, marginBottom: 16 },
          },
            `Quien suscribe ${solicitante}, ${cargoSol} del Municipio de Acateno, Puebla, por medio de la presente reciba un cordial saludo y al mismo tiempo me dirijo a usted de la manera más atenta y con Fundamento en el Artículo 45 fracciones I y X, 58 y 60 de la ley de Adquisiciones, Arrendamientos y Servicios del Sector Publico Estatal y Municipal para el Estado de Puebla, Solicito de la manera más atenta Asigne Suficiencia Presupuestal para efectos de llevar a cabo la adquisición de ${concepto}, que son de suma importancia para realizar las actividades diarias de la Administración Municipal de Acateno 2024-2027, atentamente solicito notificarme por escrito la respuesta correspondiente a mi petición.`
          ),
          Text({ style: { ...S.f9, marginBottom: 32 } }, 'Sin otro particular, quedo de Usted como su seguro colaborador.'),
          Text({ style: { ...S.bold, ...S.f9, textAlign: 'center' } }, 'A t e n t a m e n t e'),
          Text({ style: { ...S.bold, ...S.f9, textAlign: 'center', marginBottom: 48 } }, `Acateno, Puebla; a ${fechas.larga}`),
          View({ style: { ...S.firma, alignSelf: 'center' }, children: [
            View({ style: S.lineaF }),
            Text({ style: { ...S.bold, ...S.f9, textAlign: 'center' } }, solicitante),
            Text({ style: { ...S.f9, textAlign: 'center' } }, cargoSol),
            Text({ style: { ...S.f9, textAlign: 'center' } }, 'del H Ayuntamiento de Acateno, Puebla.'),
          ]}),
        ]}),
      ]})
    }

    _reactPDFCache = { PDFOrdenDePago, PDFSolicitudSuficiencia }
    return _reactPDFCache

  } catch (e) {
    console.warn('[PDF] @react-pdf/renderer no disponible:', (e as Error).message)
    return null
  }
}
