/**
 * pdf.js — Sistema de generación de PDFs con IA para Tesorería Municipal de Acateno
 *
 * Arquitectura:
 *  - Claude claude-sonnet-4-20250514 analiza cada plantilla y decide exactamente qué
 *    escribir, dónde y con qué tamaño, usando las coordenadas base como referencia.
 *  - Texto multi-línea automático para campos largos.
 *  - Número a letras completo hasta millones.
 *  - Fallback hardcodeado si la IA no responde.
 */

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'

// ─────────────────────────────────────────────────────────────
// UTILIDADES BÁSICAS
// ─────────────────────────────────────────────────────────────

function truncar(texto, max) {
  if (!texto) return ''
  const t = String(texto).trim()
  return t.length > max ? t.substring(0, max - 1) + '…' : t
}

/** Coordenada "top desde arriba" (pdfplumber) → y pdf-lib */
const top2y = (pageH, top, size = 9) => pageH - top - size

/** Dibuja texto con salto de línea automático */
function drawWrapped(page, text, x, y, { size, font, color, maxWidth, lineHeight }) {
  if (!text) return y
  const words = String(text).split(' ')
  let line = ''
  let currentY = y
  for (const word of words) {
    const test = line ? `${line} ${word}` : word
    const testWidth = font.widthOfTextAtSize(test, size)
    if (testWidth > maxWidth && line) {
      page.drawText(line, { x, y: currentY, size, font, color })
      line = word
      currentY -= lineHeight
    } else {
      line = test
    }
  }
  if (line) page.drawText(line, { x, y: currentY, size, font, color })
  return currentY
}

// ─────────────────────────────────────────────────────────────
// NÚMERO A LETRAS (hasta millones)
// ─────────────────────────────────────────────────────────────
function numeroALetras(num) {
  if (!num || isNaN(num)) return 'CERO PESOS 00/100 M.N.'
  const u = ['','UN','DOS','TRES','CUATRO','CINCO','SEIS','SIETE','OCHO','NUEVE',
    'DIEZ','ONCE','DOCE','TRECE','CATORCE','QUINCE','DIECISÉIS','DIECISIETE','DIECIOCHO','DIECINUEVE']
  const d = ['','','VEINTE','TREINTA','CUARENTA','CINCUENTA','SESENTA','SETENTA','OCHENTA','NOVENTA']
  const c = ['','CIENTO','DOSCIENTOS','TRESCIENTOS','CUATROCIENTOS','QUINIENTOS',
    'SEISCIENTOS','SETECIENTOS','OCHOCIENTOS','NOVECIENTOS']
  const entero   = Math.floor(Math.abs(num))
  const centavos = Math.round((Math.abs(num) - entero) * 100)

  function g(n) {
    if (!n) return ''
    if (n === 100) return 'CIEN'
    let r = ''
    if (n >= 100) { r += c[Math.floor(n / 100)] + ' '; n %= 100 }
    if (n >= 20)  { r += d[Math.floor(n / 10)]; if (n % 10) r += ' Y ' + u[n % 10] }
    else if (n > 0) r += u[n]
    return r.trim()
  }

  let r = ''
  if (!entero) r = 'CERO'
  else if (entero < 1000) r = g(entero)
  else if (entero < 1e6) {
    const m = Math.floor(entero / 1000), rest = entero % 1000
    r = (m === 1 ? 'MIL' : g(m) + ' MIL') + (rest ? ' ' + g(rest) : '')
  } else if (entero < 1e9) {
    const m = Math.floor(entero / 1e6), rest = entero % 1e6
    r = (m === 1 ? 'UN MILLÓN' : g(m) + ' MILLONES')
    if (rest >= 1000) {
      const mm = Math.floor(rest / 1000), rr = rest % 1000
      r += ' ' + (mm === 1 ? 'MIL' : g(mm) + ' MIL') + (rr ? ' ' + g(rr) : '')
    } else if (rest) r += ' ' + g(rest)
  } else r = entero.toLocaleString('es-MX')

  return `${r} PESOS ${String(centavos).padStart(2, '0')}/100 M.N.`
}

