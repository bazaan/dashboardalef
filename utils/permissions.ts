export const superAdmins = [
    'aipartnerstudio@gmail.com',
    'jbazan@alef.company',
    'bazanjuanpa@gmail.com',
    'marcelozumaeta31@gmail.com',
    'pbelmontesoto@gmail.com',
    'robertocaceresrivas@hotmail.com'
]

export const dashboards = [
    { name: 'Healup', path: '/pruebas/Healup', icon: 'mdi-medical-bag', logo: 'healupLOGO.png' },
    { name: 'Brada Perfumes', path: '/pruebas/BradaPerfumes', icon: 'mdi-bottle-tonic', logo: 'bradalogo.jpg' },
    { name: 'Alef Company', path: '/pruebas/AlefCompany', icon: 'mdi-domain', logo: 'aleflogo oscuro.png' }
]

export function isSuperAdmin(email: string | undefined | null): boolean {
    if (!email) return false
    return superAdmins.includes(email.toLowerCase())
}
