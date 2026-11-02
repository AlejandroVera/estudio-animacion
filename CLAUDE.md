# Estudio de Animación

Herramienta web personal de Alejandro para animar personajes de dibujo animado por piezas
(estilo *cut-out*: piezas + articulaciones + controladores) y exportar vídeo, sin After Effects.
Toda la interfaz y los textos van en **español**. El usuario no es programador: explica los cambios
en lenguaje llano y pídele que pruebe en la web publicada.

## Flujo de trabajo
- Cada push a `main` se publica solo en Vercel. Antes de subir: `npm run build` sin errores y
  probar en Chromium (Playwright) lo que se haya tocado.
- Sin dependencias nuevas salvo que hagan falta de verdad; versiones exactas en `package.json`.
- Las claves de IA (fases 2-4) van como variables de entorno en Vercel y solo se usan desde
  funciones del servidor (`api/`), nunca en el código del navegador ni en el repositorio.

## Arquitectura
- Vite + React + TypeScript, estado con zustand (`src/store.ts`, con deshacer/rehacer y
  guardado automático en localStorage).
- `src/model/types.ts`: modelo de datos. Personaje = piezas (`Part`) con imagen(es), `anchor`
  (articulación dentro de la imagen), `offset` (articulación respecto a la del padre), `z`.
  Piezas de cara con `role`: `pupil` (se mueve con la mirada), `lids`, `mouth`, `brows`
  (cambian de dibujo/variante).
- Animación = pistas de claves por canal (`part:<id>:rot|x|y|scale`, `face:gazeX|gazeY|blink|mouth|brows`),
  transiciones `suave | lineal | salto`. `src/model/anim.ts` evalúa la pose en un instante.
- `src/model/render.ts`: matrices, dibujo en canvas, detección de clic por transparencia.
  El mismo dibujo sirve para el editor y para exportar.
- `src/export/exportMp4.ts`: exporta H.264 con WebCodecs + mp4-muxer (Chrome/Edge).
- `src/model/sample.ts`: personaje de ejemplo en SVG; es la referencia del formato que deben
  producir los personajes generados con IA.

## Personajes
- `src/model/library.ts` lista los personajes disponibles (selector «Personaje» del panel izquierdo).
  Usar los mismos ids de pieza entre personajes (`cabeza`, `torso`, `brazo_der`…) para que la
  animación se pueda pasar de uno a otro.
- «Chico rosa» (`src/model/characters/rosa.ts`) viene de una ilustración de Alejandro despiezada
  con `herramientas/despiece_rosa.py` (rembg `isnet-anime` para quitar el fondo, cortes por
  polígonos, cara borrada con inpaint y redibujada en SVG, remates redondos con contorno en codos
  y rodillas). Piezas PNG en `public/personajes/rosa/`, cajas y articulaciones en
  `rosa.manifest.json`. Es la referencia para automatizar el despiece en la fase 4.

## Hoja de ruta
1. ✅ Editor: piezas, articulaciones, cara, línea de tiempo, exportar MP4.
2. Copiloto: órdenes en español → claves de animación (Claude API).
3. Voz (ElevenLabs) + bocas sincronizadas.
4. Asistente «Crear personaje»: diseño, vistas, despiece, bocas/ojos con IA (fal.ai).
5. Escenas: fondos, cámara, varios personajes, subtítulos, plantillas.

Ideas pendientes anotadas: cinemática inversa (arrastrar la mano mueve todo el brazo),
proteger la web con contraseña antes de añadir claves, guardar en IndexedDB cuando haya
imágenes grandes.
