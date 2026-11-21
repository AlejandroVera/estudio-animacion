"""Subida de tono al final de una frase: mediana de F0 en el último 35 % frente al resto (semitonos)."""
import sys, subprocess, json
import numpy as np
SR = 16000
def f0(x):
    hop, win = 160, 640
    out = []
    for i in range(0, len(x) - win, hop):
        s = x[i:i + win] - x[i:i + win].mean()
        if np.sqrt((s ** 2).mean()) < 300:
            out.append(0); continue
        ac = np.correlate(s, s, 'full')[win - 1:]
        lo, hi = SR // 320, SR // 75
        k = lo + int(np.argmax(ac[lo:hi]))
        out.append(SR / k if ac[k] > 0.35 * ac[0] else 0)
    return np.array(out)
def subida(mp3, a=None, b=None):
    args = ['ffmpeg', '-loglevel', 'error', '-i', mp3]
    if a is not None: args += ['-ss', str(a), '-to', str(b)]
    raw = subprocess.run(args + ['-ac', '1', '-ar', str(SR), '-f', 's16le', '-'], capture_output=True).stdout
    x = np.frombuffer(raw, np.int16).astype(float)
    f = f0(x); v = np.nonzero(f)[0]
    if len(v) < 10: return 0.0
    fv = f[v]
    from scipy.signal import medfilt
    fv = medfilt(fv, 5)
    base = np.median(fv)
    fv = np.where(fv > 1.6 * base, fv / 2, np.where(fv < base / 1.6, fv * 2, fv))   # errores de octava
    n = len(fv)
    return round(12 * np.log2(np.median(fv[-max(4, n // 4):]) / np.median(fv[:int(0.6 * n)])), 2)
if __name__ == '__main__':
    print(subida(*[sys.argv[1]] + [float(v) for v in sys.argv[2:]]))
