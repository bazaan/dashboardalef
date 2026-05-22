/**
 * POST /api/ecs/sincronizar-pendientes
 *
 * Consulta el sistema de ECS para detectar suscripciones que están en
 * estado 'pendiente' en nuestra BD pero que en realidad ya fueron
 * autorizadas / canceladas / etc. del lado de ECS. Actualiza nuestra BD
 * para que refleje el estado real.
 *
 * Razón: el flujo normal sincroniza vía webhook (cuando llega `webhook-compra`
 * desde ECS). Pero si ese webhook falla por cualquier razón (red, bug,
 * timeout) la suscripción queda huérfana en 'pendiente' para siempre.
 * Este endpoint es la red de seguridad: consulta a ECS y corrige.
 *
 * Lo llama automáticamente el dashboard cada vez que se carga la pestaña
 * de Suscripciones. También se puede llamar manualmente desde un botón.
 *
 * Mapeo de estados:
 *   ECS subscriptionStatus → SuscriptoresBDwppECS.estado
 *   AUTHORIZED → activa
 *   CANCELLED  → cancelada
 *   EXPIRED    → expirada
 *   FAILED     → fallida
 *   DENIED     → fallida
 *   PENDING    → (sin cambios, sigue pendiente)
 *   null       → (sin cambios, sigue pendiente)
 *
 * Response:
 * {
 *   ok: true,
 *   total_pendientes: 5,
 *   sincronizados: 3,
 *   intactos: 2,
 *   detalle: [...]
 * }
 */

import { serverSupabaseServiceRole } from '#supabase/server'

const ECS_API_BASE       = process.env.ECS_API_BASE_URL  || 'https://api.estasconsuerte.com.pe'
const ECS_ADMIN_EMAIL    = process.env.ECS_ADMIN_EMAIL   || ''
const ECS_ADMIN_PASSWORD = process.env.ECS_ADMIN_PASSWORD || ''

// Cache del token admin (TTL 6 días, el JWT dura 7)
let cachedAdminToken: { value: string; expiresAt: number } | null = null

async function getAdminToken(): Promise<string> {
  if (!ECS_ADMIN_EMAIL || !ECS_ADMIN_PASSWORD) {
    throw new Error('ECS_ADMIN_EMAIL/PASSWORD no configurados en .env')
  }
  const now = Date.now()
  if (cachedAdminToken && cachedAdminToken.expiresAt > now) {
    return cachedAdminToken.value
  }
  const res: any = await $fetch(`${ECS_API_BASE}/auth/login`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    { email: ECS_ADMIN_EMAIL, password: ECS_ADMIN_PASSWORD },
  })
  const token = res?.token || res?.access_token || res?.accessToken
  if (!token) throw new Error('Login admin no devolvió token')
  cachedAdminToken = { value: token, expiresAt: now + 6 * 24 * 60 * 60 * 1000 }
  return token
}

