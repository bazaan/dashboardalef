/**
 * Helpers compartidos de Trade Cars — sesión, configuración del Tasador y
 * registro de cambios.
 *
 * La configuración que se lee y escribe acá es la MISMA que consume el Agente
 * Tasador de WhatsApp en n8n (workflow "TRADECARS | WHATSAPP | Agente Tasador",
 * vía su tool `obtener_configuracion`). No hay una copia paralela: lo que un
 * supervisor cambia desde el dashboard entra en la siguiente tasación, sin
 * redeploy y sin tocar el prompt.
 */

import type { H3Event } from 'h3'
import type { TradeCarsModule } from '../../utils/permissions'

export type SesionTradeCars = {
  email: string
  role: string
  company_id: string
  esSuperadmin: boolean
}

/** Parámetros que el Tasador lee en cada tasación, ya resueltos a número. */
export type ConfigTasador = {
  parametros: Record<string, number>
  parametros_detalle: any[]
  reglas: any[]
  alta_rotacion: any[]
}

/**
 * Verifica la cookie de sesión y que la persona pertenezca a Trade Cars.
 * Mismo criterio que el resto de endpoints de la empresa: superadmin de Alef
 * entra siempre; el resto tiene que tener company_id de Trade Cars.
 */
export function verificarSesionTradeCars(event: H3Event): SesionTradeCars {
  const cookies = parseCookies(event)
  const raw = cookies.dashboard_session
  if (!raw) throw createError({ statusCode: 401, statusMessage: 'No autenticado' })

  let session: any
  try {
    session = JSON.parse(decodeURIComponent(raw))
  } catch {
    throw createError({ statusCode: 401, statusMessage: 'Sesión inválida' })
  }
  if (!session?.email) throw createError({ statusCode: 401, statusMessage: 'Sesión sin email' })

  const role = String(session.role || '').toLowerCase()
  const esSuperadmin = role === 'superadmin'
  const companyId = String(session.company_id || '').toLowerCase().replace(/\s+/g, '')

  if (!esSuperadmin && !companyId.includes('tradecars')) {
    throw createError({ statusCode: 403, statusMessage: 'Sin acceso a Trade Cars' })
  }

  return { email: String(session.email), role, company_id: companyId, esSuperadmin }
}

/**
 * Solo administración puede enseñarle al Tasador. Un asesor puede conversar con
 * él y consultarle datos, pero no cambiar los números con los que la empresa
 * decide cuánto paga por un auto.
 */
export function puedeEditarTasador(sesion: SesionTradeCars): boolean {
  return sesion.esSuperadmin || sesion.role === 'admin'
}

/* ══════════════════ Roles y permisos por módulo (14/09/2026) ══════════════════ */

/**
 * Mismo diseño que verificarSesionPiola() en server/utils/piola.ts: un rol
 * "Administrador" con acceso total (es_admin, ignora el checklist) y roles
 * editables con un permiso ver/crear/editar/eliminar por módulo, resueltos
 * contra `tradecars_colaboradores` + `tradecars_role_permissions`.
 *
 * A diferencia de `verificarSesionTradeCars()` (arriba, sólo lee la cookie),
 * esto SÍ vuelve a consultar `dashboardlogin` — hace falta el registro real
 * para saber si superadmin/admin, y de ahí resolver el rol de Trade Cars.
 */
export interface PerfilTradeCars {
  email: string
  rolGlobal: string
  /** Ficha en tradecars_colaboradores (null si todavía no la crearon) */
  colaborador: any | null
  /** Nombre del rol de Trade Cars (ej. 'Jefe de Compras') */
  rolTradeCars: string | null
  /** true = acceso total, ignora el checklist de módulos */
  esAdmin: boolean
  /** { modulo: {can_view, can_create, can_edit, can_delete}, __admin: bool } */
  permisos: Record<string, any>
}

