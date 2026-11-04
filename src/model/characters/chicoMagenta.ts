// Personaje de Alejandro (cabeza magenta, aro en la nariz, camiseta gris con montaña), en el estilo
// simple de «Estoy Tiesa»: trazo a mano y colores planos. Personaje EXPRESIVO hecho con la misma receta
// (herramientas/preparar_expresivo.py): familia tranquila t_* de tres cuartos con boca (~b) y
// parpadeo (~c), y posturas de gag de frente (susto, enfado, llorar, celebrar, cruzado, ¡para!).

import type { Character } from '../types'
import { personajeExpresivo } from './chicoRosaExpresivo'
import manifest from './chicoMagenta.manifest.json'

export function chicoMagentaCharacter(): Character {
  return personajeExpresivo({
    id: 'chico-rosa',
    name: 'Chico rosa',
    ruta: '/personajes/chico-magenta',
    manifest,
    referencia: '/personajes/chico-magenta/referencia.jpg',
    abiertas: ['enfado', 'celebrar'],
    ojosPorDefecto: { t_triste: 'triste', t_barbilla: 'arriba', t_rendido: 'triste', t_cruzado: 'recelo', t_nolose: 'duda', t_porfavor: 'triste' },
    sinCapas: ['t_duda', 't_frente'],
    // Repertorio de caras exageradas (t_e_*): conservan sus ojos; al hablar se pone la boca de capa
    sinOjos: ['t_e_corazones', 't_e_susto', 't_e_llora', 't_e_carcajada', 't_e_agotado', 't_e_furioso', 't_e_verguenza', 't_e_asco', 't_e_dinero', 't_e_explota', 't_e_nervioso', 't_e_dormido', 't_e_chulo', 't_e_suplica', 't_e_mareado', 't_e_ilusion'],
  })
}
