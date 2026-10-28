"""Arma las carpetas de docs/mockups/ a partir de _fuente/.

Por cada vista crea <nn-vista>/index.html y copia compartido/ y los logos
oficiales sin modificarlos.

Uso: python -I docs/mockups/_fuente/construir.py
"""
import shutil
from pathlib import Path

FUENTE = Path(__file__).resolve().parent
MOCKUPS = FUENTE.parent
LOGOS = MOCKUPS.parent / "identidad-visual" / "logos"

# Nombre publicado -> archivo oficial (ver identidad-visual/logos/FUENTES.md)
LOGOS_USADOS = {
    "facyt-isotipo.png": LOGOS / "facyt" / "facyt-isotipo_512x512_transparente.png",
    "facyt-logo.png": LOGOS / "facyt" / "facyt-logo-completo_472x512_transparente.png",
    "escudo-uc.jpg": LOGOS / "uc" / "escudo-uc-color_980x1287_odontologia.jpg",
}

ESQUELETO = """<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<style>:root{color-scheme:light}body{margin:0;font:14px system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}</style>
"""


def construir(pagina: Path) -> None:
    vista = pagina.stem
    destino = MOCKUPS / vista
    destino.mkdir(exist_ok=True)
    cuerpo = pagina.read_text(encoding="utf-8")

    # Separa lo que va en <head> (title, meta, link, style) del resto
    corte = cuerpo.index("</style>") + len("</style>")
    cabeza, resto = cuerpo[:corte], cuerpo[corte:]
    html = ESQUELETO + cabeza + "\n</head>\n<body>\n" + resto + "\n</body>\n</html>\n"
    (destino / "index.html").write_text(html, encoding="utf-8")

    shutil.copytree(FUENTE / "compartido", destino / "compartido", dirs_exist_ok=True)
    (destino / "logos").mkdir(exist_ok=True)
    for nombre, origen in LOGOS_USADOS.items():
        shutil.copyfile(origen, destino / "logos" / nombre)
    print("listo:", destino.relative_to(MOCKUPS.parent.parent))


if __name__ == "__main__":
    for pagina in sorted(FUENTE.glob("[0-9][0-9]-*.html")):
        construir(pagina)
