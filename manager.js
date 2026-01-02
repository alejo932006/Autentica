const token = localStorage.getItem('autentica_token');
if (!token) {
    window.location.href = 'login.html';
}

// Configuración de la API
const API_URL = 'http://localhost:3000/api'; 

// --- ESTA ES LA FUNCIÓN QUE TE FALTABA ---
async function authFetch(endpoint, options = {}) {
    // Asegurar que existan headers
    if (!options.headers) options.headers = {};
    
    // Inyectar el Token automáticamente
    options.headers['Authorization'] = `Bearer ${token}`;

    try {
        // Hacemos la petición real usando fetch
        const res = await fetch(endpoint, options);

        // Si el servidor dice "No autorizado" (401 o 403), sacamos al usuario
        if (res.status === 403 || res.status === 401) {
            alert("Tu sesión ha expirado o no tienes permiso.");
            logout(); // Llamamos a la función de salir
            return null;
        }

        return res;
    } catch (error) {
        console.error("Error de conexión:", error);
        throw error;
    }
}

function logout() {
    localStorage.removeItem('autentica_token');
    window.location.href = 'login.html';
}


let allProducts = [];
let allOrders = [];
let currentEditId = null;

// --- NAVEGACIÓN ---
function switchView(viewName, btn) {
    // 1. Ocultar TODAS las vistas posibles (Aquí faltaba la nueva)
    document.getElementById('view-orders').style.display = 'none';
    document.getElementById('view-inventory').style.display = 'none';
    document.getElementById('view-featured').style.display = 'none';
    
    // AGREGAMOS ESTA LÍNEA: Ocultar también la configuración
    const configView = document.getElementById('view-config');
    if (configView) configView.style.display = 'none';
    
    // 2. Gestionar clases activas del menú (Visual del botón presionado)
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    if(btn) btn.classList.add('active');
    
    // 3. Mostrar la vista deseada
    const viewToShow = document.getElementById(`view-${viewName}`);
    if (viewToShow) viewToShow.style.display = 'block';

    // 4. Cargar datos frescos según la pestaña
    if(viewName === 'orders') loadOrders();
    if(viewName === 'inventory') loadInventory();
    if(viewName === 'featured') loadFeaturedView();
    if(viewName === 'config') loadStoreConfig(); // <--- Importante: cargar datos de tienda
    if(viewName === 'users') loadUsers();
}
// ==========================================
// PEDIDOS
// ==========================================
async function loadOrders() {
    const container = document.getElementById('orders-list');
    container.innerHTML = '<p style="padding:20px; text-align:center;">Cargando pedidos...</p>';

    try {
        const res = await authFetch(`${API_URL}/manager/orders`);
        allOrders = await res.json();
        
        // KPIs
        const pending = allOrders.filter(o => o.estado === 'PENDIENTE').length;
        document.getElementById('kpi-pending').innerText = pending;
        
        const today = new Date().toISOString().slice(0,10);
        const totalToday = allOrders
            .filter(o => o.fecha_pedido.startsWith(today) && o.estado !== 'CANCELADO')
            .reduce((acc, o) => acc + Number(o.total_venta), 0);
        document.getElementById('kpi-total-today').innerText = `$${totalToday.toLocaleString()}`;
        
        renderOrdersList();
    } catch (e) {
        console.error(e);
        container.innerHTML = '<p style="padding:20px; color:red; text-align:center;">Error conectando a Localhost.</p>';
    }
}