/** Mapea status de ECS → estado interno nuestro (o null si no hay que actualizar) */
function mapearEstado(status: string | null | undefined): string | null {
  if (!status) return null
  switch (status.toUpperCase()) {
    case 'AUTHORIZED': return 'activa'
    case 'CANCELLED':  return 'cancelada'
    case 'EXPIRED':    return 'expirada'
    case 'FAILED':     return 'fallida'
    case 'DENIED':     return 'fallida'
    default:           return null
  }
}

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)

  // 1. Cargar pendientes de nuestra BD
  const { data: pendientes, error: fetchErr } = await supabase
    .from('SuscriptoresBDwppECS')
    .select('id, email, dni, numero, operation_number, plan_nombre, created_at')
    .eq('estado', 'pendiente')

  if (fetchErr) {
    throw createError({ statusCode: 500, statusMessage: `Error cargando pendientes: ${fetchErr.message}` })
  }

  if (!pendientes || pendientes.length === 0) {
    return { ok: true, message: 'No hay suscriptores pendientes', total_pendientes: 0, sincronizados: 0 }
  }

  // 2. Login admin en ECS
  let token: string
  try {
    token = await getAdminToken()
  } catch (e: any) {
    throw createError({ statusCode: 502, statusMessage: `Error login ECS: ${e?.message}` })
  }

  // 3. GET /admin/users (con reintento si token expiró)
  let users: any[] = []
  try {
    const res: any = await $fetch(`${ECS_API_BASE}/admin/users`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    users = res?.users || []
  } catch (err: any) {
    if (err?.statusCode === 401 || err?.response?.status === 401) {
      cachedAdminToken = null
      token = await getAdminToken()
      const res: any = await $fetch(`${ECS_API_BASE}/admin/users`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      users = res?.users || []
    } else {
      throw createError({
        statusCode: 502,
        statusMessage: `Error consultando /admin/users: ${err?.message}`,
      })
    }
  }

  // Indexar por email y DNI para lookup rápido
  const userByEmail = new Map<string, any>()
  const userByDni   = new Map<string, any>()
  for (const u of users) {
    if (u.email)          userByEmail.set(String(u.email).toLowerCase(), u)
    if (u.documentNumber) userByDni.set(String(u.documentNumber), u)
  }

  // 4. Por cada pendiente, buscar match y actualizar
  let sincronizados = 0
  let intactos      = 0
  const detalle: any[] = []

  for (const p of pendientes) {
    const user =
      (p.email ? userByEmail.get(String(p.email).toLowerCase()) : null) ||
      (p.dni   ? userByDni.get(String(p.dni)) : null)

    if (!user) {
      intactos++
      detalle.push({ id: p.id, email: p.email, accion: 'sin_match' })
      continue
    }

    const nuevoEstado = mapearEstado(user.subscriptionStatus)
    if (!nuevoEstado) {
      intactos++
      detalle.push({ id: p.id, email: p.email, ecs_status: user.subscriptionStatus, accion: 'sin_cambio' })
      continue
    }

    const ahora   = new Date()
    const update: Record<string, any> = {
      estado:              nuevoEstado,
      subscription_status: user.subscriptionStatus,
    }

    if (nuevoEstado === 'activa') {
      update.fecha_suscripcion      = ahora.toISOString()
      update.fecha_proxima_cobranza = new Date(ahora.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()
    } else if (nuevoEstado === 'cancelada') {
      update.fecha_cancelacion = ahora.toISOString()
    }

    await supabase.from('SuscriptoresBDwppECS').update(update).eq('id', p.id)

    // Actualizar ecs_pagos_monnet en paralelo
    if (p.operation_number) {
      const pagoUpdate: Record<string, any> = { subscription_status: user.subscriptionStatus }
      if (nuevoEstado === 'activa') {
        pagoUpdate.estado  = 'pagado'
        pagoUpdate.paid_at = ahora.toISOString()
      } else if (nuevoEstado === 'cancelada') {
        pagoUpdate.estado = 'cancelado'
      } else if (nuevoEstado === 'fallida') {
        pagoUpdate.estado = 'fallido'
      } else if (nuevoEstado === 'expirada') {
        pagoUpdate.estado = 'expirado'
      }
      await supabase.from('ecs_pagos_monnet').update(pagoUpdate).eq('operation_number', p.operation_number)
    }

    sincronizados++
    detalle.push({
      id: p.id,
      email: p.email,
      ecs_status: user.subscriptionStatus,
      accion: `actualizado a ${nuevoEstado}`,
    })
  }

  console.log(`[sincronizar-pendientes] ${sincronizados}/${pendientes.length} actualizados`)

  return {
    ok: true,
    total_pendientes: pendientes.length,
    sincronizados,
    intactos,
    detalle,
    message: `Sincronizados ${sincronizados} de ${pendientes.length} pendientes`,
  }
})
