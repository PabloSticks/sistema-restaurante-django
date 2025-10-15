import { fetchAPI, checkAuth } from './api.js';

// Proteger la página
checkAuth();

// Obtener el ID y número de la mesa desde la URL
const params = new URLSearchParams(window.location.search);
const mesaId = params.get('id');
const mesaNumero = params.get('numero');

// Referencias a los elementos del DOM
const pedidoMesaTitulo = document.getElementById('pedido-mesa-titulo');
const cobrarMesaBtn = document.getElementById('cobrar-mesa-btn');
const volverAMesasBtn = document.getElementById('volver-a-mesas-btn');
const menuContainer = document.getElementById('menu-container');
const pedidosAnterioresLista = document.getElementById('pedidos-anteriores-lista');
const carritoLista = document.getElementById('carrito-lista');
const enviarPedidoBtn = document.getElementById('enviar-pedido-btn');
const pagoModal = document.getElementById('pago-modal');
const totalAPagarSpan = document.getElementById('total-a-pagar');
const cerrarModalBtn = document.getElementById('cerrar-modal-btn');
const pagadoEfectivoBtn = document.getElementById('pagado-efectivo-btn');
const pagadoTarjetaBtn = document.getElementById('pagado-tarjeta-btn');

// Variables de estado
let carrito = [];
let pedidosAnteriores = [];
let mesaData = null; // Para guardar los datos completos de la mesa

// Funciones para "dibujar" en pantalla
const renderMenu = (categorias) => {
    menuContainer.innerHTML = '<h3>Menú</h3>';
    categorias.forEach(categoria => {
        const categoriaDiv = document.createElement('div');
        categoriaDiv.className = 'categoria-menu';
        let productosHTML = categoria.productos.map(p => `
            <div class="producto-item">
                <span>${p.nombre} - $${p.precio}</span>
                <button class="add-to-cart-btn" data-producto-id="${p.id}" data-nombre="${p.nombre}">+</button>
            </div>
        `).join('');
        categoriaDiv.innerHTML = `<h4>${categoria.nombre}</h4>${productosHTML}`;
        menuContainer.appendChild(categoriaDiv);
    });
};

const renderPedidosAnteriores = () => {
    pedidosAnterioresLista.innerHTML = '';
    if (pedidosAnteriores.length === 0) {
        pedidosAnterioresLista.innerHTML = '<li>Sin pedidos previos.</li>';
    } else {
        pedidosAnteriores.forEach(item => {
            const li = document.createElement('li');
            let botonEntregarHTML = '';
            if ((item.estacion === 'bar' && item.estado === 'recibido') || item.estado === 'listo') {
                botonEntregarHTML = `<button class="entregar-btn" data-detalle-id="${item.id}">Entregar</button>`;
            }
            li.innerHTML = `
                <span>${item.cantidad}x ${item.nombre} (${item.estado})</span>
                ${botonEntregarHTML}
            `;
            pedidosAnterioresLista.appendChild(li);
        });
    }
};

const renderCarrito = () => {
    carritoLista.innerHTML = '';
    if (carrito.length === 0) {
        carritoLista.innerHTML = '<li>El nuevo pedido está vacío</li>';
    } else {
        carrito.forEach(item => {
            const li = document.createElement('li');
            li.innerHTML = `
                <span>${item.cantidad}x ${item.nombre}</span>
                <button class="remove-from-cart-btn" data-producto-id="${item.productoId}">-</button>
            `;
            carritoLista.appendChild(li);
        });
    }
};

// Funciones para el flujo de pago
const abrirModalPago = async () => {
    try {
        const data = await fetchAPI(`/api/mesas/${mesaId}/calcular_total/`);
        totalAPagarSpan.textContent = `$${parseFloat(data.total).toFixed(0)}`;
        pagoModal.style.display = 'flex';
    } catch (error) {
        alert('No se pudo calcular el total. Asegúrate de que todos los ítems estén entregados.');
    }
};

const cerrarModalPago = () => {
    pagoModal.style.display = 'none';
};

