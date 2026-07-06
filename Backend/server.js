require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const multer = require('multer'); 
const path = require('path');
const fs = require('fs');
const app = express();
const port = process.env.PORT || 8080;
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const JWT_SECRET = process.env.JWT_SECRET;

// Middleware para proteger rutas
const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // "Bearer TOKEN"

    if (!token) return res.status(403).json({ error: 'Acceso denegado' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Token inválido' });
        req.user = user;
        next();
    });
};

const BASE_URL = process.env.BASE_URL;

const allowedOrigins = [
    'https://autentika.com',
    'https://www.autentika.com',
    'http://localhost:5500',
    'http://127.0.0.1:5500',
    'http://localhost:8080',
    'http://127.0.0.1:8080',
];

// Configuración de almacenamiento de imágenes
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const dir = './uploads';
        if (!fs.existsSync(dir)) fs.mkdirSync(dir); 
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'prod-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) callback(null, true);
        else callback(new Error('CORS no permitido'));
    },
}));
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// Base de Datos
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

// --- SISTEMA DE CONFIGURACIÓN (VIDEO Y EXTRAS) ---
// --- SISTEMA DE CONFIGURACIÓN (Actualizado) ---
const CONFIG_FILE = 'store_config.json';

// 1. Leer Configuración
app.get('/api/config', (req, res) => {
    if (fs.existsSync(CONFIG_FILE)) {
        res.json(JSON.parse(fs.readFileSync(CONFIG_FILE)));
    } else {
        // Configuración por defecto si no existe archivo
        res.json({ 
            businessName: 'Autentika', 
            historyText: 'Escribe aquí tu historia...',
            logoUrl: '',
            showcaseImages: [],
            youtubeId: ''
        });
    }
});

// 2. Guardar Configuración General
app.post('/api/manager/config', verifyToken, (req, res) => {
    // Leemos la config anterior para no borrar datos que no vengan en el request
    let currentConfig = {};
    if (fs.existsSync(CONFIG_FILE)) currentConfig = JSON.parse(fs.readFileSync(CONFIG_FILE));

    // Mezclamos la vieja con la nueva
    const newConfig = { ...currentConfig, ...req.body };
    
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(newConfig));
    res.json({ success: true });
});

// 3. Subir Assets (Logos, Banners - NUEVA RUTA)
app.post('/api/manager/upload-asset', verifyToken, upload.single('image'), (req, res) => {
    if (!req.file) return res.status(400).send('No se envió imagen');
    // Retornamos la URL lista para guardar
    const imageUrl = `/uploads/${req.file.filename}`;
    res.json({ success: true, imageUrl: `${BASE_URL}${imageUrl}` });
});

// --- RUTAS PÚBLICAS (TIENDA) ---

app.get('/api/products', async (req, res) => {
    try {
      const result = await pool.query('SELECT *, es_destacado FROM productos ORDER BY nombre');
      const productos = result.rows.map(p => ({
          id: p.codigo,
          nombre: p.nombre,
          precio: p.precio_venta,
          cantidad: p.cantidad,
          unidad: p.unidad_medida,
          linea: p.area_encargada,
          
          // --- CORRECCIÓN AQUÍ ---
          // ANTES: descripcion: `Stock: ${p.cantidad} ${p.unidad_medida}`, 
          // AHORA: Usamos la columna real de la base de datos
          descripcion: p.descripcion || '', 
          // -----------------------

          orientacion: p.imagen_orientacion || 'vertical',
          imagen_url: p.imagen_url ? `${BASE_URL}${p.imagen_url}` : null,
          destacado: p.es_destacado 
      }));
      res.json(productos);
    } catch (err) { res.status(500).send(err.message); }
  });

app.post('/api/checkout', async (req, res) => {
    const { 
        nombre, cedula, telefono, email, 
        departamento, ciudad, barrio, direccion, 
        metodo, total, productos 
    } = req.body;
    
    const resumen = JSON.stringify(productos);
    
    try {
        const query = `
            INSERT INTO pedidos (
                cliente_nombre, cliente_cedula, cliente_telefono, cliente_email,
                cliente_departamento, cliente_ciudad, cliente_barrio, cliente_direccion,
                metodo_pago, total_venta, detalle_productos
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING id
        `;
        
        const values = [
            nombre, cedula, telefono, email, 
            departamento, ciudad, barrio, direccion, 
            metodo, total, resumen
        ];
        
        const result = await pool.query(query, values);
        res.json({ success: true, orderId: result.rows[0].id });
        
    } catch (err) { 
        console.error(err);
        res.status(500).json({ error: err.message }); 
    }
});

// --- RUTAS PRIVADAS (MANAGER) ---

