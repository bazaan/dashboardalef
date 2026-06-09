/**
 * GET/POST /api/vonage/handle-call
 *
 * answer_url público que Vonage consulta al conectar la llamada de emergencia
 * (disparada por /api/gatwick/generar-llamada). Devuelve un NCCO (Nexmo Call
 * Control Object) que reproduce el mensaje 3 veces y cuelga.
 *
 * Vonage lo invoca por GET por defecto (sin auth) — por eso este endpoint es
 * público y no recibe api_key. No expone datos sensibles: solo el guión de voz.
 *
 * El texto se puede personalizar con la env var VONAGE_NCCO_TEXT.
 *
 * Nota: el doc original sugería bargeIn:true, pero Vonage exige que tras un
 * `talk` con bargeIn:true venga una acción `input`. Como esto es solo una
 * alerta (sin menú), se omite bargeIn para garantizar un NCCO válido.
 */

export default defineEventHandler(() => {
  const text = process.env.VONAGE_NCCO_TEXT || 'Emergencia Gatwick. Revisa el WhatsApp'
  const talk = { action: 'talk', text, language: 'es-ES' }
  return [talk, talk, talk, { action: 'hangup' }]
})
