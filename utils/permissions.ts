// Listas de usuarios por rol
export const superAdmins = [
    'aipartnerstudio@gmail.com',
    'jbazan@alef.company',
    'bazanjuanpa@gmail.com',
    'marcelozumaeta31@gmail.com',
    'pbelmontesoto@gmail.com',
    'robertocaceresrivas@hotmail.com',
    'elroby75@hotmail.com'
]

export const healupUsers = [
    'healupaestheticlab@gmail.com',
    'laguilar@headhuntinglab.com'
]

export const bradaUsers = [
    'maquiav288@gmail.com',
    'bradaperfumes@gmail.com',
    'danmp1219@gmail.com'
]

// Definición de Dashboards
export const dashboards = [
    { name: 'Healup', path: '/pruebas/Healup', icon: 'mdi-medical-bag', logo: 'healupLOGO.png' },
    { name: 'Brada Perfumes', path: '/pruebas/BradaPerfumes', icon: 'mdi-bottle-tonic', logo: 'bradalogo.jpg' },
    { name: 'Alef Company', path: '/pruebas/AlefCompany', icon: 'mdi-domain', logo: 'aleflogo oscuro.png' }
]

// Helpers de Verificación
function normalize(email: string | undefined | null): string {
    return email ? email.toLowerCase().trim() : ''
}

export function isSuperAdmin(email: string | undefined | null): boolean {
    return superAdmins.includes(normalize(email))
}

export function canAccessHealup(email: string | undefined | null): boolean {
    const e = normalize(email)
    return healupUsers.includes(e) || superAdmins.includes(e)
}

export function canAccessBrada(email: string | undefined | null): boolean {
    const e = normalize(email)
    return bradaUsers.includes(e) || superAdmins.includes(e)
}

// Por defecto, AlefCompany lo dejamos solo para SuperAdmins por ahora, o abierto si no se especifica.
// Asumiremos que es para SuperAdmins dado el pedido de "acceso a todas las páginas"
export function canAccessAlef(email: string | undefined | null): boolean {
    const e = normalize(email)
    return superAdmins.includes(e)
}