// CAMBIALA POR ESTA:
function renderOrdersList(ordersToRender = null) {
    const container = document.getElementById('orders-list');
    container.innerHTML = '';

    // Si no nos pasan una lista específica, usamos TODOS los pedidos
    const list = ordersToRender || allOrders; 

    if(list.length === 0) {
        container.innerHTML = '<p style="padding:20px; text-align:center;">No se encontraron pedidos en estas fechas.</p>';
        return;
    }

    // Header Tabla (Estilo Claro)
    const header = document.createElement('div');
    header.style.cssText = "display: grid; grid-template-columns: 0.5fr 1.5fr 1fr 1fr 1fr; padding: 15px; background: #F3F4F6; font-weight: bold; color: #555; font-size: 0.9rem; border-bottom: 1px solid #ddd;";
    header.innerHTML = `<span>ID</span><span>Cliente</span><span>Fecha</span><span>Estado</span><span style="text-align:right">Total</span>`;
    container.appendChild(header);

    list.forEach(o => {
        const div = document.createElement('div');
        div.style.cssText = "display: grid; grid-template-columns: 0.5fr 1.5fr 1fr 1fr 1fr; padding: 15px; border-bottom: 1px solid #eee; cursor: pointer; align-items: center; transition: background 0.2s;";
        div.onmouseover = () => div.style.background = '#F9FAFB';
        div.onmouseout = () => div.style.background = 'white';
        div.onclick = () => openOrderDetails(o.id);

        const statusStyle = o.estado === 'PENDIENTE' 
            ? 'background: #FEF3C7; color: #D97706;' 
            : 'background: #D1FAE5; color: #059669;';

        div.innerHTML = `
            <span style="font-weight:bold; color: #2C3325;">#${o.id}</span>
            <span>${o.cliente_nombre}</span>
            <span style="color: #888; font-size: 0.85rem;">${new Date(o.fecha_pedido).toLocaleDateString()}</span>
            <span><span style="${statusStyle} padding: 4px 10px; border-radius: 20px; font-size: 0.75rem; font-weight: bold;">${o.estado}</span></span>
            <span style="text-align:right; font-weight:bold;">$${Number(o.total_venta).toLocaleString()}</span>
        `;
        container.appendChild(div);
    });
}

function openOrderDetails(id) {
    // 1. Encontrar el pedido en la memoria
    const o = allOrders.find(order => String(order.id) === String(id));
    if(!o) return;

    // 2. Llenar Datos del Cliente
    document.getElementById('detail-id').innerText = o.id;
    document.getElementById('detail-client').innerText = o.cliente_nombre;
    document.getElementById('detail-cedula').innerText = o.cliente_cedula || 'No registrada';
    document.getElementById('detail-phone').innerText = o.cliente_telefono;
    
    // 3. Llenar Datos de Envío
    document.getElementById('detail-location').innerText = `${o.cliente_ciudad} - ${o.cliente_departamento}`;
    document.getElementById('detail-address').innerText = o.cliente_direccion;
    document.getElementById('detail-barrio').innerText = o.cliente_barrio || 'No especificado';
    document.getElementById('detail-method').innerText = o.metodo_pago || 'Contraentrega';
    
    // 4. Llenar Total
    document.getElementById('detail-total').innerText = `$${Number(o.total_venta).toLocaleString('es-CO')}`;

    // 5. Configurar Botón WhatsApp con Mensaje Personalizado
    const mensaje = `Hola ${o.cliente_nombre}, te saludamos de Aura Beauty 🌿. Hemos recibido tu pedido #${o.id} por valor de $${Number(o.total_venta).toLocaleString()}. ¿Podemos confirmar los datos de envío?`;
    const telefono = o.cliente_telefono.replace(/\D/g, ''); // Limpiar el número
    document.getElementById('btn-whatsapp').href = `https://wa.me/57${telefono}?text=${encodeURIComponent(mensaje)}`;

    // 6. Llenar Tabla de Productos
    const prodsContainer = document.getElementById('detail-products');
    try {
        const items = JSON.parse(o.detalle_productos);
        prodsContainer.innerHTML = items.map(item => `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #f9f9f9;">
                <div style="display:flex; align-items:center; gap:10px;">
                    <div style="background:#f0f0f0; width:40px; height:40px; border-radius:6px; overflow:hidden; display:flex; align-items:center; justify-content:center;">
                        ${item.imagen_url ? `<img src="${item.imagen_url}" style="width:100%; height:100%; object-fit:cover;">` : '📦'}
                    </div>
                    <div>
                        <div style="font-weight:bold; color:#333;">${item.nombre}</div>
                        <div style="font-size:0.8rem; color:#888;">Cant: ${item.qty}</div>
                    </div>
                </div>
                <div style="font-weight:bold; color:#556B2F;">
                    $${Number(item.precio * item.qty).toLocaleString()}
                </div>
            </div>
        `).join('');
    } catch(e) {
        prodsContainer.innerHTML = '<p style="color:red;">Error al cargar lista de productos.</p>';
    }

// 7. Botones de Acción (Actualizado con Eliminar)
const actionsDiv = document.getElementById('detail-actions');
    
// Botón de Eliminar (Siempre visible, pequeño y rojo)
const btnDelete = `
    <button onclick="deleteOrder(${o.id})" title="Eliminar Pedido"
        style="background: #FEE2E2; color: #EF4444; border: 1px solid #FECACA; width: 45px; height: 45px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s;">
        <span class="material-icons-round">delete</span>
    </button>
`;

// Botón Principal (Cambia según estado)
let mainAction = '';

if(o.estado === 'PENDIENTE') {
    mainAction = `
        <button onclick="changeStatus(${o.id}, 'DESPACHADO')" 
            style="background: #2C3325; color: white; border: none; padding: 0 25px; height: 45px; border-radius: 8px; font-weight: bold; cursor: pointer; display: flex; align-items: center; gap: 10px; transition: background 0.2s;">
            <span class="material-icons-round">local_shipping</span>
            Marcar Enviado
        </button>
    `;
} else {
    mainAction = `
        <div style="display: flex; align-items: center; gap: 5px; color: #10B981; font-weight: bold; background: #ECFDF5; padding: 0 20px; height: 45px; border-radius: 8px;">
            <span class="material-icons-round">check_circle</span>
            Completado
        </div>
    `;
}

// Unimos los botones (El de eliminar a la derecha del principal)
actionsDiv.style.display = 'flex';
actionsDiv.style.gap = '10px';
actionsDiv.innerHTML = mainAction + btnDelete;

    // 8. Mostrar Modal
    document.getElementById('modal-order-details').classList.remove('hidden');
}
function closeOrderModal() { document.getElementById('modal-order-details').classList.add('hidden'); }

