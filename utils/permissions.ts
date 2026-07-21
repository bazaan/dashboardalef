// Definición de Dashboards
export const dashboards = [
    { name: 'Alef Company', path: '/pruebas/AlefCompany', icon: 'mdi-domain', logo: 'aleflogo oscuro.png' },
    { name: 'Healup', path: '/pruebas/Healup', icon: 'mdi-medical-bag', logo: 'healupLOGO.png' },
    { name: 'Brada Perfumes', path: '/pruebas/BradaPerfumes', icon: 'mdi-bottle-tonic', logo: 'bradalogo.jpg' },
    { name: 'Origitec', path: '/pruebas/Origitec', icon: 'mdi-alpha-o-circle', logo: 'Logo_Origitec_Trans.png' },
    { name: 'Clinica Arroyo', path: '/pruebas/ClinicaArroyo', icon: 'mdi-hospital-building', logo: 'arroyoLOGO.jpg' },
    { name: 'Alegrated', path: '/pruebas/Alegrated', icon: 'mdi-star', logo: 'alegratedLOGO.jpg' },
    { name: 'Solari', path: '/pruebas/Solari', icon: 'mdi-white-balance-sunny', logo: 'solariLOGO.webp' },
    { name: 'SKIP', path: '/pruebas/SKIP', icon: 'mdi-water', logo: 'LogoSkyDive.png' },
    { name: 'Estás con Suerte', path: '/pruebas/EstasConSuerte', icon: 'mdi-clover', logo: 'ecsLOGO.png' },
    { name: 'Estetika Medika', path: '/pruebas/EstetikaMedika', icon: 'mdi-spa', logo: 'estetika-medika-logo.png' },
    { name: 'Miguel Davila', path: '/pruebas/MiguelDavila', icon: 'mdi-doctor', logo: 'miguel-davila-logo.png' },
    { name: 'FitMain', path: '/pruebas/FitMain', icon: 'mdi-dumbbell', logo: '' },
    { name: 'Gatwick', path: '/pruebas/Gatwick', icon: 'mdi-elevator', logo: 'gatwickLOGO.png' },
    { name: 'Trade Cars', path: '/pruebas/TradeCars', icon: 'mdi-car-multiple', logo: 'tradecarsLOGO.png' }
]

// Tipos para la sesión de usuario
export interface UserSession {
    email?: string;
    role?: string;
    company_id?: string;
    [key: string]: any;
}

// Helpers de Verificación

function normalize(str: string | undefined | null): string {
    return str ? str.toLowerCase().trim() : ''
}

export function isSuperAdmin(sessionOrRole: UserSession | string | undefined | null): boolean {
    if (!sessionOrRole) return false

    // Si pasan un string, asumimos que es el rol
    if (typeof sessionOrRole === 'string') {
        return normalize(sessionOrRole) === 'superadmin'
    }

    // Si pasan un objeto sesión
    return normalize(sessionOrRole.role) === 'superadmin'
}

// Función genérica para verificar acceso a dashboard de empresa
export function canAccessCompanyDashboard(session: UserSession | null, targetCompanyId: string): boolean {
    if (!session) return false

    const role = normalize(session.role)
    const userCompanyId = normalize(session.company_id)
    const target = normalize(targetCompanyId)

    // 1. Superadmin tiene acceso a todo
    if (role === 'superadmin') return true

    // 2. Admin o Agente tiene acceso SOLO a su compañía asignada
    if ((role === 'admin' || role === 'agent' || role === 'agente') && userCompanyId === target) {
        return true
    }

    return false
}

// Helpers específicos para cada Dashboard (wrappers)
// Nota: 'Healup', 'Brada', etc. deben coincidir con lo que viene en company_id de la BD
// O podemos normalizar aquí. Asumiremos los IDs que ví en la imagen: 'Alef', 'Brada', 'Heal up', 'Alegrated'

export function canAccessHealup(session: UserSession | null): boolean {
    // Normalizamos 'Heal up' a lo que esperamos se use en lógica
    // Ojo: En la BD dice "Heal up", pero mejor soportar variaciones
    if (!session) return false
    if (isSuperAdmin(session)) return true

    const cid = normalize(session.company_id)
    return cid === 'heal up' || cid === 'healup' || cid.includes('heal')
}

export function canAccessBrada(session: UserSession | null): boolean {
    if (!session) return false
    if (isSuperAdmin(session)) return true

    const cid = normalize(session.company_id)
    return cid === 'brada' || cid === 'brada perfumes' || cid.includes('brada')
}

export function canAccessOrigitec(session: UserSession | null): boolean {
    if (!session) return false
    if (isSuperAdmin(session)) return true

    const cid = normalize(session.company_id)
    return cid === 'origitec' || cid.includes('origitec')
}

