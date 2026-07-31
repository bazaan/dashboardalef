/**
 * Opciones de la cookie de sesión del dashboard.
 * ----------------------------------------------
 * Antes `useCookie('dashboard_session')` se creaba sin maxAge, así que era una
 * cookie de SESIÓN: al cerrar el navegador se borraba y había que volver a
 * loguearse. Con maxAge la sesión sobrevive al cierre del navegador y el
 * usuario entra directo con su última cuenta.
 *
 * Importante (seguridad): acá NO se guarda la contraseña, solo el perfil que
 * ya se guardaba antes (id, email, nombre, rol, company_id). El servidor sigue
 * re-verificando el rol real contra `dashboardlogin` en cada endpoint sensible,
 * así que alargar la cookie no da permisos extra a nadie.
 *
 * Cerrar sesión sigue borrándola al instante (logout pone la cookie en null).
 */
export const SESSION_COOKIE = 'dashboard_session'

/** 30 días: si no entras en un mes, se vuelve a pedir login. */
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30

export function sessionCookieOptions() {
  return {
    maxAge: SESSION_MAX_AGE,
    path: '/',
    sameSite: 'lax' as const,
    // En local (http) `secure` impediría guardarla; en producción va con https.
    secure: !import.meta.dev,
  }
}
