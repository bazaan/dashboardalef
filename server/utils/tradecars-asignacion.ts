/**
 * Trade Cars — asignación automática de asesor a las tarjetas de Solicitudes - formularios
 * (Web + IG + FB + TikTok + Sin plataforma) (29/09/2026).
 *
 * Lo comparten server/utils/tradecars-formularios.ts (tarjetas de Google Sheets) y
 * server/api/tradecars/formulario.ts + solicitudes.*.ts (Formularios web) — es la MISMA regla
 * en los dos lados, para que un cliente que ya escribió por Chatwoot y ahora llena el
 * formulario web (o viceversa) caiga con el mismo asesor.
 *
 * Regla (pedida explícitamente por el cliente):
 *   1. Buscar el teléfono en tradecars_leads_chatwoot. Si ya tuvo un asesor asignado antes
 *      (misma continuidad que usa el flujo de n8n de asignación de Chatwoot), usar ESE.
 *   2. Si no hay coincidencia, repartir por ROUND ROBIN entre los asesores activos de
 *      tradecars_asesores — vía la función SQL `tc_siguiente_asesor_formulario()`, que
 *      incrementa el contador de forma atómica (dos tarjetas nuevas al mismo tiempo nunca
 *      reciben el mismo asesor).
 */

/** Deja solo dígitos y quita el prefijo 51 (Perú) si el número quedó de 11 dígitos. */
export function normalizarTelefonoAsesor(valor: string | null | undefined): string {
  let digitos = String(valor ?? '').replace(/[^\d]/g, '')
  if (digitos.length === 11 && digitos.startsWith('51')) digitos = digitos.slice(2)
  return digitos
}

export interface AsesorAsignado {
  asesor_nombre: string
  asesor_email: string
}

/**
 * Resuelve a qué asesor le toca un lead nuevo, según su teléfono. Nunca lanza: si algo falla
 * (tabla faltante, RPC no configurada, etc.) devuelve null y quien llama decide qué hacer —
 * una tarjeta sin asesor asignado no debe romper la pantalla.
 */
export async function resolverAsesorParaTelefono(supabase: any, telefonoCrudo: string | null | undefined): Promise<AsesorAsignado | null> {
  const telefono = normalizarTelefonoAsesor(telefonoCrudo)

  if (telefono) {
    try {
      const { data: previo } = await supabase
        .from('tradecars_leads_chatwoot')
        .select('asesor_asignado')
        .eq('telefono', telefono)
        .not('asesor_asignado', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (previo?.asesor_asignado) {
        const { data: asesor } = await supabase
          .from('tradecars_asesores')
          .select('nombre, email')
          .ilike('nombre', previo.asesor_asignado)
          .eq('activo', true)
          .maybeSingle()
        if (asesor?.email) return { asesor_nombre: asesor.nombre, asesor_email: asesor.email }
      }
    } catch {
      // sigue al round robin
    }
  }

  try {
    const { data } = await supabase.rpc('tc_siguiente_asesor_formulario')
    const fila = Array.isArray(data) ? data[0] : data
    if (fila?.asesor_email) return { asesor_nombre: fila.asesor_nombre, asesor_email: fila.asesor_email }
  } catch {
    // sin asesores configurados o falta la migración — se deja sin asignar
  }

  return null
}

/**
 * Si la sesión pertenece a uno de los asesores de tradecars_asesores (Rodrigo Paredes, Jose
 * Flores, Brado Alvarado, Gino Hurtado), devuelve su fila. Si no, devuelve null — quien llama
 * decide qué hacer (ver `resolverRestriccionAsesor`, que es lo que hay que usar para filtrar
 * pantallas: acá abajo un null NO significa "sin filtro", solo "no matcheó").
 */
export async function obtenerAsesorDeSesion(supabase: any, email: string): Promise<AsesorAsignado | null> {
  if (!email) return null
  try {
    const { data } = await supabase
      .from('tradecars_asesores')
      .select('nombre, email')
      .ilike('email', email)
      .eq('activo', true)
      .maybeSingle()
    if (data?.email) return { asesor_nombre: data.nombre, asesor_email: data.email }
  } catch {
    // tabla faltante u otro error: se trata igual que "no matcheó"
  }
  return null
}

export interface RestriccionAsesor {
  /** false = admin/superadmin de Trade Cars — no hay que filtrar nada. */
  restringir: boolean
  /**
   * Con `restringir=true`: el email del asesor al que hay que limitar la vista, o `null` si la
   * sesión (un "agente" que no es admin) no está registrada en `tradecars_asesores` todavía —
   * en ese caso NO debe ver ni tocar ninguna tarjeta (default-deny), no "verlas todas". Antes
   * (hasta el 29/09/2026) un no-admin sin fila en tradecars_asesores veía todo — pensado para
   * Luis Cossa (Jefe de Compras) — pero eso mismo dejaba a una cuenta de "agente" recién creada
   * (que tampoco tiene fila todavía) viendo TODAS las tarjetas de TODOS los asesores, que es
   * justo lo que se pidió evitar: "los que tienen rango de agente SOLAMENTE pueden ver... las
   * que se les haya asignado a ELLOS". Alguien como Luis Cossa que necesite ver todo sin ser
   * asesor de round robin tiene que entrar como admin del módulo, no vía este atajo.
   */
  asesorEmail: string | null
  asesorNombre: string | null
}

/** Perfil mínimo que necesita `resolverRestriccionAsesor` (evita importar el tipo completo de tradecars.ts). */
export interface PerfilParaRestriccion { email: string; esAdmin: boolean }

export async function resolverRestriccionAsesor(perfil: PerfilParaRestriccion, supabase: any): Promise<RestriccionAsesor> {
  if (perfil.esAdmin) return { restringir: false, asesorEmail: null, asesorNombre: null }
  const asesor = await obtenerAsesorDeSesion(supabase, perfil.email)
  return { restringir: true, asesorEmail: asesor?.asesor_email ?? null, asesorNombre: asesor?.asesor_nombre ?? null }
}
