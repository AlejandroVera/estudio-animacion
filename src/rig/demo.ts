// Escena de prueba del personaje articulado: los 11 primeros segundos del guion de Tinder, con la voz real.
import { Actor } from './anim'
import { CHICO, HERMANA } from './personajes'
import { altoCadera, cargar, dibujarRig, ik, imagen, type RigDef } from './rig'

const c = document.getElementById('c') as HTMLCanvasElement
const g = c.getContext('2d')!
const W = 1080, H = 1920
const SUELO = 1450
const E = 0.36

// ---- Objetos (dibujados en el sistema de la mano: la mano está en 0,0 y los dedos apuntan a +y)
const movil = (llama: boolean) => (g: CanvasRenderingContext2D, _giro = 0) => {
  g.save()
  g.rotate(Math.PI)
  g.scale(1.45, 1.45)
  g.fillStyle = '#1b1b1f'
  g.strokeStyle = '#151015'
  g.lineWidth = 10
  g.beginPath()
  g.roundRect(-70, -30, 140, 250, 22)
  g.fill()
  g.stroke()
  g.fillStyle = llama ? '#fff3e6' : '#cfe3f5'
  g.beginPath()
  g.roundRect(-56, -12, 112, 205, 10)
  g.fill()
  if (llama) {
    g.fillStyle = '#ff5a3c'
    g.beginPath()
    g.moveTo(0, 30)
    g.bezierCurveTo(60, 80, 50, 150, 0, 160)
    g.bezierCurveTo(-55, 150, -50, 100, -22, 80)
    g.bezierCurveTo(-18, 100, -5, 100, 0, 30)
    g.fill()
  }
  g.restore()
}
const cuenco = (g: CanvasRenderingContext2D, giro: number) => {
  g.rotate(giro) // siempre derecho
  g.scale(1.35, 1.35)
  g.translate(0, -30)
  g.fillStyle = '#f4f1ea'
  g.strokeStyle = '#151015'
  g.lineWidth = 10
  g.beginPath()
  g.moveTo(-95, -20)
  g.quadraticCurveTo(0, 130, 95, -20)
  g.closePath()
  g.fill()
  g.stroke()
  g.fillStyle = '#e8b04a'
  g.beginPath()
  g.ellipse(0, -22, 92, 26, 0, 0, Math.PI * 2)
  g.fill()
  g.stroke()
}
const tenedor = (g: CanvasRenderingContext2D) => {
  g.strokeStyle = '#151015'
  g.lineWidth = 14
  g.lineCap = 'round'
  g.beginPath()
  g.moveTo(0, -30)
  g.lineTo(0, 150)
  g.stroke()
  g.strokeStyle = '#c9ccd2'
  g.lineWidth = 6
  g.stroke()
  g.fillStyle = '#e8b04a'
  g.strokeStyle = '#151015'
  g.lineWidth = 6
  g.beginPath()
  g.arc(0, 160, 26, 0, 7)
  g.fill()
  g.stroke()
}

/** Ángulos del brazo para que la mano llegue a un punto del mundo. */
function alcanza(a: Actor, t: number, lado: 'D' | 'T', x: number, y: number): Record<string, number> {
  const d: RigDef = a.def
  const s = a.n('escala', t) * d.k
  const mira = a.st('mira', t) === '-1' ? -1 : 1
  const hx = a.n('x', t) + mira * (lado === 'D' ? 1 : -1) * d.hombros.dx * s
  const hy = a.n('y', t) + (-(altoCadera(d) + a.n('cadera', t)) + d.hombros.y + 30) * s
  const r = ik(d.brazo.l1, d.brazo.l2, ((x - hx) / s) * mira, (y - hy) / s, -1)
  return lado === 'D' ? { bD1: r.a1, bD2: r.a2 } : { bT1: r.a1, bT2: r.a2 }
}

// ---- Reparto y guion de movimientos
const el = new Actor(CHICO, { x: 420, y: SUELO, escala: E })
const ella = new Actor(HERMANA, { x: 1300, y: SUELO + 6, escala: E * 0.97 })
ella.s('mira', -1, '-1')
let movilSofa: { desde: number; hasta: number } = { desde: -1, hasta: 4.12 }
const SOFA_MOVIL = { x: 610, y: 1262 }

