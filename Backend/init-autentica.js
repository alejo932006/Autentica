require('./load-env');
const { getDbConfig } = require('./load-env');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool(getDbConfig());

async function setupSecurity() {
    try {
        // 1. Crear tabla si no existe
        await pool.query(`
            CREATE TABLE IF NOT EXISTS usuarios_admin (
                id SERIAL PRIMARY KEY,
                usuario VARCHAR(50) UNIQUE NOT NULL,
                password_hash TEXT NOT NULL
            );
        `);
        console.log("✅ Tabla 'usuarios_admin' verificada.");

        // 2. Crear usuario Admin
        const usuario = process.env.ADMIN_USER;
        const password = process.env.ADMIN_PASSWORD;

        // Encriptar password
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);

        // Insertar (o no hacer nada si ya existe)
        await pool.query(`
            INSERT INTO usuarios_admin (usuario, password_hash) 
            VALUES ($1, $2)
            ON CONFLICT (usuario) DO NOTHING;
        `, [usuario, hash]);

        console.log(`✅ Usuario admin creado/verificado exitosamente.`);
        
    } catch (err) {
        console.error("Error:", err);
    } finally {
        pool.end();
    }
}

setupSecurity();