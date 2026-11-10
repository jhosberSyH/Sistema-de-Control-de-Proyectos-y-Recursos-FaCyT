# Une la captura del mockup (izquierda) y la de la app (derecha) a la misma escala.
import sys, os
from PIL import Image, ImageDraw
sal = sys.argv[1]
pares = [l.split('|') for l in sys.argv[2:]]
os.makedirs(os.path.join(sal, 'lado'), exist_ok=True)
for mock, app, nombre, ancho in pares:
    a = Image.open(os.path.join(sal, 'mockups', mock + '.png')).convert('RGB')
    b = Image.open(os.path.join(sal, 'app', app + '.png')).convert('RGB')
    w = int(ancho)
    a = a.resize((w, int(a.height * w / a.width)))
    b = b.resize((w, int(b.height * w / b.width)))
    h = max(a.height, b.height) + 28
    c = Image.new('RGB', (w * 2 + 24, h), (200, 200, 200))
    d = ImageDraw.Draw(c)
    d.text((8, 6), 'MOCKUP ' + mock, fill=(0, 0, 0)); d.text((w + 32, 6), 'APP ' + app, fill=(0, 0, 0))
    c.paste(a, (0, 28)); c.paste(b, (w + 24, 28))
    c.save(os.path.join(sal, 'lado', nombre + '.png'))
    print(nombre, c.size)
