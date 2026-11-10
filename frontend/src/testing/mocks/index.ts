/**
 * Arranque de los datos ficticios en el navegador. Solo lo carga src/main.tsx, y solo cuando
 * VITE_ENABLE_API_MOCKING === 'true' (plan_frontend.md §3).
 */
export async function iniciarMocks() {
  const [{ worker, RUTA_CONTROL }, { sembrar }] = await Promise.all([import('./browser'), import('./db')])
  await sembrar()
  await worker.start({
    // Las peticiones a /api sin handler avisan en la consola; el resto (Vite, fuentes, imágenes) pasa de largo.
    onUnhandledFrame({ frame, defaults }) {
      const datos = frame.data as { request?: Request }
      if (datos.request && new URL(datos.request.url).pathname.startsWith('/api/')) defaults.warn()
    },
  })
  console.info(
    '[mocks] Datos ficticios encendidos. Para apagarlos, usa "npm run dev" (VITE_ENABLE_API_MOCKING=false).',
  )
  vigilarWorker(RUTA_CONTROL)
}

/**
 * El Service Worker de MSW puede dejar de atender la pestaña sin aviso:
 * - Chrome lo detiene tras 30 s sin eventos (por ejemplo, con la pestaña en segundo plano frena el
 *   aviso que lo mantiene vivo) y al reiniciarse olvida qué pestañas atendía;
 * - al recargar, MSW le avisa que la pestaña se cierra y, si no quedan otras, se da de baja.
 * En ambos casos todo pasa al backend real (502 sin backend). Se comprueba al volver a la pestaña y
 * cada 20 s: primero se le vuelve a presentar la pestaña con el mismo mensaje que usa MSW al arrancar;
 * si ya no está registrado, se recarga la página (los datos vuelven a la semilla).
 */
function vigilarWorker(rutaControl: string) {
  const atiende = async () =>
    (await fetch(rutaControl, { cache: 'no-store' }).catch(() => null))?.headers.get('x-mocks') === 'activos'
  let revisando = false
  const comprobar = async () => {
    if (revisando || document.visibilityState !== 'visible') return
    revisando = true
    try {
      const registrado = Boolean(await navigator.serviceWorker.getRegistration())
      if (registrado && (await atiende())) return
      if (registrado) navigator.serviceWorker.controller?.postMessage('MOCK_ACTIVATE')
      await new Promise((r) => window.setTimeout(r, 300))
      if (registrado && (await atiende())) {
        console.info(
          '[mocks] El navegador había detenido el Service Worker: se reconectaron los datos ficticios.',
        )
        return
      }
      console.warn(
        '[mocks] El Service Worker ya no está registrado: se recarga la página para volver a encenderlo.',
      )
      window.location.reload()
    } finally {
      revisando = false
    }
  }
  document.addEventListener('visibilitychange', comprobar)
  window.addEventListener('focus', comprobar)
  window.setInterval(comprobar, 20_000)
}
