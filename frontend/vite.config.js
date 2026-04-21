import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
  // Las plantillas PDF van en public/assets/ para ser accesibles via /assets/plantilla_N.pdf
  // El directorio public/ se sirve directamente por Vite sin pasar por el bundle
  publicDir: 'public',
})