// Healup audit log — escribe en healup_audit_log desde la UI.
// Si la tabla no existe (migración aún no aplicada), el error se suprime
// silenciosamente — nunca bloquea el flujo de la UI.

interface AuditEntry {
  entidad: 'cita' | 'paciente' | 'egreso' | 'pago' | 'comprobante' | 'walk_in'
  entidad_id?: string | number | null
  accion: 'create' | 'update' | 'soft_delete' | 'state_change'
  campo?: string
  valor_antes?: any
  valor_despues?: any
  notas?: string
}

export const useHealupAudit = () => {
  const supabase = useSupabaseClient()
  const sessionCookie = useCookie<any>('dashboard_session')

  const log = async (entry: AuditEntry) => {
    try {
      const session = sessionCookie.value || {}
      await (supabase.from('healup_audit_log') as any).insert({
        user_email:    session.email || null,
        user_role:     session.role  || null,
        entidad:       entry.entidad,
        entidad_id:    entry.entidad_id != null ? String(entry.entidad_id) : null,
        accion:        entry.accion,
        campo:         entry.campo || null,
        valor_antes:   entry.valor_antes ?? null,
        valor_despues: entry.valor_despues ?? null,
        notas:         entry.notas || null,
      })
    } catch (err) {
      console.warn('[HealupAudit] Error registrando log (no bloqueante):', err)
    }
  }

  return { log }
}
