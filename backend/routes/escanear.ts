import { Router, Request, Response } from 'express'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()
router.use(authMiddleware)

// ── POST /api/escanear ────────────────────────────────────────
// Body: { imagen: string (base64), mimeType: string }
// Llama a la API de Anthropic en el servidor y devuelve los datos extraídos
router.post('/', async (req: Request, res: Response): Promise<void> => {
  const { imagen, mimeType } = req.body as { imagen?: string; mimeType?: string }

  if (!imagen || !mimeType) {
    res.status(400).json({ mensaje: 'Se requieren los campos imagen y mimeType.' })
    return
  }

  const tiposPermitidos = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  if (!tiposPermitidos.includes(mimeType)) {
    res.status(400).json({ mensaje: 'Tipo de imagen no soportado. Usa JPG, PNG o WEBP.' })
    return
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    res.status(500).json({ mensaje: 'API key de Anthropic no configurada en el servidor.' })
    return
  }

  const prompt = `Analiza esta imagen de un documento financiero/administrativo (puede ser una factura, recibo, cheque, orden de pago, requisición u otro documento similar) del municipio de Acateno, Puebla, México.

Extrae todos los datos relevantes que encuentres y devuelve ÚNICAMENTE un objeto JSON válido con esta estructura (omite los campos que no puedas identificar con certeza):

{
  "tipo_documento": "tipo de documento identificado (ej: Factura, Recibo, Cheque, Requisición, etc.)",
  "proveedor": "nombre del beneficiario, proveedor o emisor",
  "rfc": "RFC del emisor o beneficiario (solo letras y números, sin guiones ni espacios)",
  "monto": número con el monto total (solo número, sin símbolo de moneda ni comas),
  "concepto": "descripción del concepto, servicio o bien",
  "fecha": "fecha en formato YYYY-MM-DD",
  "forma_pago": "CHEQUE" | "TRANSFERENCIA" | "EFECTIVO",
  "no_factura": "número de factura, UUID o folio fiscal",
  "no_contrato": "número de contrato si aparece",
  "cuenta_bancaria": "número de cuenta o CLABE si aparece"
}

Responde SOLO con el JSON, sin explicaciones, sin texto adicional, sin bloques de código markdown.`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: [
            {
              type:   'image',
              source: { type: 'base64', media_type: mimeType, data: imagen },
            },
            { type: 'text', text: prompt },
          ],
        }],
      }),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      console.error('[ESCANEAR] Anthropic API error:', errorBody)
      res.status(502).json({ mensaje: 'Error al comunicarse con la IA. Intenta de nuevo.' })
      return
    }

    const anthropicData = await response.json() as {
      content: { type: string; text: string }[]
    }

    const texto  = anthropicData.content?.find(b => b.type === 'text')?.text ?? '{}'
    const limpio = texto.replace(/```json|```/g, '').trim()

    let datos: Record<string, unknown>
    try {
      datos = JSON.parse(limpio) as Record<string, unknown>
    } catch {
      console.error('[ESCANEAR] JSON parse error, respuesta cruda:', limpio)
      res.status(422).json({ mensaje: 'La IA no pudo extraer datos del documento. Intenta con una imagen más clara.' })
      return
    }

    res.json({ datos })

  } catch (err) {
    console.error('[ESCANEAR] Error:', err)
    res.status(500).json({ mensaje: 'Error interno al analizar la imagen.' })
  }
})

export default router