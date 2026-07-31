/**
 * Recuerda cualquier valor de UI entre recargas (pestañas, filtros, etc.).
 * ------------------------------------------------------------------------
 * Hermano de useVistaPersistente, pero genérico: sirve para la pestaña
 * interna de una tabla, un filtro de estado, un mes seleccionado…
 *
 *   const dashTab = usePersistente('sgs:dashTab', 'recientes')
 *   const filtroEmerg = usePersistente('gatwick:filtroEmerg', 'todas')
 *
 * La clave lleva el prefijo del dashboard para que dos empresas no se pisen.
 *
 * Como en useVistaPersistente, la restauración va en onMounted: el servidor
 * no tiene localStorage y leerlo en el setup rompería la hidratación.
 */
import { ref, watch, onMounted, type Ref } from 'vue'

export function usePersistente<T>(clave: string, porDefecto: T): Ref<T> {
  const storageKey = `alef:ui:${clave}`
  const valor = ref(porDefecto) as Ref<T>

  onMounted(() => {
    try {
      const crudo = localStorage.getItem(storageKey)
      if (crudo === null) return
      const guardado = JSON.parse(crudo)
      // Solo se restaura si el tipo coincide con el valor por defecto: si el
      // día de mañana un filtro pasa de string a array, el dato viejo se
      // ignora en vez de romper la vista.
      if (typeof guardado === typeof porDefecto) valor.value = guardado as T
    } catch { /* storage bloqueado o JSON corrupto: se queda el default */ }
  })

  watch(valor, (v) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(v))
    } catch { /* sin storage la app sigue funcionando igual */ }
  }, { deep: true })

  return valor
}