// ─────────────────────────────────────────────────────────────
// PREPARAR DATOS FORMATEADOS
// ─────────────────────────────────────────────────────────────
function prepararDatos(data) {
  const monto    = Number(data.monto || 0)
  const montoStr = monto.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const fecha    = data.fecha ? new Date(data.fecha + 'T12:00:00') : new Date()

  const fLarga = fecha.toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })
  const fCorta = fecha.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const enLetra = numeroALetras(monto)
  const iva     = monto * 0.16
  const total   = monto + iva

  return {
    folio:           data.folio          || '',
    proveedor:       data.proveedor      || '',
    rfc:             data.rfc            || '',
    concepto:        data.concepto       || '',
    area:            data.area_nombre    || '',
    forma_pago:      data.forma_pago     || 'CHEQUE',
    no_factura:      data.no_factura     || '',
    no_contrato:     data.no_contrato    || '',
    cuenta_bancaria: data.cuenta_bancaria || '',
    clasificacion:   data.clasificacion_clave
                       ? `${data.clasificacion_clave} — ${data.clasificacion_nombre || ''}`
                       : (data.clasificacion_nombre || ''),
    monto,
    montoStr:        `$${montoStr}`,
    ivaStr:          `$${iva.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`,
    totalStr:        `$${total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`,
    enLetra,
    fLarga,
    fCorta,
  }
}

// ─────────────────────────────────────────────────────────────
// DESCRIPCIÓN DE CADA PLANTILLA PARA LA IA
// ─────────────────────────────────────────────────────────────
const PLANTILLA_DESCRIPCIONES = {
  1: `Orden de Pago — Tesorería Municipal de Acateno.
Página tamaño carta (612×792 pts). Coordenadas con origen en la esquina inferior izquierda (sistema pdf-lib).
Campos a rellenar (x, y aproximados, ajusta para que NO se empalmen y queden alineados con las líneas del formulario):
- Folio: x=460, y=657 (esquina superior derecha, bajo "ORDEN DE PAGO TESORERÍA MUNICIPAL")
- Fecha (fLarga): x=300, y=588 (línea "MUNICIPIO DE ACATENO A:")
- Concepto: x=152, y=529, maxWidth=380 — puede requerir hasta 3 líneas con lineHeight=13
- No. Factura: x=152, y=490
- No. Contrato: x=355, y=490
- Fondo/Clasificación: x=152, y=448
- Cuenta Bancaria: x=170, y=430
- Importe a pagar: x=470, y=430
- Monto Pagado: x=470, y=415
- IMPORTE (tabla): x=530, y=396 — alineado a la derecha de la celda
- I.V.A (tabla): x=530, y=383
- RETENCIÓN ISR (tabla): x=530, y=370 — dejar vacío o "—"
- TOTAL A PAGAR (tabla): x=530, y=357 — negrita
- EN LETRA: x=170, y=292, maxWidth=360 — puede requerir hasta 3 líneas con lineHeight=12
- Beneficiario / A nombre de: x=180, y=262
- Responsable legal: x=180, y=249
- RFC: x=180, y=234
- Forma de pago: x=180, y=221`,

  2: `Solicitud de Suficiencia Presupuestal.
Carta oficial dirigida al Tesorero. Solo se personaliza:
- No. de Oficio (folio): x=510, y=665
- Fecha al pie "Acateno, Puebla; a [fLarga]": x=160, y=253`,

  3: `Autorización de Suficiencia Presupuestal.
Respuesta del Tesorero a la solicitud.
- No. de Oficio (folio): x=530, y=719
- Concepto (en el cuerpo, donde dice "adquisición de material de oficina"): x=160, y=497, maxWidth=330
- Monto en texto en el cuerpo: x=330, y=482 — formato "$X,XXX.XX (EN LETRA M.N.)"
- Tabla estructura financiera:
    Fila Participaciones — monto: x=431, y=360
    Fila TOTAL: x=431, y=332 — negrita
- Fecha al pie: x=160, y=196`,

  4: `Oficio de Solicitud interno.
Carta de solicitud de compra de papelería u otro concepto.
- FECHA (reemplaza fecha existente): x=411, y=568 — en mayúsculas, negrita
- Concepto (en el cuerpo del texto): x=85, y=452, maxWidth=440 — hasta 3 líneas lineHeight=14`,

  5: `Requisición de Materiales Papelería.
Formato de tabla con campos:
- Folio: x=460, y=620 — negrita
- Área (DEPARTAMENTO QUE SOLICITA): x=237, y=596
- Fecha de pedido: x=495, y=595
- NOMBRE: x=206, y=571`,

  6: `Formato de Recepción de Bienes y/o Servicios.
- Área solicitante: x=240, y=651
- GESTIONÓ: x=160, y=631
- FECHA: x=140, y=618
- REQUISICIÓN NO. (folio): x=395, y=618
- No. Factura: x=390, y=585
- Concepto/descripción: x=160, y=585, maxWidth=180
- Proveedor: x=316, y=571
- RFC del proveedor: x=316, y=558
- Monto unitario: x=440, y=585
- SUMA: x=440, y=502
- I.V.A: x=440, y=490
- TOTAL: x=440, y=478 — negrita`,
}