async function changeStatus(id, st) {
    if(!confirm('¿Confirmar envío?')) return;
    try {
        await authFetch(`${API_URL}/manager/orders/${id}`, {
            method: 'PATCH',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({estado: st})
        });
        closeOrderModal(); loadOrders();
    } catch(e){ alert('Error'); }
}

// ==========================================
// INVENTARIO
// ==========================================
async function loadInventory() {
    const container = document.getElementById('inventory-list');
    container.innerHTML = '<p>Cargando...</p>';
    try {
        const res = await authFetch(`${API_URL}/products`); // Asegúrate de que tu ruta en server.js sea /api/products
        allProducts = await res.json();
        renderProducts(allProducts);
    } catch(e) { container.innerHTML = 'Error conexión'; }
}

// EN manager.js

function renderProducts(list) {
    const container = document.getElementById('inventory-list');
    container.innerHTML = '';
    list.forEach(p => {
        const div = document.createElement('div');
        div.className = 'prod-card';
        const img = p.imagen_url || '';
        
        div.innerHTML = `
            <div class="prod-img">
                ${img ? `<img src="${img}">` : '<span class="material-icons-round">image</span>'}
                <button class="btn-photo" onclick="openPhotoModal('${p.id}', '${p.nombre}')">
                    <span class="material-icons-round">edit</span>
                </button>
            </div>
            <div class="prod-body">
                <div class="prod-title">${p.nombre}</div>
                <div class="input-row">
                    <div class="input-group">
                        <label>Precio</label>
                        <input type="text" id="price-${p.id}" class="input-mini" value="${Number(p.precio).toLocaleString('es-CO')}">
                    </div>
                    <div class="input-group">
                        <label>Stock</label>
                        <input type="number" id="stock-${p.id}" class="input-mini" value="${p.cantidad}">
                    </div>
                </div>
                
                <div class="form-group" style="margin-top: 10px;">
                    <label style="font-size: 0.8rem; color: gray;">Descripción</label>
                    <textarea id="desc-${p.id}" rows="3" 
                        style="width: 100%; border: 1px solid #ddd; border-radius: 6px; padding: 8px; font-family: sans-serif; font-size: 0.85rem;" 
                        placeholder="Escribe aquí...">${p.descripcion || ''}</textarea>
                </div>

                <button class="btn-save" onclick="updateProduct('${p.id}')">Guardar</button>
            </div>
        `;
        container.appendChild(div);
    });
}

