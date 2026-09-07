/**
 * GET /api/piola/ruc?ruc=20512345678 — autocompletar la ficha del cliente
 *
 * Va por el servidor y no desde el navegador por dos razones:
 *   • el token del proveedor no puede viajar al cliente
 *   • los proveedores de consulta RUC no mandan CORS, así que un fetch desde
 *     la pantalla fallaría igual
 *
 * Devuelve 200 aunque no encuentre nada: "no está en el padrón" es una
 * respuesta, no un error del sistema. La pantalla muestra el aviso y deja
 * escribir los datos a mano.
 */
import { serverSupabaseServiceRole } from '#supabase/server'
import { verificarSesionPiola, exigirAlguno } from '../../utils/piola'
import { consultarRuc } from '../../utils/piola-ruc'

export default defineEventHandler(async (event) => {
  const supabase = serverSupabaseServiceRole(event)
  const perfil = await verificarSesionPiola(event, supabase)
  // Lo consultan quienes dan de alta clientes o emiten comprobantes
  exigirAlguno(perfil, ['clientes', 'crm', 'facturacion'], 'view')

  const ruc = String(getQuery(event)?.ruc || '').trim()
  if (!ruc) throw createError({ statusCode: 400, statusMessage: 'Falta el RUC a consultar' })

  return await consultarRuc(ruc)
})
