"""Genera las versiones web de los logos que usa el frontend, a 3 veces su tamaño máximo en pantalla.

Los originales de docs/identidad-visual/logos/ no se tocan: pesan cientos de KB y la app los muestra
a 40-54 px, así que el navegador descargaba de más. Se reescala con el alfa premultiplicado para que
el contorno no tome un halo de color.

Uso:
    python -I scripts/logos_web.py

Se usó el 31/10/2026 (ver frontend/plan_frontend.md §9).
"""
from pathlib import Path
from PIL import Image

RAIZ = Path(__file__).resolve().parent.parent
LOGOS = RAIZ / 'docs' / 'identidad-visual' / 'logos'
DESTINO = RAIZ / 'frontend' / 'src' / 'assets' / 'logos'

# origen, destino, ancho (3 x el mayor ancho en pantalla)
TRABAJOS = [
    (LOGOS / 'uc' / 'escudo-uc-color_980x1287_odontologia_SIN-FONDO.png', 'escudo-uc.png', 162),  # 54 px
    (LOGOS / 'facyt' / 'facyt-isotipo_512x512_transparente.png', 'facyt-isotipo.png', 144),  # 48 px
]

for origen, nombre, ancho in TRABAJOS:
    im = Image.open(origen).convert('RGBA')
    alto = round(im.height * ancho / im.width)
    chico = im.convert('RGBa').resize((ancho, alto), Image.LANCZOS).convert('RGBA')
    salida = DESTINO / nombre
    chico.save(salida, optimize=True)
    print(f'{nombre}: {im.size} -> {chico.size}, {salida.stat().st_size // 1024} KB')