export async function resolverPerfilTradeCars(event: H3Event, supabase: any): Promise<PerfilTradeCars> {
  const cookies = parseCookies(event)
  const raw = cookies.dashboard_session
  if (!raw) throw createError({ statusCode: 401, statusMessage: 'No autenticado' })

  let session: any
  try {
    session = JSON.parse(decodeURIComponent(raw))
  } catch {
    throw createError({ statusCode: 401, statusMessage: 'Sesión inválida' })
  }
  if (!session?.email) throw createError({ statusCode: 401, statusMessage: 'Sesión sin email' })

  const { data: perfil } = await supabase
    .from('dashboardlogin').select('email, role, company_id').eq('email', session.email).single()
  if (!perfil) throw createError({ statusCode: 403, statusMessage: 'Perfil no encontrado' })

  const rolGlobal = String(perfil.role ?? '').toLowerCase()
  const cid = String(perfil.company_id ?? '').toLowerCase().replace(/\s+/g, '')
  const esSuper = rolGlobal === 'superadmin'
  if (!esSuper && !cid.includes('tradecars')) {
    throw createError({ statusCode: 403, statusMessage: 'Sin acceso a Trade Cars' })
  }

  const { data: colaborador, error: errorColaborador } = await supabase
    .from('tradecars_colaboradores')
    .select('*, rol:tradecars_roles(id, nombre, es_admin)')
    .ilike('email', perfil.email)
    .maybeSingle()

  // Si `sql/tradecars_roles.sql` todavía no se corrió, esta consulta falla
  // (la tabla no existe) — Supabase no tira excepción, devuelve `error` en la
  // respuesta. NO hay que tratar eso como "sin permisos": Trade Cars ya tiene
  // gente trabajando hoy con el menú completo, y una migración pendiente no
  // puede dejarlos de golpe sin ver Funnel/Operaciones/Tasador. Mientras el
  // sistema de roles no esté configurado, todos entran como Administrador
  // (igual que siempre estuvo, sin roles).
  const sistemaDeRolesConfigurado = !errorColaborador

  // Superadmin de Alef y admin sin ficha entran como Administrador de Trade Cars
  // — mismo criterio que Piola, para que una cuenta recién creada no se quede
  // sin ver nada hasta que alguien la dé de alta como colaborador.
  const esAdmin = esSuper
    || !sistemaDeRolesConfigurado
    || colaborador?.rol?.es_admin === true
    || (!colaborador && rolGlobal === 'admin')

  const permisos: Record<string, any> = { __admin: esAdmin }
  if (!esAdmin && colaborador?.role_id) {
    const { data: filas } = await supabase
      .from('tradecars_role_permissions')
      .select('module, can_view, can_create, can_edit, can_delete')
      .eq('role_id', colaborador.role_id)
    for (const f of filas || []) permisos[f.module] = f
  }
  // Todo colaborador ve el home, tenga o no rol asignado.
  if (!permisos.home) {
    permisos.home = { module: 'home', can_view: true, can_create: false, can_edit: false, can_delete: false }
  }

  return {
    email: perfil.email,
    rolGlobal,
    colaborador: colaborador || null,
    rolTradeCars: colaborador?.rol?.nombre || (esAdmin ? 'Administrador' : null),
    esAdmin,
    permisos,
  }
}

/** Lanza 403 si el perfil no puede realizar `accion` sobre `modulo`. */
export function exigirModuloTradeCars(
  perfil: PerfilTradeCars,
  modulo: TradeCarsModule,
  accion: 'view' | 'create' | 'edit' | 'delete' = 'view',
): void {
  if (perfil.esAdmin) return
  const p = perfil.permisos[modulo]
  if (!p || p[`can_${accion}`] !== true) {
    throw createError({ statusCode: 403, statusMessage: `Sin permiso de ${accion} en el módulo ${modulo}` })
  }
}

/** Gestionar roles y colaboradores de Trade Cars: SOLO Administrador. */
export function exigirAdminTradeCars(perfil: PerfilTradeCars, que = 'esta operación'): void {
  if (!perfil.esAdmin) {
    throw createError({ statusCode: 403, statusMessage: `Solo un Administrador puede acceder a ${que}` })
  }
}

