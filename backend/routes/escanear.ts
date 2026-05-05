import { Router, Request, Response } from 'express'
import { authMiddleware } from '../middleware/auth.js'
import { createWorker } from 'tesseract.js'

const router = Router()
router.use(authMiddleware)

// ── Helpers de extracción ─────────────────────────────────────

/** RFC mexicano: 3-4 letras + 6 dígitos + 3 homonimia */
function extraerRFC(texto: string): string | undefined {
  const m = texto.match(/\b([A-ZÑ&]{3,4})(\d{6})([A-Z0-9]{3})\b/i)
  return m ? m[0].toUpperCase().replace(/\s/g, '') : undefined
}

/** Monto: busca el número más grande asociado a $, MXN, pesos, total */
function extraerMonto(texto: string): number | undefined {
  const matches = [...texto.matchAll(/\$?\s*([\d,]+(?:\.\d{1,2})?)\s*(?:MXN|M\.N\.|pesos|mn)?/gi)]
  if (!matches.length) return undefined
  const montos = matches
    .map(m => parseFloat(m[1].replace(/,/g, '')))
    .filter(n => !isNaN(n) && n > 0)
  if (!montos.length) return undefined
  return Math.max(...montos)
}

/** Fecha en varios formatos comunes en México */
function extraerFecha(texto: string): string | undefined {
  // ISO: 2024-03-15
  let m = texto.match(/\b(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})\b/)
  if (m) return `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`
  // DD/MM/YYYY
  m = texto.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\b/)
  if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`
  // "15 de marzo de 2024"
  const meses: Record<string,string> = {
    enero:'01', febrero:'02', marzo:'03', abril:'04', mayo:'05', junio:'06',
    julio:'07', agosto:'08', septiembre:'09', octubre:'10', noviembre:'11', diciembre:'12'
  }
  m = texto.match(/(\d{1,2})\s+de\s+([a-záéíóúü]+)\s+(?:de\s+)?(\d{4})/i)
  if (m) {
    const mes = meses[m[2].toLowerCase()]
    if (mes) return `${m[3]}-${mes}-${m[1].padStart(2,'0')}`
  }
  return undefined
}

/** UUID CFDI o folio numérico */
function extraerNoFactura(texto: string): string | undefined {
  const uuid = texto.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)
  if (uuid) return uuid[0].toUpperCase()
  const folio = texto.match(/(?:folio|factura|no\.?|n[uú]m\.?)\s*[:°#]?\s*([A-Z0-9\-]{3,20})/i)
  if (folio) return folio[1].toUpperCase()
  return undefined
}

/** Forma de pago por palabras clave */
function extraerFormaPago(texto: string): 'CHEQUE' | 'TRANSFERENCIA' | 'EFECTIVO' {
  const t = texto.toUpperCase()
  if (/TRANSFER|SPEI|CIE|CLABE|BANCO/.test(t)) return 'TRANSFERENCIA'
  if (/EFECTIVO|CASH|CONTADO/.test(t))          return 'EFECTIVO'
  return 'CHEQUE'
}

/** Tipo de documento por palabras clave */
function extraerTipoDocumento(texto: string): string {
  const t = texto.toUpperCase()
  if (/FACTURA/.test(t))           return 'Factura'
  if (/RECIBO/.test(t))            return 'Recibo'
  if (/CHEQUE/.test(t))            return 'Cheque'
  if (/REQUISICI[OÓ]N/.test(t))    return 'Requisición'
  if (/ORDEN\s+DE\s+PAGO/.test(t)) return 'Orden de Pago'
  if (/NOTA\s+DE\s+VENTA/.test(t)) return 'Nota de Venta'
  if (/CONTRATO/.test(t))          return 'Contrato'
  return 'Documento financiero'
}

/** Nombre/razón social del proveedor o beneficiario */
function extraerProveedor(texto: string): string | undefined {
  // Buscar línea con palabra clave explícita
  const m = texto.match(/(?:beneficiario|proveedor|raz[oó]n\s+social|nombre)[:\s]+([^\n]{5,80})/i)
  if (m) return m[1].trim()
  // Buscar razón social por sufijo legal
  const lineas = texto.split('\n').map(l => l.trim()).filter(l => l.length > 4)
  const razon = lineas.find(l =>
    /S\.?\s*A\.?\s*(?:DE\s+C\.?V\.?)?|S\.?\s*C\.?|A\.?\s*C\.?|S\.?\s*R\.?\s*L\.?/i.test(l)
  )
  if (razon) return razon.replace(/\s+/g, ' ').trim().slice(0, 80)
  // Fallback: línea más larga sin números ni símbolos especiales
  const candidatas = lineas
    .filter(l => !/^\d/.test(l) && !/\$|RFC|CURP|TEL|FAX/i.test(l) && l.length > 8)
    .sort((a, b) => b.length - a.length)
  return candidatas[0]?.slice(0, 80)
}

/** Concepto del servicio o bien */
function extraerConcepto(texto: string): string | undefined {
  const m = texto.match(/(?:concepto|descripci[oó]n|servicio|bien|objeto)[:\s]+([^\n]{5,120})/i)
  return m ? m[1].trim() : undefined
}

// ── POST /api/escanear ────────────────────────────────────────
// Body: { imagen: string (base64), mimeType: string }
router.post('/', async (req: Request, res: Response): Promise<void> => {
  const { imagen, mimeType } = req.body as { imagen?: string; mimeType?: string }

  if (!imagen || !mimeType) {
    res.status(400).json({ mensaje: 'Se requieren los campos imagen y mimeType.' })
    return
  }

  const tiposPermitidos = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp']
  if (!tiposPermitidos.includes(mimeType)) {
    res.status(400).json({ mensaje: 'Tipo de imagen no soportado. Usa JPG, PNG o WEBP.' })
    return
  }

  let worker
  try {
    const buffer = Buffer.from(imagen, 'base64')

    // OCR con Tesseract.js en español + inglés (documentos mexicanos mezclan ambos)
    worker = await createWorker(['spa', 'eng'], 1, { logger: () => {} })
    const { data: { text } } = await worker.recognize(buffer)
    await worker.terminate()
    worker = undefined

    if (!text || text.trim().length < 10) {
      res.status(422).json({
        mensaje: 'No se pudo leer texto en la imagen. Verifica que sea legible y bien iluminada.',
      })
      return
    }

    const datos = {
      tipo_documento: extraerTipoDocumento(text),
      proveedor:      extraerProveedor(text),
      rfc:            extraerRFC(text),
      monto:          extraerMonto(text),
      concepto:       extraerConcepto(text),
      fecha:          extraerFecha(text),
      forma_pago:     extraerFormaPago(text),
      no_factura:     extraerNoFactura(text),
    }

    res.json({ datos })

  } catch (err) {
    if (worker) { try { await (worker as unknown as { terminate: () => Promise<void> }).terminate() } catch {} }
    console.error('[ESCANEAR] Error Tesseract:', err)
    res.status(500).json({ mensaje: 'Error interno al procesar la imagen con OCR.' })
  }
})

export default router