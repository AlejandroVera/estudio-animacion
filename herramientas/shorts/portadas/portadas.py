"""Portadas verticales (1080x1920) para Reels/Shorts: un dibujo del vídeo a pantalla completa + título a mano.
El texto va dentro de la franja central 3:4 (y 240-1680), que es lo que enseña la cuadrícula del perfil de Instagram.

  python3 herramientas/shorts/portadas/portadas.py
"""
import os, random
from PIL import Image, ImageDraw, ImageFont, ImageFilter

AQUI = os.path.dirname(os.path.abspath(__file__))
SH = os.path.dirname(AQUI)
IMG = os.path.join(SH, '..', 'video', 'ejemplo_domingo', 'img')
LL = os.path.join(SH, 'domingo', 'lleno')
FUENTE = os.path.join(SH, 'ComingSoon.ttf')
W, H = 1080, 1920
COL = {'negro': (25, 25, 25), 'rojo': (214, 40, 40), 'verde': (30, 140, 60), 'blanco': (250, 250, 250)}


def fondo(lleno, dibujo, alto, s, cx, ly=0.0):
    """El dibujo pegado en su ampliación vertical y recortado a 9:16 (s = escala sobre el ancho, como en el montaje)."""
    lien = Image.open(os.path.join(LL, lleno)).convert('RGB')
    lien = lien.resize((1920, round(lien.height * 1920 / lien.width)), Image.LANCZOS)
    src = Image.open(os.path.join(IMG, dibujo)).convert('RGB')
    dy = (alto - 1072) // 2
    lien.paste(src, (0, dy))
    cw = 1920 / s
    ch = cw * H / W
    x0 = min(max(cx * 1920 - cw / 2, 0), 1920 - cw)
    y0 = min(max(dy + 536 + ly * 1072 - ch / 2, 0), lien.height - ch)
    return lien.crop((int(x0), int(y0), int(x0 + cw), int(y0 + ch))).resize((W, H), Image.LANCZOS)


def linea(im, texto, y, tam, color='negro', semilla=1):
    """Una línea centrada, letras algo torcidas y a distinta altura, con halo blanco para que se lea."""
    f = ImageFont.truetype(FUENTE, tam)
    rnd = random.Random(semilla)
    anchos = [f.getlength(c) * 1.16 for c in texto]
    x = (W - sum(anchos)) / 2
    capa = Image.new('RGBA', im.size, (0, 0, 0, 0))
    for c, a in zip(texto, anchos):
        g = Image.new('RGBA', (int(tam * 2), int(tam * 2)), (0, 0, 0, 0))
        ImageDraw.Draw(g).text((tam * 0.5, tam * 0.4), c, font=f, fill=COL[color] + (255,),
                               stroke_width=max(3, tam // 18), stroke_fill=COL[color] + (255,))
        g = g.rotate(rnd.uniform(-6, 6), resample=Image.BICUBIC)
        capa.alpha_composite(g, (int(x - tam * 0.5), int(y + rnd.uniform(-8, 8) - tam * 0.4)))
        x += a
    a = capa.split()[3]
    halo = Image.new('RGBA', im.size, (255, 255, 255, 0))
    halo.putalpha(a.filter(ImageFilter.MaxFilter(tam // 6 * 2 + 1)).filter(ImageFilter.GaussianBlur(3)))
    # primero todos los halos y luego todas las letras: así el halo de una línea no tapa las letras de otra
    PENDIENTES.append(capa)
    im.alpha_composite(halo)
    return sum(anchos)


PENDIENTES = []


def letras(im):
    for capa in PENDIENTES:
        im.alpha_composite(capa)
    PENDIENTES.clear()


def subrayado(im, y, ancho, color='rojo', grosor=14):
    d = ImageDraw.Draw(im)
    x0, x1 = (W - ancho) / 2, (W + ancho) / 2
    d.line([(x0, y + 6), ((x0 + x1) / 2, y - 4), (x1, y + 4)], fill=COL[color] + (255,), width=grosor, joint='curve')


def short1():
    im = fondo('es_ofi_doble.jpg', 'es_ofi_doble_b.jpg', 3120, 1.45, 0.55, ly=-0.2).convert('RGBA')
    linea(im, 'EL JEFE', 300, 130, 'negro', 3)
    w = linea(im, 'MÁS TÓXiCO', 450, 130, 'verde', 5)
    linea(im, 'SOY YO', 1420, 190, 'rojo', 7)
    letras(im)
    subrayado(im, 1640, 560)
    return im


def short2():
    im = fondo('es_sofa_multi.jpg', 'es_sofa_ardilla_c.jpg', 2400, 1.8, 0.45, ly=-0.2).convert('RGBA')
    linea(im, 'HEMOS', 290, 130, 'negro', 11)
    linea(im, 'PROHiBiDO', 430, 140, 'negro', 13)
    w = linea(im, 'ABURRiRNOS', 1440, 128, 'rojo', 17)
    letras(im)
    subrayado(im, 1630, w * 0.9)
    return im


if __name__ == '__main__':
    out = os.path.join(SH, 'entrega_domingo')
    short1().convert('RGB').save(os.path.join(out, 'Portada-Short1-jefe-toxico.jpg'), quality=94)
    short2().convert('RGB').save(os.path.join(out, 'Portada-Short2-prohibido-aburrirse.jpg'), quality=94)
    print('listo')