// ─────────────────────────────────────────────────────────────
// LLAMADA A IA — Claude analiza y devuelve instrucciones de dibujo
// ─────────────────────────────────────────────────────────────
async function obtenerInstruccionesIA(datos, plantillaId) {
  const descripcion = PLANTILLA_DESCRIPCIONES[plantillaId]

  const prompt = `Eres un experto en documentos municipales mexicanos y en el sistema pdf-lib de JavaScript.
Debes generar instrucciones EXACTAS para rellenar el siguiente documento PDF oficial con los datos proporcionados.

DESCRIPCIÓN DEL DOCUMENTO (plantilla ${plantillaId}):
${descripcion}

DATOS DE LA REQUISICIÓN:
- Folio: ${datos.folio}
- Fecha larga: ${datos.fLarga}
- Fecha corta: ${datos.fCorta}
- Concepto: ${datos.concepto}
- Beneficiario/Proveedor: ${datos.proveedor}
- RFC: ${datos.rfc}
- Monto: ${datos.montoStr}
- En letra: ${datos.enLetra}
- IVA (16%): ${datos.ivaStr}
- Total con IVA: ${datos.totalStr}
- Forma de pago: ${datos.forma_pago}
- No. Factura/UUID: ${datos.no_factura}
- No. Contrato: ${datos.no_contrato}
- Cuenta bancaria: ${datos.cuenta_bancaria}
- Área: ${datos.area}
- Clasificación presupuestal: ${datos.clasificacion}

INSTRUCCIONES:
1. Devuelve SOLO un JSON válido, sin texto extra ni backticks.
2. El JSON debe tener una propiedad "campos" que es un array de objetos con:
   { "texto": string, "x": number, "y": number, "size": number, "bold": boolean, "maxWidth": number|null, "lineHeight": number|null }
3. Usa SOLO los campos que tengan valor real (omite si están vacíos o "—").
4. Para textos largos (concepto, en letra), divide en múltiples entradas con y decrementado en lineHeight.
5. Asegúrate de que NINGÚN texto se empalme con otro — si el concepto es largo, usa 3 líneas de ~55 chars cada una.
6. Los tamaños recomendados: títulos/totales negrita → 9-10, campos normales → 8-9, notas pequeñas → 7.
7. Alinea los montos a la derecha de las celdas de la tabla (ajusta x para que queden bien).
8. En la plantilla 1, el concepto DEBE aparecer completo aunque sean 3-4 líneas (y decrementado 12pts por línea).
9. Si el RFC está presente, SIEMPRE inclúyelo en el documento.
10. Si hay No. Factura, SIEMPRE inclúyelo.
11. Que todo se vea profesional, sin texto amontonado.

Responde ÚNICAMENTE con el JSON.`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!response.ok) throw new Error(`API error ${response.status}`)
    const apiData = await response.json()
    const texto = apiData.content?.map(b => b.text || '').join('')

    // Limpiar posibles backticks de markdown
    const limpio = texto.replace(/```json|```/gi, '').trim()
    const parsed = JSON.parse(limpio)
    return parsed.campos || []
  } catch (err) {
    console.warn('[PDF-IA] Falló la IA, usando fallback hardcodeado:', err.message)
    return null // señal para usar fallback
  }
}

