// Animación de los personajes articulados: canales con claves y curvas (con rebote), caminar por ciclos,
// sentarse con las piernas calculadas, y «vida» (respirar, balanceo) sumada siempre.

import { altoCadera, ik, POSE0, type RigDef, type RigPose } from './rig'

export type Curva = 'lin' | 'out' | 'io' | 'back' | 'salto'
const CURVA: Record<Curva, (u: number) => number> = {
  lin: (u) => u,
  out: (u) => 1 - Math.pow(1 - u, 3),
  io: (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2),
  // Se pasa un poco y vuelve: el golpe de los dibujos animados
  back: (u) => 1 + 2.4 * Math.pow(u - 1, 3) + 1.4 * Math.pow(u - 1, 2),
  salto: (u) => (u >= 1 ? 1 : 0),
}

export type Obj = (g: CanvasRenderingContext2D, giro: number) => void
type Clave = { t: number; v: number; c: Curva }
const NUM0: Record<string, number> = {
  x: 0, y: 0, escala: 1, cadera: 0, inclina: 0, cabezaRot: 0, cabezaDy: 0, estira: 1,
  bD1: POSE0.brazoD.a1, bD2: POSE0.brazoD.a2, bT1: POSE0.brazoT.a1, bT2: POSE0.brazoT.a2, pD1: 0, pD2: 0, pT1: 0, pT2: 0,
}
const STR0: Record<string, string> = { ojos: 'nada', boca: 'nada', cara: 'reposo', manoD: 'normal', manoT: 'normal', mira: '1', tDelante: '0' }