function guion() {
  const asiento = 400
  // Él: sentado en el sofá, cenando (cuenco en una mano, tenedor en la otra)
  el.sienta(-1, 0.01, asiento)
  el.s('tDelante', -1, '1').obj('T', -1, cuenco).obj('D', -1, tenedor)
  el.a(-1, 0.01, { bT1: 38, bT2: 62, bD1: 30, bD2: 75 })
  // Come: del cuenco a la boca, varias veces
  for (const t of [0.15, 1.25, 2.35]) {
    el.a(t, 0.28, { bD1: 62, bD2: 118, cabezaRot: 5 }, 'back')
    el.a(t + 0.55, 0.3, { bD1: 30, bD2: 75, cabezaRot: 0 }, 'out')
  }
  // Ella entra andando y le suelta el sermón
  ella.camina(0.25, 1.35, 790)
  ella.s('mira', 1.36, '-1')
  ella.a(1.35, 0.25, { bT1: -42, bT2: 112, inclina: 4 }) // mano en la cadera
  ella.a(1.4, 0.22, { bD1: 78, bD2: 28 }).s('manoD', 1.4, 'indice') // le señala
  for (let t = 1.7, i = 0; t < 3.0; t += 0.26, i++) ella.a(t, 0.2, { bD2: i % 2 ? 24 : 52, cabezaRot: i % 2 ? -4 : 4 }, 'io')
  for (let t = 0.6, i = 0; t < 3.2; t += 0.14, i++) ella.s('cara', t, i % 2 ? 'habla' : 'reposo')
  ella.s('cara', 3.2, 'reposo')
  el.s('ojos', 1.45, 'recelo').a(1.45, 0.25, { inclina: -3 })
  el.s('ojos', 2.9, 'esceptico')
  // «así que me ha instalado Tinder»: se acerca, coge su móvil del sofá y teclea
  ella.s('manoD', 3.25, 'normal').a(3.25, 0.2, { bD1: 10, bD2: 10, bT1: -6, bT2: 8, inclina: 0 }, 'out')
  ella.camina(3.3, 3.75, 715)
  ella.s('mira', 3.76, '-1')
  ella.a(3.8, 0.3, { ...alcanza(ella, 3.8, 'D', SOFA_MOVIL.x, SOFA_MOVIL.y - 40), inclina: 16 }, 'out')
  ella.obj('D', 4.12, movil(false))
  ella.a(4.15, 0.3, { bD1: 52, bD2: 96, inclina: 2, bT1: 46, bT2: 98 }, 'back').s('tDelante', 4.15, '1')
  ella.s('cara', 4.2, 'movil')
  for (let t = 4.5, i = 0; t < 5.5; t += 0.11, i++) ella.a(t, 0.09, { bT2: i % 2 ? 92 : 104, bD2: i % 2 ? 100 : 92 }, 'lin')
  el.s('ojos', 4.15, 'platos').a(4.15, 0.2, { inclina: -7, cabezaRot: -5 }).a(4.15, 0.2, { bD1: 30, bD2: 75 }, 'out')
  // «en mi móvil»: se lo planta delante de la cara
  ella.obj('D', 5.55, movil(true)).s('cara', 5.55, 'risa')
  ella.a(5.55, 0.22, { ...alcanza(ella, 5.55, 'D', 560, 1010), inclina: 12, bT1: -42, bT2: 112 }, 'back').s('tDelante', 5.55, '0')
  ella.a(5.55, 0.15, { estira: 1.05 }).a(5.72, 0.2, { estira: 1 })
  el.a(5.6, 0.2, { inclina: -13, cabezaRot: -8, estira: 0.95 }).a(5.85, 0.3, { estira: 1 })
  // «mientras yo cenaba»: mira a cámara y sigue comiendo, resignado
  el.s('ojos', 6.05, 'esceptico').a(6.1, 0.3, { inclina: -4, cabezaRot: 0 }, 'out')
  el.a(6.45, 0.3, { bD1: 62, bD2: 118 }, 'back').a(7.0, 0.25, { bD1: 30, bD2: 75 }, 'out')
  for (let t = 5.8, i = 0; t < 7.2; t += 0.16, i++) ella.a(t, 0.14, { estira: i % 2 ? 1.03 : 0.98 }, 'io')
  // «Lo primero, las fotos»: se lo da; él lo mira
  ella.a(7.2, 0.25, { ...alcanza(ella, 7.2, 'D', 560, 1150), inclina: 10 }, 'out')
  ella.obj('D', 7.5, undefined)
  ella.a(7.55, 0.3, { bD1: 8, bD2: 10, inclina: 0, bT1: -42, bT2: 112, estira: 1 }, 'out').s('cara', 7.5, 'reposo')
  ella.a(7.6, 0.5, { x: 800 }, 'io')
  el.obj('D', 7.5, movil(false)).a(7.5, 0.25, { bD1: 58, bD2: 92, inclina: 0 }, 'back')
  el.s('ojos', 7.55, 'triste')
  // «seis huecos»: se le cae el alma a los pies
  el.s('ojos', 9.1, 'platos').a(9.1, 0.18, { cabezaRot: -6, estira: 1.04 }).a(9.3, 0.25, { estira: 1 })
  el.s('ojos', 10.1, 'triste').a(10.1, 0.35, { inclina: 7, cabezaDy: 24, cabezaRot: 8, bD1: 40, bD2: 60 }, 'out')
  ella.s('cara', 9.3, 'risa')
  for (let t = 9.3, i = 0; t < 10.9; t += 0.15, i++) ella.a(t, 0.13, { estira: i % 2 ? 1.035 : 0.98, cabezaRot: i % 2 ? 3 : -3 }, 'io')
}

