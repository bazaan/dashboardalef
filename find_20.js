const fs = require('fs');

const dbText = fs.readFileSync('march.txt', 'utf8');

const dbEntries = dbText.split('\n').filter(l => l.trim().length > 0).map(line => {
    const match = line.match(/^\* (.*?) - Reserva: ([0-9.]+), Tratamiento: ([0-9.]+)/);
    if (!match) return null;
    return {
        name: match[1].trim(),
        total: parseFloat(match[2]) + parseFloat(match[3])
    };
}).filter(Boolean);

// Users in DB with 20 soles
console.log("=== EN LA BASE DE DATOS CON 20 SOLES ===");
dbEntries.filter(x => x.total === 20).forEach(x => {
    console.log(`${x.name} - ${x.total}`);
});

// Users in DB with 40 soles
console.log("=== EN LA BASE DE DATOS CON 40 SOLES ===");
dbEntries.filter(x => x.total === 40).forEach(x => {
    console.log(`${x.name} - ${x.total}`);
});