app.get('/api/manager/orders', verifyToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM pedidos ORDER BY id DESC');
        res.json(result.rows);
    } catch (err) { res.status(500).send(err.message); }
});

app.patch('/api/manager/orders/:id', verifyToken, async (req, res) => {
    const { estado } = req.body;
    const { id } = req.params;
    try {
        await pool.query('UPDATE pedidos SET estado = $1 WHERE id = $2', [estado, id]);
        res.json({ success: true });
    } catch (err) { res.status(500).send(err.message); }
});

app.post('/api/manager/upload-image', verifyToken, upload.single('image'), async (req, res) => {
  const { productId, orientation } = req.body; 
  const file = req.file;
  
  if (!file) return res.status(400).send('No image uploaded');

  // Guardamos solo la ruta relativa en la base de datos (/uploads/foto.jpg)
  // Esto es vital para que funcione tanto en local como en nube
  const imageUrl = `/uploads/${file.filename}`;

  try {
      await pool.query(
          'UPDATE productos SET imagen_url = $1, imagen_orientacion = $2 WHERE codigo = $3', 
          [imageUrl, orientation, productId]
      );
      // Respondemos con la URL completa para que el Manager la muestre al instante
      res.json({ success: true, imageUrl: `${BASE_URL}${imageUrl}` });
  } catch (err) { res.status(500).send(err.message); }
});

app.patch('/api/manager/products/:id', verifyToken, async (req, res) => {
    // 1. Recibir 'descripcion' del cuerpo de la petición
    const { precio, stock, descripcion } = req.body; 
    const { id } = req.params;
    
    try {
        // 2. Actualizar la consulta SQL para incluir la columna descripcion
        // Observa que agregamos un tercer parámetro ($3) y movimos el ID al cuarto ($4)
        await pool.query(
            'UPDATE productos SET precio_venta = $1, cantidad = $2, descripcion = $3 WHERE codigo = $4', 
            [precio, stock, descripcion, id]
        );
        res.json({ success: true });
    } catch (err) { res.status(500).send(err.message); }
});

app.patch('/api/manager/feature/:id', verifyToken, async (req, res) => {
    const { id } = req.params;
    const { status } = req.body; 
    try {
        await pool.query('UPDATE productos SET es_destacado = $1 WHERE codigo = $2', [status, id]);
        res.json({ success: true });
    } catch (err) { res.status(500).send(err.message); }
});

// 6. Eliminar Pedido (NUEVO)
app.delete('/api/manager/orders/:id', verifyToken, async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM pedidos WHERE id = $1', [id]);
        res.json({ success: true });
    } catch (err) { res.status(500).send(err.message); }
});

// --- GESTIÓN DE USUARIOS ADMIN ---

// 1. Listar usuarios (Sin mostrar contraseñas)
app.get('/api/manager/users', verifyToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT id, usuario FROM usuarios_admin ORDER BY id ASC');
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 2. Crear nuevo usuario
app.post('/api/manager/users', verifyToken, async (req, res) => {
    const { usuario, password } = req.body;
    
    if(!usuario || !password) return res.status(400).json({ error: "Faltan datos" });

    try {
        // Encriptar contraseña nueva
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);

        await pool.query('INSERT INTO usuarios_admin (usuario, password_hash) VALUES ($1, $2)', [usuario, hash]);
        res.json({ success: true });
    } catch (err) {
        // El código 23505 en Postgres significa "Ya existe ese valor único"
        if(err.code === '23505') return res.status(400).json({ error: "El usuario ya existe" });
        res.status(500).json({ error: err.message });
    }
});

// 3. Eliminar usuario
app.delete('/api/manager/users/:id', verifyToken, async (req, res) => {
    const { id } = req.params;
    
    // Evitar que te borres a ti mismo (opcional, pero recomendado)
    if(req.user.id == id) {
        return res.status(400).json({ error: "No puedes eliminar tu propio usuario mientras estás conectado." });
    }

    try {
        await pool.query('DELETE FROM usuarios_admin WHERE id = $1', [id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- SEGURIDAD ---


// Ruta de Login
app.post('/api/auth/login', async (req, res) => {
    const { usuario, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM usuarios_admin WHERE usuario = $1', [usuario]);
        if (result.rows.length === 0) return res.status(401).json({ error: "Usuario no encontrado" });

        const admin = result.rows[0];
        const validPassword = await bcrypt.compare(password, admin.password_hash);
        
        if (!validPassword) return res.status(401).json({ error: "Contraseña incorrecta" });

        const token = jwt.sign({ id: admin.id, user: admin.usuario }, JWT_SECRET, { expiresIn: '8h' });
        res.json({ success: true, token });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.listen(port, () => {
  console.log(`🔥 Backend Aura Beauty listo en http://localhost:${port}`);
});

