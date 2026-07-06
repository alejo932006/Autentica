const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Busca .env en Backend/ o en la raíz del proyecto (como t-shop: .env junto al server)
const envPaths = [
    path.join(__dirname, '.env'),
    path.join(__dirname, '../.env'),
];

for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
        dotenv.config({ path: envPath });
    }
}

function getDbConfig() {
    const password = process.env.DB_PASSWORD;
    if (password === undefined || password === null || password === '') {
        console.error('');
        console.error('❌ DB_PASSWORD no definido.');
        console.error('   Crea .env en Backend/ o en la raíz del proyecto con:');
        console.error('   DB_PASSWORD=tu_contraseña');
        console.error('');
    }

    return {
        user: process.env.DB_USER || 'postgres',
        host: process.env.DB_HOST || 'localhost',
        database: process.env.DB_NAME || 'Autentika',
        password: String(password ?? ''),
        port: parseInt(process.env.DB_PORT, 10) || 5432,
    };
}

module.exports = { getDbConfig };
