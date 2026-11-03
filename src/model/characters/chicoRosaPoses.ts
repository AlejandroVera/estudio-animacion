// Chico rosa «por poses»: en lugar de piezas que giran, el cuerpo es un dibujo completo por cada
// postura (todas generadas con IA editando el mismo dibujo base, así encajan al píxel) y la cabeza
// es común a todas, con ojos, párpados, cejas y boca animables encima. Al cambiar de pose el dibujo
// se funde en ~0,15 s y el cuerpo hace un pequeño rebote.
// Preparado con herramientas/preparar_poses.py. Coordenadas = píxeles del dibujo base (1536×2752).

import { buildParts, type PartDef } from '../build'
import type { Character } from '../types'
import manifest from './chicoRosaPoses.manifest.json'

const INK = '#1C181A'
const SKIN = '#E98AA4'
const WHITE = '#EBD1BD'
const MOUTH = '#4E1F2A'
const TONGUE = '#D86A82'
const TEETH = '#F3EDE4'
const S = (w = 5.5) => `stroke="${INK}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`
const line = (d: string, w = 5.5) => `<path d="${d}" fill="none" ${S(w)}/>`
const RUTA = '/personajes/chico-rosa/poses'

/** Nombre que se ve en la herramienta para cada pose. */
export const NOMBRES_POSES: Record<string, string> = {
  reposo: 'Reposo',
  hablar_a: 'Hablar 1',
  hablar_b: 'Hablar 2',
  hablar_c: 'Hablar 3',
  explicar: 'Explicar',
  manos_juntas: 'Manos juntas',
  senalar_der: 'Señalar →',
  senalar_izq: 'Señalar ←',
  senalar_abajo: 'Señalar abajo',
  encogerse: 'Encogerse',
  jarras: 'En jarras',
  cruzado: 'Brazos cruzados',
  saludar_a: 'Saludar 1',
  saludar_b: 'Saludar 2',
  pulgar: 'Pulgar arriba',
  celebrar: 'Celebrar',
  sorpresa: 'Sorpresa',
}

const EYES = [
  { cx: 666, cy: 482 },
  { cx: 872, cy: 477 },
]
const R_OJO = 28

const lipHighlights = `<ellipse cx="797" cy="622" rx="6" ry="4" fill="#F7D2DC" opacity=".75"/><ellipse cx="811" cy="619" rx="3.5" ry="3" fill="#F7D2DC" opacity=".75"/>`

const MOUTHS: Record<string, string> = {
  cerrada:
    line('M720 607 Q737 599 752 597 Q764 596 771 600 Q780 595 792 595 Q812 598 829 606', 5) +
    line('M703 614 Q738 611 770 615 Q802 609 846 611') +
    line('M737 632 Q775 650 814 629', 5) +
    line('M752 656 Q779 648 799 655', 4.5) +
    lipHighlights,
  sonrisa: line('M704 603 Q772 638 847 601') + line('M745 644 Q776 654 806 642', 5) + line('M754 662 Q779 655 798 661', 4.5),
  abierta:
    `<path d="M712 607 Q775 598 838 607 Q832 652 775 656 Q718 652 712 607 Z" fill="${MOUTH}" ${S()}/>` +
    `<ellipse cx="775" cy="641" rx="25" ry="8" fill="${TONGUE}"/>` +
    line('M722 602 Q750 593 771 596 Q792 593 828 602', 4.5) +
    line('M744 666 Q775 677 806 666', 4.5),
  E:
    `<path d="M708 607 Q775 600 842 607 Q834 633 775 635 Q716 633 708 607 Z" fill="${MOUTH}" ${S()}/>` +
    `<path d="M718 609 L832 609 L828 617 L722 617 Z" fill="${TEETH}"/>` +
    line('M742 650 Q775 660 808 648', 5) +
    line('M754 668 Q779 661 798 667', 4.5),
  O:
    `<ellipse cx="775" cy="625" rx="19" ry="23" fill="${MOUTH}" ${S()}/>` +
    line('M754 659 Q775 666 796 659', 4.5) +
    line('M757 675 Q779 669 795 674', 4),
  MBP:
    line('M712 613 Q775 619 838 613', 7.5) +
    line('M724 606 Q752 600 771 603 Q790 600 826 606', 4.5) +
    line('M745 628 Q775 640 805 628', 4.5) +
    line('M752 653 Q779 646 799 652', 4.5) +
    lipHighlights,
  triste: line('M708 624 Q775 602 842 624') + line('M752 642 Q776 636 800 642', 4.5) + line('M754 658 Q779 651 798 657', 4.5),
  grito:
    `<path d="M704 603 Q775 594 846 603 Q842 662 775 668 Q708 662 704 603 Z" fill="${MOUTH}" ${S()}/>` +
    `<path d="M716 606 L834 606 L830 614 L720 614 Z" fill="${TEETH}"/>` +
    `<ellipse cx="775" cy="650" rx="30" ry="10" fill="${TONGUE}"/>`,
}

