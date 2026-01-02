import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
// import { getFirestore } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// // --- CONFIG ---
// const firebaseConfig = {
//   apiKey: "TU_API_KEY", 
//   authDomain: "TU_PROJECT.firebaseapp.com",
//   projectId: "TU_PROJECT_ID",
//   storageBucket: "TU_PROJECT.appspot.com",
//   messagingSenderId: "...",
//   appId: "..."
// };

// const app = initializeApp(firebaseConfig);
// const auth = getAuth(app);

// --- CONFIGURACIÓN FIJA ---
const API_BASE_URL = 'http://localhost:3000'; // Tu servidor real

// --- ESTADO ---
let allProducts = [];
let cart = JSON.parse(localStorage.getItem('tshop_cart')) || [];

// --- INIT ---
document.addEventListener('DOMContentLoaded', () => {
    // Listeners UI Globales
    document.getElementById('cart-btn').onclick = () => toggleCart();
    document.getElementById('menu-btn').onclick = () => {
        const menu = document.getElementById('mobile-menu');
        menu.classList.toggle('hidden');
        menu.classList.toggle('flex');
    };
    
    // Listeners Checkout
    document.getElementById('back-to-cart-btn').onclick = showCartList;
    document.getElementById('checkout-form').onsubmit = submitOrder;

    updateCartUI();
    
    // CONEXIÓN AUTOMÁTICA AL INICIAR
    fetchTunnelData();
});

// --- API & DATA ---

async function fetchTunnelData() {
    showLoader(true);
    document.getElementById('error-message')?.classList.add('hidden');
    
    // Actualizar indicador visual (badge verde)
    const badge = document.getElementById('connection-badge');
    if(badge) badge.innerHTML = `<i data-lucide="loader" class="animate-spin w-3 h-3"></i> Conectando...`;

    try {
        // Usamos la URL fija de tu dominio
        const res = await fetch(`${API_BASE_URL}/api/products`);
        
        if (!res.ok) throw new Error("Error conectando a API");
        
        allProducts = await res.json();
        
        // Si hay éxito:
        generateFilters();
        // IMPORTANTE: Recuerda que cambiamos renderProducts para la paginación
        // Aquí llamamos a la función que inicia el renderizado
        renderProducts(allProducts); 
        
        // Renderizar carrusel si existe la función
        if(typeof renderCarousel === 'function') renderCarousel(allProducts);

        if(badge) {
            badge.className = "flex items-center gap-1 bg-green-50 text-green-700 px-3 py-1 rounded-full text-[10px] font-black border border-green-200 uppercase tracking-wide";
            badge.innerHTML = `<i data-lucide="wifi" class="w-3 h-3"></i> Online`;
        }
        
        showLoader(false);
    } catch (err) {
        console.error(err);
        showLoader(false);
        if(badge) {
            badge.className = "flex items-center gap-1 bg-red-50 text-red-700 px-3 py-1 rounded-full text-[10px] font-black border border-red-200 uppercase tracking-wide";
            badge.innerHTML = `<i data-lucide="wifi-off" class="w-3 h-3"></i> Offline`;
        }
        
        // Mostrar mensaje de error amigable en la grilla
        const grid = document.getElementById('products-grid');
        grid.innerHTML = `
            <div class="col-span-full text-center py-10">
                <p class="text-gray-400">No se pudo conectar con el servidor.</p>
                <button onclick="fetchTunnelData()" class="mt-4 text-brand-orange font-bold underline">Reintentar</button>
            </div>
        `;
    }
    lucide.createIcons();
}

// --- RENDERIZADO PRODUCTOS ---

// --- VARIABLES GLOBALES DE PAGINACIÓN ---
let currentListForDisplay = []; // Lista filtrada actual (para búsqueda/filtros)
let itemsShown = 0;             // Contador actual
const ITEMS_PER_BATCH = 12;     // Cuántos mostrar por vez

