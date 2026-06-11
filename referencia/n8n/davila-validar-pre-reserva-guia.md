# Tool `validar_pre_reserva` — Miguel Davila (guía n8n)

La tool ya está implementada en el dashboard. Esta guía explica cómo conectar
el sub-workflow de n8n al endpoint.

## Endpoint del dashboard

```
POST https://dashboard.alef.company/api/davila/pre-reserva
api_key: davila-pre-reserva-2026
```

Maneja las 4 operaciones (CREATE / UPDATE_PAGO / CONFIRMAR / CANCELAR),
Google Calendar y la tabla `pre_reservas`. El agente solo manda parámetros
y recibe `{ success, ... }`.

## Paso 1 — Importar el sub-workflow

1. En n8n: **Workflows → Import from File** → `davila-validar-pre-reserva-subflow.json`
2. Quedará un workflow con 2 nodos:
   - **When Executed by Another Workflow** (trigger con el schema de inputs)
   - **Llamar endpoint pre-reserva** (HTTP Request al dashboard)
3. **Guarda** el workflow y copia su **ID** (aparece en la URL: `/workflow/<ID>`).

## Paso 2 — Conectar el nodo `validar_pre_reserva` del flujo principal

En el flujo `MIGUEL DAVILA | WHATSAPP`, el nodo `validar_pre_reserva` (toolWorkflow)
hoy apunta a un sub-workflow vacío. Cámbialo:

1. Abre el nodo **validar_pre_reserva**.
2. En **Workflow**, selecciona el sub-workflow que importaste en el Paso 1.
3. En **Workflow Inputs → mapping**, define estos campos (todos `string`) usando
   `$fromAI` para que el agente los complete:

   | Campo       | Valor |
   |-------------|-------|
   | `operacion` | `{{ $fromAI('operacion', 'CREATE, UPDATE_PAGO, CONFIRMAR o CANCELAR', 'string') }}` |
   | `celular`   | `{{ $('Webhook').item.json.body.conversation.contact_inbox.source_id }}` |
   | `fecha`     | `{{ $fromAI('fecha', 'fecha de la cita YYYY-MM-DD (solo CREATE)', 'string') }}` |
   | `hora`      | `{{ $fromAI('hora', 'hora de la cita HH:MM 24h (solo CREATE)', 'string') }}` |

   > **SOLO 4 parámetros** (Junio 2026). Se eliminaron nombre_completo, tratamiento,
   > DNI, edad, modalidad, comprobante, monto — María valida los datos personales
   > manualmente.
   > **Importante:** `celular` se toma del Webhook (igual que en la tool `Calendario`
   > existente), NO del agente. Es el identificador único del cliente.

4. En la **descripción de la tool** (campo del nodo), pega:

   ```
   Maneja todo el ciclo de pre-reserva de citas. Úsala con operacion:
   - CREATE: crear una pre-reserva nueva (requiere fecha y hora). Devuelve pre_reserva_id.
     REAGENDAR/CAMBIAR horario antes de pagar = llamar CREATE otra vez con la NUEVA
     fecha y hora: el sistema cancela automáticamente la pre-reserva anterior
     pendiente (devuelve reagendada:true y los datos de la anterior).
   - UPDATE_PAGO: confirmar que el cliente pagó (solo tras validar el comprobante de S/300).
   - CONFIRMAR: confirmar la cita después de recibir los datos personales.
   - CANCELAR: cancelar una pre-reserva antes de pagar (sin crear otra).
   El celular se completa automáticamente. La tool valida disponibilidad,
   Google Calendar y los 40 minutos de vigencia.
   REGLA OBLIGATORIA: NUNCA digas que reservaste, cambiaste o cancelaste un
   horario sin haber llamado esta tool en ese mismo turno y haber recibido
   success:true. Si no llamaste la tool, el cambio NO existe.
   ```

## Paso 3 — Respuestas que recibe el agente

| Operación | Éxito | Error típico |
|---|---|---|
| CREATE | `{ success: true, pre_reserva_id, expires_at, reagendada, anterior }` | `{ success:false, error:"horario_ocupado" }` |
| UPDATE_PAGO | `{ success: true, estado:"pagado" }` | `{ success:false, error:"expirado" }` |
| CONFIRMAR | `{ success: true, estado:"confirmado" }` | `{ success:false, error:"pre_reserva_no_encontrada" }` |
| CANCELAR | `{ success: true, estado:"cancelado" }` | `{ success:false, error:"pre_reserva_no_encontrada" }` |

## Paso 4 — Conexión a Google Calendar (¡importante!)

Davila tiene su PROPIA conexión a Google Calendar, separada de las demás empresas.

1. Entra al dashboard de **Miguel Davila → Soporte → "Conexión a Google Calendar"**.
2. Click en **"Conectar con Google Calendar"**.
3. Inicia sesión con la cuenta de Google de Davila (la del calendario de citas)
   y acepta los permisos.
4. Vuelves al dashboard con "Calendario conectado ✅" y el email de la cuenta.

Eso guarda el refresh token en `app_settings(key='google_refresh_token_davila')`.
Las citas se crean en el calendario **principal** ("primary") de esa cuenta —
no necesitas saber ni configurar ningún Calendar ID.

### Variables de entorno (Netlify)

```
# Davila — solo estas son nuevas:
GOOGLE_CALENDAR_ID_DAVILA   = primary            # default; dejar así salvo calendario secundario
DAVILA_PRE_RESERVA_CRON_KEY = davila-cron-2026-xK9
```

> **NO hace falta tocar Google Cloud Console.** Davila reutiliza el callback
> OAuth de Healup (`/api/healup/gcal-callback`, ya registrado) con state='davila'.
> Las credenciales `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` ya existen (las usa Healup).

## Paso 5 — SQL

Correr una vez en Supabase: `sql/davila_pre_reservas.sql`

## CRON de limpieza (ya queda automático)

`netlify/functions/cron-davila-pre-reservas.mts` corre cada 15 min y marca como
`expirado` las pre-reservas sin pagar tras 40 min, liberando el horario en GCal.
No requiere acción del agente.

## Pruebas manuales (curl)

```bash
# CREATE
curl -X POST https://dashboard.alef.company/api/davila/pre-reserva \
  -H "Content-Type: application/json" \
  -d '{"api_key":"davila-pre-reserva-2026","operacion":"CREATE","celular":"+51999888777","fecha":"2026-06-04","hora":"16:00","nombre_completo":"Juan Perez","tratamiento":"Botox"}'

# UPDATE_PAGO
curl -X POST https://dashboard.alef.company/api/davila/pre-reserva \
  -H "Content-Type: application/json" \
  -d '{"api_key":"davila-pre-reserva-2026","operacion":"UPDATE_PAGO","celular":"+51999888777"}'

# CONFIRMAR
curl -X POST https://dashboard.alef.company/api/davila/pre-reserva \
  -H "Content-Type: application/json" \
  -d '{"api_key":"davila-pre-reserva-2026","operacion":"CONFIRMAR","celular":"+51999888777"}'

# CANCELAR
curl -X POST https://dashboard.alef.company/api/davila/pre-reserva \
  -H "Content-Type: application/json" \
  -d '{"api_key":"davila-pre-reserva-2026","operacion":"CANCELAR","celular":"+51999888777"}'

# CRON manual
curl "https://dashboard.alef.company/api/davila/pre-reserva-cron?api_key=davila-cron-2026-xK9"
```