// ─────────────────────────────────────────────────────────────
// FALLBACK HARDCODEADO (si la IA falla)
// Coordenadas validadas con pdfplumber — pageH = 792 pts
// ─────────────────────────────────────────────────────────────
function camposFallback(d, plantillaId, pageH) {
  const t2y = (top, size = 9) => top2y(pageH, top, size)
  const campos = []
  const add = (texto, x, topFromAbove, size = 9, bold = false) => {
    if (!texto) return
    campos.push({ texto: String(texto), x, y: t2y(topFromAbove, size), size, bold })
  }

  switch (plantillaId) {
    case 1: {
      // ── Orden de Pago ─────────────────────────────────────
      add(d.folio, 460, 135, 9, true)
      add(d.fLarga, 300, 204, 9)

      // Concepto — hasta 4 líneas de 55 chars
      const concepto = d.concepto || ''
      const lineas = dividirTexto(concepto, 55)
      lineas.forEach((l, i) => add(l, 152, 263 + i * 13, 8))

      add(truncar(d.no_factura, 30), 152, 302, 8)
      add(truncar(d.no_contrato, 24), 355, 302, 8)
      if (d.clasificacion) add(truncar(d.clasificacion, 40), 152, 322, 7.5)
      add(d.cuenta_bancaria, 170, 344, 8)

      // Montos
      add(d.montoStr, 470, 344, 9)
      add(d.montoStr, 470, 359, 9)
      add(d.montoStr, 470, 389, 9)
      add(d.montoStr, 470, 422, 9, true)

      // En letra — hasta 3 líneas
      const letraLineas = dividirTexto(d.enLetra, 60)
      letraLineas.slice(0, 3).forEach((l, i) => add(l, 170, 492 + i * 12, 8))

      // Beneficiario
      add(truncar(d.proveedor, 50), 180, 523, 9)
      add(truncar(d.proveedor, 50), 180, 537, 9)
      add(d.rfc, 180, 557, 9)
      add(d.forma_pago, 180, 569, 9)
      break
    }
    case 2:
      add(d.folio || 'S/N', 510, 127, 9)
      add(`Acateno, Puebla; a ${d.fLarga}`, 160, 539, 9)
      break
    case 3:
      add(d.folio || '', 530, 73, 9)
      if (d.concepto) {
        dividirTexto(d.concepto, 55).slice(0, 2).forEach((l, i) =>
          add(l, 160, 295 + i * 13, 9))
      }
      add(d.montoStr, 431, 432, 9, true)
      add(d.montoStr, 431, 460, 9, true)
      add(`Acateno, Puebla; a ${d.fLarga}`, 160, 596, 9)
      break
    case 4:
      add(d.fLarga.toUpperCase(), 411, 224, 9, true)
      if (d.concepto) {
        dividirTexto(d.concepto, 55).slice(0, 3).forEach((l, i) =>
          add(l, 85, 340 + i * 14, 9))
      }
      break
    case 5:
      add(d.folio, 460, 172, 9, true)
      if (d.area) add(d.area.toUpperCase(), 237, 196, 8)
      add(d.fCorta, 495, 197, 8)
      if (d.proveedor) add(truncar(d.proveedor.toUpperCase(), 35), 206, 221, 8)
      break
    case 6:
      if (d.area) add(d.area.toUpperCase(), 240, 141, 8)
      if (d.proveedor) add(truncar(d.proveedor.toUpperCase(), 40), 160, 161, 8)
      add(d.fCorta, 140, 174, 8)
      add(d.folio, 395, 174, 8)
      if (d.no_factura) add(truncar(d.no_factura, 30), 390, 207, 7)
      if (d.rfc) add(truncar(d.rfc, 20), 316, 207, 7)
      if (d.concepto) add(truncar(d.concepto, 40), 160, 207, 7)
      if (d.proveedor) add(truncar(d.proveedor, 25), 316, 221, 7)
      add(d.montoStr, 440, 207, 8)
      add(d.montoStr, 440, 290, 8)
      add(d.ivaStr, 440, 302, 8)
      add(d.totalStr, 440, 314, 8, true)
      break
  }
  return campos
}