// --- REEMPLAZA TU FUNCIÓN renderProducts POR ESTA ---
function renderProducts(products) {
    // 1. Guardamos la lista completa que recibimos (sea todos, filtrados o búsqueda)
    currentListForDisplay = products;
    
    // 2. Reseteamos el contador
    itemsShown = 0;
    
    // 3. Limpiamos el grid
    const grid = document.getElementById('products-grid');
    grid.innerHTML = '';
    
    // 4. Manejo de estado vacío
    const emptyState = document.getElementById('empty-state');
    if (!products || products.length === 0) {
        grid.classList.add('hidden');
        if(emptyState) emptyState.classList.remove('hidden');
        document.getElementById('load-more-container').classList.add('hidden'); // Ocultar botón
        return;
    }
    
    grid.classList.remove('hidden');
    if(emptyState) emptyState.classList.add('hidden');

    // 5. LLAMAMOS A LA FUNCIÓN QUE DIBUJA EL PRIMER LOTE
    loadMoreProducts();
}

// --- NUEVA FUNCIÓN PARA EL BOTÓN "CARGAR MÁS" ---
window.loadMoreProducts = () => {
    const grid = document.getElementById('products-grid');
    const btnContainer = document.getElementById('load-more-container');
    
    // Calcular el siguiente lote
    const nextBatch = currentListForDisplay.slice(itemsShown, itemsShown + ITEMS_PER_BATCH);
    
    // Renderizar este lote
    nextBatch.forEach(p => {
        const precio = formatCurrency(p.precio);
        
        // Lógica simplificada de imagen: siempre vertical y limpia para belleza
        const imgContent = p.imagen_url 
            ? `<img src="${p.imagen_url}" class="h-64 w-full object-cover group-hover:scale-105 transition duration-700 ease-in-out" loading="lazy" alt="${p.nombre}">`
            : `<div class="h-64 w-full flex items-center justify-center bg-gray-50 text-gray-300"><i data-lucide="image" class="w-10 h-10"></i></div>`;

        const card = document.createElement('div');
        // Estilo: Borde muy sutil, fondo blanco, sin sombras duras
        card.className = "bg-white group cursor-pointer fade-in relative"; 
        
        card.onclick = (e) => { if(!e.target.closest('.add-btn-direct')) openModal(p); };

        card.innerHTML = `
            <div class="relative overflow-hidden rounded-2xl bg-gray-100 mb-4 shadow-sm border border-gray-100">
                ${imgContent}
                
                ${p.cantidad < 5 ? `<span class="absolute top-3 left-3 bg-white/90 backdrop-blur text-red-800 text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider">Últimas und</span>` : ''}
                
                <button onclick="addToCartById('${p.id}'); event.stopPropagation();" 
                    class="add-btn-direct absolute bottom-3 right-3 w-10 h-10 bg-white hover:bg-brand-olive hover:text-white rounded-full shadow-lg flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0">
                    <i data-lucide="plus" class="w-5 h-5"></i>
                </button>
            </div>

            <div class="text-center px-2">
                <p class="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">${p.linea || 'Cuidado General'}</p>
                <h4 class="font-serif text-lg text-gray-900 leading-tight mb-2 group-hover:text-brand-olive transition-colors">${p.nombre}</h4>
                <p class="font-light text-gray-900 text-lg">${precio}</p>
            </div>
        `;
        grid.appendChild(card);
    });

    // Actualizar contador
    itemsShown += nextBatch.length;
    
    // Actualizar textos del contador
    document.getElementById('showing-count').innerText = itemsShown;
    document.getElementById('total-count').innerText = currentListForDisplay.length;

    // Decidir si mostramos u ocultamos el botón
    if (itemsShown >= currentListForDisplay.length) {
        btnContainer.classList.add('hidden'); // Ya mostramos todo
    } else {
        btnContainer.classList.remove('hidden'); // Faltan productos
    }

    lucide.createIcons();
};

// --- LOGICA CARRITO Y CHECKOUT ---

