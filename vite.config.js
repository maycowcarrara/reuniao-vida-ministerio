import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

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