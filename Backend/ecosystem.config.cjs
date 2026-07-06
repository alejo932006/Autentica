/**
 * PM2 — Autentika Backend (Windows)
 *
 * cd "C:\Autentica\Backend"
 * npm install
 *
 * Crear .env aquí (Backend\.env) o en C:\Autentica\.env
 * node init-autentica.js
 * pm2 start ecosystem.config.cjs
 * pm2 save
 */
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });

function envString(key, fallback = '') {
    const value = process.env[key];
    return value === undefined || value === null ? fallback : String(value);
}

if (!envString('DB_PASSWORD')) {
    console.warn('');
    console.warn('⚠️  AVISO: DB_PASSWORD vacío. Crea Backend\\.env o ..\\.env antes de arrancar.');
    console.warn('');
}

module.exports = {
    apps: [
        {
            name: 'autentika-backend',
            script: 'server.js',
            cwd: __dirname,
            instances: 1,
            autorestart: true,
            watch: false,
            max_memory_restart: '300M',
            env: {
                NODE_ENV: 'production',
                DB_USER: envString('DB_USER', 'postgres'),
                DB_HOST: envString('DB_HOST', 'localhost'),
                DB_NAME: envString('DB_NAME', 'Autentika'),
                DB_PASSWORD: envString('DB_PASSWORD'),
                DB_PORT: envString('DB_PORT', '5432'),
                JWT_SECRET: envString('JWT_SECRET'),
                PORT: envString('PORT', '8080'),
                BASE_URL: envString('BASE_URL', 'https://api.auntentika.com'),
            },
        },
    ],
};
