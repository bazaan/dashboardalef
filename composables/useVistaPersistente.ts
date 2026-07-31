/**
 * Recuerda la última vista del dashboard entre recargas.
 * -----------------------------------------------------
 * Reemplaza a `const activeView = ref('dashboard')`: si el usuario recarga
 * (F5, se cae la conexión, cierra y vuelve), regresa a la sección donde
 * estaba en vez de mandarlo siempre al inicio.
 *
 *   const activeView = useVistaPersistente('gatwick')
 *
 * Cada dashboard guarda su propia vista, así que puedes estar en "Egresos"
 * en uno y en "Emergencias" en otro sin que se pisen.
 *
 * Detalles de implementación:
 * · La restauración va en onMounted (no en el setup) para no romper la
 *   hidratación de Nuxt: el servidor no tiene localStorage.
 * · Auto-reparación: si la vista guardada ya no existe (se renombró o se
 *   quitó del dashboard), el contenedor quedaría vacío. Se detecta y se
 *   vuelve al inicio, en vez de dejar al usuario mirando una pantalla en
 *   blanco sin saber por qué.
 */
import { ref, watch, onMounted, nextTick, type Ref } from 'vue'

export function useVistaPersistente(dashboard: string, porDefecto = 'dashboard'): Ref<string> {
  const clave = `alef:ultima-vista:${dashboard}`
  const vista = ref(porDefecto)

  onMounted(async () => {
    let guardada: string | null = null
    try {
      guardada = localStorage.getItem(clave)
    } catch { /* modo privado o storage bloqueado: se queda en el inicio */ }

    if (!guardada || guardada === vista.value) return
    vista.value = guardada

    // ¿La vista guardada sigue existiendo? Si no, el main queda sin contenido.
    await nextTick()
    const main = document.querySelector('.main-content')
    if (main && main.childElementCount === 0) {
      vista.value = porDefecto
      try { localStorage.removeItem(clave) } catch {}
    }
  })

  watch(vista, (v) => {
    try {
      if (v) localStorage.setItem(clave, v)
    } catch { /* si no se puede guardar, la app sigue funcionando igual */ }
  })

  return vista
}