// ---- Cámara: planos por corte
const PLANOS: { t: number; x: number; y: number; z: number; z2?: number }[] = [
  { t: 0, x: 580, y: 1090, z: 1.3, z2: 1.36 },
  { t: 3.3, x: 530, y: 1060, z: 1.62, z2: 1.68 },
  { t: 7.3, x: 470, y: 1030, z: 2.3, z2: 2.4 },
  { t: 9.05, x: 610, y: 1060, z: 1.75 },
  { t: 10.1, x: 450, y: 1010, z: 2.6, z2: 2.7 },
]

let rms: number[] = []
const plate = imagen('/rig/salon.jpg')

function frame(t: number) {
  const k = [...PLANOS].reverse().find((p) => t >= p.t)!
  const sig = PLANOS[PLANOS.indexOf(k) + 1]?.t ?? 11
  const z = k.z + ((k.z2 ?? k.z) - k.z) * ((t - k.t) / (sig - k.t))
  g.setTransform(1, 0, 0, 1, 0, 0)
  g.fillStyle = '#000'
  g.fillRect(0, 0, W, H)
  g.translate(W / 2, H / 2)
  g.scale(z, z)
  g.translate(-k.x, -k.y)
  g.imageSmoothingQuality = 'high'
  g.drawImage(plate, 0, 0, W, H)
  // Boca de él con la voz
  const v = rms[Math.round(t * 30)] ?? 0
  const pe = el.pose(t)
  pe.boca = v > 0.5 ? 'abierta' : v > 0.2 ? 'o' : 'nada'
  pe.cabezaDy -= v * 10
  if ((t + 0.7) % 3.1 < 0.11) pe.ojos = 'cerrados'
  // Sombras
  for (const a of [el, ella]) {
    const s = a.n('escala', t) * a.def.k
    g.fillStyle = 'rgba(0,0,0,0.16)'
    g.beginPath()
    g.ellipse(a.n('x', t), a.n('y', t) + 6, 330 * s * 0.5, 60 * s * 0.5, 0, 0, 7)
    g.fill()
  }
  // El móvil en el sofá hasta que ella lo coge
  if (t < movilSofa.hasta) {
    g.save()
    g.translate(SOFA_MOVIL.x, SOFA_MOVIL.y)
    g.scale(E * 0.62, E * 0.62)
    g.rotate(Math.PI / 2 + 0.2)
    g.translate(0, -110)
    movil(false)(g)
    g.restore()
  }
  dibujarRig(g, CHICO, pe)
  dibujarRig(g, HERMANA, ella.pose(t))
  // «6» a mano
  if (t > 9.1 && t < 10.1) {
    g.setTransform(1, 0, 0, 1, 0, 0)
    g.font = '900 230px "Comic Sans MS", cursive'
    g.fillStyle = '#EE1B24'
    g.fillText('6', 800, 420)
  }
}

async function main() {
  await Promise.all([cargar(CHICO), cargar(HERMANA), plate.decode()])
  rms = await (await fetch('/rig/voz_rms.json')).json()
  guion()
  const w = window as unknown as { listo: boolean; fotograma: (t: number) => string }
  w.fotograma = (t: number) => {
    frame(t)
    return c.toDataURL('image/jpeg', 0.9)
  }
  frame(0)
  w.listo = true
}
void main()
