/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { msw } from 'msw/vite'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  // El script del Service Worker solo se sirve (y se copia al build) cuando los
  // datos mock están encendidos. Con la variable apagada no queda rastro de MSW.
  const mocks = env.VITE_ENABLE_API_MOCKING === 'true'

  return {
    plugins: [react(), tailwindcss(), mocks && msw({ mode: 'worker-only' })],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: {
      port: 5173,
      // Sin mocks, /api va al backend local, igual que detrás de Nginx (README §12).
      proxy: { '/api': 'http://localhost:8000' },
    },
    test: {
      environment: 'jsdom',
      globals: true,
      // fecha-prueba va primero: la semilla se arma al importar y depende de la fecha de hoy
      setupFiles: ['./src/testing/fecha-prueba.ts', './src/testing/setup.ts'],
      css: true,
      // Cada prueba monta la app entera y recorre un flujo; con todos los archivos en paralelo, 5 s no alcanzan.
      testTimeout: 20_000,
    },
  }
})
