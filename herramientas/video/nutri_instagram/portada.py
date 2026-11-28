"""Portada de Instagram del vídeo de Nutricionista de Instagram (1080x1920; texto dentro de la franja 3:4 central).
El fondo (salón) es cargado: el texto va sobre carteles blancos con borde para que se lea."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'shorts', 'portadas'))
import portadas as P
from PIL import Image, ImageDraw, ImageFilter
im = Image.open('img/br_pdf_b.jpg').convert('RGB')
im = im.resize((1080, round(im.height * 1080 / im.width)), Image.LANCZOS)
y0 = (im.height - 1920) // 2
# el dibujo baja 230 px para que el cartel de arriba no le tape la cara; arriba se rellena con su pared (color liso de la pared)
B = 230
im = im.crop((0, 0, 1080, 1920 - B))
import numpy as np
arriba = Image.new('RGB', (1080, B), tuple(int(v) for v in np.median(np.asarray(im)[5:40, 100:300].reshape(-1, 3), 0)))
lienzo = Image.new('RGB', (1080, 1920)); lienzo.paste(arriba, (0, 0)); lienzo.paste(im, (0, B))
im = lienzo.convert('RGBA')

def cartel(caja, ang):
    x0, y0, x1, y1 = caja
    c = Image.new('RGBA', im.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(c)
    d.rounded_rectangle((x0 + 12, y0 + 14, x1 + 12, y1 + 14), radius=34, fill=(0, 0, 0, 110))  # sombra
    d.rounded_rectangle(caja, radius=34, fill=(255, 255, 255, 255), outline=(25, 25, 25, 255), width=8)
    c = c.rotate(ang, center=((x0 + x1) / 2, (y0 + y1) / 2), resample=Image.BICUBIC)
    im.alpha_composite(c)

cartel((50, 50, 1030, 300), -1.5)
cartel((40, 1580, 1040, 1860), 1.5)
P.linea(im, 'NUTRiCiONiSTA', 72, 105, 'negro', 3)
P.linea(im, 'SiN CARRERA', 180, 105, 'negro', 5)
P.linea(im, 'DiPLOMA', 1600, 115, 'rojo', 7)
P.linea(im, 'EN PDF', 1725, 115, 'rojo', 9)
P.letras(im)
im.convert('RGB').save('entrega/Portada-Nutricionista-Instagram.jpg', quality=92)
