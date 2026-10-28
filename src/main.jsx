import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { ToastProvider } from './components/ToastProvider.jsx'
import { ensurePwaInstallListener } from './hooks/usePwaInstall.js'
import { limparMarcadoresAtualizacao, registerServiceWorkerRegistration, reloadAppWithCacheBust } from './services/appUpdater.js'
import { toast } from './utils/toast.js'
import './index.css'
import 'drag-drop-touch';

// 🔥 IMPORTAÇÃO E REGISTRO DO PWA AQUI 🔥
import { registerSW } from 'virtual:pwa-register'

limparMarcadoresAtualizacao()
ensurePwaInstallListener()

window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault()
  reloadAppWithCacheBust('preload-error')
})

window.addEventListener('unhandledrejection', (event) => {
  const message = String(event?.reason?.message || event?.reason || '')
  if (message.includes('Failed to fetch dynamically imported module')) {
    event.preventDefault()
    reloadAppWithCacheBust('dynamic-import')
  }
})

// Ativa o Service Worker imediatamente para garantir o cache offline
const updateServiceWorker = registerSW({
  immediate: true,
  onNeedRefresh() {
    if (window.location.pathname.startsWith('/c/')) {
      updateServiceWorker(true)
    } else if (window.location.pathname.startsWith('/admin')) {
      toast.info('Nova versao disponivel\nUse o botao Versao do Sistema quando puder recarregar o app.', { duration: 8000 })
    }
  },
  onRegisteredSW(_swUrl, registration) {
    registerServiceWorkerRegistration(registration)
    if (registration && window.location.pathname.startsWith('/c/')) {
      registration.waiting?.postMessage({ type: 'SKIP_WAITING' })
      registration.update().catch(() => {
        // A página mantém o tratamento de falha de conexão da confirmação.
      })
    }
  }
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </React.StrictMode>,
)
