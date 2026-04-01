const fs = require('fs');
const content = fs.readFileSync('C:\\Users\\elrob\\Desktop\\khozaz\\trabajos\\ALEF\\DASHBOARD ALEF\\DASHBOARDADVANCEDV2\\DASHBOARDADVANCED\\DashboardAlefCompany\\pages\\pruebas\\Solari.vue', 'utf8');
const regex = /\.from\(['"`]([a-zA-Z0-9_]+)['"`]\)/g;
const matches = [...content.matchAll(regex)];
const tables = new Set(matches.map(m => m[1]));
console.log(Array.from(tables).join('\n'));
