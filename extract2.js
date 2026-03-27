const fs = require('fs');
const files = [
    'Alegrated.vue',
    'BradaPerfumes.vue',
    'ClinicaArroyo.vue',
    'Origitec.vue'
];
const basePath = 'c:/Users/elrob/Desktop/khozaz/trabajos/ALEF/DASHBOARD ALEF/DASHBOARDADVANCEDV2/DASHBOARDADVANCED/DashboardAlefCompany/pages/pruebas/';
const res = {};
files.forEach(f => {
    try {
        const c = fs.readFileSync(basePath + f, 'utf8');
        const m = [...c.matchAll(/\.from\(['"]([^'"]+)['"]\)/g)];
        res[f] = [...new Set(m.map(x=>x[1]))];
    } catch(e) {
        res[f] = [e.toString()];
    }
});
fs.writeFileSync('c:/Users/elrob/Desktop/khozaz/trabajos/ALEF/DASHBOARD ALEF/DASHBOARDADVANCEDV2/DASHBOARDADVANCED/DashboardAlefCompany/tables2.json', JSON.stringify(res, null, 2));
