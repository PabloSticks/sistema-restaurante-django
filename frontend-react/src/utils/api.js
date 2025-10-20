// src/utils/api.js
export const API_BASE_URL = 'http://127.0.0.1:8000';

const redirectToLogin = () => {
    console.warn("Redirigiendo a login...");
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    window.location.replace('/login');
};

export const fetchAPI = async (endpoint, options = {}) => {
    const token = localStorage.getItem('accessToken');
    const headers = { 'Content-Type': 'application/json', ...options.headers };

    if (token && !endpoint.includes('/api/token/')) {
        headers['Authorization'] = `Bearer ${token}`;
    } else if (!token && !endpoint.includes('/api/token/')) {
        console.warn(`fetchAPI: No hay token para ${endpoint}.`);
        redirectToLogin();
        throw new Error('No autenticado.');
    }

    try {
        console.log(`fetchAPI: Llamando ${options.method || 'GET'} ${API_BASE_URL}${endpoint}`);
        const response = await fetch(`${API_BASE_URL}${endpoint}`, { ...options, headers });
        console.log(`fetchAPI: Respuesta ${endpoint} -> Status: ${response.status}`);

        if (!response.ok) {
            if ((response.status === 401 || response.status === 403) && !endpoint.includes('/api/token/')) {
                 console.warn(`fetchAPI: ${response.status} en ${endpoint}. Redirigiendo a login...`);
                 redirectToLogin();
                 throw new Error('Sesión inválida o permisos insuficientes.');
            }
            let errorDetail = `Error: ${response.status} ${response.statusText}`;
            try {
                const errorData = await response.json();
                errorDetail = errorData.detail || errorData.error || JSON.stringify(errorData) || errorDetail;
            } catch (e) { /* No hacer nada si no hay JSON */ }
            console.error(`fetchAPI: Error final para ${endpoint}:`, errorDetail);
            throw new Error(errorDetail);
        }

        if (response.status === 204) return null;
        const jsonData = await response.json();
        return jsonData;

    } catch (error) {
        console.error(`fetchAPI Error Crítico: ${options.method || 'GET'} ${endpoint}`, error);
        throw error;
    }
};

// checkAuth ahora solo verifica, no redirige. App.jsx se encarga de eso.
export const checkAuth = () => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
        console.log("checkAuth: No hay token.");
        return false;
    }
    // Opcional: decodificar y revisar expiración aquí
    console.log("checkAuth: Token encontrado.");
    return true;
};