import React, { useState, useEffect } from 'react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import Login from './components/Login.jsx';
import { checkAuth } from './utils/api.js';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(() => !!localStorage.getItem('accessToken'));
  const location = useLocation();
  const navigate = useNavigate();

  // Esta es la función que DEBEMOS pasar a Login
  const handleLoginSuccess = () => {
    console.log("App: handleLoginSuccess EJECUTADO! Actualizando estado...");
    setIsLoggedIn(true);
    // Ya no navegamos desde aquí, Login se encarga
  };

  const handleLogout = () => {
    console.log("App: Logout handler called!");
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    setIsLoggedIn(false);
    // useEffect se encargará de redirigir a /login
  };

  // useEffect: Verifica token y redirige si es necesario
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    const shouldBeLoggedIn = !!token;
    console.log(`App useEffect [${location.pathname}]: check. ShouldBe: ${shouldBeLoggedIn}, CurrentState: ${isLoggedIn}`);

    // Sincroniza estado si localStorage cambió
    if (isLoggedIn !== shouldBeLoggedIn) {
      console.log("App useEffect: Sincronizando estado...");
      setIsLoggedIn(shouldBeLoggedIn);
    }

    // REDIRECCIÓN: Si NO está logueado Y NO está en /login...
    if (!shouldBeLoggedIn && location.pathname !== '/login') {
      console.error("App useEffect: ¡SIN TOKEN FUERA DE LOGIN! Redirigiendo a /login.");
      navigate('/login', { replace: true });
    }

  }, [location.pathname, isLoggedIn, navigate]);

  // ----- Lógica de Renderizado -----
  console.log(`App Render [${location.pathname}]: isLoggedIn es ${isLoggedIn}`);

  if (!isLoggedIn) {
    if (location.pathname === '/login') {
      console.log("App Render: Mostrando <Login /> y PASANDO onLoginSuccess");
      return <Login onLoginSuccess={handleLoginSuccess} />;
    } else {
      // Si no está logueado y no está en /login, useEffect ya redirigió
      console.log("App Render: No logueado, esperando redirección de useEffect a /login");
      return null;
    }
  }

  // Si SÍ está logueado...
  // Si está yendo a /login, redirigir a /salon
  if (location.pathname === '/login') {
    console.log("App Render: Logueado en /login, redirigiendo a /salon");
    return <Navigate to="/salon" replace />;
  }

  // Si está en la raíz (/), redirigir a /salon
  if (location.pathname === '/') {
    console.log("App Render: Logueado en /, redirigiendo a /salon");
    return <Navigate to="/salon" replace />;
  }

  // Si está logueado y en cualquier otra ruta válida, mostramos Outlet
  console.log("App Render: Logueado, mostrando <Outlet />");
  return <Outlet />;
}

export default App;