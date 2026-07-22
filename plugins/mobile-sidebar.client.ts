/**
 * Plugin que añade soporte para sidebar móvil sin tocar las 11 vistas.
 *
 * En móvil (≤768px):
 *   - Oculta la sidebar (la convierte en overlay deslizable desde la izquierda)
 *   - Inyecta un botón hamburguesa fijo (top-left) en cada dashboard
 *   - Al tocarlo, abre/cierra la sidebar con un overlay oscuro
 *   - Cierra automáticamente la sidebar al tocar un nav-item (mejor UX)
 *
 * En desktop (>768px): no hace nada, la sidebar se ve como siempre.
 */

export default defineNuxtPlugin(() => {
  if (typeof window === 'undefined') return

  const MOBILE_BREAKPOINT = 768

  // Helpers
  const isMobile = () => window.innerWidth <= MOBILE_BREAKPOINT

  let hamburgerBtn: HTMLButtonElement | null = null
  let overlay: HTMLDivElement | null = null

  function ensureHamburger() {
    if (hamburgerBtn) return

    // Botón hamburguesa
    hamburgerBtn = document.createElement('button')
    hamburgerBtn.id = 'mobile-menu-toggle'
    hamburgerBtn.setAttribute('aria-label', 'Abrir menú')
    hamburgerBtn.innerHTML = `
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="3" y1="6" x2="21" y2="6"></line>
        <line x1="3" y1="12" x2="21" y2="12"></line>
        <line x1="3" y1="18" x2="21" y2="18"></line>
      </svg>
    `
    document.body.appendChild(hamburgerBtn)

    // Overlay para cerrar tocando fuera
    overlay = document.createElement('div')
    overlay.id = 'mobile-sidebar-overlay'
    document.body.appendChild(overlay)

    // Toggle handlers
    hamburgerBtn.addEventListener('click', toggleSidebar)
    overlay.addEventListener('click', closeSidebar)
  }

  /** Quita lo inyectado: fuera de un dashboard no hay sidebar que abrir. */
  function removeHamburger() {
    if (!hamburgerBtn && !overlay) return
    closeSidebar()
    hamburgerBtn?.remove()
    overlay?.remove()
    hamburgerBtn = null
    overlay = null
  }

  /**
   * Se ejecuta en cada cambio del DOM. Antes solo se inyectaba y nunca se
   * limpiaba, así que al salir de un dashboard el botón y el overlay se
   * quedaban flotando sobre el login y el admin hub.
   */
  function syncMobileChrome() {
    if (document.querySelector('.dashboard-container')) ensureHamburger()
    else removeHamburger()
  }

  function toggleSidebar() {
    document.body.classList.toggle('mobile-sidebar-open')
  }

  function closeSidebar() {
    document.body.classList.remove('mobile-sidebar-open')
  }

  // Listeners globales: se registran una sola vez, no por cada inyección
  document.addEventListener('click', (e) => {
    if (!isMobile()) return
    const target = e.target as HTMLElement
    if (target.closest('.nav-item, .footer-item')) {
      // Pequeño delay para que el click navegue antes de cerrar
      setTimeout(closeSidebar, 100)
    }
  })

  window.addEventListener('resize', () => {
    if (!isMobile()) closeSidebar()
  })

  // Sincronizar al cargar y en cambios de ruta
  const observer = new MutationObserver(() => syncMobileChrome())
  observer.observe(document.body, { childList: true, subtree: true })

  // Setup inicial
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', syncMobileChrome)
  } else {
    syncMobileChrome()
  }
})
