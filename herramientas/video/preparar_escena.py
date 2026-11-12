"""Prepara los dibujos de una escena para animarla (trozo 3 del domingo; adaptar rutas para otro vídeo).
Para cada edición en <crudo>/: `X_b.png` = segundo movimiento (se copia solo lo que cambia, protegiendo la cabeza
para que no tiemble); `X_boca.png` = la misma escena con la boca abierta: se busca la boca abierta en el dibujo
nuevo (lo que no es magenta ni dorado en la parte baja de su cabeza) y se guarda como capa RGBA que el montador
pone encima mientras habla (`"boca": "img/X_boca.png"` en el plano). Revisar SIEMPRE con una hoja de caras: si
una boca sale cortada, recortarla a mano con una elipse donde está la boca del dibujo editado.
"""
import sys, os, glob
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as ndi
T=os.path.dirname(os.path.abspath(__file__)); S=os.path.dirname(T)
E='/home/user/estudio-animacion/herramientas/video/ejemplo_domingo/img'
def base_de(n):
    for d in (T, S+'/broll', S+'/pil/img'):
        p=os.path.join(d,n+'.png')
        if os.path.exists(p): return p
    raise SystemExit('sin base '+n)
def cabezas(a):
    r_,g_,b_=a[...,0],a[...,1],a[...,2]
    mag=(r_>150)&(g_<120)&(b_>110)&(r_-g_>80)
    lab,n=ndi.label(mag); out=[]
    if not n: return out
    tam=ndi.sum(mag,lab,range(1,n+1))
    for i in np.argsort(tam)[::-1][:2]:
        if tam[i]<4000: break
        m=ndi.binary_fill_holes(lab==i+1); dt=ndi.distance_transform_edt(m)
        y,x=np.unravel_index(int(np.argmax(dt)),dt.shape); out.append((x,y,float(dt[y,x])))
    return out
def disco(sh,x,y,r):
    yy,xx=np.ogrid[:sh[0],:sh[1]]; return (xx-x)**2+(yy-y)**2<=r*r
def guardar(img,nombre,rgba=False):
    im=img.resize((1920,1072),Image.LANCZOS)
    if rgba: im.save(os.path.join(E,nombre+'.png'))
    else: im.convert('RGB').save(os.path.join(E,nombre+'.jpg'),quality=90)
for f in sorted(glob.glob(os.path.join(T,sys.argv[1] if len(sys.argv)>1 else 'crudo','*.png'))):
    nom=os.path.basename(f)[:-4]
    boca=nom.endswith(('_boca','_bocao')); base=nom.rsplit('_',1)[0]
    A=Image.open(base_de(base)).convert('RGB'); a=np.asarray(A).astype(int)
    b=np.asarray(Image.open(f).convert('RGB').resize(A.size)).astype(int)
    d=np.abs(a-b).max(2)>45
    heads=cabezas(a)
    if boca:
        # la boca abierta se busca en el dibujo NUEVO: lo que no es magenta (ni el aro dorado) en la parte baja
        # de una cabeza; se elige la cabeza donde más cambió
        rb,gb,bb=b[...,0],b[...,1],b[...,2]
        magb=(rb>150)&(gb<120)&(bb>110)&(rb-gb>80)
        oro=(rb>150)&(gb>110)&(bb<120)
        mejor=None
        for (x,y,r) in heads:
            z=disco(d.shape,x,y,r*0.86)&(np.arange(d.shape[0])[:,None]>y+0.18*r)
            cand=z&~magb&~oro&d
            if cand.sum()>(mejor[0] if mejor else 0): mejor=(cand.sum(),z,x,y,r)
        m=np.zeros(d.shape,bool)
        if mejor and mejor[0]>40:
            _,z,x,y,r=mejor
            nm=z&~magb&~oro
            lab,n=ndi.label(ndi.binary_dilation(nm,iterations=2))
            t=ndi.sum(d&z,lab,range(1,n+1)); k=int(np.argmax(t))+1
            ys,xs=np.nonzero((lab==k)&nm)
            x0,x1,y0,y1=xs.min(),xs.max(),ys.min(),ys.max(); mx,my=(x0+x1)/2,(y0+y1)/2
            rx,ry=(x1-x0)/2+8,(y1-y0)/2+8
            yy,xx=np.ogrid[:d.shape[0],:d.shape[1]]
            m=(((xx-mx)/rx)**2+((yy-my)/ry)**2<=1)&disco(d.shape,x,y,r*0.98)
            # y la raya de la boca vieja que quede fuera, también tapada
            ra,ga,ba=a[...,0],a[...,1],a[...,2]
            vieja=z&(a.max(2)<100)
            lv,nv=ndi.label(ndi.binary_dilation(vieja,iterations=2))
            for j in range(1,nv+1):
                if (m&(lv==j)).any(): m|=ndi.binary_dilation(lv==j,iterations=3)&disco(d.shape,x,y,r*0.95)
        al=np.asarray(Image.fromarray((m*255).astype('uint8')).filter(ImageFilter.GaussianBlur(2)))
        rgba=np.dstack([b.astype('uint8'),al])
        guardar(Image.fromarray(rgba,'RGBA'),nom,rgba=True)
    else:
        prot=np.zeros(d.shape,bool)
        if not base.startswith(('taza','es_calle_guardia','es_bib_dormido','es_gym_espejo','es_gym_barra','es_calle_salta')):
            for (x,y,r) in heads[:1]: prot|=disco(d.shape,x,y,r*1.08)
        d&=~prot; d=ndi.binary_opening(d,iterations=2)
        lab,n=ndi.label(ndi.binary_dilation(d,iterations=8))
        if n:
            t=ndi.sum(np.ones_like(d),lab,range(1,n+1)); m=np.isin(lab,[i+1 for i,v in enumerate(t) if v>2500])
        else: m=d
        m=ndi.binary_fill_holes(m)&~prot
        al=np.asarray(Image.fromarray((m*255).astype('uint8')).filter(ImageFilter.GaussianBlur(3))).astype(float)[...,None]/255
        guardar(Image.fromarray((a*(1-al)+b*al).astype('uint8')),nom)
    print(nom, 'cambia %.1f%%'%(m.mean()*100), 'cabezas',len(heads))
