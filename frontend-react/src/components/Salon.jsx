import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
// Asegúrate que la ruta a api.js sea correcta
import { fetchAPI, checkAuth } from '../utils/api.js';

function Salon() {
  // 1. Proteger la página: si no hay token, redirige a /login
  try {
    checkAuth();
  } catch (error) {
    // checkAuth lanza error si redirige, podemos simplemente no renderizar más
    return null; // O mostrar un loader mientras redirige
  }

  const navigate = useNavigate(); // Hook para navegar
  const [mesas, setMesas] = useState(null); // Empezamos con null para diferenciar carga inicial de vacío
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true); // Empieza cargando

  // 2. Efecto para cargar las mesas al montar el componente
  useEffect(() => {
    const cargarMesas = async () => {
      setIsLoading(true); // Indica inicio de carga
      setError('');      // Limpia errores previos
      setMesas(null);    // Limpia mesas previas mientras carga
      console.log("Salon: Iniciando carga de mesas...");

      try {
        // Llama a la API para obtener las mesas
        const data = await fetchAPI('/api/mesas/');
        console.log("Salon: Datos RECIBIDOS de fetchAPI:", data);

        // Verifica si la respuesta es un array (lista)
        if (Array.isArray(data)) {
          console.log("Salon: Los datos SON un array. Actualizando estado.");
          setMesas(data); // Guarda las mesas en el estado
        } else {
          // Si la API no devuelve una lista, muestra un error
          console.error("Salon: La API no devolvió un array para mesas:", data);
          setError('Respuesta inesperada del servidor al cargar mesas.');
          setMesas([]); // Pone un array vacío para evitar errores de .map
        }
      } catch (err) {
        // Si fetchAPI lanza un error (red, 40x, 50x)
        console.error("Salon: Error DENTRO de cargarMesas catch:", err);
        setError(`Error al cargar mesas: ${err.message || 'Error desconocido'}`);
        setMesas([]); // Pone un array vacío en caso de error
      } finally {
        setIsLoading(false); // Marca como finalizada la carga (con éxito o error)
        console.log("Salon: Carga de mesas finalizada.");
      }
    };
    cargarMesas(); // Ejecuta la carga
  }, []); // 

  // 3. Función para manejar el logout
  const handleLogout = () => {
    console.log("Salon: Cerrando sesión...");
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    navigate('/login'); // Redirige a la página de login
  };

  // 4. Función para navegar a la vista de una mesa específica
  const handleMesaClick = (mesaId) => {
    console.log(`Salon: Navegando a mesa ${mesaId}`);
    navigate(`/mesa/${mesaId}`); // Usa react-router para cambiar de "página"
  };

  // --- RENDERIZADO DEL COMPONENTE ---

  // Muestra mensaje mientras carga
  if (isLoading) {
    return (
      <div className="container">
        <div className="header"><h2>Vista del Salón</h2></div>
        <hr/>
        <p>Cargando mesas...</p>
      </div>
    );
  }

  // Muestra mensaje de error si falló la carga
  if (error) {
    return (
      <div className="container">
        <div className="header">
          <h2>Vista del Salón</h2>
          <button onClick={handleLogout} id="logout-button">Cerrar Sesión</button>
        </div>
        <hr />
        <p className="error-message">{error}</p>
        <button onClick={() => window.location.reload()}>Reintentar</button> {/* Botón para reintentar */}
      </div>
    );
  }

  // Muestra mensaje si no hay mesas (pero la carga fue exitosa)
  if (!mesas || mesas.length === 0) {
    return (
      <div className="container">
        <div className="header">
          <h2>Vista del Salón</h2>
          <button onClick={handleLogout} id="logout-button">Cerrar Sesión</button>
        </div>
        <hr />
        <p>No hay mesas disponibles o registradas.</p>
        {/* Aquí  añadir un botón para crear mesas si fuera rol Admin/Gerente */}
      </div>
    );
  }

  // Renderizado principal: Muestra la grilla de mesas
  return (
    // No usamos div.container aquí si App.jsx ya lo provee
    <div>
      <div id="main-content"> {/* Mantenemos IDs si el CSS los usa */}
        <div className="header">
          <h2>Vista del Salón</h2>
          <button onClick={handleLogout} id="logout-button">Cerrar Sesión</button>
        </div>
        <hr />
        <div id="mesas-container">
          {/* Mapea sobre el array de mesas para crear cada tarjeta */}
          {mesas.map((mesa) => (
            <div
              key={mesa.id} // Key única para React
              className="mesa" // Clase para estilos CSS
              onClick={() => handleMesaClick(mesa.id)} // Llama a la navegación al hacer clic
              title={`Ir a gestionar Mesa ${mesa.numero}`} // Ayuda visual
            >
              <h3>Mesa #{mesa.numero}</h3>
              <p>{mesa.estado}</p> {/* Muestra el estado actual */}
              {/* No mostramos botón cobrar aquí */}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Salon;