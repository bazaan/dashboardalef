/**
 * POST /api/ecs/generar-link-monnet
 *
 * Tool del agente IA de ECS: genera link de suscripción Yape para el cliente.
 *
 * IMPORTANTE: Este endpoint ya NO habla con Monnet directamente — ahora hace
 * proxy al sistema interno de ECS (api.estasconsuerte.com.pe). Razón: ECS
 * tiene su propia BD de suscripciones y su web "Mi Cuenta" depende de que
 * la suscripción esté ahí. Si creamos directo en Monnet, queda huérfana.
 *
 * El sistema ECS se encarga de:
 *   1. Crear la suscripción en Monnet con sus credenciales
 *   2. Guardarla en su BD asociada al usuario (por phoneNumber)
 *   3. Recibir el webhook AUTHORIZED de Monnet
 *   4. Disparar el cobro automáticamente
 *   5. Mostrar la suscripción en "Mi Cuenta" del cliente
 *
 * Pasos del endpoint:
 *   1. Registra al cliente en ECS via /auth/register/alef → recibe JWT del usuario
 *   2. POST /subscriptions/create al sistema ECS usando ese token
 *      (la suscripción queda asociada al cliente registrado, no a un admin)
 *   3. Guarda el registro en ecs_pagos_monnet y SuscriptoresBDwppECS
 *   4. Devuelve el deepLink al bot para que lo envíe al cliente por WhatsApp
 *
 * Body esperado:
 * {
 *   api_key:                  string,    — auth
 *   cliente_nombre:           string,
 *   cliente_email:            string,
 *   cliente_telefono:         string,    — 9 dígitos, será el phoneNumber Yape
 *   cliente_dni?:             string,
 *   plan_nombre:              string,    — texto humano del plan ("La Fija", "Medio Pituco")
 *   plan_key?:                string,    — opcional, si lo conocemos directo (ej: "MEDIO_PITUCO")
 *   monto:                    number,    — referencial, ECS define el monto real
 *   chatwoot_account_id?:     number,
 *   chatwoot_inbox_id?:       number,
 *   chatwoot_conversation_id?: number,
 * }
 *
 * Response:
 * {
 *   ok: true,
 *   link: "https://www.yape.com.pe/app/checkout/ocp/subscription?...",
 *   ecs_subscription_id: 120,        — ID interno en ECS
 *   monnet_subscription_id: 13233,   — ID en Monnet
 *   plan_name: "Medio Pituco",
 *   operation_number: "ECS-...",
 *   log_id: number
 * }
 */

import { serverSupabaseServiceRole } from '#supabase/server'

const API_KEY            = 'ecs-monnet-2026-link'
const ECS_API_BASE       = process.env.ECS_API_BASE_URL  || 'https://api.estasconsuerte.com.pe'
const ECS_ADMIN_EMAIL    = process.env.ECS_ADMIN_EMAIL   || ''
const ECS_ADMIN_PASSWORD = process.env.ECS_ADMIN_PASSWORD || ''

// Cache del token admin (TTL 6 días, el JWT dura 7). Solo se usa para el
// fallback cuando un usuario ya está registrado en ECS.
let cachedAdminToken: { value: string; expiresAt: number } | null = null

async function getAdminToken(): Promise<string | null> {
  if (!ECS_ADMIN_EMAIL || !ECS_ADMIN_PASSWORD) return null
  const now = Date.now()
  if (cachedAdminToken && cachedAdminToken.expiresAt > now) {
    return cachedAdminToken.value
  }
  try {
    const res: any = await $fetch(`${ECS_API_BASE}/auth/login`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    { email: ECS_ADMIN_EMAIL, password: ECS_ADMIN_PASSWORD },
    })
    const token = res?.token || res?.access_token || res?.accessToken
    if (!token) return null
    cachedAdminToken = { value: token, expiresAt: now + 6 * 24 * 60 * 60 * 1000 }
    return token
  } catch { return null }
}

