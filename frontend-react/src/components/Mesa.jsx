import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchAPI, checkAuth, API_BASE_URL } from '../utils/api.js';

function Mesa() {
  try { checkAuth(); } catch (error) { return null; }

  const { id: mesaId } = useParams();
  const navigate = useNavigate();

  const [mesaNumero, setMesaNumero] = useState(null);
  const [mesaData, setMesaData] = useState(null);
  const [menu, setMenu] = useState([]);
  const [pedidosAnterioresAgrupados, setPedidosAnterioresAgrupados] = useState([]);
  const [carrito, setCarrito] = useState([]);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [showPagoModal, setShowPagoModal] = useState(false);
  const [totalAPagar, setTotalAPagar] = useState(0);
  const [puedeCobrar, setPuedeCobrar] = useState(false);

  // --- FUNCIÓN PRINCIPAL PARA CARGAR DATOS ---
  const cargarVistaMesa = useCallback(async () => {
    if (!mesaId) { navigate('/salon'); return; }
    if (!isLoading) setIsLoading(true);
    setError('');
    setPuedeCobrar(false);
    console.log(`Mesa ${mesaId}: Iniciando carga/refresco de datos...`);
    try {
      const [dataMesa, categorias] = await Promise.all([
        fetchAPI(`/api/mesas/${mesaId}/`),
        fetchAPI('/api/categorias/')
      ]);
      console.log(`Mesa ${mesaId}: Datos recibidos`, { dataMesa, categorias });

      setMesaData(dataMesa);
      setMesaNumero(dataMesa.numero);

      const itemsMap = new Map();
      let todosItemsEntregados = true;
      let hayPedidosActivos = false;

      if (dataMesa.pedidos && dataMesa.pedidos.length > 0) {
        dataMesa.pedidos.forEach(pedido => {
          if (pedido.estado !== 'pagado') {
            hayPedidosActivos = true;
            if (Array.isArray(pedido.detalles)) {
              pedido.detalles.forEach(detalle => {
                if (!detalle || !detalle.producto) {
                  console.warn(`Detalle inválido en pedido ${pedido.id}:`, detalle);
                  return;
                }
                if (detalle.estado !== 'entregado') {
                  todosItemsEntregados = false;
                }
                const productoId = detalle.producto.id;
                const existingItem = itemsMap.get(productoId);
                if (existingItem) {
                  existingItem.cantidadTotal += detalle.cantidad;
                  existingItem.detallesOriginales.push({ id: detalle.id, cantidad: detalle.cantidad, estado: detalle.estado });
                } else {
                  itemsMap.set(productoId, {
                    productoId: detalle.producto.id,
                    nombre: detalle.producto.nombre,
                    cantidadTotal: detalle.cantidad,
                    estacion: detalle.producto.estacion,
                    detallesOriginales: [{ id: detalle.id, cantidad: detalle.cantidad, estado: detalle.estado }]
                  });
                }
              });
            }
          }
        });
      }
      setPedidosAnterioresAgrupados(Array.from(itemsMap.values()));
      setMenu(categorias);
      setPuedeCobrar(hayPedidosActivos && todosItemsEntregados);
      console.log(`Mesa ${mesaId}: Carga completada. Puede cobrar: ${hayPedidosActivos && todosItemsEntregados}`);

    } catch (err) {
      setError(`Error al cargar datos: ${err.message}`);
      console.error(`Mesa ${mesaId}: Error fetching data:`, err);
    } finally {
      setIsLoading(false);
    }
  }, [mesaId, navigate]);

  // --- useEffect PARA CARGA INICIAL Y SSE ---
  useEffect(() => {
    cargarVistaMesa();

    // Configurar SSE para escuchar eventos de esta mesa específica
    const token = localStorage.getItem('accessToken');
    if (!token) {
        console.error("Mesa SSE: No hay token para EventSource.");
        setError("Error de autenticación para notificaciones.");
        return;
    }

    const channel = `mesa-${mesaId}`;
    const eventSourceUrl = `${API_BASE_URL}/api/events/?channel=${channel}&_sse_token=${token}`;
    console.log(`Mesa ${mesaId} SSE: Conectando a`, eventSourceUrl);

    const sse = new EventSource(eventSourceUrl);

    // Escuchar evento 'item_listo' enviado desde el backend
    sse.addEventListener('item_listo', (event) => {
        console.log(`¡SSE RECIBIDO en Mesa ${mesaId}: item_listo!`, event.data);
        try {
            const data = JSON.parse(event.data);
            console.log(`Producto listo: ${data.producto_nombre} (detalle ${data.detalle_id})`);
            // Recargar datos para mostrar el botón "Entregar"
            cargarVistaMesa();
        } catch (e) {
            console.error('Error parseando evento item_listo:', e);
        }
    });

    sse.onerror = (err) => {
        console.error(`Error de EventSource (SSE) en Mesa ${mesaId}:`, err);
        setError('Error de conexión en tiempo real.');
        sse.close();
    };

    return () => {
        console.log(`Mesa ${mesaId} SSE: Desmontando componente, cerrando conexión EventSource.`);
        sse.close();
    };
  }, [mesaId, cargarVistaMesa]);

  // --- Funciones Carrito ---
  const handleAddToCart = (producto) => {
    setCarrito(prev => {
      const existente = prev.find(item => item.productoId === producto.id);
      if (existente) {
        return prev.map(item => item.productoId === producto.id ? { ...item, cantidad: item.cantidad + 1 } : item);
      }
      return [...prev, { productoId: producto.id, nombre: producto.nombre, cantidad: 1 }];
    });
  };

  const handleRemoveFromCart = (productoId) => {
    setCarrito(prev => {
      const existente = prev.find(item => item.productoId === productoId);
      if (!existente) return prev;
      if (existente.cantidad === 1) {
        return prev.filter(item => item.productoId !== productoId);
      }
      return prev.map(item => item.productoId === productoId ? { ...item, cantidad: item.cantidad - 1 } : item);
    });
  };

  // --- Funciones Acciones ---
  const handleEntregarItem = async (itemAgrupado) => {
      setError('');
      setIsActionLoading(true);
      console.log(`Mesa ${mesaId}: Entregando item(s)`, itemAgrupado);
      const detallesAEntregarIds = itemAgrupado.detallesOriginales
          .filter(d => (itemAgrupado.estacion === 'bar' && d.estado === 'recibido') || d.estado === 'listo')
          .map(d => d.id);

      if (detallesAEntregarIds.length === 0) {
          console.warn(`Mesa ${mesaId}: No hay detalles listos para entregar para ${itemAgrupado.nombre}`);
          setIsActionLoading(false);
          return;
      }
      console.log(`Mesa ${mesaId}: IDs a marcar como entregados:`, detallesAEntregarIds);
      const updatePromises = detallesAEntregarIds.map(detalleId =>
          fetchAPI(`/api/detalles-pedido/${detalleId}/`, { method: 'PATCH', body: JSON.stringify({ estado: 'entregado' }) })
      );
      try {
          await Promise.all(updatePromises);
          console.log(`Mesa ${mesaId}: Item(s) ${itemAgrupado.nombre} entregado(s).`);
          cargarVistaMesa();
      } catch (err) {
         setError(err.message);
         alert(`No se pudo marcar como entregado: ${err.message}`);
         console.error(`Mesa ${mesaId}: Error al entregar:`, err);
      } finally {
          setIsActionLoading(false);
      }
  };

  const handleEnviarPedido = async () => {
    if (carrito.length === 0) { alert('El nuevo pedido está vacío.'); return; }
    const pedidoData = {
      mesa: mesaId,
      detalles: carrito.map(item => ({ producto: item.productoId, cantidad: item.cantidad, nota: '' }))
    };
    setError('');
    setIsActionLoading(true);
    console.log(`Mesa ${mesaId}: Enviando nuevo pedido...`, pedidoData);
    try {
      await fetchAPI('/api/pedidos/', { method: 'POST', body: JSON.stringify(pedidoData) });
      alert('¡Nuevos ítems enviados!');
      console.log(`Mesa ${mesaId}: Nuevo pedido enviado.`);
      setCarrito([]);
      cargarVistaMesa();
    } catch (err) {
      setError(err.message);
      alert(`Error al enviar pedido: ${err.message}`);
      console.error(`Mesa ${mesaId}: Error al enviar:`, err);
    } finally {
        setIsActionLoading(false);
    }
  };

  // --- Funciones Pago ---
  const handleAbrirModalPago = async () => {
     setError('');
     console.log(`Mesa ${mesaId}: Abriendo modal de pago...`);
    try {
        const data = await fetchAPI(`/api/mesas/${mesaId}/calcular_total/`);
        console.log(`Mesa ${mesaId}: Total calculado:`, data.total);
        setTotalAPagar(parseFloat(data.total).toFixed(0));
        setShowPagoModal(true);
    } catch (err) {
        setError(err.message);
        alert('No se puede cobrar: ' + err.message);
        console.error(`Mesa ${mesaId}: Error al calcular total:`, err);
    }
  };

  const handleCerrarModalPago = () => {
      if (isActionLoading) return;
      console.log(`Mesa ${mesaId}: Cerrando modal de pago.`);
      setShowPagoModal(false);
  }

  const handleFinalizarMesa = async () => {
    setError('');
    setIsActionLoading(true);
    console.log(`Mesa ${mesaId}: Intentando finalizar mesa...`);
    try {
        if (mesaData && mesaData.pedidos) {
            const updatePromises = mesaData.pedidos
                .filter(pedido => pedido.estado !== 'pagado')
                .map(pedido => {
                    console.log(`Mesa ${mesaId}: Marcando pedido ${pedido.id} como pagado.`);
                    return fetchAPI(`/api/pedidos/${pedido.id}/`, { method: 'PATCH', body: JSON.stringify({ estado: 'pagado' }) });
                });
            await Promise.all(updatePromises);
            console.log(`Mesa ${mesaId}: Pedidos marcados como pagados.`);
        }
        console.log(`Mesa ${mesaId}: Liberando mesa...`);
        await fetchAPI(`/api/mesas/${mesaId}/`, { method: 'PATCH', body: JSON.stringify({ estado: 'disponible' }) });
        alert('Mesa finalizada.');
        console.log(`Mesa ${mesaId}: Mesa liberada. Navegando a /salon.`);
        navigate('/salon');
    } catch (err) {
        setError(err.message);
        console.error(`Mesa ${mesaId}: Error al finalizar mesa:`, err);
        alert(`No se pudo finalizar la mesa: ${err.message}`);
    } finally {
        setIsActionLoading(false);
        setShowPagoModal(false);
    }
  };

  // --- Renderizado ---
  if (isLoading) return <div className="container"><p>Cargando datos de la mesa...</p></div>;

  if (error && !mesaNumero) return (
      <div className="container">
          <p className="error-message">{error}</p>
          <button onClick={() => navigate('/salon')}>Volver al Salón</button>
      </div>
  );

  return (
    <div>
      <div id="toma-pedido-view">
        <div className="header">
          <h2>Gestionar Mesa #{mesaNumero || mesaId}</h2>
          <div>
            <button id="cobrar-mesa-btn" className="cobrar-btn" onClick={handleAbrirModalPago} disabled={!puedeCobrar || isActionLoading} title={!puedeCobrar ? "Asegúrate de que todos los items estén entregados" : "Cobrar la cuenta"}>
              {isActionLoading ? 'Procesando...' : 'Cobrar Mesa'}
            </button>
            <button id="volver-a-mesas-btn" onClick={() => navigate('/salon')} disabled={isActionLoading}>Volver al Salón</button>
          </div>
        </div>
        <hr />
        {error && <p className="error-message" style={{textAlign: 'center'}}>{error}</p>}

        <div className="pedido-layout">
          <div id="menu-container">
            <h3>Menú</h3>
            {Array.isArray(menu) && menu.map(categoria => (
              <div key={categoria.id} className="categoria-menu">
                <h4>{categoria.nombre}</h4>
                {Array.isArray(categoria.productos) && categoria.productos.map(producto => (
                  <div key={producto.id} className="producto-item">
                    <span>{producto.nombre} - ${producto.precio}</span>
                    <button className="add-to-cart-btn" onClick={() => handleAddToCart(producto)} disabled={isActionLoading}>+</button>
                  </div>
                ))}
              </div>
            ))}
          </div>

          <div id="pedidos-anteriores-container">
            <h3>Pedidos Servidos</h3>
            <ul id="pedidos-anteriores-lista">
              {!Array.isArray(pedidosAnterioresAgrupados) || pedidosAnterioresAgrupados.length === 0 ? (
                <li>Sin pedidos previos.</li>
              ) : (
                pedidosAnterioresAgrupados.map(item => {
                  let displayEstado = 'entregado';
                  let puedeEntregar = false;

                  if (item && Array.isArray(item.detallesOriginales)) {
                      item.detallesOriginales.forEach(d => {
                          if (d.estado === 'recibido') displayEstado = 'recibido';
                          else if (d.estado === 'preparacion' && displayEstado !== 'recibido') displayEstado = 'preparacion';
                          else if (d.estado === 'listo' && displayEstado !== 'recibido' && displayEstado !== 'preparacion') displayEstado = 'listo';

                          if ((item.estacion === 'bar' && d.estado === 'recibido') || d.estado === 'listo') {
                              puedeEntregar = true;
                          }
                      });
                  } else { displayEstado = item?.estado || 'error'; }

                  return (
                    <li key={`${item.productoId}-${displayEstado}`}>
                      <span>{item.cantidadTotal || '?'}x {item.nombre || '??'} ({displayEstado})</span>
                      {puedeEntregar && (
                        <button className="entregar-btn" onClick={() => handleEntregarItem(item)} disabled={isActionLoading}>Entregar</button>
                      )}
                    </li>
                  );
                })
              )}
            </ul>
          </div>

          <div id="carrito-container">
            <h3>Nuevo Pedido</h3>
            <ul id="carrito-lista">
              {carrito.length === 0 ? (
                <li>El nuevo pedido está vacío</li>
              ) : (
                carrito.map(item => (
                  <li key={item.productoId}>
                    <span>{item.cantidad}x {item.nombre}</span>
                    <button className="remove-from-cart-btn" onClick={() => handleRemoveFromCart(item.productoId)} disabled={isActionLoading}>-</button>
                  </li>
                ))
              )}
            </ul>
            <button id="enviar-pedido-btn" onClick={handleEnviarPedido} disabled={carrito.length === 0 || isActionLoading}>
              {isActionLoading ? 'Enviando...' : 'Añadir al Pedido'}
            </button>
          </div>
        </div>
      </div>

      {showPagoModal && (
         <div id="pago-modal" className="modal-overlay">
            <div className="modal-content">
              <h2>Finalizar Cuenta</h2>
              <p>Total a Pagar: <span id="total-a-pagar" style={{ fontWeight: 'bold' }}>${totalAPagar}</span></p>
              <div className="modal-actions">
                  <button id="pagado-efectivo-btn" className="btn-pago" onClick={handleFinalizarMesa} disabled={isActionLoading}>
                      {isActionLoading ? 'Procesando...' : 'Pagado en Efectivo'}
                  </button>
                  <button id="pagado-tarjeta-btn" className="btn-pago" onClick={handleFinalizarMesa} disabled={isActionLoading}>
                      {isActionLoading ? 'Procesando...' : 'Pagado con Tarjeta'}
                  </button>
              </div>
              <button id="cerrar-modal-btn" className="btn-cierre" onClick={handleCerrarModalPago} disabled={isActionLoading}>Cancelar</button>
            </div>
          </div>
      )}
    </div>
  );
}

export default Mesa;