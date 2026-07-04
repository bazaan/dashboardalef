/**
 * POST /api/healup/cita-multiple-tiktok  (TikTok)
 *
 * Versión TikTok de "Cita Múltiple": hasta 4 pacientes independientes. Igual que la de
 * WhatsApp pero apunta a PacientesBDtiktokHEALUP (red_social = "Tiktok").
 * Lógica en server/utils/healup-cita-multiple.ts.
 *
 * Body: { pacienteN_nombre_completo, pacienteN_DNI, pacienteN_celular,
 *         pacienteN_tratamiento, pacienteN_tipo_cabina, pacienteN_inicio_cita,
 *         pacienteN_fin_cita  (N=1..4),  ID, red_social,  api_key }
 */
import { procesarCitaMultiple } from '~/server/utils/healup-cita-multiple'

export default defineEventHandler((event) => procesarCitaMultiple(event, {
  apiKey:         'healup-cita-multiple-tiktok-2026',
  toolName:       'Cita Multiple TikTok',
  pacientesTable: 'PacientesBDtiktokHEALUP',
  canal:          'tiktok',
}))