const finalizarMesa = async () => {
    try {
        // Marcamos todos los pedidos de la mesa como 'pagado'
        if (mesaData && mesaData.pedidos) {
            for (const pedido of mesaData.pedidos) {
                if (pedido.estado !== 'pagado') {
                     await fetchAPI(`/api/pedidos/${pedido.id}/`, {
                        method: 'PATCH',
                        body: JSON.stringify({ estado: 'pagado' }),
                    });
                }
            }
        }
        // Liberamos la mesa
        await fetchAPI(`/api/mesas/${mesaId}/`, {
            method: 'PATCH',
            body: JSON.stringify({ estado: 'disponible' }),
        });
        alert('Mesa finalizada con éxito.');
        window.location.href = 'salon.html';
    } catch (error) {
        console.error('Error detallado al finalizar la mesa:', error);
        alert('No se pudo finalizar la mesa.');
    }
};

// Lógica de eventos
volverAMesasBtn.onclick = () => window.location.href = 'salon.html';
cobrarMesaBtn.addEventListener('click', abrirModalPago);
cerrarModalBtn.addEventListener('click', cerrarModalPago);
pagadoEfectivoBtn.addEventListener('click', finalizarMesa);
pagadoTarjetaBtn.addEventListener('click', finalizarMesa);

menuContainer.addEventListener('click', (event) => {
    if (event.target.classList.contains('add-to-cart-btn')) {
        const productoId = event.target.dataset.productoId;
        const nombre = event.target.dataset.nombre;
        const itemExistente = carrito.find(item => item.productoId === productoId);
        if (itemExistente) {
            itemExistente.cantidad++;
        } else {
            carrito.push({ productoId: productoId, nombre: nombre, cantidad: 1 });
        }
        renderCarrito();
    }
});

carritoLista.addEventListener('click', (event) => {
    if (event.target.classList.contains('remove-from-cart-btn')) {
        const productoId = event.target.dataset.productoId;
        const itemExistente = carrito.find(item => item.productoId === productoId);
        if (itemExistente) {
            itemExistente.cantidad--;
            if (itemExistente.cantidad === 0) {
                carrito = carrito.filter(item => item.productoId !== productoId);
            }
        }
        renderCarrito();
    }
});

pedidosAnterioresLista.addEventListener('click', async (event) => {
    if (event.target.classList.contains('entregar-btn')) {
        const detalleId = event.target.dataset.detalleId;
        try {
            await fetchAPI(`/api/detalles-pedido/${detalleId}/`, {
                method: 'PATCH',
                body: JSON.stringify({ estado: 'entregado' })
            });
            cargarVistaMesa();
        } catch (error) {
            alert('No se pudo marcar como entregado.');
        }
    }
});

enviarPedidoBtn.addEventListener('click', async () => {
    if (carrito.length === 0) {
        alert('El nuevo pedido está vacío.');
        return;
    }
    const pedidoData = {
        mesa: mesaId,
        detalles: carrito.map(item => ({ producto: item.productoId, cantidad: item.cantidad, nota: '' }))
    };
    try {
        await fetchAPI('/api/pedidos/', { method: 'POST', body: JSON.stringify(pedidoData) });
        alert('¡Nuevos ítems enviados a cocina!');
        cargarVistaMesa();
    } catch (error) {
        alert('Error al enviar el pedido.');
    }
});

// Función principal para cargar la página
const cargarVistaMesa = async () => {
    if (!mesaId || !mesaNumero) {
        alert('No se especificó una mesa.');
        window.location.href = 'salon.html';
        return;
    }
    
    pedidoMesaTitulo.textContent = `Gestionar Mesa #${mesaNumero}`;

    try {
        const [data, categorias] = await Promise.all([
            fetchAPI(`/api/mesas/${mesaId}/`),
            fetchAPI('/api/categorias/')
        ]);
        
        mesaData = data; // Guardamos los datos completos de la mesa

        pedidosAnteriores = [];
        if (mesaData.pedidos && mesaData.pedidos.length > 0) {
            mesaData.pedidos.forEach(pedido => {
                if (pedido.estado !== 'pagado') {
                    pedido.detalles.forEach(detalle => {
                        pedidosAnteriores.push({
                            id: detalle.id,
                            productoId: detalle.producto.id,
                            nombre: detalle.producto.nombre,
                            cantidad: detalle.cantidad,
                            estado: detalle.estado,
                            estacion: detalle.producto.estacion
                        });
                    });
                }
            });
        }
        
        carrito = [];
        renderMenu(categorias);
        renderPedidosAnteriores();
        renderCarrito();
    } catch (error) {
        console.error("Error al cargar datos de la mesa:", error);
    }
};

// Iniciar la carga de la página
cargarVistaMesa();