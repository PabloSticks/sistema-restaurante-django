import React from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';

import App from './App.jsx';
import Salon from './components/Salon.jsx';
import Mesa from './components/Mesa.jsx';
import Cocina from './components/Cocina.jsx';

import './global.css';

const router = createBrowserRouter([
  {
    // TODAS las rutas pasan por App (incluido /login)
    path: "/",
    element: <App />, // App maneja auth y renderiza Login o Outlet
    children: [
      {
        path: "login", // ✅ Agregamos /login como ruta hija
        element: null, // App.jsx se encarga de renderizar <Login />
      },
      {
        path: "salon",
        element: <Salon />,
      },
      {
        path: "mesa/:id",
        element: <Mesa />,
      },
      {
        path: "cocina",
        element: <Cocina />,
      },
    ]
  },
]);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);