/* Barra de revisión de los mockups: ancho, tema y los controles propios de cada vista.
   Cada página define window.MK = { vista: "Inicio de sesión", tanda: 1, extras: "..." } antes de cargar este archivo. */
(function () {
  var ICONOS = {
    inicio: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/>',
    proyectos: '<path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H9l2 2.5h8.5A1.5 1.5 0 0 1 21 9v9.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5z"/>',
    solicitudes: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1"/><path d="M8.5 10h7M8.5 14h7M8.5 18h4"/>',
    inventario: '<path d="M9 3h6M10 3v6L4.5 18.5A1.7 1.7 0 0 0 6 21h12a1.7 1.7 0 0 0 1.5-2.5L14 9V3"/><path d="M7.5 15h9"/>',
    equipos: '<rect x="4" y="4" width="16" height="12" rx="2"/><path d="M8 20h8M12 16v4"/><path d="m8 12 2.5-3 2 2L16 7"/>',
    calendario: '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    almacen: '<path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5z"/><path d="M3.5 7.5 12 12l8.5-4.5M12 12v9"/>',
    prorrateo: '<path d="M12 3a9 9 0 1 0 9 9h-9z"/><path d="M15 3.5A9 9 0 0 1 20.5 9H15z"/>',
    reportes: '<path d="M4 20h16"/><path d="M7 16v-5M12 16V7M17 16v-8"/>',
    auditoria: '<path d="M3.5 12a8.5 8.5 0 1 0 2.5-6"/><path d="M3 4v4h4"/><path d="M12 8v4.5l3 2"/>',
    usuarios: '<circle cx="9" cy="8.5" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 5.5a3.5 3.5 0 0 1 0 6.5M18.5 20a6.5 6.5 0 0 0-2.5-5.2"/>',
    campana: '<path d="M6 16v-5a6 6 0 1 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
    buscar: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>',
    ok: '<circle cx="12" cy="12" r="9"/><path d="m8 12.5 2.8 2.8 5.7-5.8"/>',
    reloj: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5.5l3.5 2"/>',
    error: '<circle cx="12" cy="12" r="9"/><path d="m9 9 6 6M15 9l-6 6"/>',
    alerta: '<path d="M12 3.5 2.5 20h19z"/><path d="M12 10v4.5M12 17.5v.01"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.5v.01"/>',
    lapiz: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
    mas: '<path d="M12 5v14M5 12h14"/>',
    flecha: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    salir: '<path d="M9 4H5v16h4"/><path d="m14 8 4 4-4 4M18 12H9"/>',
    ojo: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    candado: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
    filtro: '<path d="M4 5h16l-6 7.5V19l-4 1.5v-8z"/>',
    descarga: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
    abajo: '<path d="m6 9 6 6 6-6"/>',
    lote: '<rect x="4" y="7" width="16" height="13" rx="2"/><path d="M8 7V4h8v3M8 12h8"/>'
  };

  // Sprite de íconos lineales (trazo uniforme)
  var sprite = '<svg xmlns="http://www.w3.org/2000/svg" style="position:absolute;width:0;height:0" aria-hidden="true">';
  Object.keys(ICONOS).forEach(function (k) { sprite += '<symbol id="i-' + k + '" viewBox="0 0 24 24">' + ICONOS[k] + '</symbol>'; });
  document.body.insertAdjacentHTML("afterbegin", sprite + "</svg>");

  function leer(clave, def) { try { return localStorage.getItem(clave) || def; } catch (e) { return def; } }
  function guardar(clave, val) { try { localStorage.setItem(clave, val); } catch (e) {} }

  var cfg = window.MK || {};
  var marco = document.querySelector(".marco");
  var cmp = document.getElementById("comparador");

  var html = '<div class="cmp-fila">' +
    '<div class="cmp-titulo"><small>Mockup · tanda ' + (cfg.tanda || 1) + '</small><strong>' + cfg.vista + '</strong></div>' +
    '<div class="cmp-grupo" role="group" aria-label="Ancho">' +
    '<button type="button" data-ancho="escritorio">Escritorio</button><button type="button" data-ancho="telefono">Teléfono 390 px</button></div>' +
    '<div class="cmp-grupo" role="group" aria-label="Tema">' +
    '<button type="button" data-tema="sistema">Sistema</button><button type="button" data-tema="light">Claro</button><button type="button" data-tema="dark">Oscuro</button></div>' +
    (cfg.extras || "") +
    '</div><p class="cmp-nota"><strong>Diseño aprobado.</strong> IBM Plex Sans + Plex Mono · azul noche y azul de la FaCyT · riel de íconos y encabezado editorial con el escudo.</p>';
  cmp.innerHTML = html;

  function ponerAncho(a) {
    marco.setAttribute("data-ancho", a);
    cmp.querySelectorAll("[data-ancho]").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.ancho === a)); });
    guardar("mk-ancho", a);
  }
  function ponerTema(t) {
    if (t === "sistema") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", t);
    cmp.querySelectorAll("[data-tema]").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.tema === t)); });
  }

  cmp.addEventListener("click", function (e) {
    var b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.ancho) ponerAncho(b.dataset.ancho);
    if (b.dataset.tema) ponerTema(b.dataset.tema);
  });
  ponerAncho(/[?&]ancho=telefono/.test(location.search) ? "telefono" : leer("mk-ancho", "escritorio"));
  ponerTema(document.documentElement.getAttribute("data-theme") || "sistema");

  // Alto de la barra del comparador, para que los paneles fijos (sticky) queden debajo de ella
  function medir() { document.documentElement.style.setProperty("--cmp-h", cmp.offsetHeight + "px"); }
  medir();
  window.addEventListener("resize", medir);

  // Evita que los formularios del mockup intenten enviarse
  document.addEventListener("submit", function (e) { e.preventDefault(); });
})();
