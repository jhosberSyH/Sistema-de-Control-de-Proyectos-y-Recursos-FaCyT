// Aplica el tema guardado antes de pintar, para que no parpadee (ver src/lib/tema.ts).
// Vive en un archivo aparte (no en línea en index.html) para que la Content-Security-Policy no tenga
// que permitir scripts en línea: script-src 'self' basta.
try {
  var t = localStorage.getItem('cpq-tema')
  if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t)
} catch (e) {}
