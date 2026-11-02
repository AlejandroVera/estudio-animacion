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
- Deformación por malla (`Part.skin`, `drawSkinned` en `render.ts`): cerca de una articulación cada
  vértice gira una fracción del giro de la pieza (o de su hija), lo que dobla hombros, codos, caderas
  y rodillas sin adelgazar el dibujo; la imagen se dibuja en triángulos y solo cuando hay giro.
  Los rangos se calculan solos (`autoSkin` en `build.ts`) para las piezas de imagen del esqueleto
  estándar (`brazo_*`, `antebrazo_*`, `muslo_*`, `pierna_*`): cualquier personaje nuevo que use esos
  ids lo hereda sin configurar nada.
- `src/export/exportMp4.ts`: exporta H.264 con WebCodecs + mp4-muxer (Chrome/Edge).
- `src/model/sample.ts`: personaje de ejemplo en SVG; es la referencia del formato que deben
  producir los personajes generados con IA.

## Personajes
- `src/model/library.ts` lista los personajes disponibles (selector «Personaje» del panel izquierdo).
  Usar los mismos ids de pieza entre personajes (`cabeza`, `torso`, `brazo_der`…) para que la
  animación se pueda pasar de uno a otro.
- «Chico rosa» (`src/model/characters/chicoRosa.ts`): ilustración de Alejandro redibujada en pose
  animable (en «A», brazos y piernas separados) con Magnific (Nano Banana 2.1) y despiezada con
  `herramientas/despiece_chico_rosa.py`: rembg `isnet-anime` quita el fondo, cortes por polígonos
  (codos perpendiculares al brazo), cara borrada con inpaint y redibujada en SVG, remates redondos
  con contorno en codos y rodillas. Piezas PNG en `public/personajes/chico-rosa/`, cajas y
  articulaciones en `chicoRosa.manifest.json`. Es la referencia para automatizar el despiece (fase 4).
- `public/personajes/rosa/` son las piezas de la primera versión; solo se conservan para que los
  proyectos guardados antiguos sigan viéndose.

## Gestos y vida automática
- `src/model/gestures.ts`: biblioteca de gestos (saludar, encogerse, señalar, pensar, jarras,
  explicar, asentir, negar, celebrar, sorpresa) escritos para el lado derecho en direcciones de
  pantalla; `expandGesture` los traduce a giros de cualquier personaje con el esqueleto estándar
  (ángulos de reposo + espejo para el lado izquierdo). Desplazamientos en fracciones de la longitud
  del brazo. Al añadir o retocar un gesto, revisarlo fotograma a fotograma (modo `?pruebas`, que
  expone el estado en `window.estudio`).
- El copiloto (API y MCP) recibe `gestos_disponibles` y responde `gestos: [{nombre, t, lado,
  velocidad}]`; `applyCopilot` los expande y sustituye lo que hubiera en esos canales.
- `src/model/life.ts`: respiración, balanceo y parpadeos sumados al dibujar (no son claves).
  Se desactiva con «Vida automática» (`project.vida === false`).

## Manos y hombros
- Manos como pieza propia (`mano_izq`, `mano_der`, hijas del antebrazo) con varios dibujos
  (`natural`, `abierta`, `palma_arriba`, `puno`, `indice`, `dorso`, `pulgar`), elegidos con el canal
  `part:<id>:v`. `herramientas/manos.py` las prepara para cualquier personaje: busca la muñeca (punto
  más estrecho del antebrazo), separa la mano original y coloca las de una hoja de seis manos
  derechas generada con IA (Magnific, referencia = ilustración del personaje), escaladas y giradas
  al eje del antebrazo y espejadas para el otro lado.
- Hombros: el canal `part:brazo_*:y` sube el brazo entero y el torso acompaña con `skin.lift`
  (automático en `autoSkin`). Panel «Hombros» y canal `hombros` en los gestos.

## Hoja de ruta
1. ✅ Editor: piezas, articulaciones, cara, línea de tiempo, exportar MP4.
2. ✅ Copiloto, por dos vías que comparten la guía de animación y el formato (`api/_guia.ts`):
   - **API** (`api/copiloto.ts`): orden escrita o dictada en la web → Claude (por defecto
     `claude-haiku-5-5`, cambiable con `COPILOTO_MODELO`) con salida JSON estructurada.
   - **MCP** (`api/mcp.ts`, sin coste de API): conector para la app de Claude con las herramientas
     `ver_estudio`, `animar` y `deshacer`. La web, con «Conectar con Claude» activado
     (`src/copilot/link.ts`), publica su estado y recoge cada 4 s las órdenes de la cola en Upstash
     Redis (`api/_almacen.ts`, `api/estado.ts`).
   `src/copilot/context.ts` describe el personaje (ángulo de reposo de cada pieza) y valida/aplica
   las respuestas en un solo paso de deshacer. Variables en Vercel: `ANTHROPIC_API_KEY`,
   `CLAVE_ESTUDIO` (contraseña de la web y del conector), `KV_REST_API_URL`/`KV_REST_API_TOKEN`
   (las crea la integración de Upstash) y opcional `COPILOTO_MODELO`.
3. ✅ Voz: se sube un audio (panel «Voz», guardado en IndexedDB por `src/audio/storage.ts`), suena al
   reproducir, se ve su onda en la línea de tiempo, «Mover la boca con la voz» crea las claves de
   boca por energía y brillo del sonido (`src/audio/lipsync.ts`) y el MP4 sale con audio (AAC u Opus).
   Pendiente: generar la voz con ElevenLabs desde la herramienta (necesita su clave).
4. Asistente «Crear personaje»: diseño, vistas, despiece, bocas/ojos con IA (fal.ai).
5. Escenas: fondos, cámara, varios personajes, subtítulos, plantillas.

Ideas pendientes anotadas: cinemática inversa (arrastrar la mano mueve todo el brazo),
guardar en IndexedDB cuando haya
imágenes grandes.
