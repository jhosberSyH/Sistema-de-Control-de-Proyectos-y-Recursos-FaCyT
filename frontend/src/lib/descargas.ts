/** Entrega al navegador un archivo descargado de la API (CSV, PDF, Excel) con el nombre que propone el servidor. */
export function guardarArchivo(archivo: Blob, nombre: string) {
  const url = URL.createObjectURL(archivo)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = nombre
  document.body.append(enlace)
  enlace.click()
  enlace.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