export function canAccessAlef(session: UserSession | null): boolean {
    // Alef es la empresa dueña, generalmente solo superadmin o admin de Alef
    if (!session) return false
    if (isSuperAdmin(session)) return true

    const cid = normalize(session.company_id)
    return cid === 'alef' || cid === 'alef company' || cid.includes('alef')
}

export function canAccessClinicaArroyo(session: UserSession | null): boolean {
    if (!session) return false
    if (isSuperAdmin(session)) return true

    const cid = normalize(session.company_id)
    return cid === 'clinica arroyo' || cid === 'clinicaarroyo' || cid.includes('arroyo')
}

export function canAccessAlegrated(session: UserSession | null): boolean {
    if (!session) return false
    if (isSuperAdmin(session)) return true

    const cid = normalize(session.company_id)
    return cid === 'alegrated' || cid.includes('alegrated')
}

export function canAccessSolari(session: UserSession | null): boolean {
    if (!session) return false
    if (isSuperAdmin(session)) return true

    const cid = normalize(session.company_id)
    return cid === 'solari' || cid.includes('solari')
}

export function canAccessSKIP(session: UserSession | null): boolean {
    if (!session) return false
    if (isSuperAdmin(session)) return true

    const cid = normalize(session.company_id)
    return cid === 'skip' || cid.includes('skip')
}

export function canAccessEstasConSuerte(session: UserSession | null): boolean {
    if (!session) return false
    if (isSuperAdmin(session)) return true

    const cid = normalize(session.company_id)
    return cid === 'estasconsuerte' || cid === 'estás con suerte' || cid.includes('ecs') || cid.includes('suerte')
}

export function canAccessEstetikaMedika(session: UserSession | null): boolean {
    if (!session) return false
    if (isSuperAdmin(session)) return true

    const cid = normalize(session.company_id)
    return cid === 'estetikamedika' || cid === 'estetika medika' || cid === 'estetikamedika' || cid.includes('estetika')
}

export function canAccessDavila(session: UserSession | null): boolean {
    if (!session) return false
    if (isSuperAdmin(session)) return true

    const cid = normalize(session.company_id)
    return cid === 'davila' || cid === 'miguel davila' || cid.includes('davila')
}

export function canAccessGatwick(session: UserSession | null): boolean {
    if (!session) return false
    if (isSuperAdmin(session)) return true

    const cid = normalize(session.company_id)
    return cid === 'gatwick' || cid === 'gatwick ascensores' || cid.includes('gatwick')
}

export function canAccessTradeCars(session: UserSession | null): boolean {
    if (!session) return false
    if (isSuperAdmin(session)) return true

    // company_id puede venir como 'tradecars', 'Trade Cars', 'trade cars peru', etc.
    const cid = normalize(session.company_id).replace(/\s+/g, '')
    return cid.includes('tradecars')
}

export function getDashboardPathByCompanyId(companyId: string | undefined | null): string {
    if (!companyId) return '/'

    const normalizedId = normalize(companyId)

    // Exact matches based on DB and simple variations
    if (normalizedId === 'heal up' || normalizedId === 'healup' || normalizedId.includes('heal')) return '/pruebas/Healup'
    if (normalizedId === 'brada' || normalizedId === 'brada perfumes' || normalizedId.includes('brada')) return '/pruebas/BradaPerfumes'
    if (normalizedId === 'alef' || normalizedId === 'alef company' || normalizedId.includes('alef')) return '/pruebas/AlefCompany'
    if (normalizedId === 'alegrated' || normalizedId.includes('alegrated')) return '/pruebas/Alegrated'
    if (normalizedId === 'clinica arroyo' || normalizedId === 'clinicaarroyo' || normalizedId.includes('arroyo')) return '/pruebas/ClinicaArroyo'
    if (normalizedId === 'origitec' || normalizedId.includes('origitec')) return '/pruebas/Origitec'
    if (normalizedId === 'solari' || normalizedId.includes('solari')) return '/pruebas/Solari'
    if (normalizedId === 'skip' || normalizedId.includes('skip')) return '/pruebas/SKIP'
    if (normalizedId === 'estasconsuerte' || normalizedId === 'estás con suerte' || normalizedId.includes('suerte')) return '/pruebas/EstasConSuerte'
    if (normalizedId === 'estetikamedika' || normalizedId === 'estetika medika' || normalizedId.includes('estetika')) return '/pruebas/EstetikaMedika'
    if (normalizedId === 'davila' || normalizedId === 'miguel davila' || normalizedId.includes('davila')) return '/pruebas/MiguelDavila'
    if (normalizedId === 'gatwick' || normalizedId === 'gatwick ascensores' || normalizedId.includes('gatwick')) return '/pruebas/Gatwick'
    if (normalizedId.replace(/\s+/g, '').includes('tradecars')) return '/pruebas/TradeCars'

    return '/'
}

