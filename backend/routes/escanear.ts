import { Router, Request, Response } from 'express'
import { authMiddleware } from '../middleware/auth.js'
import { createWorker } from 'tesseract.js'

const router = Router()
router.use(authMiddleware)

// ── Helpers de extracción y limpieza (Optimizados para OCR) ───

/** Limpia texto basura común del OCR */
function limpiarTextoOCR(texto: string): string {
  return texto.replace(/\n\s*\n/g, '\n').replace(/[|]/g, 'I');
}

/** RFC mexicano: 3-4 letras + 6 dígitos + 3 homonimia. Limpia espacios y guiones. */
function extraerRFC(texto: string): string | undefined {
  // Permite espacios o guiones intermedios que el OCR suele agregar por error
  const m = texto.match(/\b([A-ZÑ&]{3,4})[\s\-]*(\d{6})[\s\-]*([A-Z0-9]{3})\b/i)
  if (m) {
    return m[0].toUpperCase().replace(/[\s\-]/g, '')
  }
  return undefined
}

/** Monto: busca el número más grande asociado a $, MXN, pesos, total, importe */
function extraerMonto(texto: string): number | undefined {
  // Primero intentamos buscar líneas explícitas de "TOTAL" o "IMPORTE"
  const regexTotal = /(?:TOTAL|IMPORTE|NETO)\s*[:$]?\s*([\d,]+\.\d{2})/gi;
  const matchTotales = [...texto.matchAll(regexTotal)];
  
  if (matchTotales.length > 0) {
    const montos = matchTotales.map(m => parseFloat(m[1].replace(/,/g, ''))).filter(n => !isNaN(n));
    if (montos.length > 0) return Math.max(...montos);
  }

  // Fallback: buscar cualquier formato de moneda
  const regexMoneda = /\$?\s*([\d,]+(?:\.\d{1,2})?)\s*(?:MXN|M\.N\.|pesos|mn)?/gi;
  const matches = [...texto.matchAll(regexMoneda)];
  if (!matches.length) return undefined;

  const montos = matches
    .map(m => parseFloat(m[1].replace(/,/g, '')))
    .filter(n => !isNaN(n) && n > 0);
    
  if (!montos.length) return undefined;
  return Math.max(...montos); // El total suele ser el número más alto en la factura
}

/** Fecha: Fuerza la salida a YYYY-MM-DD bajo cualquier formato leído */
function extraerFecha(texto: string): string | undefined {
  // Formato: DD/MM/YYYY o DD-MM-YYYY o DD/MM/YY
  let m = texto.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\b/);
  if (m) {
    let year = m[3];
    if (year.length === 2) year = `20${year}`; // Asumir 2000+ si tiene 2 dígitos
    return `${year}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  
  // Formato: YYYY-MM-DD o YYYY/MM/DD
  m = texto.match(/\b(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})\b/);
  if (m) {
    return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  }

  // Formato texto: "15 de marzo de 2024"
  const meses: Record<string, string> = {
    enero:'01', febrero:'02', marzo:'03', abril:'04', mayo:'05', junio:'06',
    julio:'07', agosto:'08', septiembre:'09', octubre:'10', noviembre:'11', diciembre:'12'
  };
  m = texto.match(/(\d{1,2})\s+de\s+([a-záéíóúü]+)\s+(?:de\s+)?(\d{4})/i);
  if (m) {
    const mes = meses[m[2].toLowerCase()];
    if (mes) return `${m[3]}-${mes}-${m[1].padStart(2, '0')}`;
  }
  
  return undefined;
}

/** UUID CFDI o folio numérico */
function extraerNoFactura(texto: string): string | undefined {
  // Buscar primero un UUID de facturación electrónica (36 caracteres)
  const uuid = texto.match(/\b[0-9a-f]{8}\-[0-9a-f]{4}\-[0-9a-f]{4}\-[0-9a-f]{4}\-[0-9a-f]{12}\b/i);
  if (uuid) return uuid[0].toUpperCase();

  // Fallback: Buscar la palabra folio o factura
  const folio = texto.match(/(?:folio|factura|no\.?|n[uú]m\.?)\s*[:°#]?\s*([A-Z0-9\-]{3,20})/i);
  if (folio) return folio[1].toUpperCase();

  return undefined;
}

/** Forma de pago por palabras clave */
function extraerFormaPago(texto: string): 'CHEQUE' | 'TRANSFERENCIA' | 'EFECTIVO' {
  const t = texto.toUpperCase()
  if (/TRANSFER|SPEI|CIE|CLABE|BANCO|CUENTA/.test(t)) return 'TRANSFERENCIA'
  if (/EFECTIVO|CASH|CONTADO/.test(t))           return 'EFECTIVO'
  return 'CHEQUE'
}

/** Tipo de documento por palabras clave */
function extraerTipoDocumento(texto: string): string {
  const t = texto.toUpperCase()
  if (/FACTURA|CFDI/.test(t))      return 'Factura'
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
  const m = texto.match(/(?:beneficiario|proveedor|emisor|raz[oó]n\s+social|nombre)[:\s]+([^\n]{5,80})/i)
  if (m) return m[1].trim()
  
  // Buscar razón social por sufijo legal común en México
  const lineas = texto.split('\n').map(l => l.trim()).filter(l => l.length > 4)
  const razon = lineas.find(l =>
    /S\.?\s*A\.?\s*(?:DE\s+C\.?V\.?)?|S\.?\s*C\.?|A\.?\s*C\.?|S\.?\s*R\.?\s*L\.?/i.test(l)
  )
  if (razon) return razon.replace(/\s+/g, ' ').trim().slice(0, 80)
  
  // Fallback: línea más larga que no sea puramente numérica ni datos técnicos
  const candidatas = lineas
    .filter(l => !/^\d/.test(l) && !/\$|RFC|CURP|TEL|FAX|UUID|FOLIO|FECHA/i.test(l) && l.length > 8)
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

  let worker;
  try {
    const buffer = Buffer.from(imagen, 'base64')

    // OCR con Tesseract.js en español + inglés
    worker = await createWorker(['spa', 'eng'], 1, { logger: () => {} })
    const { data: { text } } = await worker.recognize(buffer)
    await worker.terminate()
    worker = undefined

    const textoLimpio = limpiarTextoOCR(text);

    if (!textoLimpio || textoLimpio.trim().length < 10) {
      res.status(422).json({
        mensaje: 'No se pudo leer texto en la imagen. Verifica que sea legible y bien iluminada.',
      })
      return
    }

    // Mapeo riguroso de los datos extraídos
    const datos = {
      tipo_documento: extraerTipoDocumento(textoLimpio),
      proveedor:      extraerProveedor(textoLimpio),
      rfc:            extraerRFC(textoLimpio),
      monto:          extraerMonto(textoLimpio),
      concepto:       extraerConcepto(textoLimpio),
      fecha:          extraerFecha(textoLimpio),
      forma_pago:     extraerFormaPago(textoLimpio),
      no_factura:     extraerNoFactura(textoLimpio),
    }

    res.json({ datos })

  } catch (err) {
    if (worker) { try { await (worker as unknown as { terminate: () => Promise<void> }).terminate() } catch {} }
    console.error('[ESCANEAR] Error Tesseract:', err)
    res.status(500).json({ mensaje: 'Error interno al procesar la imagen con OCR.' })
  }
})

export default router