/**
 * POST /api/healup/cita-multiple  (WhatsApp)
 *
 * Tool "Cita Múltiple" de WhatsApp: agenda hasta 4 pacientes, cada uno INDEPENDIENTE
 * (su propio horario, cabina y tratamiento). Cada paciente obtiene su propio evento
 * en Google Calendar y en healup_calendar_events (a su hora/día/cabina), y su propia
 * fila en PacientesBDwppHEALUP. Lógica en server/utils/healup-cita-multiple.ts.
 *
 * Body: { pacienteN_nombre_completo, pacienteN_DNI, pacienteN_celular,
 *         pacienteN_tratamiento, pacienteN_tipo_cabina, pacienteN_inicio_cita,
 *         pacienteN_fin_cita  (N=1..4),  ID, red_social,  api_key }
 */
import { procesarCitaMultiple } from '~/server/utils/healup-cita-multiple'

export default defineEventHandler((event) => procesarCitaMultiple(event, {
  apiKey:         'healup-cita-multiple-2026',
  toolName:       'Cita Multiple',
  pacientesTable: 'PacientesBDwppHEALUP',
  canal:          'whatsapp',
}))