async function updateProduct(id) {
    const p = document.getElementById(`price-${id}`).value.replace(/\D/g,'');
    const s = document.getElementById(`stock-${id}`).value;
    
    // CORRECCIÓN: Capturamos la descripción del ID específico
    const d = document.getElementById(`desc-${id}`).value; 

    try {
        await authFetch(`${API_URL}/manager/products/${id}`, {
            method: 'PATCH',
            headers: {'Content-Type': 'application/json'},
            // CORRECCIÓN: Enviamos 'descripcion' en el cuerpo
            body: JSON.stringify({
                precio: p, 
                stock: s, 
                descripcion: d 
            })
        });
        alert('Guardado correctamente. Recarga la página principal para ver los cambios.');
    } catch(e) { 
        console.error(e);
        alert('Error al guardar'); 
    }
}
function searchProducts(v) {
    renderProducts(allProducts.filter(p => p.nombre.toLowerCase().includes(v.toLowerCase())));
}

// ==========================================
// FOTOS
// ==========================================
function openPhotoModal(id, name) {
    currentEditId = id;
    document.getElementById('modal-prod-name').innerText = name;
    document.getElementById('modal-photo').classList.remove('hidden');
}
function closeModal() { document.getElementById('modal-photo').classList.add('hidden'); }

async function uploadPhoto() {
    const file = document.getElementById('file-input').files[0];
    if(!file) return alert('Selecciona foto');
    
    const orient = document.querySelector('input[name="img-orient"]:checked').value;
    const formData = new FormData();
    formData.append('image', file);
    formData.append('productId', currentEditId);
    formData.append('orientation', orient);

    try {
        await authFetch(`${API_URL}/manager/upload-image`, { method: 'POST', body: formData });
        closeModal(); loadInventory();
    } catch(e) { alert('Error subiendo'); }
}

// ==========================================
// DESTACADOS
// ==========================================
function loadFeaturedView() {
    loadVideoConfig(); // <--- NUEVO
    if(allProducts.length === 0) loadInventory().then(renderFeaturedUI);
    else renderFeaturedUI();
}

function renderFeaturedUI() {
    const activeDiv = document.getElementById('featured-active-list');
    activeDiv.innerHTML = '';
    
    allProducts.filter(p => p.destacado).forEach(p => {
        const d = document.createElement('div');
        d.style.cssText = "display:flex; justify-content:space-between; padding:10px; border-bottom:1px solid #eee;";
        d.innerHTML = `<span>${p.nombre}</span> <button onclick="toggleFeature('${p.id}', false)" style="color:red; background:none; border:none; cursor:pointer;">Quitar</button>`;
        activeDiv.appendChild(d);
    });
}

function searchForFeature(v) {
    const listDiv = document.getElementById('featured-search-list');
    if(v.length < 2) { listDiv.innerHTML = ''; return; }
    
    listDiv.innerHTML = '';
    allProducts.filter(p => !p.destacado && p.nombre.toLowerCase().includes(v.toLowerCase())).slice(0,5).forEach(p => {
        const d = document.createElement('div');
        d.style.cssText = "display:flex; justify-content:space-between; padding:10px; border-bottom:1px solid #eee;";
        d.innerHTML = `<span>${p.nombre}</span> <button onclick="toggleFeature('${p.id}', true)" style="color:green; background:none; border:none; cursor:pointer;">Destacar</button>`;
        listDiv.appendChild(d);
    });
}

async function toggleFeature(id, st) {
    await authFetch(`${API_URL}/manager/feature/${id}`, {
        method: 'PATCH',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({status: st})
    });
    const p = allProducts.find(x => String(x.id) === String(id));
    if(p) p.destacado = st;
    renderFeaturedUI();
    document.getElementById('featured-search-list').innerHTML = '';
}

