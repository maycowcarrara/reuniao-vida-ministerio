import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa' // <--- Importe isso

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
        orientation: 'portrait',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Se o arquivo vier de "node_modules", é uma biblioteca
          if (id.includes('node_modules')) {
            // Vamos separar o Firebase em um arquivo só pra ele (é o mais pesado)
            if (id.includes('firebase')) {
              return 'firebase';
            }
            // O resto das bibliotecas (React, Lucide, etc) vai para "vendor"
            return 'vendor';
          }
        }
      }
    }
  }
})