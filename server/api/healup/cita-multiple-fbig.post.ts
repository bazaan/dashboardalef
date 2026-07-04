/**
 * POST /api/healup/cita-multiple-fbig  (Instagram / Facebook)
 *
 * Versión IG/FB de "Cita Múltiple": hasta 4 pacientes independientes. Igual que la de
 * WhatsApp pero apunta a PacientesBDfbigHEALUP y agrega los extras del canal:
 * marca pasar_supervisor, append de 1 fila por paciente en Google Sheets "citas_healup"
 * y aviso a la supervisora (LUCIA). Lógica en server/utils/healup-cita-multiple.ts.
 *
 * Body: { pacienteN_nombre_completo, pacienteN_DNI, pacienteN_celular,
 *         pacienteN_tratamiento, pacienteN_tipo_cabina, pacienteN_inicio_cita,
 *         pacienteN_fin_cita  (N=1..4),  ID, red_social,  api_key }
 */
import { procesarCitaMultiple } from '~/server/utils/healup-cita-multiple'

export default defineEventHandler((event) => procesarCitaMultiple(event, {
  apiKey:         'healup-cita-multiple-fbig-2026',
  toolName:       'Cita Multiple FB/IG',
  pacientesTable: 'PacientesBDfbigHEALUP',
  canal:          'fbig',
}))