// Mapeo plan_nombre (humano) → planKey (slug ECS). Se puede sobreescribir
// pasando plan_key directamente en el body.
const PLAN_KEY_MAP: Record<string, string> = {
  'la fija':           'LA_FIJA',
  'medio pituco':      'MEDIO_PITUCO',
  'pituco':            'PITUCO',
  'la suertuda':       'LA_SUERTUDA',
  // agregar acá conforme se conozcan más planes
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function genOperationNumber(): string {
  const ts = Date.now()
  const rnd = Math.floor(Math.random() * 1e6).toString().padStart(6, '0')
  return `ECS-${ts}-${rnd}`
}

function normalizePhone(raw: string | number): string {
  const str = String(raw ?? '').replace(/\D/g, '')
  if (str.length === 11 && str.startsWith('51')) return str.slice(2)
  if (str.length > 9) return str.slice(-9)
  return str
}

function resolverPlanKey(planNombre: string, planKeyExplicit?: string): string {
  if (planKeyExplicit && planKeyExplicit.trim()) return planKeyExplicit.trim()
  const lower = String(planNombre || '').trim().toLowerCase()
  if (PLAN_KEY_MAP[lower]) return PLAN_KEY_MAP[lower]
  // Fallback: convertir a UPPER_SNAKE_CASE
  return lower.replace(/\s+/g, '_').replace(/[^a-z0-9_]/gi, '').toUpperCase()
}

/**
 * Parsea el nombre completo en firstName / lastName.
 * "Julio Cesar Zumaeta Perez" → { firstName: "Julio", lastName: "Cesar Zumaeta Perez" }
 */
function parseNombre(fullName: string): { firstName: string; lastName: string } {
  const partes = String(fullName || '').trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return { firstName: 'Cliente', lastName: '-' }
  if (partes.length === 1) return { firstName: partes[0], lastName: '-' }
  return { firstName: partes[0], lastName: partes.slice(1).join(' ') }
}

/**
 * Registra al cliente en el sistema ECS via /auth/register/alef.
 * Devuelve el token JWT del usuario recién creado, que se usa para crear
 * la suscripción a su nombre (no del admin).
 */
async function registrarClienteECS(args: {
  email: string
  firstName: string
  lastName: string
  documentNumber: string
  phoneNumber: string
}): Promise<string> {
  const registerPayload = {
    email:            args.email,
    documentType:     'DNI',
    documentNumber:   args.documentNumber,
    firstName:        args.firstName,
    lastName:         args.lastName,
    phoneCountryCode: '+51',
    phoneNumber:      args.phoneNumber,
    marketingOptIn:   true,                  // SIEMPRE true
  }

  const res: any = await $fetch(`${ECS_API_BASE}/auth/register/alef`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    registerPayload,
  })

  const token = res?.token || res?.access_token || res?.accessToken
  if (!token) {
    throw new Error(`Registro ECS no devolvió token. Response: ${JSON.stringify(res)}`)
  }
  return token
}