// Las columnas de trazabilidad y de rango las agrega sql/tradecars_tasador_config.sql.
// Mientras esa migración no se haya corrido, las tablas existen pero sin ellas, y
// pedirlas devuelve 400. Se reintenta con el set mínimo para que el módulo abra
// igual y la UI pueda avisar que falta correr la migración.
const COLUMNAS_PARAM_COMPLETAS = 'clave,valor,unidad,categoria,descripcion,minimo,maximo,activa,actualizado_en,actualizado_por'
const COLUMNAS_PARAM_MINIMAS = 'clave,valor,unidad,categoria,descripcion,activa'

/** Lee la configuración vigente del Tasador desde las 3 tablas de config. */
export async function leerConfigTasador(supabase: any): Promise<ConfigTasador> {
  const consultarParametros = async (columnas: string) =>
    supabase.from('tradecars_config_parametros_tasador')
      .select(columnas)
      .eq('activa', true)
      .order('categoria', { ascending: true })
      .order('clave', { ascending: true })

  const [params, reglas, rotacion] = await Promise.all([
    consultarParametros(COLUMNAS_PARAM_COMPLETAS)
      .then((r: any) => (r.error ? consultarParametros(COLUMNAS_PARAM_MINIMAS) : r)),
    supabase.from('tradecars_config_reglas_marca_modelo')
      .select('id,marca,modelo,gnv_glp,anio_min,anio_max,tipo_ajuste,valor_ajuste,flag,descripcion,prioridad,activa')
      .eq('activa', true)
      .order('prioridad', { ascending: true }),
    supabase.from('tradecars_config_modelos_alta_rotacion')
      .select('id,marca,modelo,motivo,activa')
      .eq('activa', true)
      .order('marca', { ascending: true }),
  ])

  const detalle: any[] = (params as any).data || []
  const plano: Record<string, number> = {}
  for (const p of detalle) plano[p.clave] = Number(p.valor)

  return {
    parametros: plano,
    parametros_detalle: detalle,
    reglas: reglas.data || [],
    alta_rotacion: rotacion.data || [],
  }
}

/**
 * Deja constancia de todo lo que se toca en la configuración del Tasador.
 * Es la tabla que el dashboard muestra como "Historial de cambios" y la que
 * lista las solicitudes que quedaron pendientes de que Alef las implemente.
 */
export async function registrarCambio(supabase: any, fila: {
  tipo: string
  accion: string
  objetivo?: string | null
  valor_anterior?: any
  valor_nuevo?: any
  resumen: string
  motivo?: string | null
  estado?: string
  origen?: string
  solicitado_por?: string | null
}) {
  const { data, error } = await supabase.from('tradecars_tasador_cambios').insert({
    tipo: fila.tipo,
    accion: fila.accion,
    objetivo: fila.objetivo ?? null,
    valor_anterior: fila.valor_anterior ?? null,
    valor_nuevo: fila.valor_nuevo ?? null,
    resumen: fila.resumen,
    motivo: fila.motivo ?? null,
    estado: fila.estado ?? 'aplicado',
    origen: fila.origen ?? 'chat_tasador',
    solicitado_por: fila.solicitado_por ?? null,
  }).select().single()

  if (error) throw createError({ statusCode: 500, statusMessage: `No se pudo registrar el cambio: ${error.message}` })
  return data
}

/**
 * Log en agent_tool_logs — es lo que alimenta el panel "Dev · Agent Logs" del
 * dashboard interno de Alef. Nunca debe tumbar la operación que lo invoca.
 */
export async function logTasador(
  supabase: any,
  toolName: string,
  input: any,
  output: any,
  status: 'success' | 'error' | 'partial' = 'success',
  errorMessage?: string,
) {
  try {
    await supabase.from('agent_tool_logs').insert({
      company_id: 'tradecars',
      tool_name: toolName,
      input_data: input ?? null,
      output_data: output ?? null,
      status,
      error_message: errorMessage ?? null,
    })
  } catch {
    /* el log es observabilidad, no parte del flujo */
  }
}
