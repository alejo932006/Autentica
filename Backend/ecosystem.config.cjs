/**
 * PM2 — Autentika Backend (Windows)
 *
 * En el servidor (PowerShell o CMD), desde la carpeta Backend:
 *   cd "C:\ruta\real\Autentica\Backend"
 *   npm install
 *   node init-autentica.js
 *   pm2 start ecosystem.config.cjs
 *   pm2 save
 */
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
            },
        },
    ],
};