async function loadVideoConfig() {
    try {
        const res = await authFetch(`${API_URL}/config`); // GET
        const data = await res.json();
        if(data.youtubeId) {
            document.getElementById('youtube-url-input').value = `https://www.youtube.com/watch?v=${data.youtubeId}`;
        }
    } catch(e) { console.error("Error cargando config video"); }
}

async function saveVideoConfig() {
    const url = document.getElementById('youtube-url-input').value;
    if(!url) return alert("Pega un enlace válido");
    
    try {
        await authFetch(`${API_URL}/manager/config`, { // POST
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ youtubeUrl: url })
        });
        alert("Video actualizado correctamente en la portada.");
    } catch(e) { alert("Error al guardar video"); }
}

// --- ELIMINAR PEDIDO ---
async function deleteOrder(id) {
    if(!confirm(`⚠️ ¡CUIDADO!\n\nEstás a punto de eliminar permanentemente el pedido #${id}.\nEsta acción no se puede deshacer.\n\n¿Estás seguro?`)) return;

    try {
        const res = await authFetch(`${API_URL}/manager/orders/${id}`, {
            method: 'DELETE'
        });

        if(res.ok) {
            closeOrderModal();
            loadOrders(); // Recargar la lista para que desaparezca
            // Feedback visual opcional
            alert("Pedido eliminado correctamente.");
        } else {
            alert("No se pudo eliminar el pedido.");
        }
    } catch(e) {
        alert("Error de conexión al intentar eliminar.");
    }
}

// --- FILTRO POR FECHAS ---

function filterOrdersByDate() {
    const startInput = document.getElementById('filter-date-start').value;
    const endInput = document.getElementById('filter-date-end').value;

    if (!startInput && !endInput) {
        renderOrdersList(allOrders); // Si no hay fechas, mostrar todo
        return;
    }

    const filtered = allOrders.filter(o => {
        // La fecha viene de la BD así: "2023-11-20T14:30:00.000Z"
        // Cortamos los primeros 10 caracteres para tener "2023-11-20"
        const orderDate = o.fecha_pedido.substring(0, 10);
        
        let isValid = true;
        if (startInput) isValid = isValid && (orderDate >= startInput);
        if (endInput) isValid = isValid && (orderDate <= endInput);
        
        return isValid;
    });

    renderOrdersList(filtered);
}

function clearDateFilter() {
    document.getElementById('filter-date-start').value = '';
    document.getElementById('filter-date-end').value = '';
    renderOrdersList(allOrders); // Restaurar lista completa
}

// ==========================================
// SISTEMA DE ACTUALIZACIÓN EN TIEMPO REAL (AUTO-POLLING)
// ==========================================

let lastOrderId = null; // Para recordar cuál fue el último pedido

function startLiveUpdates() {
    // Ejecutar cada 5 segundos (5000 ms)
    setInterval(async () => {
        // Solo verificamos si estamos en la vista de pedidos para ahorrar recursos
        const ordersView = document.getElementById('view-orders');
        if (ordersView.style.display === 'none') return;

        try {
            // 1. Consultar servidor silenciosamente
            const res = await authFetch(`${API_URL}/manager/orders`);
            const freshOrders = await res.json();

            if (freshOrders.length === 0) return;

            // 2. Detectar si hay cambios (comparamos el ID del pedido más reciente)
            const latestOrder = freshOrders[0]; // Como vienen ordenados DESC, el 0 es el último
            
            // Si es la primera carga, solo guardamos el ID
            if (lastOrderId === null) {
                lastOrderId = latestOrder.id;
                return; 
            }

            // 3. Si el ID más nuevo es diferente al que teníamos, ¡HAY PEDIDO NUEVO!
            if (latestOrder.id !== lastOrderId) {
                
                // Actualizamos la memoria
                lastOrderId = latestOrder.id;
                allOrders = freshOrders; 

                // Refrescamos la interfaz visualmente
                const pending = allOrders.filter(o => o.estado === 'PENDIENTE').length;
                document.getElementById('kpi-pending').innerText = pending;
                
                const today = new Date().toISOString().slice(0,10);
                const totalToday = allOrders
                    .filter(o => o.fecha_pedido.startsWith(today) && o.estado !== 'CANCELADO')
                    .reduce((acc, o) => acc + Number(o.total_venta), 0);
                document.getElementById('kpi-total-today').innerText = `$${totalToday.toLocaleString()}`;

                // Repintar la lista (Manteniendo el filtro de fecha si existe)
                // Nota: Si tienes un filtro de fecha activo, usa la función de filtro, si no, render normal
                const startInput = document.getElementById('filter-date-start').value;
                if(startInput) {
                    filterOrdersByDate(); // Si hay filtro, respetarlo
                } else {
                    renderOrdersList(); // Si no, mostrar todo
                }

                // 4. Feedback Visual y Sonoro (Notificación)
                playNotificationSound();
                showToastNotification(`¡Nuevo Pedido #${latestOrder.id}!`);
            }

        } catch (e) {
            console.error("Conexión perdida momentáneamente...");
        }
    }, 5000); // <-- Intervalo de 5 segundos
}

