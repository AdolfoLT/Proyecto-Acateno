/**
 * pdf.js — Acateno Tesorería
 * ─────────────────────────────────────────────────────────────────────────────
 * RUTAS DE PLANTILLAS (en orden de prioridad):
 *   • frontend/public/assets/plantilla_N.pdf      ← donde están actualmente
 *   • frontend/public/plantillas/plantilla_N.pdf
 *   • frontend/public/plantilla_N.pdf
 *
 * REQUISITOS:
 *   npm install pdf-lib
 *
 * NOTAS DE COMPATIBILIDAD:
 *   - pdf-lib NO puede cargar PDFs con cifrado o protección de copia.
 *     Si las plantillas fueron generadas con Adobe y tienen restricciones,
 *     ábrelas en Adobe → Archivo → Propiedades → Seguridad → Sin seguridad → Guardar.
 *   - Si el navegador bloquea la preview con window.open(), usar mode 'blob'.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'

// Rutas donde buscar las plantillas — se prueban en orden
// NOTA: Vite reserva /assets/ para sus bundles — usar /plantillas/ como carpeta principal
const RUTAS_PLANTILLA = [
  (id) => `frontend/public/assets/plantilla_${id}.pdf`,        // frontend/public/plantillas/  ← recomendado
  (id) => `/plantilla_${id}.pdf`,                   // frontend/public/ (raíz)
  (id) => `/assets/plantilla_${id}.pdf`,            // frontend/public/assets/ (puede fallar con Vite)
]

async function cargarPlantilla(plantillaId) {
  const errores = []

  for (const ruta of RUTAS_PLANTILLA) {
    const url = ruta(plantillaId)
    try {
      const resp = await fetch(url, { cache: 'no-store' })
      if (!resp.ok) {
        errores.push(`${url} → HTTP ${resp.status}`)
        continue
      }
      const bytes = await resp.arrayBuffer()
      if (bytes.byteLength < 100) {
        errores.push(`${url} → archivo vacío o demasiado pequeño`)
        continue
      }
      // Verificar firma PDF (%PDF-)
      const firma = new Uint8Array(bytes.slice(0, 5))
      const texto = String.fromCharCode(...firma)
      if (!texto.startsWith('%PDF')) {
        errores.push(`${url} → el archivo no es un PDF válido`)
        continue
      }
      console.log(`[PDF] Plantilla ${plantillaId} cargada desde: ${url}`)
      return bytes
    } catch (err) {
      errores.push(`${url} → ${err.message}`)
    }
  }

  throw new Error(
    `No se pudo cargar la plantilla ${plantillaId}.\n\n` +
    `Rutas intentadas:\n${errores.map(e => `  • ${e}`).join('\n')}\n\n` +
    `Solución: coloca el archivo en frontend/public/assets/plantilla_${plantillaId}.pdf\n` +
    `Si el PDF tiene protección de seguridad, quítala antes de copiarlo.`
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MODAL DE PROGRESO
// ─────────────────────────────────────────────────────────────────────────────
function inyectarModal() {
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
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
        </svg>
      </div>
      <h3 id="pdf-prog-titulo"
          style="font-size:1rem;font-weight:600;color:#1a3a2a;margin-bottom:6px;">
        Generando documento...
      </h3>
      <p id="pdf-prog-estado"
         style="font-size:.82rem;color:#7a8278;margin-bottom:20px;min-height:18px;">
        Iniciando
      </p>
      <div style="width:100%;height:10px;background:#eef0ec;
                  border-radius:99px;overflow:hidden;margin-bottom:10px;">
        <div id="pdf-prog-barra"
             style="height:100%;width:0%;border-radius:99px;
                    background:linear-gradient(90deg,#1a3a2a,#3d7a56);
                    transition:width .3s cubic-bezier(.4,0,.2,1);"></div>
      </div>
      <span id="pdf-prog-pct"
            style="font-size:.85rem;font-weight:700;color:#2d5a3f;">0%</span>
    </div>`

  document.body.appendChild(el)
}

function setProgreso(pct, estado) {
  inyectarModal()
  document.getElementById('pdf-prog-modal').style.display = 'flex'
  document.getElementById('pdf-prog-barra').style.width   = `${pct}%`
  document.getElementById('pdf-prog-pct').textContent     = `${pct}%`
  if (estado) document.getElementById('pdf-prog-estado').textContent = estado
}

function cerrarProgreso() {
  const m = document.getElementById('pdf-prog-modal')
  const b = document.getElementById('pdf-prog-barra')
  if (m) m.style.display = 'none'
  if (b) b.style.width   = '0%'
}

// ─────────────────────────────────────────────────────────────────────────────
// WORD-WRAP
// ─────────────────────────────────────────────────────────────────────────────
function partirRenglones(texto, tamFuente, anchoMax) {
  if (!texto) return []
  const maxChars = Math.max(5, Math.floor(anchoMax / (tamFuente * 0.52)))
  const palabras = String(texto).trim().split(/\s+/)
  const lineas   = []
  let linea      = ''

  for (const pal of palabras) {
    const candidata = linea ? `${linea} ${pal}` : pal
    if (candidata.length <= maxChars) {
      linea = candidata
    } else {
      if (linea) lineas.push(linea)
      if (pal.length > maxChars) {
        let resto = pal
        while (resto.length > maxChars) {
          lineas.push(resto.slice(0, maxChars - 1) + '-')
          resto = resto.slice(maxChars - 1)
        }
        linea = resto
      } else {
        linea = pal
      }
    }
  }
  if (linea) lineas.push(linea)
  return lineas
}

// ─────────────────────────────────────────────────────────────────────────────
// FUNCIÓN PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
export async function generarPDF(data, preview = false, plantillaId = 1) {

  const nombresArchivo = {
    1: 'Orden_de_Pago',
    2: 'Solicitud_de_Suficiencia',
    3: 'Autorizacion_de_Suficiencia',
    4: 'Oficio_de_Solicitud',
    5: 'Requisicion_de_Materiales',
    6: 'Recepcion_de_Bien',
  }

  const titulosDoc = {
    1: 'Orden de Pago',
    2: 'Solicitud de Suficiencia',
    3: 'Autorización de Suficiencia',
    4: 'Oficio de Solicitud',
    5: 'Requisición de Materiales',
    6: 'Formato de Recepción de Bien',
  }

  inyectarModal()
  const elTitulo = document.getElementById('pdf-prog-titulo')
  if (elTitulo) elTitulo.textContent = `Generando: ${titulosDoc[plantillaId] || 'Documento'}`

  setProgreso(0, 'Iniciando...')

  try {
    // 1. Cargar plantilla
    setProgreso(15, 'Buscando plantilla...')
    const bytesPlantilla = await cargarPlantilla(plantillaId)

    // 2. Abrir con pdf-lib
    setProgreso(35, 'Procesando plantilla...')
    let pdfDoc
    try {
      pdfDoc = await PDFDocument.load(bytesPlantilla, {
        ignoreEncryption: true,  // intentar cargar aunque tenga flag de cifrado
      })
    } catch (loadErr) {
      throw new Error(
        `pdf-lib no pudo abrir la plantilla ${plantillaId}.\n\n` +
        `Causa: ${loadErr.message}\n\n` +
        `Si el PDF tiene seguridad/protección:\n` +
        `  1. Ábrelo en Adobe Acrobat\n` +
        `  2. Archivo → Propiedades → Seguridad → Sin seguridad\n` +
        `  3. Guarda y reemplaza el archivo en frontend/public/assets/`
      )
    }

    const fontReg  = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
    const paginas  = pdfDoc.getPages()
    if (paginas.length === 0) throw new Error(`La plantilla ${plantillaId} no tiene páginas.`)
    const pagina = paginas[0]
    const { width: W, height: H } = pagina.getSize()

    // Helper: escribir texto
    function escribir(txt, x, topPDF, tam = 9, negrita = false, anchoMax = 0, inter = 12) {
      if (txt === null || txt === undefined || String(txt).trim() === '') return
      const texto  = String(txt).trim()
      const fuente = negrita ? fontBold : fontReg
      const negro  = rgb(0, 0, 0)

      const trazar = (t, yPos) => {
        if (yPos > 4 && yPos < H - 4) {
          pagina.drawText(t, { x, y: yPos, size: tam, font: fuente, color: negro })
        }
      }

      if (anchoMax > 0) {
        partirRenglones(texto, tam, anchoMax).forEach((lin, i) => {
          trazar(lin, H - (topPDF + i * inter) - tam + 1)
        })
      } else {
        trazar(texto, H - topPDF - tam + 1)
      }
    }

    // 3. Formatear datos
    setProgreso(55, 'Preparando datos...')
    const monto    = Number(data.monto || 0)
    const montoStr = monto.toLocaleString('es-MX', { minimumFractionDigits: 2 })

    // Ajuste de fecha: evitar desfase de timezone
    const rawFecha  = data.fecha ? String(data.fecha).slice(0, 10) : new Date().toISOString().slice(0, 10)
    const [yr, mo, dy] = rawFecha.split('-').map(Number)
    const fechaObj  = new Date(yr, mo - 1, dy)   // fecha local, sin UTC

    const fLarga = fechaObj.toLocaleDateString('es-MX', {
      day: '2-digit', month: 'long', year: 'numeric',
    })
    const fCorta = fechaObj.toLocaleDateString('es-MX')
    const enLetra = numeroALetras(monto)
    const area    = data.area_nombre || data.area || ''

    // 4. Llenar campos por plantilla
    setProgreso(70, 'Llenando campos del documento...')

    switch (plantillaId) {

      // ════════════════════════════════════════════════════════
      // PLANTILLA 1 — ORDEN DE PAGO
      // ════════════════════════════════════════════════════════
      case 1: {
        escribir(fLarga,                    210, 205)
        escribir(data.concepto,              85, 265, 8, false, 440, 10)
        escribir(data.no_factura,           145, 303, 8)
        escribir(data.no_contrato,          335, 303, 8)
        escribir(data.cuenta_bancaria,      155, 345, 8)
        escribir(`$ ${montoStr}`,           415, 345, 9)
        escribir(`$ ${montoStr}`,           415, 360, 9)
        escribir(`$ ${montoStr}`,           415, 391, 9)
        escribir('$ 0.00',                  415, 401, 9)
        escribir('$ 0.00',                  415, 412, 9)
        escribir(`$ ${montoStr}`,           415, 423, 9, true)
        escribir(enLetra,                    85, 490, 8, false, 440, 11)
        escribir(data.proveedor,            155, 524, 9)
        escribir(data.proveedor,            155, 546, 9)
        escribir(data.rfc,                  155, 558, 9)
        escribir(data.forma_pago || 'CHEQUE', 155, 571, 9)
        break
      }

      // ════════════════════════════════════════════════════════
      // PLANTILLA 2 — SOLICITUD DE SUFICIENCIA PRESUPUESTAL
      // ════════════════════════════════════════════════════════
      case 2: {
        escribir(data.folio || 'S/N',       509, 127)
        escribir(`Acateno, Puebla; a ${fLarga}`, 200, 539)
        break
      }

      // ════════════════════════════════════════════════════════
      // PLANTILLA 3 — AUTORIZACIÓN DE SUFICIENCIA PRESUPUESTAL
      // ════════════════════════════════════════════════════════
      case 3: {
        escribir(data.folio,                529,  73)
        escribir(`$ ${montoStr}`,           431, 432, 9, true)
        escribir(`$ ${montoStr}`,           431, 481, 9, true)
        escribir(`Acateno, Puebla; a ${fLarga}`, 195, 596)
        break
      }

      // ════════════════════════════════════════════════════════
      // PLANTILLA 4 — OFICIO DE SOLICITUD
      // ════════════════════════════════════════════════════════
      case 4: {
        escribir(fLarga.toUpperCase(),      411, 224, 9, true)
        break
      }

      // ════════════════════════════════════════════════════════
      // PLANTILLA 5 — REQUISICIÓN DE MATERIALES PAPELERÍA
      // ════════════════════════════════════════════════════════
      case 5: {
        if (area && area.toLowerCase() !== 'tesorería') {
          escribir(area.toUpperCase(),      237, 196)
        }
        escribir(fCorta,                    495, 197)
        escribir((data.proveedor || '').toUpperCase(), 206, 218)
        escribir(fCorta,                    400, 223)
        escribir(data.folio,                460, 172, 9, true)
        break
      }

      // ════════════════════════════════════════════════════════
      // PLANTILLA 6 — FORMATO DE RECEPCIÓN DE BIENES Y/O SERVICIOS
      // ════════════════════════════════════════════════════════
      case 6: {
        if (area) escribir(area.toUpperCase(), 215, 144)
        escribir((data.proveedor || '').toUpperCase(), 135, 161, 9, false, 220)
        escribir(fCorta,                    135, 174)
        escribir(data.folio,                400, 174)
        break
      }

      default:
        throw new Error(`Plantilla ${plantillaId} no reconocida. IDs válidos: 1-6.`)
    }

    // 5. Guardar
    setProgreso(88, 'Guardando documento...')
    const pdfBytes = await pdfDoc.save()

    // 6. Entregar
    setProgreso(96, 'Preparando archivo...')
    const blob      = new Blob([pdfBytes], { type: 'application/pdf' })
    const objectUrl = URL.createObjectURL(blob)

    setProgreso(100, '¡Documento listo!')
    await new Promise(r => setTimeout(r, 600))
    cerrarProgreso()

    if (preview) {
      // Algunos navegadores bloquean window.open si no es un evento directo de click.
      // Si se bloquea, descargamos en su lugar.
      const ventana = window.open(objectUrl, '_blank')
      if (!ventana || ventana.closed || typeof ventana.closed === 'undefined') {
        // Popup bloqueado — descargar como fallback
        const a    = document.createElement('a')
        a.href     = objectUrl
        a.download = `${data.folio || 'doc'}_${nombresArchivo[plantillaId]}_preview.pdf`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
      }
      setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000)
    } else {
      const a    = document.createElement('a')
      a.href     = objectUrl
      a.download = `${data.folio || 'doc'}_${nombresArchivo[plantillaId]}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(objectUrl), 15_000)
    }

  } catch (err) {
    cerrarProgreso()
    console.error('[PDF] Error:', err)

    // Mensaje de error amigable con Swal si está disponible, si no alert
    const msg = `Error al generar el PDF:\n\n${err.message}`
    if (window.Swal) {
      window.Swal.fire({
        title: 'Error al generar PDF',
        html: `<pre style="font-size:.75rem;text-align:left;white-space:pre-wrap;color:#7f1d1d">${err.message}</pre>`,
        icon: 'error',
        confirmButtonColor: '#1a3a2a',
      })
    } else {
      alert(msg)
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// NÚMERO A LETRAS — pesos mexicanos
// ─────────────────────────────────────────────────────────────────────────────
function numeroALetras(num) {
  if (!num || isNaN(num)) return 'CERO PESOS 00/100 M.N.'

  const u = [
    '', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE',
    'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS',
    'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE',
  ]
  const d = [
    '', '', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA',
    'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA',
  ]
  const c = [
    '', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS',
    'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS',
  ]

  const entero   = Math.floor(Math.abs(num))
  const centavos = Math.round((Math.abs(num) - entero) * 100)

  function g(n) {
    if (!n)        return ''
    if (n === 100) return 'CIEN'
    let r = ''
    if (n >= 100) { r += `${c[Math.floor(n / 100)]} `; n %= 100 }
    if (n >= 20)  { r += d[Math.floor(n / 10)]; if (n % 10) r += ` Y ${u[n % 10]}` }
    else if (n)   { r += u[n] }
    return r.trim()
  }

  let res = ''
  if (!entero) {
    res = 'CERO'
  } else if (entero < 1_000) {
    res = g(entero)
  } else if (entero < 1_000_000) {
    const miles = Math.floor(entero / 1_000)
    const resto = entero % 1_000
    res = `${miles === 1 ? 'MIL' : `${g(miles)} MIL`}${resto ? ` ${g(resto)}` : ''}`
  } else if (entero < 1_000_000_000) {
    const mill  = Math.floor(entero / 1_000_000)
    const resto = entero % 1_000_000
    res = mill === 1 ? 'UN MILLÓN' : `${g(mill)} MILLONES`
    if (resto >= 1_000) {
      const m = Math.floor(resto / 1_000)
      const r = resto % 1_000
      res += ` ${m === 1 ? 'MIL' : `${g(m)} MIL`}${r ? ` ${g(r)}` : ''}`
    } else if (resto) {
      res += ` ${g(resto)}`
    }
  } else {
    res = entero.toLocaleString('es-MX')
  }

  return `${res} PESOS ${String(centavos).padStart(2, '0')}/100 M.N.`
}