"""Primeros planos de cara de la nutri (caras/crudo/e_*.png) + su ~b (caras/crudo_bocas/e_*.png):
de la ~b copia SOLO la zona de la boca, quita el fondo blanco unido al borde y guarda webp en caras/expresiones/.
Uso: python3 herramientas/caras_nutri.py [carpeta_personaje zx0 zx1 zy0 zy1 cx cy rx ry]   (por defecto la nutri)
  zona de la boca (z*) y óvalo de la cara (c*, r*) en la base de 2048: fuera del óvalo los blancos sueltos se borran."""
from PIL import Image, ImageFilter
import numpy as np, glob, os
from scipy import ndimage as nd
import sys
A=sys.argv[1:]
D=(A[0] if A else 'public/personajes/nutri')+'/caras'; O=f'{D}/expresiones'; os.makedirs(O,exist_ok=True)
ZX0,ZX1,ZY0,ZY1=[int(v) for v in A[1:5]] if len(A)>4 else (780,1290,1230,1600)   # zona de la boca
OCX,OCY,ORX,ORY=[int(v) for v in A[5:9]] if len(A)>8 else (1030,1110,330,390)   # óvalo de la cara

def sin_fondo(a):
    blanco=a.min(2)>232
    lab,_=nd.label(blanco)
    borde=set(np.unique(np.concatenate([lab[0],lab[-1],lab[:,0],lab[:,-1]])))-{0}
    fondo=np.isin(lab,list(borde))
    # huecos blancos entre el pelo (fuera del óvalo de la cara: ahí no hay ojos ni dientes)
    lab2,k2=nd.label(blanco&~fondo)
    if k2:
        cs=nd.center_of_mass(blanco,lab2,range(1,k2+1)); sz=nd.sum(blanco,lab2,range(1,k2+1))
        for i,((cy,cx),z) in enumerate(zip(cs,sz)):
            if z>150 and ((cx-OCX)/ORX)**2+((cy-OCY)/ORY)**2>1: fondo|=lab2==i+1
    al=Image.fromarray((~fondo).astype(np.uint8)*255).filter(ImageFilter.GaussianBlur(1))
    im=Image.fromarray(a).convert('RGBA'); im.putalpha(al); return im

def boca(a,b):
    ref=a[ZY0-150:ZY0,ZX0:ZX1].astype(int); mejor=(1e18,0,0)
    for dy in range(-16,17,2):
        for dx in range(-16,17,2):
            c=b[ZY0-150+dy:ZY0+dy,ZX0+dx:ZX1+dx].astype(int)
            e=np.abs(c-ref).mean()
            if e<mejor[0]: mejor=(e,dx,dy)
    b=np.roll(np.roll(b,-mejor[2],0),-mejor[1],1)
    d=np.abs(a.astype(int)-b.astype(int)).max(2)>45
    m=np.zeros(d.shape,bool); m[ZY0:ZY1,ZX0:ZX1]=d[ZY0:ZY1,ZX0:ZX1]
    m=nd.binary_opening(m,iterations=2)
    lab,k=nd.label(nd.binary_dilation(m,iterations=10))
    if k:
        sz=nd.sum(m,lab,range(1,k+1)); m=lab==(np.argmax(sz)+1)
    m=nd.binary_fill_holes(nd.binary_dilation(m,iterations=8))
    al=np.asarray(Image.fromarray(m.astype(np.uint8)*255).filter(ImageFilter.GaussianBlur(5)))/255.
    return (a*(1-al[...,None])+b*al[...,None]).astype(np.uint8)

for f in sorted(glob.glob(f'{D}/crudo/e_*.png')):
    n=os.path.basename(f)[:-4]
    a=np.asarray(Image.open(f).convert('RGB'))
    sin_fondo(a).save(f'{O}/{n}.webp',quality=92)
    fb=f'{D}/crudo_bocas/{n}.png'
    if os.path.exists(fb):
        b=np.asarray(Image.open(fb).convert('RGB').resize((a.shape[1],a.shape[0])))
        sin_fondo(boca(a,b)).save(f'{O}/{n}~b.webp',quality=92)
    print(n)
