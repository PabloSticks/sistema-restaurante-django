
export const API_BASE_URL = 'http://127.0.0.1:8000';

export const fetchAPI = async (endpoint, options = {}) => {
    const token = localStorage.getItem('accessToken');
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers,
    };
    const response = await fetch(`${API_BASE_URL}${endpoint}`, { ...options, headers });

    if (response.status === 401 || response.status === 403) {
        window.location.href = 'login.html';
        return;
    }
    if (!response.ok) {
        throw new Error(`Error en la petición a ${endpoint}: ${response.statusText}`);
    }
    if (response.status === 204) return null;
    return response.json();
};

export const checkAuth = () => {
    if (!localStorage.getItem('accessToken')) {
        window.location.href = 'login.html';
    }
};