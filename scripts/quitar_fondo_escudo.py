"""Quita el fondo blanco exterior del escudo de la UC y suaviza el contorno.

Rellena desde los bordes de la imagen solo los píxeles claros conectados con el exterior, así el
blanco de dentro del escudo (letras, figuras) no se toca. El borde antialiasado entre el marco negro
y el fondo se convierte en negro con transparencia. El original no se modifica.

Uso:
    python -I scripts/quitar_fondo_escudo.py <origen.jpg> <destino.png>

Se usó el 28/10/2026 para generar
docs/identidad-visual/logos/uc/escudo-uc-color_980x1287_odontologia_SIN-FONDO.png
(ver docs/identidad-visual/logos/FUENTES.md).
"""
import sys
from collections import deque
from PIL import Image

origen, destino = sys.argv[1], sys.argv[2]
im = Image.open(origen).convert('RGB')
w, h = im.size
px = im.load()
claro = lambda c: min(c) > 200
fondo = bytearray(w * h)
cola = deque()
for x in range(w):
    for y in (0, h - 1):
        if claro(px[x, y]) and not fondo[y * w + x]:
            fondo[y * w + x] = 1; cola.append((x, y))
for y in range(h):
    for x in (0, w - 1):
        if claro(px[x, y]) and not fondo[y * w + x]:
            fondo[y * w + x] = 1; cola.append((x, y))
while cola:
    x, y = cola.popleft()
    for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
        if 0 <= nx < w and 0 <= ny < h and not fondo[ny * w + nx] and claro(px[nx, ny]):
            fondo[ny * w + nx] = 1; cola.append((nx, ny))

salida = Image.new('RGBA', (w, h))
po = salida.load()
def cerca_del_fondo(x, y, r=2):
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            nx, ny = x + dx, y + dy
            if 0 <= nx < w and 0 <= ny < h and fondo[ny * w + nx]:
                return True
    return False
for y in range(h):
    for x in range(w):
        r, g, b = px[x, y]
        if fondo[y * w + x]:
            po[x, y] = (255, 255, 255, 0)
        elif cerca_del_fondo(x, y) and max(r, g, b) - min(r, g, b) < 40:
            # Borde antialiasado entre el marco negro y el blanco: se separa como negro con alfa.
            a = 255 - (r + g + b) // 3
            po[x, y] = (0, 0, 0, max(0, min(255, a)))
        else:
            po[x, y] = (r, g, b, 255)
caja = salida.getbbox()
salida.crop(caja).save(destino, optimize=True)
print('listo', salida.crop(caja).size)
