# Hoja de contactos: varias capturas en fila, cada una a un ancho fijo, recortadas a un alto máximo.
import sys, os
from PIL import Image, ImageDraw
sal, nombre, ancho, alto = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4])
rutas = sys.argv[5:]
ims = []
for r in rutas:
    im = Image.open(os.path.join(sal, r)).convert('RGB')
    im = im.resize((ancho, int(im.height * ancho / im.width)))
    ims.append((r, im.crop((0, 0, ancho, min(im.height, alto)))))
h = max(i.height for _, i in ims) + 22
c = Image.new('RGB', ((ancho + 12) * len(ims), h), (190, 190, 190))
d = ImageDraw.Draw(c)
for k, (r, im) in enumerate(ims):
    x = k * (ancho + 12)
    d.text((x + 4, 4), os.path.basename(r)[:60], fill=(0, 0, 0))
    c.paste(im, (x, 22))
os.makedirs(os.path.join(sal, 'hojas'), exist_ok=True)
c.save(os.path.join(sal, 'hojas', nombre + '.png'))
print(c.size)