export class Actor {
  num: Record<string, Clave[]> = {}
  str: Record<string, { t: number; v: string }[]> = {}
  pasos: { t0: number; t1: number }[] = []
  objD: { t: number; f?: Obj }[] = []
  objT: { t: number; f?: Obj }[] = []
  fase = Math.random() * 6
  constructor(public def: RigDef, ini: Record<string, number> = {}) {
    for (const [k, v] of Object.entries(ini)) this.num[k] = [{ t: -1, v, c: 'salto' }]
  }
  n(canal: string, t: number): number {
    const ks = this.num[canal]
    if (!ks?.length) return NUM0[canal] ?? 0
    if (t <= ks[0].t) return ks[0].v
    for (let i = ks.length - 1; i >= 0; i--) {
      if (t >= ks[i].t) {
        const b = ks[i + 1]
        if (!b) return ks[i].v
        return ks[i].v + (b.v - ks[i].v) * CURVA[b.c]((t - ks[i].t) / (b.t - ks[i].t))
      }
    }
    return ks[0].v
  }
  /** Lleva varios canales a un valor entre t y t+dur (desde lo que valgan en t). */
  a(t: number, dur: number, vals: Record<string, number>, c: Curva = 'back') {
    for (const [k, v] of Object.entries(vals)) {
      const ks = (this.num[k] ??= [{ t: -1, v: NUM0[k] ?? 0, c: 'salto' }])
      const ahora = this.n(k, t)
      while (ks.length && ks[ks.length - 1].t >= t) ks.pop()
      ks.push({ t, v: ahora, c: 'lin' }, { t: t + dur, v, c })
    }
    return this
  }
  s(canal: string, t: number, v: string) {
    ;(this.str[canal] ??= []).push({ t, v })
    this.str[canal].sort((p, q) => p.t - q.t)
    return this
  }
  st(canal: string, t: number): string {
    let v = STR0[canal] ?? ''
    for (const k of this.str[canal] ?? []) if (k.t <= t) v = k.v
    return v
  }
  /** Camina hasta x entre t0 y t1 (mira hacia donde va). */
  camina(t0: number, t1: number, x: number) {
    const x0 = this.n('x', t0)
    this.a(t0, t1 - t0, { x }, 'lin')
    this.s('mira', t0, x > x0 ? '1' : '-1')
    this.pasos.push({ t0, t1 })
    return this
  }
  /** Se sienta (o se levanta con alto = 0): baja la cadera y dobla las piernas hacia delante. */
  sienta(t: number, dur: number, alto: number) {
    const P = this.def.pierna
    const de_pie = altoCadera(this.def)
    if (alto <= 0) return this.a(t, dur, { cadera: 0, pD1: 0, pD2: 0, pT1: 0, pT2: 0 }, 'out')
    const tobillo = de_pie - P.l1 - P.l2
    const d = ik(P.l1, P.l2, P.l1 * 0.98, alto - tobillo, 1)
    const d2 = ik(P.l1, P.l2, P.l1 * 0.8, alto - tobillo, 1)
    return this.a(t, dur, { cadera: alto - de_pie, pD1: d.a1, pD2: d.a2, pT1: d2.a1, pT2: d2.a2 }, 'out')
  }
  obj(mano: 'D' | 'T', t: number, f?: Obj) {
    ;(mano === 'D' ? this.objD : this.objT).push({ t, f })
    return this
  }
  pose(t: number): RigPose {
    const n = (k: string) => this.n(k, t)
    const p: RigPose = {
      ...POSE0,
      x: n('x'), y: n('y'), escala: n('escala'), cadera: n('cadera'), inclina: n('inclina'), cabezaRot: n('cabezaRot'), cabezaDy: n('cabezaDy'), estira: n('estira'),
      brazoD: { a1: n('bD1'), a2: n('bD2'), mano: this.st('manoD', t) as 'normal' },
      brazoT: { a1: n('bT1'), a2: n('bT2'), mano: this.st('manoT', t) as 'normal' },
      piernaD: { a1: n('pD1'), a2: n('pD2') }, piernaT: { a1: n('pT1'), a2: n('pT2') },
      ojos: this.st('ojos', t), boca: this.st('boca', t), cara: this.st('cara', t), mira: this.st('mira', t) === '-1' ? -1 : 1,
      brazoTDelante: this.st('tDelante', t) === '1',
    }
    for (const o of this.objD) if (o.t <= t) p.objD = o.f
    for (const o of this.objT) if (o.t <= t) p.objT = o.f
    // Caminar: ciclo de piernas y brazos según lo andado
    for (const w of this.pasos) {
      if (t < w.t0 || t > w.t1) continue
      const mezcla = Math.min(1, (t - w.t0) / 0.12, (w.t1 - t) / 0.12)
      const zancada = this.def.pierna.l1 * 0.95 * p.escala * this.def.k
      const ph = (Math.abs(p.x - this.n('x', w.t0)) / zancada) * Math.PI
      const sn = Math.sin(ph), cs = Math.cos(ph)
      p.piernaD = { a1: 28 * sn * mezcla, a2: -38 * Math.max(0, cs) * mezcla }
      p.piernaT = { a1: -28 * sn * mezcla, a2: -38 * Math.max(0, -cs) * mezcla }
      p.cadera += (10 * Math.cos(2 * ph) - 6) * mezcla
      p.brazoD = { ...p.brazoD, a1: p.brazoD.a1 - 24 * sn * mezcla, a2: p.brazoD.a2 + 14 * mezcla }
      p.brazoT = { ...p.brazoT, a1: p.brazoT.a1 + 24 * sn * mezcla, a2: p.brazoT.a2 + 14 * mezcla }
      p.inclina += 3 * mezcla
      p.cabezaRot += 2 * Math.sin(2 * ph) * mezcla
    }
    // Vida: respira y se balancea un poco; la cabeza va con retraso cuando el cuerpo se mueve
    const f = this.fase
    p.estira *= 1 + 0.006 * Math.sin(t * 1.7 + f)
    p.cabezaRot += 1.2 * Math.sin(t * 1.3 + f) + 0.6 * Math.sin(t * 2.9 + f * 2)
    p.brazoD.a1 += 1.5 * Math.sin(t * 1.5 + f)
    p.brazoT.a1 += 1.5 * Math.sin(t * 1.4 + f + 1)
    const v = (this.n('inclina', t) - this.n('inclina', t - 0.08)) / 0.08
    p.cabezaRot -= Math.max(-10, Math.min(10, v * 0.12))
    return p
  }
}
