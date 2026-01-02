const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

// Configuración idéntica a tu server.js
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'FacturaAPP', 
  password: '0534', 
  port: 5432,
});

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
        const usuario = 'admin'; 
        const password = '123'; // <--- CAMBIA ESTO POR TU CONTRASEÑA

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