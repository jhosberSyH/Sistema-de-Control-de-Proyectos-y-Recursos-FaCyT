import '@testing-library/jest-dom/vitest'
import { cleanup, configure } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, beforeEach } from 'vitest'
import { sembrar } from './mocks/db'
import { server } from './mocks/server'
import { guardarSesion } from './mocks/utils'

// La primera prueba de cada archivo carga la vista perezosa (import dinámico) y algunas esperan una pausa a
// propósito (búsqueda, guardado automático): con todos los archivos en paralelo, el segundo que espera
// findBy por defecto no alcanza.
configure({ asyncUtilTimeout: 8000 })

// En Node, el interceptor de MSW no soporta un cuerpo multipart/form-data enviado en streaming
// (RequestContentLengthMismatchError) y el fetch de Node no reconoce el File de jsdom. En las pruebas,
// un FormData se arma a mano en bytes, como lo haría el navegador (multipart con su boundary): el
// servidor recibe el mismo formulario. Se instala después de server.listen(), que reemplaza fetch.
const CRLF = '\r\n'

async function multipart(datos: FormData) {
  const separador = `----cpq-prueba-${Math.random().toString(16).slice(2)}`
  const texto = new TextEncoder()
  const partes: Uint8Array[] = []
  for (const [nombre, valor] of datos.entries()) {
    const disposicion = `--${separador}${CRLF}Content-Disposition: form-data; name="${nombre}"`
    if (typeof valor === 'string') {
      partes.push(texto.encode(`${disposicion}${CRLF}${CRLF}${valor}${CRLF}`))
    } else {
      const archivo = valor as File
      const tipo = archivo.type || 'application/octet-stream'
      partes.push(
        texto.encode(`${disposicion}; filename="${archivo.name}"${CRLF}Content-Type: ${tipo}${CRLF}${CRLF}`),
        new Uint8Array(await archivo.arrayBuffer()),
        texto.encode(CRLF),
      )
    }
  }
  partes.push(texto.encode(`--${separador}--${CRLF}`))
  const cuerpo = new Uint8Array(partes.reduce((t, p) => t + p.length, 0))
  partes.reduce((pos, p) => (cuerpo.set(p, pos), pos + p.length), 0)
  return { cuerpo, tipo: `multipart/form-data; boundary=${separador}` }
}

function multipartEnBytes() {
  const fetchOriginal = globalThis.fetch
  globalThis.fetch = async (entrada: RequestInfo | URL, init?: RequestInit) => {
    if (!(init?.body instanceof FormData)) return fetchOriginal(entrada, init)
    const { cuerpo, tipo } = await multipart(init.body)
    const encabezados = new Headers(init.headers)
    encabezados.set('Content-Type', tipo)
    return fetchOriginal(entrada, { ...init, headers: encabezados, body: cuerpo })
  }
}

// Las pruebas usan los mismos handlers que el navegador en modo mock (plan_frontend.md §8).
beforeAll(() => {
  server.listen({ onUnhandledFrame: 'error' })
  multipartEnBytes()
})
beforeEach(async () => {
  await sembrar()
  guardarSesion(null)
  window.localStorage.clear()
})
afterEach(() => {
  cleanup()
  server.resetHandlers()
})
afterAll(() => server.close())