window.showCheckoutForm = () => {
    if (cart.length === 0) return alert("El carrito está vacío");
    document.getElementById('cart-view-list').classList.add('hidden');
    document.getElementById('cart-view-checkout').classList.remove('hidden');
    document.getElementById('cart-title').innerText = "Finalizar Pedido";
    document.getElementById('back-to-cart-btn').classList.remove('hidden');
    
    // Forzamos la actualización inicial (para que calcule el total según el select por defecto)
    const currentMethod = document.getElementById('cust-method').value;
    updatePaymentInfo(currentMethod);
};
window.showCartList = () => {
    document.getElementById('cart-view-list').classList.remove('hidden');
    document.getElementById('cart-view-checkout').classList.add('hidden');
    document.getElementById('cart-title').innerText = "Tu Carrito";
    document.getElementById('back-to-cart-btn').classList.add('hidden');
};

async function submitOrder(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<i data-lucide="loader" class="animate-spin w-5 h-5"></i> Enviando...`;
    lucide.createIcons();

    // RECOLECCIÓN DE DATOS ACTUALIZADA
    const orderData = {
        nombre: document.getElementById('cust-name').value,
        cedula: document.getElementById('cust-cedula').value,
        telefono: document.getElementById('cust-phone').value,
        email: document.getElementById('cust-email').value,
        
        departamento: document.getElementById('cust-dept').value,
        ciudad: document.getElementById('cust-city').value,
        direccion: document.getElementById('cust-address').value,
        barrio: document.getElementById('cust-barrio').value,
        
        metodo: document.getElementById('cust-method').value,
        total: getFinalTotal((acc, item) => acc + (item.precio * item.qty), 0),
        productos: cart
    };

    const urlInput = document.getElementById('tunnel-url');
    let url = urlInput.value.trim() || 'http://localhost:3000';
    url = url.replace(/\/$/, "");

    try {
        const res = await fetch(`${url}/api/checkout`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orderData)
        });

        const data = await res.json();

        if (data.success) {
            alert(`¡Pedido Confirmado!\nID de Orden: #${data.orderId}\nGracias por tu compra.`);
            cart = []; // Limpiar carrito
            saveCart();
            updateCartUI();
            toggleCart(false); // Cerrar
            showCartList(); // Resetear vista
            e.target.reset(); // Limpiar form
        } else {
            throw new Error(data.error || "Error desconocido");
        }
    } catch (err) {
        alert("Error al enviar pedido: " + err.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

// --- FUNCIONES BASE CARRITO ---

window.addToCartById = (id) => {
    const product = allProducts.find(p => String(p.id) === String(id));
    if (!product) return;
    
    const existingItem = cart.find(item => String(item.id) === String(id));
    if (existingItem) existingItem.qty++;
    else cart.push({ ...product, qty: 1 });
    
    saveCart();
    updateCartUI();
    toggleCart(true); 
};

window.changeQty = (id, delta) => {
    const item = cart.find(i => String(i.id) === String(id));
    if (!item) return;
    item.qty += delta;
    if (item.qty <= 0) window.removeFromCart(id);
    else {
        saveCart();
        updateCartUI();
    }
};

window.removeFromCart = (id) => {
    cart = cart.filter(i => String(i.id) !== String(id));
    saveCart();
    updateCartUI();
};

function saveCart() { localStorage.setItem('tshop_cart', JSON.stringify(cart)); }

function updateCartUI() {
    const container = document.getElementById('cart-items-container');
    const badge = document.getElementById('cart-counter');
    const totalEl = document.getElementById('cart-total');
    const emptyStateCart = document.getElementById('cart-empty-state');
    const btnCheckout = document.getElementById('btn-checkout-init');

    const totalQty = cart.reduce((acc, item) => acc + item.qty, 0);
    badge.innerText = totalQty;
    badge.classList.toggle('hidden', totalQty === 0);

    container.innerHTML = '';
    let totalPrice = 0;

    if (cart.length === 0) {
        emptyStateCart.classList.remove('hidden');
        btnCheckout.classList.add('hidden'); // Ocultar botón pagar si no hay items
    } else {
        emptyStateCart.classList.add('hidden');
        btnCheckout.classList.remove('hidden');
        
        cart.forEach(item => {
            const itemTotal = item.precio * item.qty;
            totalPrice += itemTotal;
            const li = document.createElement('li');
            li.className = "flex py-6 fade-in border-b border-gray-100 last:border-0";
            
            const imgHtml = item.imagen_url 
                ? `<img src="${item.imagen_url}" class="h-20 w-20 flex-none rounded-lg border border-gray-200 object-contain bg-white">`
                : `<div class="h-20 w-20 flex-none rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center"><i data-lucide="package" class="w-8 h-8 text-gray-300"></i></div>`;

            li.innerHTML = `
                ${imgHtml}
                <div class="ml-4 flex flex-1 flex-col justify-between">
                    <div>
                        <div class="flex justify-between text-base font-medium text-gray-900">
                            <h3 class="line-clamp-1 font-bold">${item.nombre}</h3>
                            <p class="ml-4 font-bold text-gray-900">${formatCurrency(itemTotal)}</p>
                        </div>
                        <p class="mt-1 text-xs text-gray-500 uppercase tracking-wide">${item.linea || 'General'}</p>
                    </div>
                    <div class="flex flex-1 items-end justify-between text-sm mt-2">
                        <div class="flex items-center bg-gray-50 rounded-lg border border-gray-200">
                            <button onclick="changeQty('${item.id}', -1)" class="w-8 h-8 flex items-center justify-center hover:bg-gray-200 rounded-l-lg text-gray-600 font-bold">-</button>
                            <span class="w-8 text-center text-gray-900 font-medium text-xs">${item.qty}</span>
                            <button onclick="changeQty('${item.id}', 1)" class="w-8 h-8 flex items-center justify-center hover:bg-gray-200 rounded-r-lg text-gray-600 font-bold">+</button>
                        </div>
                        <button type="button" onclick="removeFromCart('${item.id}')" class="font-medium text-red-500 hover:text-red-700 text-xs underline">Eliminar</button>
                    </div>
                </div>
            `;
            container.appendChild(li);
        });
    }
    totalEl.innerText = formatCurrency(totalPrice);
    // Si estamos en vista checkout, actualizamos también ese total
    const displayCheckout = document.getElementById('checkout-total-display');
    if(displayCheckout) displayCheckout.innerText = formatCurrency(totalPrice);
    
    lucide.createIcons();
}

// --- UTILIDADES ---

window.toggleCart = (forceOpen = null) => {
    const sidebar = document.getElementById('cart-sidebar');
    const panel = document.getElementById('cart-panel');
    const isOpen = !sidebar.classList.contains('hidden');
    const shouldOpen = forceOpen !== null ? forceOpen : !isOpen;

    if (shouldOpen) {
        sidebar.classList.remove('hidden');
        setTimeout(() => panel.classList.remove('translate-x-full'), 10);
    } else {
        // Reset a vista lista al cerrar
        setTimeout(showCartList, 500); 
        panel.classList.add('translate-x-full');
        setTimeout(() => sidebar.classList.add('hidden'), 500);
    }
};

// EN app.js

window.openModal = (p) => {
    // Llenar datos básicos
    document.getElementById('modal-title').innerText = p.nombre;
    document.getElementById('modal-price').innerText = formatCurrency(p.precio);
    document.getElementById('modal-stock').innerText = p.cantidad || 0;
    
    // Llenar categoría (Si existe el elemento en el HTML)
    const catEl = document.getElementById('modal-category');
    if(catEl) catEl.innerText = p.linea || 'General';

    // --- LÓGICA DE DESCRIPCIÓN (LA PARTE QUE PEDISTE) ---
    const descEl = document.getElementById('modal-desc');
    
    // Convertimos saltos de línea (\n) en <br> para que se vea bien el formato
    // Y verificamos si hay texto real
    if (p.descripcion && p.descripcion.trim() !== "") {
        descEl.innerHTML = p.descripcion.replace(/\n/g, '<br>'); 
        descEl.classList.remove('hidden'); // Mostrar si hay texto
        descEl.style.display = 'block';    // Asegurar display block
    } else {
        descEl.innerHTML = '';
        descEl.classList.add('hidden');    // Ocultar totalmente si no hay texto
        descEl.style.display = 'none';
    }
    // ----------------------------------------------------

    // Imagen
    const container = document.getElementById('modal-img-container');
    container.innerHTML = p.imagen_url 
        ? `<img src="${p.imagen_url}" class="max-h-full max-w-full object-contain">` 
        : `<i data-lucide="package" class="w-24 h-24 text-gray-300"></i>`;

    // Botón de agregar
    document.getElementById('modal-add-btn').onclick = () => {
        addToCartById(p.id);
        document.getElementById('product-modal').classList.add('hidden');
    };

    // Mostrar el modal (usando tu ID original de Tailwind)
    document.getElementById('product-modal').classList.remove('hidden');
    lucide.createIcons();
};

window.closeModal = () => document.getElementById('product-modal').classList.add('hidden');

function generateFilters() {
    const filterContainer = document.getElementById('category-filters');
    // Obtenemos categorías únicas
    const lineas = ['Todas', ...new Set(allProducts.map(p => p.linea || 'General'))];
    
    filterContainer.innerHTML = lineas.map(cat => `
        <button onclick="filterBy('${cat}')" class="filter-btn whitespace-nowrap px-6 py-2 rounded-full text-xs font-bold tracking-wide transition-all border border-transparent">
            ${cat}
        </button>
    `).join('');
    
    window.filterBy = (catName) => {
        document.querySelectorAll('.filter-btn').forEach(b => {
            const isActive = b.innerText.trim() === catName;
            // Estilo Activo: Verde Oliva + Texto Blanco + Sombra suave
            // Estilo Inactivo: Fondo Gris Muy Claro + Texto Gris + Hover Oscuro
            b.className = isActive 
                ? "filter-btn whitespace-nowrap px-6 py-2 rounded-full text-xs font-bold tracking-wide transition-all border border-brand-olive bg-brand-olive text-white shadow-md transform scale-105"
                : "filter-btn whitespace-nowrap px-6 py-2 rounded-full text-xs font-bold tracking-wide transition-all border border-transparent bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-brand-dark";
        });
        
        if (catName === 'Todas') renderProducts(allProducts);
        else renderProducts(allProducts.filter(p => (p.linea || 'General') === catName));
    };

    // Activar 'Todas' por defecto si hay datos
    if(lineas.length > 0) window.filterBy('Todas');
}
function setMode(mode) {
    currentMode = mode;
    const fbControls = document.getElementById('firebase-controls');
    const tnControls = document.getElementById('tunnel-controls');
    if (mode === 'firebase') {
        fbControls.classList.remove('hidden');
        tnControls.classList.add('hidden');
        renderProducts([]);
    } else {
        fbControls.classList.add('hidden');
        tnControls.classList.remove('hidden');
        renderProducts([]);
    }
}

window.searchProductsFront = (term) => {
    const lowerTerm = term.toLowerCase();
    const filtered = allProducts.filter(p => 
        p.nombre.toLowerCase().includes(lowerTerm) || 
        (p.linea && p.linea.toLowerCase().includes(lowerTerm))
    );
    renderProducts(filtered);
    
    // Si no hay resultados, mostramos el estado vacío
    const emptyState = document.getElementById('empty-state');
    if (filtered.length === 0) {
        document.getElementById('products-grid').classList.add('hidden');
        if(emptyState) emptyState.classList.remove('hidden');
    }
};

function showLoader(show) { 
    document.getElementById('loader').classList.toggle('hidden', !show); 
}

function formatCurrency(val) {
    return Number(val).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
}

let currentSlide = 0;
let featuredProducts = [];

// --- CARRUSEL ESTILO EDITORIAL (Aura Beauty) ---
function renderCarousel(products) {
    // 1. Filtrar solo los marcados como destacados en la BD
    featuredProducts = products.filter(p => p.destacado);
    
    const section = document.getElementById('featured-section');
    const track = document.getElementById('carousel-track');
    const dotsContainer = document.getElementById('carousel-dots');

    // Seguridad: Si no hay elementos en el HTML o no hay productos destacados, ocultamos
    if (!section || !track || featuredProducts.length === 0) {
        if(section) section.classList.add('hidden');
        return;
    }

    section.classList.remove('hidden');
    track.innerHTML = '';
    dotsContainer.innerHTML = '';

    featuredProducts.forEach((p, index) => {
        // Formatear precio
        const precio = formatCurrency(p.precio);

        // Slide HTML - Diseño dividido (Imagen Izq / Texto Der)
        const slide = document.createElement('div');
        slide.className = "w-full flex-shrink-0 flex flex-col md:flex-row min-h-[400px] relative";
        
        // Lógica de imagen segura (por si no carga)
        const imgSrc = p.imagen_url || 'https://via.placeholder.com/800x600/E6E2D3/556B2F?text=Aura+Product';

        slide.innerHTML = `
            <div class="md:w-1/2 relative h-64 md:h-auto overflow-hidden group">
                <img src="${imgSrc}" class="absolute inset-0 w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105" alt="${p.nombre}">
                <div class="absolute top-6 left-6 bg-white/90 backdrop-blur px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest text-brand-olive shadow-sm">
                    Recomendado
                </div>
            </div>
            
            <div class="md:w-1/2 p-10 md:p-16 flex flex-col justify-center items-start space-y-4 bg-brand-cream relative">
                <div class="absolute top-0 right-0 p-10 opacity-10 pointer-events-none">
                    <i data-lucide="sparkles" class="w-32 h-32 text-brand-olive"></i>
                </div>

                <h2 class="text-3xl md:text-5xl font-serif text-brand-dark leading-tight">
                    ${p.nombre}
                </h2>
                
                <p class="text-xl text-brand-olive font-medium font-serif italic">${precio}</p>
                
                <p class="text-gray-500 text-sm leading-relaxed line-clamp-2 max-w-md">
                   ${p.descripcion || 'Descubre la fórmula natural que transforma tu rutina diaria con ingredientes seleccionados.'}
                </p>

                <div class="pt-4">
                    <button onclick="addToCartById('${p.id}')" class="bg-brand-dark text-white hover:bg-brand-olive transition-colors px-8 py-3 rounded-lg font-bold uppercase text-xs tracking-widest flex items-center gap-2 shadow-lg">
                        <i data-lucide="shopping-bag" class="w-4 h-4"></i>
                        Lo quiero
                    </button>
                </div>
            </div>
        `;
        track.appendChild(slide);

        // Dot (Indicador) HTML
        const dot = document.createElement('button');
        // Estilo del punto: Si está activo es verde oliva alargado, si no, gris redondo
        dot.className = `h-2 rounded-full transition-all duration-300 ${index === 0 ? 'w-8 bg-brand-olive' : 'w-2 bg-gray-300 hover:bg-brand-olive/50'}`;
        dot.onclick = () => goToSlide(index);
        dotsContainer.appendChild(dot);
    });
    
    // Recargar iconos (flechas y bolsa)
    lucide.createIcons();

    // Reiniciar autoplay si existía
    if(window.carouselInterval) clearInterval(window.carouselInterval);
    window.carouselInterval = setInterval(() => moveCarousel(1), 6000); // 6 segundos
}

window.moveCarousel = (direction) => {
    const total = featuredProducts.length;
    if (total === 0) return;
    
    currentSlide = (currentSlide + direction + total) % total;
    updateCarousel();
};

window.goToSlide = (index) => {
    currentSlide = index;
    updateCarousel();
};

function updateCarousel() {
    const track = document.getElementById('carousel-track');
    const dots = document.getElementById('carousel-dots').children;
    track.style.transform = `translateX(-${currentSlide * 100}%)`;
    
    Array.from(dots).forEach((dot, idx) => {
        dot.className = `h-2 rounded-full transition-all duration-300 ${idx === currentSlide ? 'w-8 bg-brand-olive' : 'w-2 bg-gray-300'}`;
    });
}

// Actualiza el mensaje azul según el método seleccionado
window.updatePaymentInfo = (method) => {
    const infoText = document.getElementById('payment-info-text');
    const alertBox = document.getElementById('payment-alert');
    const totalDisplay = document.getElementById('checkout-total-display');
    
    // 1. Actualizar estilos y mensajes
    alertBox.className = "mt-3 border-l-4 p-3 rounded-r-md flex gap-3 transition-all duration-300 bg-blue-50 border-blue-500";
    let iconHTML = `<i data-lucide="info" class="h-4 w-4 text-blue-500 mt-0.5"></i>`;

    if (method === 'Contraentrega') {
        infoText.innerHTML = `<strong>Pago seguro:</strong> Pagas en efectivo al recibir el producto.`;
    } 
    else if (method === 'Transferencia') {
        infoText.innerHTML = `<strong>Bancolombia / Nequi:</strong> Sin costos adicionales. Te enviaremos los datos por WhatsApp.`;
    } 
    else if (method === 'MercadoPago') {
        alertBox.className = "mt-3 border-l-4 p-3 rounded-r-md flex gap-3 transition-all duration-300 bg-sky-50 border-sky-600";
        iconHTML = `<i data-lucide="credit-card" class="h-4 w-4 text-sky-600 mt-0.5"></i>`;
        
        // AQUÍ AGREGAMOS LA INFORMACIÓN DEL AUMENTO
        infoText.innerHTML = `<strong>PSE y Tarjetas:</strong> Generaremos un Link de Pago Seguro de Mercado Pago y Te lo Enviaremos Por Whtasapp. <br><span class="text-red-600 font-bold text-[10px] mt-1 block">⚠️ Aplica comisión del 3.29% por uso de plataforma.</span>`;
    }

    // Actualizar icono
    const iconContainer = alertBox.querySelector('div');
    if(iconContainer) {
        iconContainer.innerHTML = iconHTML;
        lucide.createIcons();
    }

    // 2. ACTUALIZAR EL TOTAL VISUALMENTE
    const newTotal = getFinalTotal();
    totalDisplay.innerText = formatCurrency(newTotal);
    
    // Si hay recargo, podemos poner el texto en rojo o naranja para resaltar
    if (method === 'MercadoPago') {
        totalDisplay.classList.add('text-brand-orange');
        totalDisplay.classList.remove('text-gray-900');
    } else {
        totalDisplay.classList.add('text-gray-900');
        totalDisplay.classList.remove('text-brand-orange');
    }
};

// Función auxiliar para calcular el total con o sin comisión
function getFinalTotal() {
    const rawTotal = cart.reduce((acc, item) => acc + (item.precio * item.qty), 0);
    const method = document.getElementById('cust-method').value;
    
    // Si es MercadoPago, sumamos el 3.29%
    if (method === 'MercadoPago') {
        return rawTotal * 1.0329; // Multiplicar por 1.0329 es igual a sumar 3.29%
    }
    return rawTotal;
}

// Función para abrir/cerrar el modal de contacto
window.toggleContactModal = () => {
    const modal = document.getElementById('modal-contact');
    
    if (modal.classList.contains('hidden')) {
        modal.classList.remove('hidden');
        modal.classList.add('fade-in'); // Usamos tu animación existente
    } else {
        modal.classList.add('hidden');
    }
    // Recargar iconos por si acaso
    lucide.createIcons();
};

// --- LÓGICA DE VIDEO ---
let globalYoutubeId = '';

// 1. Cargar configuración al iniciar
// --- CARGAR IDENTIDAD DE MARCA ---
async function fetchConfig() {
    try {
        const res = await fetch(`${API_BASE_URL}/api/config`);
        const data = await res.json();
        
        // 1. Video (Ya existía)
        if(data.youtubeId) globalYoutubeId = data.youtubeId;

        // 2. Identidad Básica (Nombre y Logo)
        if(data.businessName) {
            document.querySelectorAll('#brand-name, #brand-name-modal').forEach(el => el.innerText = data.businessName);
            document.title = data.businessName; // Cambia título de la pestaña
        }
        if(data.logoUrl) {
            document.querySelectorAll('#brand-logo, #brand-logo-modal').forEach(el => el.src = data.logoUrl);
        }

        // 3. Historia
        if(data.historyText) {
            document.getElementById('brand-history').innerText = data.historyText;
        }

        // 4. Galería de Fotos (Showcase)
        const showcaseGrid = document.getElementById('brand-showcase');
        if(showcaseGrid && data.showcaseImages && data.showcaseImages.length > 0) {
            showcaseGrid.innerHTML = data.showcaseImages.map(img => `
                <div class="h-32 rounded-lg overflow-hidden shadow-sm border border-brand-sand group">
                    <img src="${img}" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700">
                </div>
            `).join('');
        }

    } catch(e) { console.log("Usando configuración por defecto"); }
}
// Agrega fetchConfig() dentro del evento DOMContentLoaded al inicio de tu archivo

// 2. Abrir Modal
window.openVideoModal = () => {
    if(!globalYoutubeId) return alert("Pronto tendremos nuestro video oficial disponible.");
    
    const modal = document.getElementById('video-modal');
    const container = document.getElementById('video-container');
    
    modal.classList.remove('hidden');
    // Inyectamos el iframe con autoplay
    container.innerHTML = `
        <iframe width="100%" height="100%" 
            src="https://www.youtube.com/embed/${globalYoutubeId}?autoplay=1&rel=0&modestbranding=1" 
            title="Aura Video" frameborder="0" 
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
            allowfullscreen>
        </iframe>`;
    
    document.body.style.overflow = 'hidden'; // Evitar scroll
};

// 3. Cerrar Modal
window.closeVideoModal = () => {
    const modal = document.getElementById('video-modal');
    modal.classList.add('hidden');
    document.getElementById('video-container').innerHTML = ''; // Limpiar iframe para detener sonido
    document.body.style.overflow = 'auto';
};

// IMPORTANTE: Asegúrate de llamar fetchConfig() cuando la página carga.
document.addEventListener('DOMContentLoaded', () => {
   fetchConfig();
   // ... resto de tu código init ...
});

function openProductModal(productData) {
    // 1. Referencias a elementos del DOM
    const modal = document.getElementById('productModal');
    const title = document.getElementById('modal-title');
    const img = document.getElementById('modal-img');
    const price = document.getElementById('modal-price');
    
    // Referencias específicas para la descripción
    const descContainer = document.getElementById('modal-desc-container');
    const descText = document.getElementById('modal-desc-text');

    // 2. Llenar datos básicos
    title.innerText = productData.nombre;
    img.src = productData.imagen_url;
    price.innerText = "$" + productData.precio;

    // 3. LÓGICA DE VALIDACIÓN (Aquí está lo que pediste)
    // Verificamos si existe, si no es null, y si no es solo espacios en blanco.
    if (productData.descripcion && productData.descripcion.trim() !== "") {
        
        // Si hay descripción configurada en el Manager:
        descText.innerText = productData.descripcion;
        descContainer.style.display = 'block'; // Mostramos el bloque
        
    } else {
        
        // Si NO hay descripción (comportamiento por defecto):
        descText.innerText = "";
        descContainer.style.display = 'none'; // Ocultamos todo el bloque para que no ocupe espacio visual
        
    }

    // 4. Mostrar el modal
    modal.style.display = 'flex';
}


lucide.createIcons();