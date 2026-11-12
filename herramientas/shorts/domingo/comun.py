I = '../../video/ejemplo_domingo/img/'
def esc(n, t0, **k):
    d = {'t0': t0, 'fondo': I + n + '.jpg', 'boca': I + n + '_boca.png', 'boca_o': I + n + '_bocao.png'}; d.update(k); return d
def br(n, t0, **k):
    d = {'t0': t0, 'fondo': I + n + '.jpg', 'habla': False}; d.update(k); return d
def ch(t, n): return {'t': t, 'fondo': I + n + '.jpg'}
def alt(a, b, c, **k): d = {'imgs': [I + a + '.jpg', I + b + '.jpg'], 'cada': c}; d.update(k); return d
def R(t0, txt, x, y, col='negro', tam=100, **k):
    d = {'t0': t0, 'texto': txt, 'x': x, 'y': y, 'color': col, 'tam': tam, 'centro': True, 'fijo': True}; d.update(k); return d
def D(t0, txt, x, y, col='negro', tam=60, **k):  # rótulo dentro del dibujo (coordenadas del vídeo horizontal)
    return R(t0, txt, x, y, col, tam, en_dibujo=True, **k)

def lleno(P):
    """Pone a cada plano con marco su dibujo ampliado a 9:16 (lleno/<familia>.jpg) para verlo a pantalla completa."""
    import os
    hechos = {l.split()[0]: int(l.split()[2]) for l in open(os.path.join(os.path.dirname(__file__), 'lleno/hechos.txt')) if l.strip()}
    for p in P:
        if not p.get('marco'):
            continue
        n = p['fondo'].split('/')[-1][:-4]
        n = {'es_cama_mini_c': 'es_cama_mini'}.get(n, n)
        if n in hechos:
            p['lleno'] = 'lleno/' + n + '.jpg'
            p['dy'] = (hechos[n] - 1072) // 2
            if n == 'es_bib_mito':
                p['pegar_y'] = [50, 1022]
    return P
