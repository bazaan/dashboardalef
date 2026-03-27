const fs = require('fs');
const files = [
    'Alegrated.vue',
    'BradaPerfumes.vue',
    'ClinicaArroyo.vue',
    'Origitec.vue'
];
const basePath = 'c:/Users/elrob/Desktop/khozaz/trabajos/ALEF/DASHBOARD ALEF/DASHBOARDADVANCEDV2/DASHBOARDADVANCED/DashboardAlefCompany/pages/pruebas/';

const results = {};

files.forEach(file => {
    try {
        const content = fs.readFileSync(basePath + file, 'utf8');
        const matches = [...content.matchAll(/\.from\(['"]([^'"]+)['"]\)/g)];
        const tables = [...new Set(matches.map(m => m[1]))];
        results[file] = tables;
    } catch (e) {
        results[file] = ['Error reading file'];
    }
});

console.log(JSON.stringify(results, null, 2));
