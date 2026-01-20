// middleware/auth-dashboard.ts
export default defineNuxtRouteMiddleware((to, from) => {
    // Leemos la cookie que creamos en el login
    const userSession = useCookie('dashboard_session');

    // Si no existe la cookie, mandamos al login
    if (!userSession.value) {
        return navigateTo('/');
    }
});