// Utilidades para notificar
function showToastNotification(message) {
    // Crea una etiqueta flotante temporal
    const toast = document.createElement('div');
    toast.style.cssText = "position: fixed; bottom: 20px; right: 20px; background: #2C3325; color: white; padding: 15px 25px; border-radius: 8px; box-shadow: 0 10px 30px rgba(0,0,0,0.2); font-weight: bold; z-index: 1000; animation: slideIn 0.3s ease-out;";
    toast.innerText = message;
    document.body.appendChild(toast);

    // Sonido simple del sistema (Beep)
    // Para un sonido real mp3, necesitarías un archivo de audio.
    
    // Eliminar después de 4 segundos
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 500);
    }, 4000);
}

// ==========================================
// CONFIGURACIÓN DE TIENDA (Autentika)
// ==========================================

let storeConfig = {
    logoUrl: '',
    showcaseImages: ['', ''], // Espacios para 2 fotos
    youtubeId: ''
};

async function loadStoreConfig() {
    try {
        const res = await authFetch(`${API_URL}/config`);
        const data = await res.json();
        
        // Rellenar inputs
        document.getElementById('config-name').value = data.businessName || 'Autentika';
        document.getElementById('config-history').value = data.historyText || '';
        document.getElementById('preview-logo').src = data.logoUrl || '';
        
        if(data.youtubeId) {
            document.getElementById('config-video').value = `https://youtube.com/watch?v=${data.youtubeId}`;
        }

        // Fotos Showcase
        if(data.showcaseImages) {
            if(data.showcaseImages[0]) document.getElementById('preview-showcase-1').src = data.showcaseImages[0];
            if(data.showcaseImages[1]) document.getElementById('preview-showcase-2').src = data.showcaseImages[1];
            storeConfig.showcaseImages = data.showcaseImages;
        }
        
        storeConfig.logoUrl = data.logoUrl;

    } catch(e) { console.error("Error cargando config"); }
}

async function uploadAsset(type) {
    let fileInput;
    if(type === 'logo') fileInput = document.getElementById('logo-upload');
    if(type === 'showcase1') fileInput = document.getElementById('showcase-upload-1');
    if(type === 'showcase2') fileInput = document.getElementById('showcase-upload-2');

    const file = fileInput.files[0];
    if(!file) return;

    const formData = new FormData();
    formData.append('image', file);

    try {
        const res = await authFetch(`${API_URL}/manager/upload-asset`, {
            method: 'POST',
            body: formData
        });
        const data = await res.json();

        if(data.success) {
            // Actualizar vista previa y memoria
            if(type === 'logo') {
                storeConfig.logoUrl = data.imageUrl;
                document.getElementById('preview-logo').src = data.imageUrl;
            }
            if(type === 'showcase1') {
                storeConfig.showcaseImages[0] = data.imageUrl;
                document.getElementById('preview-showcase-1').src = data.imageUrl;
            }
            if(type === 'showcase2') {
                storeConfig.showcaseImages[1] = data.imageUrl;
                document.getElementById('preview-showcase-2').src = data.imageUrl;
            }
        }
    } catch(e) { alert("Error subiendo imagen"); }
}

