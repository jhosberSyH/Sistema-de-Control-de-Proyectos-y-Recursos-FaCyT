/* Marco de las vistas internas: navegación por rol, encabezado editorial y barra superior.
   Cada página define window.APP = { rol: "adm", activo: "usuarios", titulo: "Usuarios", ins: "..." }
   antes de cargar este archivo, y deja vacíos #nav-lat, #editorial y #barra. */
(function () {
  var ROLES = {
    adm: { ini: "JR", nombre: "José Rodríguez", rol: "Administrador del Sistema", avisos: 2,
      nav: [["inicio", "inicio", "Inicio"], ["dashboard", "reportes", "Dashboard"], ["proyectos", "proyectos", "Proyectos", 1], ["usuarios", "usuarios", "Usuarios"], ["insumos", "inventario", "Catálogo de insumos"], ["equipos", "equipos", "Catálogo de equipos"], ["ubicaciones", "almacen", "Ubicaciones y parámetros"], ["auditoria", "auditoria", "Auditoría"]] },
    coo: { ini: "DR", nombre: "Daniela Rivas", rol: "Coordinadora de Proyecto", avisos: 3,
      nav: [["inicio", "inicio", "Inicio"], ["proyectos", "proyectos", "Mis proyectos"], ["solicitudes", "solicitudes", "Solicitudes", 1], ["reservas", "calendario", "Equipos y reservas"], ["inventario", "inventario", "Inventario"], ["cierre", "prorrateo", "Cierre de período", 1], ["reportes", "descarga", "Reportes"]] },
    apr: { ini: "CP", nombre: "Carmen Pérez", rol: "Aprobadora / Gestora de Inventario", avisos: 5,
      nav: [["inicio", "inicio", "Inicio"], ["bandeja", "solicitudes", "Bandeja de aprobación", 9], ["inventario", "inventario", "Inventario"], ["almacen", "almacen", "Almacén", 2], ["reservas", "calendario", "Equipos y reservas"], ["priorizacion", "filtro", "Priorización"], ["cierre", "prorrateo", "Gastos compartidos"], ["reportes", "descarga", "Reportes"]] }
  };
  function ico(n) { return '<svg class="ico" aria-hidden="true"><use href="#i-' + n + '"/></svg>'; }
  window.ico = ico;
  window.est = function (tipo, texto) {
    var i = { ok: "ok", warn: "reloj", err: "error", info: "info", neutro: "lapiz" }[tipo];
    return '<span class="estado ' + tipo + '">' + ico(i) + texto + "</span>";
  };
  window.prio = function (n) {
    return '<span class="prio ' + n.toLowerCase().replace("í", "i") + '"><i aria-hidden="true"></i>' + n + "</span>";
  };

  function pintarMarco() {
    var cfg = window.APP || {};
    var r = ROLES[cfg.rol || "adm"];
    document.getElementById("nav-lat").innerHTML =
      '<a class="marca" href="#contenido"><img src="logos/facyt-isotipo.png" alt="" width="38" height="38"><div><strong>Control de Proyectos</strong><span>FaCyT · UC</span></div></a>' +
      '<nav><ul>' + r.nav.map(function (n) {
        return '<li><a class="item" href="#contenido"' + (n[0] === cfg.activo ? ' aria-current="page"' : "") + ">" + ico(n[1]) + "<span>" + n[2] + "</span>" + (n[3] ? '<span class="cuenta">' + n[3] + "</span>" : "") + "</a></li>";
      }).join("") + "</ul></nav>" +
      '<div class="nav-pie"><span class="avatar">' + r.ini + '</span><div class="quien"><strong>' + r.nombre + "</strong><span>" + r.rol + '</span></div><button class="salir" type="button" aria-label="Cerrar sesión">' + ico("salir") + "</button></div>";
    document.getElementById("editorial").innerHTML =
      '<span class="placa-escudo"><img src="logos/escudo-uc.jpg" alt="Escudo de la Universidad de Carabobo" width="40" height="53"></span>' +
      '<div class="txt"><span class="ins">Universidad de Carabobo · FaCyT · ' + (cfg.ins || cfg.titulo) + '</span><span class="fecha">' + (cfg.fecha || "Martes 27 de octubre de 2026 · El período de octubre cierra el sábado 31/10") + "</span></div>";
    document.getElementById("barra").innerHTML =
      '<button class="icono-btn menu" type="button" aria-label="Abrir menú">' + ico("menu") + "</button>" +
      '<span class="marca-tel"><img src="logos/facyt-isotipo.png" alt="" width="28" height="28">' + cfg.titulo + "</span>" +
      '<div class="buscar"><label for="buscar" class="vh">Buscar</label>' + ico("buscar") + '<input class="entrada" id="buscar" type="search" placeholder="Buscar proyecto, insumo, equipo o solicitud"></div>' +
      '<div class="der"><button class="icono-btn" type="button" aria-label="Avisos, ' + r.avisos + ' sin leer">' + ico("campana") + '<span class="punto">' + r.avisos + "</span></button></div>";
  }
  window.pintarMarco = pintarMarco;
  pintarMarco();
})();
