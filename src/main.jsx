import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import 'drag-drop-touch';

// 🔥 IMPORTAÇÃO E REGISTRO DO PWA AQUI 🔥
import { registerSW } from 'virtual:pwa-register'

// Ativa o Service Worker imediatamente para garantir o cache offline
registerSW({ immediate: true })

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)