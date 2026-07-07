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

// --- API: local en desarrollo, producción en api.auntentika.com ---
const API_BASE_URL = (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
    ? 'http://localhost:8080'
    : 'https://api.auntentika.com';

// --- ESTADO ---
let allProducts = [];
let cart = JSON.parse(localStorage.getItem('tshop_cart')) || [];

// --- INIT ---
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('cart-btn').onclick = () => toggleCart();
    document.getElementById('menu-btn').onclick = () => {
        const menu = document.getElementById('mobile-menu');
        menu.classList.toggle('hidden');
        menu.classList.toggle('flex');
    };

    document.getElementById('back-to-cart-btn').onclick = showCartList;
    document.getElementById('checkout-form').onsubmit = submitOrder;

    updateCartUI();
    applyHeroVideos();
    fetchConfig();
    fetchTunnelData();

    ['hero-video', 'featured-video'].forEach((id) => {
        document.getElementById(id)?.play().catch(() => {});
    });
});

// --- API & DATA ---

async function fetchTunnelData() {
    showLoader(true);
    document.getElementById('error-message')?.classList.add('hidden');
    
    // Actualizar indicador visual (badge verde)
    const badge = document.getElementById('connection-badge');
    if (badge) {
        badge.className = 'connection-badge connection-badge--connecting';
        badge.innerHTML = `<i data-lucide="loader" class="w-3 h-3 animate-spin"></i> Conectando...`;
    }

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

        if (badge) {
            badge.className = 'connection-badge connection-badge--online';
            badge.innerHTML = `<i data-lucide="wifi" class="w-3 h-3"></i> En línea`;
        }
        
        showLoader(false);
    } catch (err) {
        console.error(err);
        showLoader(false);
        if (badge) {
            badge.className = 'connection-badge connection-badge--offline';
            badge.innerHTML = `<i data-lucide="wifi-off" class="w-3 h-3"></i> Sin conexión`;
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

// Reemplaza tu función window.loadMoreProducts en app.js por esta:

// Reemplaza tu función window.loadMoreProducts en app.js por esta versión "Mobile Friendly":

window.loadMoreProducts = () => {
    const grid = document.getElementById('products-grid');
    const btnContainer = document.getElementById('load-more-container');

    const nextBatch = currentListForDisplay.slice(itemsShown, itemsShown + ITEMS_PER_BATCH);

    nextBatch.forEach(p => {
        const precio = formatCurrency(p.precio);
        const stockLabel = p.cantidad > 0 ? `${p.cantidad} disp.` : 'Agotado';
        const imgContent = p.imagen_url
            ? `<img src="${p.imagen_url}" class="h-40 md:h-56 w-full object-cover" loading="lazy" alt="${p.nombre}">`
            : `<div class="h-40 md:h-56 w-full flex items-center justify-center bg-gray-50 text-gray-300"><i data-lucide="image" class="w-8 h-8"></i></div>`;

        const card = document.createElement('article');
        card.className = 'product-card fade-in relative';
        card.onclick = (e) => { if (!e.target.closest('.product-card__btn-cart')) openModal(p); };

        card.innerHTML = `
            <div class="product-card__media h-40 md:h-56">
                ${imgContent}
                ${p.cantidad < 5 && p.cantidad > 0 ? '<span class="product-card__badge">Últimos</span>' : ''}
                ${p.destacado ? '<span class="product-card__badge product-card__badge--featured">Destacado</span>' : ''}
            </div>
            <div class="product-card__body">
                <div class="product-card__meta">
                    <span class="product-card__category">${p.linea || 'Cuidado General'}</span>
                    <span class="product-card__stock"><span class="product-card__stock-dot"></span>${stockLabel}</span>
                </div>
                <h4 class="product-card__title" title="${p.nombre}">${p.nombre}</h4>
                <div class="product-card__pricing">
                    <span class="product-card__price">${precio}</span>
                </div>
                <div class="product-card__actions">
                    <button type="button" onclick="addToCartById('${p.id}'); event.stopPropagation();"
                        class="product-card__btn-cart" aria-label="Agregar al carrito">
                        <i data-lucide="shopping-bag" class="w-4 h-4"></i>
                        Agregar al carrito
                    </button>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });

    itemsShown += nextBatch.length;

    const showingEl = document.getElementById('showing-count');
    const totalEl = document.getElementById('total-count');
    if (showingEl) showingEl.innerText = itemsShown;
    if (totalEl) totalEl.innerText = currentListForDisplay.length;

    if (itemsShown >= currentListForDisplay.length) {
        btnContainer.classList.add('hidden');
    } else {
        btnContainer.classList.remove('hidden');
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
    let url = urlInput.value.trim() || API_BASE_URL;
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
    // 1. Llenar datos básicos
    document.getElementById('modal-title').innerText = p.nombre;
    document.getElementById('modal-price').innerText = formatCurrency(p.precio);
    
    // Stock (Manejando posible null)
    const stockEl = document.getElementById('modal-stock');
    if(stockEl) stockEl.innerText = `Stock: ${p.cantidad || 0}`;
    
    // Categoría
    const catEl = document.getElementById('modal-category');
    if(catEl) catEl.innerText = p.linea || 'General';

    // 2. LÓGICA DE DESCRIPCIÓN CORREGIDA
    const descEl = document.getElementById('modal-desc');
    
    if (p.descripcion && p.descripcion.trim().length > 0 && p.descripcion !== "null") {
        // Reemplaza saltos de línea (\n) por <br> para que se vea bien el párrafo
        descEl.innerHTML = p.descripcion.replace(/\n/g, '<br>');
        descEl.classList.remove('hidden'); 
    } else {
        // Si no hay descripción, ocultamos el elemento
        descEl.innerHTML = '';
        descEl.classList.add('hidden');
    }

    // 3. Imagen
    const container = document.getElementById('modal-img-container');
    container.innerHTML = p.imagen_url 
        ? `<img src="${p.imagen_url}" class="max-h-full max-w-full object-contain rounded-lg shadow-sm">` 
        : `<i data-lucide="package" class="w-24 h-24 text-gray-300"></i>`;

    // 4. Configurar botón de agregar
    const addBtn = document.getElementById('modal-add-btn');
    // Clonamos el botón para eliminar listeners anteriores y evitar duplicados
    const newBtn = addBtn.cloneNode(true);
    addBtn.parentNode.replaceChild(newBtn, addBtn);
    
    newBtn.onclick = () => {
        addToCartById(p.id);
        document.getElementById('product-modal').classList.add('hidden');
    };

    // 5. Mostrar Modal
    document.getElementById('product-modal').classList.remove('hidden');
    
    // Recargar iconos (por si la imagen fallback usa lucide)
    lucide.createIcons();
};

window.closeModal = () => document.getElementById('product-modal').classList.add('hidden');

function generateFilters() {
    const lineas = ['Todas', ...new Set(allProducts.map(p => p.linea || 'General'))];

    const sidebarContainer = document.getElementById('sidebar-categories');
    if (sidebarContainer) {
        sidebarContainer.innerHTML = `
            <li>
                <button type="button" onclick="filterBy('Todas')" class="catalog-cat-btn catalog-cat-btn--all">
                    <span>Ver toda la colección</span>
                    <span class="catalog-cat-btn__count">${allProducts.length}</span>
                </button>
            </li>
            ${lineas.filter(c => c !== 'Todas').map(cat => {
                const count = allProducts.filter(p => (p.linea || 'General') === cat).length;
                return `
                <li>
                    <button type="button" onclick="filterBy('${cat}')" class="catalog-cat-btn" data-category="${cat}">
                        <span>${cat}</span>
                        <span class="catalog-cat-btn__count">${count}</span>
                    </button>
                </li>`;
            }).join('')}
        `;
    }

    const mobileContainer = document.getElementById('category-filters');
    if (mobileContainer) {
        mobileContainer.innerHTML = lineas.map(cat => `
            <button type="button" onclick="filterBy('${cat}')" class="filter-pill${cat === 'Todas' ? ' filter-pill--active' : ''}" data-category="${cat}">
                ${cat}
            </button>
        `).join('');
    }
}

window.filterBy = (catName) => {
    if (catName === 'Todas') renderProducts(allProducts);
    else renderProducts(allProducts.filter(p => (p.linea || 'General') === catName));

    document.querySelectorAll('.filter-pill').forEach(btn => {
        btn.classList.toggle('filter-pill--active', btn.dataset.category === catName);
    });
};

// Nueva función para Ordenar (Precio / Relevancia)
window.sortProducts = (criteria) => {
    let sorted = [...currentListForDisplay]; // Copia de la lista actual filtrada
    
    if (criteria === 'menor_precio') {
        sorted.sort((a, b) => parseFloat(a.precio) - parseFloat(b.precio));
    } else if (criteria === 'mayor_precio') {
        sorted.sort((a, b) => parseFloat(b.precio) - parseFloat(a.precio));
    } else {
        // Relevancia: Volvemos al orden original (o por ID)
        sorted.sort((a, b) => a.id - b.id);
    }
    
    renderProducts(sorted); // Volver a pintar
};

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
    featuredProducts = products.filter(p => p.destacado);

    const section = document.getElementById('featured-section');
    const track = document.getElementById('carousel-track');
    const dotsContainer = document.getElementById('carousel-dots');

    if (window.carouselInterval) {
        clearInterval(window.carouselInterval);
        window.carouselInterval = null;
    }

    if (!section || !track || !dotsContainer || featuredProducts.length === 0) {
        if (section) section.classList.add('hidden');
        return;
    }

    section.classList.remove('hidden');
    track.innerHTML = '';
    dotsContainer.innerHTML = '';
    currentSlide = 0;

    featuredProducts.forEach((p, index) => {
        const precio = formatCurrency(p.precio);
        const imgSrc = p.imagen_url || '';
        const safeName = (p.nombre || '').replace(/"/g, '&quot;');

        const slide = document.createElement('article');
        slide.className = 'featured-showcase__slide';
        slide.innerHTML = `
            <div class="featured-showcase__copy">
                <span class="featured-showcase__eyebrow">Destacado · ${p.linea || 'General'}</span>
                <h2 class="featured-showcase__name">${safeName}</h2>
                <p class="featured-showcase__price">${precio}</p>
                <div class="featured-showcase__actions">
                    <button type="button" class="featured-showcase__btn featured-showcase__btn--primary"
                        onclick="addToCartById('${p.id}'); event.stopPropagation();">
                        Agregar al carrito
                    </button>
                    <button type="button" class="featured-showcase__btn featured-showcase__btn--ghost"
                        onclick="openModalById('${p.id}'); event.stopPropagation();">
                        Ver detalle →
                    </button>
                </div>
            </div>
            <div class="featured-showcase__visual">
                ${imgSrc
                    ? `<div class="featured-showcase__stage">
                        <img src="${imgSrc}" alt="${safeName}" class="featured-showcase__img" loading="lazy">
                       </div>`
                    : `<div class="featured-showcase__img-placeholder"><i data-lucide="sparkles"></i></div>`}
            </div>
        `;
        track.appendChild(slide);

        const dot = document.createElement('button');
        dot.type = 'button';
        dot.className = `featured-showcase__dot${index === 0 ? ' is-active' : ''}`;
        dot.setAttribute('aria-label', `Ir al slide ${index + 1}`);
        dot.onclick = () => goToSlide(index);
        dotsContainer.appendChild(dot);
    });

    updateCarousel();
    lucide.createIcons();

    const showNav = featuredProducts.length > 1;
    document.querySelectorAll('.featured-showcase__nav').forEach(btn => {
        btn.style.display = showNav ? '' : 'none';
    });
    dotsContainer.style.display = showNav ? '' : 'none';

    if (showNav) {
        window.carouselInterval = setInterval(() => moveCarousel(1), 6000);
    }
}

window.openModalById = (id) => {
    const product = allProducts.find(p => String(p.id) === String(id));
    if (product) openModal(product);
};

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
    const dots = document.getElementById('carousel-dots');
    if (!track || !dots) return;

    track.style.transform = `translateX(-${currentSlide * 100}%)`;

    Array.from(dots.children).forEach((dot, idx) => {
        dot.classList.toggle('is-active', idx === currentSlide);
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
    else if (method === 'Datafono') {
        alertBox.className = "mt-3 border-l-4 p-3 rounded-r-md flex gap-3 transition-all duration-300 bg-green-50 border-brand-olive";
        iconHTML = `<i data-lucide="credit-card" class="h-4 w-4 text-brand-olive mt-0.5"></i>`;
        infoText.innerHTML = `<strong>Datáfono a domicilio:</strong> Llevaremos el datáfono hasta tu hogar para que realices el pago con tarjeta débito o crédito al momento de la entrega.`;
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
    totalDisplay.classList.add('text-brand-dark');
    totalDisplay.classList.remove('text-brand-orange');
};

// Función auxiliar para calcular el total con o sin comisión
function getFinalTotal() {
    return cart.reduce((acc, item) => acc + (item.precio * item.qty), 0);
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

        if (data.youtubeId) globalYoutubeId = data.youtubeId;

        if (data.businessName) {
            document.querySelectorAll('#brand-name, #brand-name-modal').forEach(el => el.innerText = data.businessName);
            document.title = `${data.businessName} — Beauty & Care`;
        }

        const brandLogo = data.logoUrl || `${API_BASE_URL}/uploads/logo.jpg`;
        document.querySelectorAll('#brand-logo, #brand-logo-modal, #brand-logo-footer').forEach(el => {
            el.src = brandLogo.startsWith('http') ? brandLogo : `${API_BASE_URL}${brandLogo}`;
        });

        if (data.historyText) {
            document.getElementById('brand-history').innerText = data.historyText;
        }

        const showcaseGrid = document.getElementById('brand-showcase');
        if (showcaseGrid && data.showcaseImages && data.showcaseImages.length > 0) {
            showcaseGrid.innerHTML = data.showcaseImages.map(img => `
                <div class="h-32 rounded-lg overflow-hidden shadow-sm border border-brand-sand group">
                    <img src="${img}" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700">
                </div>
            `).join('');
        }

        applyHeroVideos(data.heroVideoUrl, data.featuredVideoUrl);

    } catch (e) {
        console.log('Usando configuración por defecto');
        applyHeroVideos();
    }
}

const DEFAULT_HERO_VIDEO = `${API_BASE_URL}/uploads/herovideo.mp4`;

function applyHeroVideos(heroUrl, featuredUrl) {
    const heroVideo = document.getElementById('hero-video');
    const featuredVideo = document.getElementById('featured-video');
    const heroSource = document.getElementById('hero-video-source');
    const featuredSource = document.getElementById('featured-video-source');

    const resolveVideoUrl = (url) => {
        if (!url) return DEFAULT_HERO_VIDEO;
        return url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
    };

    const setupVideo = (videoEl, sourceEl, url) => {
        if (!videoEl || !sourceEl) return;

        const targetUrl = resolveVideoUrl(url);
        if (sourceEl.src === targetUrl) return;

        sourceEl.src = targetUrl;
        videoEl.load();

        videoEl.onerror = () => {
            if (sourceEl.src !== DEFAULT_HERO_VIDEO) {
                sourceEl.src = DEFAULT_HERO_VIDEO;
                videoEl.load();
            }
        };

        videoEl.onloadeddata = () => {
            videoEl.play().catch(() => {});
        };
    };

    const resolvedHero = resolveVideoUrl(heroUrl);
    setupVideo(heroVideo, heroSource, resolvedHero);
    setupVideo(featuredVideo, featuredSource, featuredUrl || heroUrl || resolvedHero);
}

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

lucide.createIcons();