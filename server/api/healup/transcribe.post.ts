/**
 * Healup Agent — Transcripcion de audio via Whisper (OpenAI).
 * Recibe audio blob como FormData, retorna texto transcrito.
 *
 * Auth: requiere sesion dashboard_session.
 */

export default defineEventHandler(async (event) => {
  // Auth
  const cookies = parseCookies(event)
  const sessionRaw = cookies.dashboard_session
  if (!sessionRaw) throw createError({ statusCode: 401, statusMessage: 'No autenticado' })
  try { JSON.parse(decodeURIComponent(sessionRaw)) } catch {
    throw createError({ statusCode: 401, statusMessage: 'Sesion invalida' })
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw createError({ statusCode: 500, statusMessage: 'OPENAI_API_KEY no configurada en el servidor' })
  }

  // Leer multipart form data
  const formData = await readMultipartFormData(event)
  if (!formData || !formData.length) {
    throw createError({ statusCode: 400, statusMessage: 'Se requiere un archivo de audio' })
  }

  const audioFile = formData.find(f => f.name === 'audio')
  if (!audioFile || !audioFile.data) {
    throw createError({ statusCode: 400, statusMessage: 'Campo "audio" no encontrado' })
  }

  try {
    // Construir FormData para OpenAI
    const blob = new Blob([audioFile.data], { type: audioFile.type || 'audio/webm' })
    const oaiForm = new FormData()
    oaiForm.append('file', blob, audioFile.filename || 'audio.webm')
    oaiForm.append('model', 'whisper-1')
    oaiForm.append('language', 'es')
    oaiForm.append('response_format', 'json')
    oaiForm.append('prompt', 'Healup clinica estetica Lima Peru. Botox, acido hialuronico, Yape, Plin, procedimiento, egreso, paciente, cita.')

    const resp = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}` },
      body: oaiForm
    })

    if (!resp.ok) {
      const errBody = await resp.text()
      console.error('[transcribe] OpenAI error:', resp.status, errBody)
      throw createError({ statusCode: resp.status, statusMessage: `Whisper error: ${errBody}` })
    }

    const result: any = await resp.json()
    return { text: result.text || '' }
  } catch (err: any) {
    if (err.statusCode) throw err
    console.error('[transcribe] Error:', err?.message || err)
    throw createError({ statusCode: 500, statusMessage: err?.message || 'Error transcribiendo audio' })
  }
})
