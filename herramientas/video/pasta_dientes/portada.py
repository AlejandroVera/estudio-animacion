"""Portada de Instagram del vídeo de la pasta de dientes (1080x1920; texto dentro de la franja 3:4 central)."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'shorts', 'portadas'))
import portadas as P
from PIL import Image
im = Image.open('img/es_pasillo_b.jpg').convert('RGB')
im = im.resize((1080, round(im.height * 1080 / im.width)), Image.LANCZOS)
y0 = (im.height - 1920) // 2
im = im.crop((0, y0, 1080, y0 + 1920)).convert('RGBA')
P.linea(im, 'FUi A POR', 290, 120, 'negro', 3)
P.linea(im, 'PASTA DE DiENTES', 430, 92, 'negro', 5)
P.linea(im, 'Y VOLVÍ CON', 1350, 105, 'negro', 7)
P.linea(im, 'ANSiEDAD', 1480, 150, 'rojo', 9)
P.letras(im)
im.convert('RGB').save('entrega/Portada-pasta-de-dientes.jpg', quality=92)
