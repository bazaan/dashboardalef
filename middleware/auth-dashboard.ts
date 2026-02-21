// middleware/auth-dashboard.ts
import { isSuperAdmin, getDashboardPathByCompanyId } from '@/utils/permissions';

interface UserSession {
    email?: string;
    role?: string;
    company_id?: string;
    [key: string]: any;
}

export default defineNuxtRouteMiddleware((to, from) => {
    // Leemos la cookie que creamos en el login
    const userSession = useCookie<UserSession>('dashboard_session');

    // Si no existe la cookie, mandamos al login
    if (!userSession.value) {
        return navigateTo('/');
    }

    const role = userSession.value.role?.toLowerCase() || '';
    const companyId = userSession.value.company_id || '';
    const isSuper = role === 'superadmin' || isSuperAdmin(userSession.value);

    // 1. PROTECCION DE ADMIN HUB
    if (to.path === '/admin-hub') {
        if (!isSuper) {
            console.warn("Acceso denegado a Admin Hub. Redirigiendo...");
            // Intentar redirigir a su dashboard correspondiente
            if (companyId) {
                const targetPath = getDashboardPathByCompanyId(companyId);
                if (targetPath && targetPath !== '/') {
                    return navigateTo(targetPath);
                }
            }
            return navigateTo('/');
        }
        return; // Superadmin puede entrar
    }

    // 2. PROTECCION DE RUTAS DE EMPRESA (Dashboard Company Pages)
    // Si no es superadmin, verificar que intente entrar a SU dashboard
    if (!isSuper) {
        const targetPath = getDashboardPathByCompanyId(companyId);

        // Si el usuario tiene un dashboard asignado
        if (targetPath && targetPath !== '/') {
            // Verificamos si la ruta a la que va empieza con la ruta de su dashboard
            // Ejemplo: va a /pruebas/Healup... y su target es /pruebas/Healup
            if (!to.path.startsWith(targetPath)) {
                console.warn(`Redireccionando usuario ${role} de ${to.path} a ${targetPath}`);
                return navigateTo(targetPath);
            }
        } else {
            // Usuario sin dashboard asignado (o company_id invalido)
            console.warn("Usuario sin dashboard asignado intentando navegar.");
            return navigateTo('/');
        }
    }
});
