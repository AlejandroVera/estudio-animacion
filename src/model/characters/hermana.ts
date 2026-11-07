// La hermana del chico rosa: personaje SECUNDARIO (persona normal, mismo trazo cutre). Dibujos hechos
// con fal editando siempre el mismo dibujo base y preparados con herramientas/preparar_secundario.py
// (sin fondo, alineados por la cabeza, lienzo común). No habla: actúa (posturas) y camina.

import type { Character } from '../types'
import { personajeExpresivo } from './chicoRosaExpresivo'
import manifest from './hermana.manifest.json'

export function hermanaCharacter(): Character {
  return personajeExpresivo({
    id: 'hermana',
    name: 'Hermana',
    ruta: '/personajes/hermana',
    manifest,
    abiertas: [],
    sinCapas: manifest.poses,
  })
}
