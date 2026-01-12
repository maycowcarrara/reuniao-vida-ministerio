import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from "vite-plugin-singlefile"

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  base: './', // Isso força o uso de caminhos relativos em vez de absolutos
  build: {
    outDir: 'dist',
    assetsInlineLimit: 100000000, // Força inlining de tudo
  }
})