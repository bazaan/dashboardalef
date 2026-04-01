const fs = require('fs');
const path = require('path');

const srcPath = path.join(__dirname, 'pages', 'pruebas', 'Healup.vue');
const destPath = path.join(__dirname, 'pages', 'pruebas', 'Solari.vue');

let content = fs.readFileSync(srcPath, 'utf8');

// Replace table names correctly
content = content.replace(/PacientesBDwppHEALUP/g, 'PacientesBDwppSOLARI');
content = content.replace(/PacientesBDfbigHEALUP/g, 'PacientesBDfbigSOLARI');
content = content.replace(/GeneralBDwppHEALUP/g, 'GeneralBDwppSOLARI');
content = content.replace(/GeneralBDfbigHEALUP/g, 'GeneralBDfbigSOLARI');
content = content.replace(/comprasBDwppBRADA/g, 'comprasBDwppSOLARI'); // the original had Brada, the user requested to make it 'solari' based

// Replace supabase prefixes
content = content.replace(/healup_medical_history/g, 'solari_medical_history');
content = content.replace(/healup_working_hours/g, 'solari_working_hours');
content = content.replace(/healup_calendar_events/g, 'solari_calendar_events');
content = content.replace(/healup_procedures/g, 'solari_procedures');
content = content.replace(/egresos_healup/g, 'egresos_solari');

// Replace 'HEALUP', 'Healup', 'healup'
// Logo and role-related
content = content.replace(/assets\/img\/cruz\.webp/g, 'assets/img/solariLOGO.webp'); // In Healup it might be cruz.webp or healupLOGO.webp
content = content.replace(/assets\/img\/healup[-_A-Za-z0-9]*\.webp/ig, 'assets/img/solariLOGO.webp');
content = content.replace(/<img(.*?)src="[^"]*cruz\.webp"(.*?)>/g, '<img$1src="~/assets/img/solariLOGO.webp"$2>');
content = content.replace(/<img(.*?)src="[^"]*healup[^"]*\.webp"(.*?)>/ig, '<img$1src="~/assets/img/solariLOGO.webp"$2>');

// Class or textual
content = content.replace(/\bHealup\b/g, 'Solari');
content = content.replace(/\bHEALUP\b/g, 'SOLARI');
content = content.replace(/\bhealup\b/g, 'solari');

// Also look out for check role functions
// canAccessHealup -> canAccessSolari
content = content.replace(/canAccess[Hh]ealup/g, 'canAccessSolari');

fs.writeFileSync(destPath, content, 'utf8');
console.log('Successfully created Solari.vue with replaced table names and references.');
