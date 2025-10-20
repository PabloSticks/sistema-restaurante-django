import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchAPI, checkAuth, API_BASE_URL } from '../utils/api.js';

function Cocina() {
  const navigate = useNavigate();
  const [pedidosCocina, setPedidosCocina] = useState(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [updatingItemId, setUpdatingItemId] = useState(null);

  // --- FUNCIÓN PARA CARGAR PEDIDOS ---
  const cargarPedidosCocina = useCallback(async (isInitialLoad = false) => {
    if (isInitialLoad) setIsLoading(true);
    console.log("Cocina: Iniciando carga/refresco de pedidos...");
    try {
      const data = await fetchAPI('/api/pedidos/');
      console.log("Cocina: Datos RECIBIDOS de fetchAPI:", data);

      if (Array.isArray(data)) {
        const pedidosFiltrados = data
          .map(pedido => {
             const mesaNumero = pedido.mesa?.numero ?? '??';
             const detallesFiltrados = Array.isArray(pedido.detalles) ? pedido.detalles.filter(detalle =>
                 detalle.producto?.estacion === 'cocina' &&
                 (detalle.estado === 'recibido' || detalle.estado === 'preparacion')
             ) : [];
             return { ...pedido, mesaNumero, detalles: detallesFiltrados };
          })
          .filter(pedido => pedido.detalles.length > 0);

        console.log("Cocina: Pedidos filtrados para mostrar:", pedidosFiltrados);
        setPedidosCocina(pedidosFiltrados);
        if(error) setError('');
      } else {
        console.error("Cocina: La API no devolvió un array:", data);
        setError('Respuesta inesperada del servidor.');
        setPedidosCocina([]);
      }
    } catch (err) {
      console.error("Cocina: Error DENTRO de cargarPedidosCocina catch:", err);
      setError(`Error al cargar pedidos: ${err.message || 'Error desconocido'}`);
    } finally {
      if (isInitialLoad) setIsLoading(false);
      console.log("Cocina: Carga/refresco de pedidos finalizada.");
    }
  }, [error]);

  // --- useEffect PARA ESCUCHAR EVENTOS SSE ---
  useEffect(() => {
    // 1. Carga inicial
    cargarPedidosCocina(true);

    // 2. Conexión SSE
    const token = localStorage.getItem('accessToken');
    if (!token) {
        console.error("Cocina SSE: No hay token para EventSource.");
        setError("Error de autenticación para notificaciones.");
        return;
    }

    const eventSourceUrl = `${API_BASE_URL}/api/events/?channel=cocina&_sse_token=${token}`;
    console.log("Cocina SSE: Conectando a", eventSourceUrl);

    const sse = new EventSource(eventSourceUrl);

    // 3. Escuchadores de eventos (CON PARSEO DE JSON)
    sse.addEventListener('nuevo_item', (event) => {
        console.log('¡SSE RECIBIDO: nuevo_item!', event.data);
        try {
            const data = JSON.parse(event.data);
            console.log(`Nuevo pedido: ${data.producto_nombre} x${data.cantidad} - Mesa ${data.mesa_numero}`);
            // Volvemos a cargar todo para que aparezca el nuevo pedido
            cargarPedidosCocina(false); // false = no mostrar loader
        } catch (e) {
            console.error('Error parseando evento nuevo_item:', e);
        }
    });

    sse.addEventListener('item_entregado', (event) => {
        console.log('¡SSE RECIBIDO: item_entregado!', event.data);
        try {
            const data = JSON.parse(event.data);
            console.log(`Item entregado: detalle ${data.detalle_id}`);
            // Volvemos a cargar todo para que el ítem desaparezca de la lista
            cargarPedidosCocina(false);
        } catch (e) {
            console.error('Error parseando evento item_entregado:', e);
        }
    });

    sse.onerror = (err) => {
        console.error('Error de EventSource (SSE):', err);
        setError('Error de conexión en tiempo real.');
        sse.close();
    };

    // 4. Limpieza al desmontar el componente
    return () => {
        console.log("Cocina SSE: Desmontando componente, cerrando conexión EventSource.");
        sse.close();
    };
  }, [cargarPedidosCocina]);

  // --- Función para Actualizar el Estado ---
  const handleActualizarEstado = async (detalleId, nuevoEstado) => {
    if (updatingItemId) return;
    setError('');
    setUpdatingItemId(detalleId);
    try {
      await fetchAPI(`/api/detalles-pedido/${detalleId}/`, {
        method: 'PATCH',
        body: JSON.stringify({ estado: nuevoEstado })
      });
      // El backend enviará eventos SSE automáticamente, pero recargamos por si acaso
      cargarPedidosCocina(false);
    } catch (err) {
      setError(`Error al actualizar estado: ${err.message}`);
      alert(`No se pudo actualizar el estado: ${err.message}`);
    } finally {
      setUpdatingItemId(null);
    }
  };

  // --- Función de Logout ---
  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    navigate('/login');
  };

  // --- RENDERIZADO ---
  if (isLoading) return <div className="container"><p>Cargando comandas...</p></div>;

  return (
    <div className="container">
      <div className="header">
        <h2>Comandas Pendientes (Cocina)</h2>
        <button onClick={handleLogout} id="logout-button" disabled={!!updatingItemId}>
          Cerrar Sesión
        </button>
      </div>
      <hr />
      {error && <p className="error-message" style={{textAlign: 'center'}}>{error}</p>}
      <div id="pedidos-cocina-container">
        {!Array.isArray(pedidosCocina) || pedidosCocina.length === 0 ? (
          <p>No hay pedidos pendientes para la cocina.</p>
        ) : (
          pedidosCocina.map(pedido => (
            <div key={pedido.id} className="comanda">
              <h3>
                  Mesa #{pedido.mesaNumero}
                  <span style={{fontSize: '0.8em', color: '#6c757d', marginLeft: '10px'}}>
                      ({new Date(pedido.fecha_hora).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                  </span>
              </h3>
              {Array.isArray(pedido.detalles) && pedido.detalles.map(detalle => (
                <div key={detalle.id} className={`item-cocina item-estado-${detalle.estado}`}>
                  <span>{detalle.cantidad}x {detalle.producto?.nombre || 'Producto Desconocido'}</span>
                  <div>
                    {detalle.estado === 'recibido' && (
                      <button className="estado-btn preparacion" onClick={() => handleActualizarEstado(detalle.id, 'preparacion')} disabled={!!updatingItemId}>
                        Preparar
                      </button>
                    )}
                    {detalle.estado === 'preparacion' && (
                      <button className="estado-btn listo" onClick={() => handleActualizarEstado(detalle.id, 'listo')} disabled={!!updatingItemId}>
                        Listo
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default Cocina;