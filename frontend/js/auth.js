import { API_BASE_URL } from './api.js'; 

const loginForm = document.getElementById('login-form');
const errorMessage = document.getElementById('error-message');

loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    try {
        const response = await fetch(`${API_BASE_URL}/api/token/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });
        if (!response.ok) throw new Error('Usuario o contraseña incorrectos.');
        const data = await response.json();
        localStorage.setItem('accessToken', data.access);
        window.location.href = 'salon.html';
    } catch (error) {
        errorMessage.textContent = error.message;
    }
});