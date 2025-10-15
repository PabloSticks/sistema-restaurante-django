import { fetchAPI, checkAuth } from './api.js';

// 1. Proteger la página: si no hay token, nos bota al login.
checkAuth();

// 2. Referencias a los elementos del DOM DE ESTA PÁGINA
const mesasContainer = document.getElementById('mesas-container');
const logoutButton = document.getElementById('logout-button');

// 3. Función para "dibujar" las mesas en la pantalla
const renderMesas = (mesas) => {
    mesasContainer.innerHTML = '';
    mesas.forEach(mesa => {
        const mesaElement = document.createElement('div');
        mesaElement.className = 'mesa';
        // Simplemente navega a la página de la mesa al hacer clic
        mesaElement.onclick = () => {
            window.location.href = `mesa.html?id=${mesa.id}&numero=${mesa.numero}`;
        };
        // Ya no hay lógica de botones aquí, solo muestra la información
        mesaElement.innerHTML = `
            <h3>Mesa #${mesa.numero}</h3>
            <p>${mesa.estado}</p>
        `;
        mesasContainer.appendChild(mesaElement);
    });
};

// 4. Lógica de eventos DE ESTA PÁGINA
logoutButton.addEventListener('click', () => {
    localStorage.removeItem('accessToken');
    window.location.href = 'login.html';
});

// 5. Función principal para cargar la página
const cargarMesas = async () => {
    try {
        const mesas = await fetchAPI('/api/mesas/');
        renderMesas(mesas);
    } catch (error) {
        console.error("No se pudieron cargar las mesas:", error);
    }
};

// Cargar las mesas al iniciar la página
cargarMesas();