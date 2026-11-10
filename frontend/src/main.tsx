import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from '@/app/app'
import './index.css'

/**
 * Enciende los datos ficticios solo si VITE_ENABLE_API_MOCKING === 'true'.
 * Vite reemplaza la variable al compilar: con los mocks apagados, este import()
 * se elimina del build y nada de src/testing llega al navegador.
 */
async function activarMocks() {
  if (import.meta.env.VITE_ENABLE_API_MOCKING !== 'true') return
  const { iniciarMocks } = await import('@/testing/mocks')
  await iniciarMocks()
}

const raiz = document.getElementById('root')
if (!raiz) throw new Error('No se encontró el elemento #root en index.html')

// La app se pinta después de que el Service Worker está listo, así ninguna petición se escapa.
activarMocks().then(() => {
  createRoot(raiz).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
