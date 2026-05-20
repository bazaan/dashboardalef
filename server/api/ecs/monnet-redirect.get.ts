/**
 * GET /api/ecs/monnet-redirect?status=ok|error
 *
 * Página de retorno cuando el cliente termina el pago en Monnet.
 * Solo muestra un mensaje HTML — el webhook es quien realmente confirma el pago.
 */

export default defineEventHandler((event) => {
  const { status } = getQuery(event)
  const isOk = status === 'ok'

  setHeader(event, 'Content-Type', 'text/html; charset=utf-8')

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${isOk ? 'Pago recibido' : 'Pago con problemas'} — Estás Con Suerte</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}
    body{min-height:100vh;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#0f0f1e 0%,#1a1a2e 100%);color:#fff;padding:20px}
    .card{max-width:480px;text-align:center;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:24px;padding:48px 32px}
    .icon{font-size:80px;margin-bottom:20px}
    h1{font-size:28px;margin-bottom:12px}
    p{color:#9ca3af;font-size:16px;line-height:1.5;margin-bottom:8px}
    .badge{display:inline-block;padding:6px 14px;border-radius:99px;font-size:13px;font-weight:600;margin-top:24px}
    .ok{background:rgba(34,197,94,0.15);color:#22c55e}
    .err{background:rgba(239,68,68,0.15);color:#ef4444}
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${isOk ? '✅' : '⚠️'}</div>
    <h1>${isOk ? '¡Pago recibido!' : 'Algo salió mal'}</h1>
    <p>${isOk
      ? 'Recibimos tu pago correctamente. En unos segundos te llegará la confirmación por WhatsApp y la boleta electrónica al correo.'
      : 'Hubo un problema procesando tu pago. Si el dinero fue descontado, contáctanos por WhatsApp y lo verificamos.'}</p>
    <div class="badge ${isOk ? 'ok' : 'err'}">Estás Con Suerte 🍀</div>
  </div>
</body>
</html>`
})
