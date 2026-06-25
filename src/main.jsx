import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { ToastProvider } from './components/ToastProvider.jsx'
import { ensurePwaInstallListener } from './hooks/usePwaInstall.js'
import { registerAppUpdater, registerServiceWorkerRegistration } from './services/appUpdater.js'
import { toast } from './utils/toast.js'
import './index.css'
import 'drag-drop-touch';

// 🔥 IMPORTAÇÃO E REGISTRO DO PWA AQUI 🔥
import { registerSW } from 'virtual:pwa-register'

ensurePwaInstallListener()

// Ativa o Service Worker imediatamente para garantir o cache offline
const updateServiceWorker = registerSW({
  immediate: true,
  onNeedRefresh() {
    if (window.location.pathname.startsWith('/admin')) {
      toast.info('Nova versao disponivel\nUse o botao Versao do Sistema quando puder recarregar o app.', { duration: 8000 })
    }
  },
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
