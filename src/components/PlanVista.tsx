// «Ver el plan»: lo que el director va a hacer en cada viñeta, explicado en texto, ANTES de dibujar nada
// (y de gastar en fal). Si no convence, se cambian las indicaciones y se pide otra vez.

import { DESCRIPCIONES } from '../model/characters/chicoRosaExpresivo'
import type { Project } from '../model/types'
import { unificarLugares, type PlanDirector } from '../script/voices'
import { fondoDeIndicaciones } from '../script/scenes'

const TAMANOS: Record<string, string> = { general: 'cuerpo entero', medio: 'de cintura arriba', primer: 'primer plano', lejos: 'pequeño, lejos' }
const SITIO: Record<string, string> = { pensamiento: '💭 imagina', mano: '✋ sujeta en la mano', delante: '⬇️ delante de él' }

type Pos = { escena: number; palabra: number }
const antes = (a: Pos, b: Pos) => a.escena < b.escena || (a.escena === b.escena && a.palabra < b.palabra)

export function PlanVista({ plan, palabras, project, escenas = [] }: { plan: PlanDirector; palabras: string[][]; project: Project; escenas?: { indicaciones?: string }[] }) {
  const palabra = (p: Pos) => palabras[p.escena]?.[p.palabra] ?? '…'
  const nuevas = new Map((plan.nuevas ?? []).map((n) => ['x_' + n.nombre, n]))
  const extras = new Map((project.posturasExtra ?? []).map((e) => [e.nombre, e.descripcion]))
  const describe = (p: string) => {
    const n = nuevas.get(p)
    if (n) return `✏️ gesto nuevo: ${n.que_expresa}`
    if (extras.has(p)) return `gesto a medida: ${extras.get(p)}`
    return (DESCRIPCIONES[p] ?? p).replace(/^EXAGERADO\s*/, '¡exagerado! ')
  }
  // Tiempo aproximado de cada palabra (unas 2,6 por segundo), para unificar lugares como al generar
  const previas = palabras.map((_, i) => palabras.slice(0, i).reduce((n, p) => n + p.length, 0))
  const total = palabras.reduce((n, p) => n + p.length, 0) / 2.6
  const vins = unificarLugares(
    [...(plan.vinetas ?? [])].sort((a, b) => (antes(a, b) ? -1 : 1)).map((v) => ({ ...v, t: ((previas[v.escena] ?? 0) + v.palabra) / 2.6 })),
    total,
    (v) => !!fondoDeIndicaciones(escenas[v.escena]?.indicaciones),
  )
  const enVineta = (p: Pos, i: number) => !antes(p, vins[i]) && (i + 1 >= vins.length || antes(p, vins[i + 1]))

  // Lo que se pagaría en fal (lo que ya existe con el mismo nombre se reutiliza)
  const ratio = project.width / project.height
  const lugares = [...new Set(vins.filter((v) => !v.inserto).map((v) => v.fondo.trim()).filter((f) => f && !/^blanco/i.test(f)))]
  const lugaresNuevos = lugares.filter((f) => !(project.fondos ?? []).some((l) => l.descripcion === f && Math.abs(l.w / l.h - ratio) < 0.15))
  const gestosNuevos = (plan.nuevas ?? []).filter((n) => !(project.posturasExtra ?? []).some((e) => e.nombre === 't_x_' + n.nombre.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20)))
  const dibujos = [...new Set((plan.objetos ?? []).map((o) => o.dibujo))].filter((d) => !(project.objetos ?? []).some((o) => o.dibujo === d))
  const insertos = [...new Set(vins.map((v) => v.inserto?.trim()).filter(Boolean))].filter((d) => !(project.fondos ?? []).some((l) => l.descripcion === 'inserto: ' + d))
  const coste = lugaresNuevos.length + gestosNuevos.length * 2 + dibujos.length + insertos.length

  return (
    <div className="plan-vista">
      {plan.historia && (
        <p className="plan-historia">
          <b>La historia:</b> {plan.historia}
        </p>
      )}
      <ol className="plan-lista">
        {vins.map((v, i) => (
          <li key={i}>
            <div>
              <b>«{palabra(v)}»</b> ·{' '}
              {v.inserto ? (
                <>🖼 viñeta dibujada: {v.inserto}</>
              ) : (
                <>
                  {v.fondo === 'blanco' ? 'fondo blanco' : v.fondo} · {TAMANOS[v.tamano] ?? v.tamano}
                </>
              )}
              {v.idea && <> — {v.idea}</>}
            </div>
            {v.motivo && <div className="muted small">Por qué: {v.motivo}</div>}
            <ul>
              {plan.cambios
                .filter((c) => enVineta(c, i))
                .map((c, k) => (
                  <li key={'c' + k}>
                    🧍 en «{palabra(c)}»: {describe(c.postura)}
                    {c.motivo && <span className="muted"> ({c.motivo})</span>}
                  </li>
                ))}
              {(plan.objetos ?? [])
                .filter((o) => enVineta(o, i))
                .map((o, k) => (
                  <li key={'o' + k}>
                    {SITIO[o.pos] ?? '💭 imagina'}: {o.que} en «{palabra(o)}»{o.motivo && <span className="muted"> ({o.motivo})</span>}
                  </li>
                ))}
              {(plan.secundarios ?? [])
                .filter((x) => enVineta(x, i))
                .map((x, k) => (
                  <li key={'s' + k}>
                    👥 {x.quien} en «{palabra(x)}»: {x.postura === 'fuera' ? 'se va' : x.postura}
                    {x.movimiento !== 'ninguno' ? ` (${x.movimiento === 'entra' ? 'entra caminando' : 'sale caminando'})` : ''}
                    {x.motivo && <span className="muted"> ({x.motivo})</span>}
                  </li>
                ))}
              {(plan.rotulos ?? [])
                .filter((r) => enVineta(r, i))
                .map((r, k) => (
                  <li key={'r' + k}>
                    ✍️ escribe «{r.texto}» en {r.color} en «{palabra(r)}»{r.motivo && <span className="muted"> ({r.motivo})</span>}
                  </li>
                ))}
            </ul>
          </li>
        ))}
      </ol>
      <p className="small">
        <b>Para generarlo se dibujarían en fal {coste} imágenes</b> ({lugaresNuevos.length} lugares nuevos, {insertos.length} viñetas dibujadas, {gestosNuevos.length} gestos nuevos ×2 y {dibujos.length} dibujos). Si
        te convence, pulsa «🎙 Generar voces y animar» y se usará este mismo plan. Si no, cambia las indicaciones y vuelve a pedirlo (no gasta en fal).
      </p>
    </div>
  )
}
