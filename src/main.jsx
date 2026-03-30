import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { ToastProvider } from './components/ToastProvider.jsx'
import { registerAppUpdater, registerServiceWorkerRegistration } from './services/appUpdater.js'
import './index.css'
import 'drag-drop-touch';

// 🔥 IMPORTAÇÃO E REGISTRO DO PWA AQUI 🔥
import { registerSW } from 'virtual:pwa-register'

// Ativa o Service Worker imediatamente para garantir o cache offline
const updateServiceWorker = registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, registration) {
    registerServiceWorkerRegistration(registration)
  }
})

registerAppUpdater(updateServiceWorker)

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </React.StrictMode>,
)