// Divide texto en líneas de máx `maxLen` chars sin cortar palabras
function dividirTexto(texto, maxLen) {
  if (!texto) return []
  const words = texto.split(' ')
  const lineas = []
  let linea = ''
  for (const word of words) {
    if ((linea + ' ' + word).trim().length > maxLen && linea) {
      lineas.push(linea.trim())
      linea = word
    } else {
      linea = linea ? linea + ' ' + word : word
    }
  }
  if (linea) lineas.push(linea.trim())
  return lineas
}

// ─────────────────────────────────────────────────────────────
// DIBUJADO FINAL
// ─────────────────────────────────────────────────────────────
async function dibujarCampos(page, campos, fontR, fontB, pageH) {
  for (const campo of campos) {
    if (!campo.texto || !String(campo.texto).trim()) continue
    const font = campo.bold ? fontB : fontR
    const size = campo.size || 9
    const x = campo.x
    const y = campo.y // ya viene en coordenada pdf-lib (desde abajo)

    // Si viene con maxWidth y lineHeight, hacer wrapping manual
    if (campo.maxWidth && campo.lineHeight) {
      drawWrapped(page, campo.texto, x, y, {
        size, font, color: rgb(0, 0, 0),
        maxWidth: campo.maxWidth,
        lineHeight: campo.lineHeight,
      })
    } else {
      try {
        page.drawText(String(campo.texto), { x, y, size, font, color: rgb(0, 0, 0) })
      } catch (err) {
        // Ignorar errores de caracteres no soportados — reintentar sin acentos
        const limpio = String(campo.texto)
          .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
          .replace(/[^\x00-\x7F]/g, '')
        try { page.drawText(limpio, { x, y, size, font, color: rgb(0, 0, 0) }) } catch {}
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────
// FUNCIÓN PRINCIPAL EXPORTADA
// ─────────────────────────────────────────────────────────────
export async function generarPDF(data, preview = false, plantillaId = 1) {
  const nombres = {
    1: 'Orden_de_Pago',
    2: 'Solicitud_Suficiencia',
    3: 'Autorizacion_Suficiencia',
    4: 'Oficio_Solicitud',
    5: 'Requisicion_Materiales',
    6: 'Recepcion_Bienes',
  }

  try {
    // 1. Cargar plantilla PDF
    const res = await fetch(`/assets/plantilla_${plantillaId}.pdf`)
    if (!res.ok) throw new Error(
      `No se encontró plantilla_${plantillaId}.pdf\n` +
      `→ Coloca los PDFs en: frontend/public/assets/`
    )
    const bytes = await res.arrayBuffer()

    // 2. Abrir con pdf-lib
    const pdfDoc = await PDFDocument.load(bytes)
    const fontR  = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const fontB  = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
    const page   = pdfDoc.getPages()[0]
    const { height: pageH } = page.getSize()

    // 3. Preparar datos formateados
    const d = prepararDatos(data)

    // 4. Pedir instrucciones a la IA
    let campos = await obtenerInstruccionesIA(d, plantillaId)

    // 5. Si la IA falló, usar fallback
    if (!campos || campos.length === 0) {
      campos = camposFallback(d, plantillaId, pageH)
    } else {
      // La IA devuelve coordenadas en sistema pdf-lib (desde abajo) — usarlas directo
      // Si algún campo trae maxWidth/lineHeight, se respeta en dibujarCampos
    }

    // 6. Dibujar todo
    await dibujarCampos(page, campos, fontR, fontB, pageH)

    // 7. Generar y entregar
    const salida    = await pdfDoc.save()
    const blob      = new Blob([salida], { type: 'application/pdf' })
    const objectUrl = URL.createObjectURL(blob)

    if (preview) {
      window.open(objectUrl, '_blank')
    } else {
      const a = document.createElement('a')
      a.href     = objectUrl
      a.download = `${d.folio || 'doc'}_${nombres[plantillaId]}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(objectUrl), 15000)
    }

  } catch (err) {
    console.error('[PDF]', err)
    alert(`Error al generar PDF:\n${err.message}`)
  }
}