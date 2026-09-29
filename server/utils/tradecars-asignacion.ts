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
 * Flores, Brado Alvarado, Gino Hurtado), devuelve su fila — hay que filtrarle las tarjetas a
 * solo las suyas. Si no (admin/superadmin, o alguien que no está en esa tabla — ej. Luis Cossa,
 * que es Jefe de Compras y no un asesor de round robin), devuelve null y NO se filtra nada: es
 * el mismo comportamiento que ya tenían antes de esta función.
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
    // tabla faltante u otro error: no se filtra nada
  }
  return null
}
