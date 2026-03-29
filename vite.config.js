import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const normalizePath = (value = '') => value.replace(/\\/g, '/')

const getReadableChunkName = (chunkInfo) => {
  const preferredName = chunkInfo.name && chunkInfo.name !== 'index' ? chunkInfo.name : ''
  if (preferredName) return preferredName

  const candidateIds = [
    chunkInfo.facadeModuleId,
    ...(chunkInfo.moduleIds || [])
  ]
    .filter(Boolean)
    .map(normalizePath)

  const sourceId = candidateIds.find((id) => id.includes('/src/')) || candidateIds[0]
  if (!sourceId) return 'chunk'

  const parts = sourceId.split('/')
  const fileName = parts[parts.length - 1] || ''
  const baseName = fileName.replace(/\.[^.]+$/, '')

  if (baseName && baseName !== 'index') return baseName
  return parts[parts.length - 2] || 'chunk'
}

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'Reunião Vida e Ministério',
        short_name: 'Vida e Ministério',
        description: 'Gerenciador da Reunião Vida e Ministério',
        theme_color: '#1f2937',
        background_color: '#1f2937',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        orientation: 'any',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },
      // 🔥 ADIÇÃO IMPORTANTE PARA O MODO OFFLINE 🔥
      workbox: {
        // Diz para o navegador fazer cache de todos esses tipos de arquivo
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json}'],

        // Aumenta o limite de tamanho de arquivo de 2MB para 5MB 
        // Isso impede que o chunk do Firebase seja rejeitado pelo cache offline
        maximumFileSizeToCacheInBytes: 5000000,
      }
    })
  ],
  build: {
    rollupOptions: {
      output: {
        chunkFileNames(chunkInfo) {
          return `assets/${getReadableChunkName(chunkInfo)}-[hash].js`
        },
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('firebase/auth')) {
              return 'firebase-auth';
            }
            if (id.includes('firebase/firestore')) {
              return 'firebase-firestore';
            }
            if (id.includes('firebase/app')) {
              return 'firebase-core';
            }
            if (id.includes('firebase')) {
              return 'firebase-misc';
            }
            if (
              id.includes('react-router') ||
              id.includes('react-dom') ||
              id.includes('react/') ||
              id.includes('scheduler')
            ) {
              return 'framework';
            }
            if (id.includes('@emailjs/browser')) {
              return 'email';
            }
            if (id.includes('cheerio')) {
              return 'importador';
            }
            if (id.includes('lucide-react')) {
              return 'ui-icons';
            }
            return 'vendor';
          }
        }
      }
    }
  }
})