// ── Handler ──────────────────────────────────────────────────────────────────

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const supabase = serverSupabaseServiceRole(event)
  const startTime = Date.now()

  // 1. Auth
  if (body?.api_key !== API_KEY) {
    throw createError({ statusCode: 401, statusMessage: 'API key inválida' })
  }

  // 2. Log inicial
  let logId: number | null = null
  try {
    const { data: logRow } = await supabase.from('agent_tool_logs').insert({
      company_id: 'estasconsuerte',
      tool_name:  'Generar Link Monnet',
      input_data: body,
      status:     'running',
    }).select('id').single()
    logId = logRow?.id ?? null
  } catch {}

  const updateLog = async (status: string, output: any, errorMsg?: string) => {
    if (!logId) return
    try {
      await supabase.from('agent_tool_logs').update({
        status, output_data: output, error_message: errorMsg ?? null,
        duration_ms: Date.now() - startTime,
      }).eq('id', logId)
    } catch {}
  }

  // 3. Validación
  const {
    cliente_nombre, cliente_email, cliente_telefono, cliente_dni,
    plan_nombre, plan_key, monto,
    chatwoot_account_id, chatwoot_inbox_id, chatwoot_conversation_id,
  } = body

  if (!cliente_telefono || !plan_nombre || !cliente_email || !cliente_dni || !cliente_nombre) {
    const msg = 'Faltan campos requeridos: cliente_nombre, cliente_email, cliente_telefono, cliente_dni, plan_nombre'
    await updateLog('error', null, msg)
    throw createError({ statusCode: 400, statusMessage: msg })
  }

  const operation_number = genOperationNumber()
  const phone            = normalizePhone(cliente_telefono)
  const planKey          = resolverPlanKey(plan_nombre, plan_key)
  const { firstName, lastName } = parseNombre(cliente_nombre)

  // 4. Registrar al cliente en ECS via /auth/register/alef
  //    La respuesta incluye un token JWT del usuario nuevo (role: CLIENTE).
  //    Ese token se usa para crear la suscripción a su nombre, así queda
  //    asociada al cliente correcto (visible en "Mi Cuenta" de su perfil).
  let token: string
  try {
    token = await registrarClienteECS({
      email:          cliente_email,
      firstName,
      lastName,
      documentNumber: String(cliente_dni),
      phoneNumber:    phone,
    })
  } catch (err: any) {
    const detail = err?.data ?? err?.response?._data ?? err?.message ?? err
    const detailStr = typeof detail === 'object' ? JSON.stringify(detail) : String(detail)

    // CASO ESPECIAL: cliente ya registrado en ECS. /auth/register/alef no es
    // idempotente y rechaza si existe DNI o email previo. En lugar de fallar
    // duro, intentamos detectar el estado actual del cliente y dar una
    // respuesta útil al bot.
    const yaRegistrado = /ya registrado|already (?:exists|registered)|duplicado|duplicate/i.test(detailStr)

    if (yaRegistrado) {
      console.log(`[generar-link-monnet] Cliente ${cliente_email} ya registrado en ECS — manejo gracioso`)

      const adminToken = await getAdminToken()

      // Si no hay admin token configurado, devolvemos mensaje claro pero genérico
      if (!adminToken) {
        const msg = 'Este cliente ya está registrado en ECS. Pídele que ingrese a estasconsuerte.com.pe y se suscriba desde su perfil.'
        await updateLog('error', null, 'Cliente duplicado y sin ECS_ADMIN para fallback')
        return {
          ok: false,
          ya_registrado: true,
          message: msg,
          log_id: logId,
        }
      }

      // Buscar al cliente en /admin/users para ver su estado real
      let user: any = null
      try {
        const usersRes: any = await $fetch(`${ECS_API_BASE}/admin/users`, {
          headers: { Authorization: `Bearer ${adminToken}` },
        })
        const users = usersRes?.users || []
        user = users.find((u: any) =>
          String(u.email ?? '').toLowerCase() === String(cliente_email).toLowerCase() ||
          String(u.documentNumber ?? '') === String(cliente_dni),
        ) ?? null
      } catch (lookupErr: any) {
        console.error('[generar-link-monnet] Error buscando user en admin:', lookupErr?.message)
      }

      // Caso 1: el cliente ya tiene suscripción AUTHORIZED → avisar al bot
      if (user?.subscriptionStatus === 'AUTHORIZED') {
        await updateLog('skipped', { reason: 'cliente ya suscrito (AUTHORIZED)' })
        return {
          ok: false,
          ya_suscrito: true,
          plan_actual: user.subscriptionPlan ?? null,
          message: `Ya tienes una suscripción activa al plan "${user.subscriptionPlan ?? 'ECS'}". No es necesario suscribirte de nuevo.`,
          log_id: logId,
        }
      }

      // Caso 2: tiene una suscripción PENDING — buscar nuestro link guardado y reusarlo
      if (user?.subscriptionStatus === 'PENDING') {
        const { data: pendiente } = await supabase
          .from('SuscriptoresBDwppECS')
          .select('id, operation_number, deep_link, ecs_subscription_id, monnet_subscription_id, plan_nombre')
          .eq('email', cliente_email)
          .eq('estado', 'pendiente')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (pendiente?.deep_link) {
          await updateLog('success', { reused: true, operation_number: pendiente.operation_number })
          return {
            ok: true,
            reused: true,
            link: pendiente.deep_link,
            ecs_subscription_id: pendiente.ecs_subscription_id,
            monnet_subscription_id: pendiente.monnet_subscription_id,
            operation_number: pendiente.operation_number,
            plan_name: pendiente.plan_nombre,
            monto: Number(monto) || 0,
            metodo_pago: 'Yape',
            message: `Tienes un link de pago pendiente:\n${pendiente.deep_link}\n\nÁbrelo desde tu celular para completar la afiliación con Yape.`,
            log_id: logId,
          }
        }
      }

      // Caso 3: registrado pero sin suscripción (NULL, cancelada, expirada, etc.)
      //    NO podemos crear una nueva a su nombre porque /auth/register/alef nos
      //    rechazó. Devolvemos un mensaje claro pidiendo otra vía.
      await updateLog('error', null, `Cliente ya registrado, status=${user?.subscriptionStatus ?? 'desconocido'}`)
      return {
        ok: false,
        ya_registrado: true,
        ecs_status: user?.subscriptionStatus ?? null,
        message: 'Este cliente ya está registrado en ECS pero no tiene suscripción activa. Pídele que inicie sesión en estasconsuerte.com.pe y se suscriba desde ahí.',
        log_id: logId,
      }
    }

    // Otros errores: comportamiento original
    const errMsg = `Error registrando cliente en ECS: ${detailStr}`
    await updateLog('error', null, errMsg)
    throw createError({ statusCode: 502, statusMessage: errMsg })
  }

  // 5. Crear suscripción en ECS con el token del cliente
  const ecsPayload = {
    planKey,
    device:      'MOBILE',
    phoneNumber: phone,
  }

  let ecsResponse: any
  try {
    ecsResponse = await $fetch<any>(`${ECS_API_BASE}/subscriptions/create`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: ecsPayload,
    })
  } catch (err: any) {
    const detail = err?.data ?? err?.response?._data ?? err?.message ?? err
    const errMsg = `Error creando suscripción ECS: ${JSON.stringify(detail)}`
    await updateLog('error', null, errMsg)
    throw createError({ statusCode: 502, statusMessage: errMsg })
  }

  // 6. Validar respuesta de ECS
  if (ecsResponse?.errorCode) {
    const errMsg = `ECS rechazó la suscripción: [${ecsResponse.errorCode}] ${ecsResponse.errorMessage}`
    await updateLog('error', null, errMsg)
    throw createError({ statusCode: 502, statusMessage: errMsg })
  }

  const ecsSubscriptionId    = ecsResponse?.id
  const monnetSubscriptionId = ecsResponse?.subscriptionId
  const deepLink             = ecsResponse?.deepLink
  const planName             = ecsResponse?.planName

  if (!deepLink) {
    const errMsg = `ECS no devolvió deepLink. Response: ${JSON.stringify(ecsResponse)}`
    await updateLog('error', null, errMsg)
    throw createError({ statusCode: 502, statusMessage: errMsg })
  }

  // 7a. Guardar en ecs_pagos_monnet para trazabilidad de pago
  try {
    await supabase.from('ecs_pagos_monnet').insert({
      operation_number,
      cliente_nombre,
      cliente_email,
      cliente_telefono:         phone,
      cliente_dni,
      plan_nombre:              planName || plan_nombre,
      monto:                    Number(monto) || 0,
      moneda:                   'PEN',
      estado:                   'pendiente_autorizacion',
      subscription_id:          monnetSubscriptionId,
      subscription_status:      ecsResponse?.status ?? 'PENDING',
      processor_code:           'Yape_on_file',
      deep_link:                deepLink,
      link_pago:                deepLink,
      chatwoot_account_id:      chatwoot_account_id ?? null,
      chatwoot_inbox_id:        chatwoot_inbox_id ?? null,
      chatwoot_conversation_id: chatwoot_conversation_id ?? null,
      payload_request:          { planKey, device: 'MOBILE', phoneNumber: phone, ecs_id: ecsSubscriptionId },
      payload_response:         ecsResponse,
    })
  } catch (e: any) {
    console.error('[generar-link-monnet] Error guardando en ecs_pagos_monnet:', e?.message)
    // No bloquear: la suscripción ya está creada en ECS
  }

  // 7b. Registrar el suscriptor en SuscriptoresBDwppECS (estado: pendiente)
  //     Al recibir el webhook de autorización/cobro se actualiza a 'activa'.
  try {
    const fullName = String(cliente_nombre || '').trim()
    const partes   = fullName.split(/\s+/)
    const nombre   = partes[0] || null
    const apellido = partes.length > 1 ? partes.slice(1).join(' ') : null

    await supabase.from('SuscriptoresBDwppECS').insert({
      numero:                 phone,
      nombre,
      apellido,
      dni:                    cliente_dni || null,
      email:                  cliente_email || null,
      plan_nombre:            planName || plan_nombre,
      plan_key:               planKey,
      monto:                  Number(monto) || 0,
      metodo_pago:            'Yape',
      ecs_subscription_id:    ecsSubscriptionId,
      monnet_subscription_id: monnetSubscriptionId,
      operation_number,
      estado:                 'pendiente',
    })
  } catch (e: any) {
    console.error('[generar-link-monnet] Error guardando en SuscriptoresBDwppECS:', e?.message)
  }

  // 8. Respuesta exitosa
  const output = {
    ok: true,
    link: deepLink,
    ecs_subscription_id:    ecsSubscriptionId,
    monnet_subscription_id: monnetSubscriptionId,
    plan_name:              planName,
    plan_key:               planKey,
    operation_number,
    monto: Number(monto) || 0,
    metodo_pago: 'Yape',
    message: `Link de pago generado:\n${deepLink}\n\nAbre el link en tu celular para autorizar el pago con Yape. Una vez autorizado, el cobro se procesa automáticamente.`,
    log_id: logId,
  }

  await updateLog('success', output)

  console.log(
    `[generar-link-monnet] ECS | ${operation_number} | plan=${planKey} | ecs_id=${ecsSubscriptionId} | sub=${monnetSubscriptionId} | ${cliente_nombre} ✅`,
  )

  return output
})