export function chicoRosaPosesCharacter(): Character {
  const [lx, ly, lw, lh] = manifest.lienzo
  const [hx, hy, hw, hh] = manifest.cabeza.caja
  const poses = manifest.poses.filter((p) => p !== 'cabeza')
  const defs: PartDef[] = [
    {
      id: 'cuerpo',
      name: 'Cuerpo (pose)',
      parent: null,
      z: 10,
      box: { x: lx, y: ly, w: lw, h: lh },
      pivot: { x: manifest.pies[0], y: manifest.pies[1] },
      image: true,
      fade: 0.1,
      defaultVariant: 'reposo',
      variants: Object.fromEntries(poses.map((p) => [p, `${RUTA}/${p}.webp`])),
    },
    {
      id: 'cabeza',
      name: 'Cabeza',
      parent: 'cuerpo',
      z: 40,
      box: { x: hx, y: hy, w: hw, h: hh },
      pivot: { x: manifest.cabeza.cuello[0], y: manifest.cabeza.cuello[1] },
      image: true,
      variants: { normal: `${RUTA}/cabeza.webp` },
    },
    {
      id: 'ojos',
      name: 'Ojos',
      parent: 'cabeza',
      z: 42,
      box: { x: 620, y: 432, w: 300, h: 100 },
      pivot: { x: 769, y: 480 },
      variants: { normal: EYES.map((e) => `<circle cx="${e.cx}" cy="${e.cy}" r="${R_OJO}" fill="${WHITE}" ${S()}/>`).join('') },
    },
    ...EYES.map((e, i) => ({
      id: i === 0 ? 'pupila_izq' : 'pupila_der',
      name: i === 0 ? 'Pupila izq.' : 'Pupila der.',
      parent: 'ojos',
      z: 43,
      role: 'pupil' as const,
      gazeRange: { x: 11, y: 9 },
      box: { x: e.cx - 12, y: e.cy - 12, w: 24, h: 24 },
      pivot: { x: e.cx + 2, y: e.cy },
      variants: { normal: `<circle cx="${e.cx + 2}" cy="${e.cy}" r="8.8" fill="${INK}"/>` },
    })),
    {
      id: 'parpados',
      name: 'Párpados',
      parent: 'ojos',
      z: 44,
      role: 'lids',
      box: { x: 625, y: 440, w: 290, h: 90 },
      pivot: { x: 769, y: 480 },
      defaultVariant: 'abierto',
      variants: {
        abierto: '<g/>',
        medio: EYES.map((e) => `<path d="M${e.cx - 31} ${e.cy} A31 31 0 0 1 ${e.cx + 31} ${e.cy} Z" fill="${SKIN}" ${S()}/>`).join(''),
        cerrado: EYES.map(
          (e) => `<circle cx="${e.cx}" cy="${e.cy}" r="34" fill="${SKIN}"/>` + line(`M${e.cx - 24} ${e.cy + 3} Q${e.cx} ${e.cy + 15} ${e.cx + 24} ${e.cy + 3}`),
        ).join(''),
      },
    },
    {
      id: 'cejas',
      name: 'Cejas',
      parent: 'cabeza',
      z: 45,
      role: 'brows',
      box: { x: 620, y: 395, w: 300, h: 75 },
      pivot: { x: 769, y: 440 },
      defaultVariant: 'neutral',
      variants: {
        neutral: line('M634 449 Q669 427 703 441', 6.5) + line('M847 437 Q874 428 900 441', 6.5),
        enfadado: line('M634 438 Q672 440 704 456', 6.5) + line('M846 455 Q876 438 901 433', 6.5),
        triste: line('M634 452 Q668 446 703 429', 6.5) + line('M846 428 Q875 443 901 452', 6.5),
        sorprendido: line('M634 436 Q669 409 703 425', 6.5) + line('M847 422 Q874 408 900 424', 6.5),
      },
    },
    {
      id: 'boca',
      name: 'Boca',
      parent: 'cabeza',
      z: 46,
      role: 'mouth',
      box: { x: 690, y: 585, w: 170, h: 100 },
      pivot: { x: 775, y: 612 },
      defaultVariant: 'cerrada',
      variants: MOUTHS,
    },
  ]
  return {
    id: 'chico-rosa',
    name: 'Chico rosa',
    referencia: `${RUTA}/referencia.jpg`,
    ...buildParts(defs),
    expressions: {
      Neutral: { brows: 'neutral', mouth: 'cerrada' },
      Contento: { brows: 'neutral', mouth: 'sonrisa' },
      Triste: { brows: 'triste', mouth: 'triste' },
      Enfadado: { brows: 'enfadado', mouth: 'MBP' },
      Sorprendido: { brows: 'sorprendido', mouth: 'O' },
      Gritando: { brows: 'enfadado', mouth: 'grito' },
    },
  }
}

/** ¿Es un personaje por poses? (su pieza raíz tiene varios dibujos) */
export function poseRoot(character: Character) {
  return character.parts.find((p) => !p.parent && Object.keys(p.variants).length > 1)
}
