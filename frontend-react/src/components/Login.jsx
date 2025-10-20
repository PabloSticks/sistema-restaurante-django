import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL, fetchAPI } from '../utils/api.js';

// Recibe la prop onLoginSuccess desde App.jsx
function Login({ onLoginSuccess }) {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setIsLoading(true);
    console.log("Login: Intentando iniciar sesión...");

    try {
      // 1. Obtener el Token
      console.log("Login: Solicitando token a /api/token/");
      const tokenResponse = await fetch(`${API_BASE_URL}/api/token/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      console.log("Login: Respuesta de /api/token/ recibida, Status:", tokenResponse.status);
      if (!tokenResponse.ok) {
        let errorMsg = 'Usuario o contraseña incorrectos.';
        try {
            const errorData = await tokenResponse.json();
            errorMsg = errorData.detail || errorData.non_field_errors?.[0] || errorMsg;
        } catch(e) { errorMsg = `Error: ${tokenResponse.status} ${tokenResponse.statusText}`; }
        console.error("Login: Error en respuesta API /token/:", tokenResponse.status, errorMsg);
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        throw new Error(errorMsg);
      }

      const tokenData = await tokenResponse.json();
      if (!tokenData.access) {
           localStorage.removeItem('accessToken');
           localStorage.removeItem('refreshToken');
           throw new Error("Respuesta exitosa pero no se recibió token de acceso.");
      }
      console.log("Login: Token recibido:", tokenData.access ? "Sí" : "No");

      // 2. Guardar el Token
      console.log("Login: Guardando token en localStorage...");
      localStorage.setItem('accessToken', tokenData.access);
      localStorage.setItem('refreshToken', tokenData.refresh);
      const tokenGuardado = localStorage.getItem('accessToken');
      console.log("Login: Token guardado? Verificación:", tokenGuardado ? "Sí" : "¡NO!");
      if (!tokenGuardado) {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          throw new Error("¡Error crítico! El token no se pudo guardar en localStorage.");
      }

      // 3. Obtener Datos del Usuario
      console.log("Login: Obteniendo datos del usuario desde /api/users/me/...");
      const userData = await fetchAPI('/api/users/me/');
      console.log("Login: Datos del usuario recibidos:", userData);

      // 4. DECIDIR RUTA BASADO EN ROL
      const userGroups = userData.groups || [];
      let targetPath = '/';

      if (userGroups.includes('Meseros')) {
        targetPath = '/salon';
      } else if (userGroups.includes('Cocina')) {
        targetPath = '/cocina';
      } else if (userGroups.includes('Gerente') || userData.is_superuser) {
        targetPath = '/gerente';
      } else {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        throw new Error('Rol de usuario no reconocido o no asignado.');
      }

      console.log(`Login: Rol detectado (${userGroups.join(', ')}). Navegando a ${targetPath}`);
      
      // ✅ SOLUCIÓN: Solo navegar, App.jsx detectará el cambio automáticamente
      // No llamamos a onLoginSuccess porque causaría re-render antes de cambiar la ruta
      navigate(targetPath, { replace: true });

    } catch (err) {
      setError(err.message);
      console.error('Login: Falló el proceso:', err);
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
    } finally {
        setIsLoading(false);
    }
  };

  // JSX del formulario
  return (
    <div className="login-container">
      <h1>Bienvenido a Buen Sabor</h1>
      <form onSubmit={handleSubmit}>
        <h2>Iniciar Sesión</h2>
         <div className="form-group">
          <label htmlFor="username">Usuario:</label>
          <input
            type="text"
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoComplete="username"
            disabled={isLoading}
           />
        </div>
        <div className="form-group">
          <label htmlFor="password">Contraseña:</label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            disabled={isLoading}
          />
        </div>
        <button type="submit" disabled={isLoading}>
            {isLoading ? 'Ingresando...' : 'Ingresar'}
        </button>
        <p className="error-message">{error || '\u00A0'}</p>
      </form>
    </div>
  );
}

export default Login;