async function saveBrandConfig() {
    const name = document.getElementById('config-name').value;
    const history = document.getElementById('config-history').value;
    const videoUrl = document.getElementById('config-video').value;

    const payload = {
        businessName: name,
        historyText: history,
        logoUrl: storeConfig.logoUrl,
        showcaseImages: storeConfig.showcaseImages,
        youtubeUrl: videoUrl // El backend procesará esto para sacar el ID
    };

    try {
        await authFetch(`${API_URL}/manager/config`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        });
        alert("¡Tienda actualizada! Recarga la página principal para ver los cambios.");
    } catch(e) { alert("Error guardando"); }
}

// ==========================================
// GESTIÓN DE USUARIOS
// ==========================================

async function loadUsers() {
    const container = document.getElementById('users-list-container');
    container.innerHTML = '<p style="color:gray;">Cargando...</p>';

    try {
        const res = await authFetch(`${API_URL}/manager/users`);
        const users = await res.json();

        if(users.length === 0) {
            container.innerHTML = '<p>No hay usuarios.</p>';
            return;
        }

        container.innerHTML = '';
        users.forEach(u => {
            const div = document.createElement('div');
            div.style.cssText = "display: flex; justify-content: space-between; align-items: center; padding: 15px; border-bottom: 1px solid #eee;";
            
            div.innerHTML = `
                <div style="display:flex; align-items:center; gap:10px;">
                    <div style="background:#556B2F; color:white; width:35px; height:35px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:bold;">
                        ${u.usuario.charAt(0).toUpperCase()}
                    </div>
                    <span style="font-weight:bold; color:#333;">${u.usuario}</span>
                </div>
                <button onclick="deleteUser(${u.id})" style="color:#EF4444; background:none; border:none; cursor:pointer;" title="Eliminar">
                    <span class="material-icons-round">delete</span>
                </button>
            `;
            container.appendChild(div);
        });

    } catch(e) {
        console.error(e);
        container.innerHTML = '<p style="color:red;">Error cargando lista.</p>';
    }
}

async function createNewUser(e) {
    e.preventDefault(); // Evita que la página se recargue

    const user = document.getElementById('new-user-name').value;
    const pass = document.getElementById('new-user-pass').value;
    const btn = e.target.querySelector('button');

    // Desactivar botón para evitar doble clic
    btn.disabled = true;
    btn.innerText = "Creando...";

    try {
        const res = await authFetch(`${API_URL}/manager/users`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ usuario: user, password: pass })
        });

        const data = await res.json();

        if(res.ok) {
            alert(`✅ Usuario "${user}" creado correctamente.`);
            // Limpiar formulario
            document.getElementById('new-user-name').value = '';
            document.getElementById('new-user-pass').value = '';
            // Recargar lista
            loadUsers();
        } else {
            alert("Error: " + (data.error || "No se pudo crear"));
        }

    } catch(err) {
        alert("Error de conexión");
    } finally {
        btn.disabled = false;
        btn.innerText = "Crear Usuario";
    }
}

async function deleteUser(id) {
    if(!confirm("¿Estás seguro de eliminar este usuario? Esta acción es irreversible.")) return;

    try {
        const res = await authFetch(`${API_URL}/manager/users/${id}`, {
            method: 'DELETE'
        });
        
        const data = await res.json();
        
        if(res.ok) {
            loadUsers(); // Recargar lista
        } else {
            alert("Error: " + (data.error || "No se pudo eliminar"));
        }
    } catch(e) {
        alert("Error al intentar eliminar.");
    }
}

// Agregar llamada en switchView
// if(viewName === 'config') loadStoreConfig();

function playNotificationSound() {
    // Intenta reproducir un sonido genérico o crea un objeto Audio si tienes el archivo
    // const audio = new Audio('notification.mp3');
    // audio.play().catch(e => console.log("Audio bloqueado por navegador"));
}


// INICIAR EL VIGILANTE
startLiveUpdates();

// INICIO
loadOrders();