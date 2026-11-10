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
- La contraseña del estudio está DESACTIVADA a petición de Alejandro (`PEDIR_CLAVE = false` en
  `api/_clave.ts`): la web no la pide y cualquiera con el enlace puede gastar los saldos. Para volver a
  activarla, poner `true`. El conector MCP sigue con `?clave=`.

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
- FORMATO del vídeo (selector «Formato» de la barra de arriba, junto a «Duración»: vertical 9:16, horizontal 16:9, cuadrado, 4:5): `setFormato` en `store.ts` cambia `width/height` y escala personaje (misma parte del alto) y cámara; `LIBRARY.place` está pensado para 1080×1920 y `colocar` lo adapta; los fondos se piden con `formatoDe` y solo se reutilizan si tienen la misma forma.
- `src/export/exportMp4.ts`: exporta H.264 con WebCodecs + mp4-muxer (Chrome/Edge).
- `src/model/sample.ts`: personaje de ejemplo en SVG; es la referencia del formato que deben
  producir los personajes generados con IA.

## Personajes
- `src/model/library.ts` lista los personajes disponibles (selector «Personaje» del panel izquierdo).
  Usar los mismos ids de pieza entre personajes (`cabeza`, `torso`, `brazo_der`…) para que la
  animación se pueda pasar de uno a otro.
- «Chico rosa» (id `chico-rosa`, `src/model/characters/chicoRosaPoses.ts`) es un personaje POR POSES
  (ver sección siguiente); es el que usa Alejandro. Los proyectos guardados con la versión por piezas
  se pasan solos a esta (`refreshCharacters` en `library.ts`: si cambia la pieza raíz, recoloca el
  personaje y quita las pistas de piezas que ya no existen).
- «Chico rosa (piezas)» (id `chico-rosa-piezas`, `src/model/characters/chicoRosa.ts`): la versión
  marioneta. Ilustración de Alejandro redibujada en pose
  animable (en «A», brazos y piernas separados) con Magnific (Nano Banana 2.1) y despiezada con
  `herramientas/despiece_chico_rosa.py`: rembg `isnet-anime` quita el fondo, cortes por polígonos
  (codos perpendiculares al brazo), cara borrada con inpaint y redibujada en SVG, remates redondos
  con contorno en codos y rodillas. Piezas PNG en `public/personajes/chico-rosa/`, cajas y
  articulaciones en `chicoRosa.manifest.json`. Es la referencia para automatizar el despiece (fase 4).
- `public/personajes/rosa/` son las piezas de la primera versión; solo se conservan para que los
  proyectos guardados antiguos sigan viéndose.

## Personaje EXPRESIVO (el método actual, estilo «Estoy Tiesa»)
Referencia de Alejandro: vídeos de YouTube del canal «Estoy Tiesa». Análisis: el personaje cambia de
POSTURA COMPLETA CON SU CARA (susto, enfado, ojos de corazón, lágrimas, guiño…) de golpe, sin fundidos,
cada 1,5-3,5 s en la palabra fuerte; entre medias el cuerpo está 100 % quieto y solo se mueve la boca
(2-3 formas). Nada de cabeza separada, balanceos, respiración ni deformaciones.
- «Chico rosa» (id `chico-rosa`) = `src/model/characters/chicoMagenta.ts`: el personaje NUEVO de
  Alejandro (cabeza magenta, aro en la nariz, camiseta gris con montaña), dibujo SIMPLE de trazo a mano
  y colores planos, como el de Estoy Tiesa (con el personaje detallado los cortes «saltaban» porque la
  IA variaba los detalles en cada dibujo). Imágenes en `public/personajes/chico-magenta/`.
- Todos los expresivos se construyen con `personajeExpresivo(...)` (en `chicoRosaExpresivo.ts`) a partir
  de su carpeta y su manifest. Receta para un personaje nuevo: subir su dibujo a Magnific; base de frente
  con boca cerrada y base tranquila (mano en el bolsillo); familia `t_*` editando la base tranquila
  (solo brazo libre y cara); gags editando la de frente; una edición de boca por postura y una de ojos
  cerrados de `t_reposo`; recortar (`recortar_poses.py`), medir (`herramientas/medir_cabeza.py`, toma
  el color de la cabeza solo) y `preparar_expresivo.py … <parpadeo.png> t_reposo t_`.
- «Chico rosa (detallado)» (`chicoRosaExpresivoCharacter`, id `chico-rosa-detallado`): el anterior, raíz
  `cuerpo` con posturas en `public/personajes/chico-rosa/expresivo/` y `<pose>~b` con la boca al revés.
  `Character.expresivo`: `abiertas` (posturas con la boca ya abierta), `cabeza` (para los planos),
  `gestos` (gesto de la biblioteca → postura) y `emociones` (expresión de escena → posturas).
- Se hacen con Magnific Nano Banana 2.1 editando el dibujo base («misma figura y sitio, cambia postura Y
  expresión: …»), 2 versiones y se elige; luego otra edición por postura solo de la boca.
  `herramientas/preparar_expresivo.py` recorta, alinea y de la versión «~b» toma SOLO la boca.
- Segundo análisis de la referencia (lo que la hace natural): ~45 % del tiempo tranquila, ~35 % gestos
  suaves, ~20 % exagerado y SOLO en chistes; de tres cuartos y asimétrica (peso en una pierna, mano en
  el bolsillo); posturas seguidas con el MISMO cuerpo cambiando solo un brazo y la cara; cortes SECOS
  (nada de fundidos ni pop: lo hacía robótico); parpadeo cada 3-5 s y al cambiar de postura.
- Por eso hay dos familias: tranquila `t_*` (tres cuartos, misma postura base, solo cambia el brazo
  libre y la cara; con `~b` boca y `~c` ojos cerrados, el parpadeo copiado de una sola imagen) y la de
  gags de frente (susto, enfado, llorar…), que solo sale con `gag[expresión]` o una exclamación.
- `poseAt`: si la boca (canal `face:mouth`) está abierta y la postura no, usa `~b` (y al revés); justo
  después de cambiar de postura, `~c` (parpadeo). `drawCharacter` pone `~c` en los parpadeos de la vida.
- Boca del expresivo (`silabas` en `voices.ts`): se abre al empezar cada vocal y se cierra al acabarla
  (mínimo 2 fotogramas), no por letras. Cada cambio de postura se pega al inicio de la palabra más
  cercana (0,08 s antes). Comprobado: la boca va a 0 fotogramas de la voz (correlación boca/energía).
- Fotogramas reales de la referencia (Drive de Alejandro, 3 tramos de 60): el cuerpo y la cabeza no se
  mueven NADA; los brazos cambian de golpe (sin intermedio) y los OJOS cambian por su cuenta en otro
  momento; boca de 3-4 formas cada 2-3 fotogramas. Por eso: CAPAS DE CARA (`herramientas/capas_cara.py`,
  `manifest.capas`): en la familia t_* (misma cabeza al píxel) hay piezas `ojos` (esceptico, recelo,
  arriba, platos, felices, triste, duda, cerrados) y `boca` (abierta, o, dientes) recortadas con borde
  suave y pegadas encima; `nada` = lo de la postura. `poseAt` elige la boca por la vocal (`silabas`
  da abierta/O/E) y los ojos por el canal `face:brows`; el parpadeo usa `ojos: cerrados`. Las posturas
  de gag (de frente) siguen con su cara y `~b`.
- Repertorio (tras «poco repertorio, mira de lado, cuerpo y cara por caminos distintos»): 33 posturas
  tranquilas t_* (20 nuevas con los dos brazos: tu, yo, abiertos, dosmanos, juntas, frente, rendido,
  barriga, pulgar, jarras, porfavor, reloj, dinero, cruzado, nolose, masomenos, alla, espera…). Ojos
  `frente` (pupilas a cámara) por defecto; `ojosPorDefecto` da a cada postura su mirada coherente
  (triste→triste, barbilla→arriba…); `sinCapas` (mano delante de la cara) usa su propia cara y `~b`.
  Índice y contar con los dedos, solo cuando el texto lo pide (lo decía el usuario: no pegaba).
- GESTOS A MEDIDA: el director puede pedir hasta 3 por vídeo («nuevas»: nombre + dibujo en inglés). La
  web llama a `api/postura.ts` (fal Nano Banana edita `base_gestos.jpg`, el t_reposo con ojos al frente
  y fondo blanco), `src/script/posturas.ts` quita el fondo blanco unido a los bordes, recorta al lienzo,
  alinea por la cabeza con t_reposo, guarda en IndexedDB y lo apunta en `project.posturasExtra`
  (`t_x_<nombre>`, familia tranquila: lleva capas de boca y ojos). `cargarExtras` los añade al
  personaje al cargar. Probado en la web real (sartén y espátula). REVISIÓN (`revisar` en posturas.ts): compara el dibujo con la base, recoloca la cabeza (la IA la mueve hasta ~20 px y el borde de la capa de ojos asomaba) y si una mano tapa los ojos o la boca (cambio en su caja > 0,15 / 0,10) apunta `sinOjos`/`sinBoca` y esa capa no se pone (antes el ojo quedaba pegado DELANTE de la mano). Los gestos guardados sin `revisada` se arreglan solos al cargar.
- ESCENOGRAFÍA (como la referencia): el director también devuelve `fondos` (por escena: «blanco» o un
  lugar cotidiano; el mismo texto = mismo fondo) y `rotulos` (palabra, texto 1-3 palabras, color
  negro/rojo/verde/azul, pos arriba/izq/der/izq_baja/der_baja/abajo). `project.rotulos` se dibujan con
  `drawRotulos` (render.ts) en letra Kalam a mano con borde blanco, fuera de la cámara, con «pop» de
  0,15 s, hasta el final de su escena. La referencia de estilo de los fondos es `Character.referencia` (debe EXISTIR en `public/`: con el chico rosa faltaba y fal daba 422; ahora `referencia.jpg`); si fal falla con referencia, `api/imagen.ts` reintenta sin ella. Al acabar «Generar voces y animar» se generan los fondos solos
  (`generateSceneBackgrounds`; «blanco» se hace sin IA). Fondos fijos, sin zoom lento. Estilo de fondo «cutre» a petición de Alejandro (garabato de tableta, trazo irregular, colores apagados), descrito en el texto de `api/imagen.ts`, sin usar imágenes de la referencia.
- OBJETOS EN ESCENA (tras «en la escena no ocurre nada»): el director devuelve `objetos` (escena, palabra,
  que, dibujo en inglés, pos arriba_izq/arriba_der/izq/der/izq_baja/der_baja): el objeto del que habla,
  bocadillos de pensamiento, carteles con precio… `src/script/objetos.ts` (`ponerObjetos`) los dibuja con
  `api/imagen.ts` tipo «objeto» (garabato sobre blanco), quita el fondo (`quitarFondo`), recorta, guarda en
  IndexedDB y los apunta en `project.objetos` (mismo dibujo = se reutiliza). `drawObjetos` (render.ts) los
  pinta fuera de la cámara con «pop», como los rótulos; el editor (Stage) también pinta objetos y rótulos.
- MONTAJE POR VIÑETAS (tras «le falta ritmo, pone elementos porque sí»): el director devuelve `vinetas`
  (escena, palabra, idea, fondo, tamano) de 2-5 s: en cada corte cambian a la vez encuadre (cámara y
  escala) y, si toca, fondo; objetos y rótulos desaparecen al cortar (rótulos al menos 1,6 s). En
  `voiceScript` las indicaciones de la escena mandan (fondo y tamaño), «plano fijo» = todo general,
  «lejos» en blanco pasa a «medio». `fondosPorVinetas` (images.ts) dibuja un fondo por lugar distinto y
  pone las claves de opacidad por viñeta. «Fondo: la misma cocina» = sigue el lugar anterior.
- COMPOSICIÓN (tras «parece todo encorsetado»; fotogramas de la referencia: personaje grande a un lado y el
  otro lado se llena palabra a palabra, se borra al cortar): cada viñeta lleva `lado` (izq/centro/der) y
  se guarda en `project.vinetas`; el personaje se desplaza con `part:<raíz>:x`. `src/model/contenido.ts`
  (`drawContenido`) apila en el lado libre lo de esa viñeta (`vin`): rótulos con `estilo` grande (palabras
  enormes negras), nota (color subrayado) o cartel (cifra en cartelito), objetos, bocadillos de
  pensamiento (objeto con pos «pensamiento», nube dibujada) y flechas rojas a mano que se dibujan
  (`flecha`). Solo en horizontal; en vertical, los sitios fijos de siempre. Viñeta a un lado sin
  contenido = al centro. Con pocos elementos se agrandan (hasta ×1,7).
- LETRA A MANO (tras «el texto parece hecho por código»): `src/model/letra.ts` escribe como la referencia:
  fuente «Coming Soon» engrosada (trazo uniforme, puntas redondas), mayúsculas con la «i» minúscula
  (`aSuManera`), cada letra torcida y a su altura, colores puros, sin borde blanco (solo un halo suave) y
  escribiéndose letra a letra (`avanceEscritura`, ≈0,04 s/letra); subrayado que se dibuja después.
  La usan `contenido.ts` y `drawRotulos`. El LADO del personaje se mantiene mientras siga el mismo fondo
  (solo cambia con el lugar) y el director pone lugares en la mayoría de viñetas (blanco ≤ 1 de cada 4).
- INTERACCIÓN con lo que aparece: la mano libre de las posturas t_* señala a la IZQUIERDA de la pantalla, así
  que con el personaje a la izquierda (contenido a la derecha) se dibuja en ESPEJO (`drawPersonajeEscena`
  en render.ts, lo usan drawFrame y Stage) y siempre presenta/señala hacia el contenido. Objetos con pos
  «mano» se apoyan en la palma (`expresivo.palma` = t_presenta, x 116, y 832; `voiceScript` pone esa
  postura 1,5 s) y con pos «delante» van abajo tapándole las piernas. El bocadillo sale de la cabeza real
  (`PuntosPersonaje`). El director debe hacer al menos una interacción por viñeta con contenido, con mínimos (1 de cada 3 viñetas con algo en la mano, 1 «delante» por vídeo). Lo de la mano desaparece al dejar la postura de sujetar. Los fondos se piden con `hueco` (la mitad del contenido casi vacía, pocos objetos al otro lado).
- GESTOS A MEDIDA CON SU CARA (tras «a veces la cara se deforma»: los ojos de capa sobre la cara que dibujó la
  IA se mezclaban, p. ej. ojeras asomando o un ojo encima de los dedos): `dibujarPostura` pide además su
  versión ~b (api/imagen «libre» sobre la imagen de fal, que ahora se admite como referencia) y
  `combinarBoca` copia solo la zona de la boca; `imageIdB` en `posturasExtra`, y esos gestos van en
  `sinCapas` (su cara y su boca). Los gestos sin ~b conservan sus ojos (todos en `sinOjos`) y solo llevan
  la boca de capa. El director usa gestos a medida (hasta 5-8) para toda ACCIÓN con un objeto; los objetos
  sueltos solo para ideas (bocadillo, cifra, icono). Huecos borrados también en t_barriga, t_frente, t_pulgar.
- REPERTORIO DE CARAS EXAGERADAS `t_e_*` (16: corazones, susto, llora, carcajada, agotado, furioso,
  verguenza, asco, dinero, explota, nervioso, dormido, chulo, suplica, mareado, ilusion): `api/postura.ts`
  con `cara` (expresión exagerada, se permiten lágrimas, sudor, corazones…), procesadas en la web con
  `procesarDibujo` (posturas.ts) y guardadas como posturas fijas; `~b` = la misma con la boca al revés
  (api/imagen «libre» sobre el original de `public/personajes/chico-magenta/originales/`, y de esa solo
  se copia la zona de la boca). Van en `sinCapas` (su cara) y las de boca abierta en `abiertas`.
  `quitarHuecos` no toca la cabeza ni los pies y solo borra blanco que en reposo no era blanco.
- HUECOS: el blanco encerrado entre brazo y cuerpo/cabeza no toca el borde y quitarFondo no lo borraba
  (mancha blanca). `quitarHuecos` (posturas.ts) lo borra en los gestos a medida (zona que en t_reposo es
  fondo); en las posturas fijas se borró con un script (componentes blancas >300 px que en t_reposo son
  fondo). `REVISION` en posturas.ts: subirla hace que los gestos guardados se revisen otra vez al cargar.
- Postura con mano en la cara sin `~b` (t_frente): usa la boca de capa para no quedarse callado.
- TAMAÑO POR ESCENA: selector «Tamaño» de cada escena = `Escena.plano` (`lejos` pequeño: escala 0,7 de la
  raíz desde los pies; `general`; `medio` y `primer` con zoom de cámara). Las indicaciones mandan:
  `planoDeIndicaciones` («pequeño», «primer plano», «de cintura arriba»…) y `fondoDeIndicaciones`
  («Fondo: …», «fondo blanco») en scenes.ts, aplicadas en `voiceScript`. Si un fondo falla, los demás se
  generan igual.
- Mano delante de la cara en gestos a medida: `revisar` busca trazos oscuros unidos al contorno de la
  cabeza que entran en la caja de ojos/boca (>200 px); NO compara la cara (la IA la redibuja con otra
  expresión y eso dejaba al personaje sin boca). Alinea también el tamaño de la cabeza. El parpadeo no
  pega ojos cerrados en posturas `sinCapas`/`sinOjos`.
- EL USUARIO DIRIGE (petición expresa: «quiero yo dirigir a la IA»): cada escena tiene «🎬 Lo que quieres
  que haga» (`Escena.indicaciones`) y el guion «Indicaciones para todo el vídeo»
  (`guion.indicaciones`). `api/actuar.ts` las trata como ÓRDENES por encima de todo (gesto → a medida
  si no existe, fondo, rótulos, cara). Para corregir: cambiar la indicación y volver a «Generar voces y
  animar» (la voz está en caché y los fondos con la misma descripción se reutilizan: no se repaga).
- PROPONER INDICACIONES (tras perder Alejandro su guion anotado y pedir «yo pongo el guion y la IA anota cada
  escena como Estoy Tiesa»): botón «✨ Proponer indicaciones» del panel Guion → `api/indicaciones.ts`
  (Sonnet, guía de animador de Estoy Tiesa) rellena `Escena.indicaciones` (conserva y completa lo que ya
  hubiera) y las generales si están vacías; luego «Generar voces y animar» las cumple. El panel guarda un
  BORRADOR (texto, escenas, indicaciones) en localStorage `estudio-animacion:borrador-guion` a cada cambio
  (antes solo se guardaba al animar y se perdía al cerrar o recargar).
- CONTADO COMO HISTORIA (tras «abuso del texto, no parece una historia»): el director escribe primero
  `historia` (lo que VIVE el personaje momento a momento) y cada viñeta es un momento de ella (lugar +
  acción con gesto a medida); `api/indicaciones.ts` sigue la misma idea. Texto escaso: `dirigir` deja como
  mucho 1 rótulo por viñeta (3 si la escena pide rótulos) y uno cada 5 s; los objetos sueltos (que no van
  en la mano ni delante) pasan a bocadillo de pensamiento, uno por viñeta.
- «🧹 Dibujar todo de nuevo» (casilla junto a «Generar voces y animar»): antes de generar vacía
  `posturasExtra`, `objetos` y los fondos automáticos (con `descripcion`; los puestos a mano se quedan) para
  que todo se dibuje con la versión actual (si no, se reutilizaba lo de versiones viejas por el mismo
  nombre/descripción). La voz guardada sí se reutiliza. `conExtras` quita la ~b de un gesto anterior si el
  rehecho no tiene.
- CRITERIO DEL DIRECTOR (tras «necesita sentido, buen gusto, coherencia, no meter cosas por meterlas»): la GUIA
  de `api/actuar.ts` se reescribió entera (las instrucciones acumuladas se contradecían; había MÍNIMOS de
  objetos en la mano/delante que obligaban a meter cosas): 1) historia primero, 2) viñetas con continuidad
  (mismo lugar con el mismo texto mientras la historia siga allí, 2-4 lugares), 3) el personaje actúa la
  historia (gestos a medida solo para las acciones que más cuentan), 4) lo que aparece al lado: menos es
  más, todo con `motivo` (objetos, rótulos, viñetas y gestos lo llevan en el esquema), 5) miradas.
- «🔎 VER EL PLAN (sin dibujar)» (panel Guion, `PlanVista.tsx`): `verPlan` (voices.ts) pide el plan al director
  con las palabras del texto (las mismas que dará la voz, `palabrasDeTexto`), sin voz ni fal, y lo guarda en
  `project.planDirector` {clave, plan}; `dirigir` lo reutiliza si la clave (palabras de cada escena +
  indicaciones) coincide, así se genera EXACTAMENTE lo visto. Muestra la historia, cada viñeta con lugar,
  tamaño, posturas, objetos y rótulos con su porqué, y cuántas imágenes se dibujarían en fal.
- REVISIÓN DEL VÍDEO LARGO (1 min, vertical): 1) LUGARES: salían ~15 sitios distintos y el mismo sofá
  dibujado tres veces → `unificarLugares` (voices.ts, también en «Ver el plan»): un lugar que nombra lo
  mismo que uno anterior (sofá, cafetería…) usa su mismo texto (= mismo dibujo) y como mucho un lugar
  por cada ~10 s (se quedan los que más tiempo ocupan; los demás siguen en el de antes; los que pide el
  usuario no se tocan); la GUIA lo pide también y prohíbe repetir la misma idea (reloj del fondo +
  bocadillo de reloj + rótulo con la hora). 2) SOMBRA: las caras t_e_* y los gestos a medida tienen los
  pies más arriba que t_reposo (se alinean por la cabeza) y quedaban flotando sobre la sombra → en el
  expresivo la sombra va bajo la fila opaca más baja del dibujo actual (`pieReal` en render.ts).
  3) CABEZA CORTADA en plano en gestos a medida (la IA la dibujó pegada al borde de su imagen) →
  `completarCabeza` (posturas.ts) rellena lo que falta por encima del corte con la cabeza de reposo;
  REVISION 5 lo aplica a los gestos guardados. 4) Rótulos y objetos en VERTICAL ya no tapan la cabeza
  ni se salen del borde (`colocarSinTapar` en render.ts, con `PuntosPersonaje.circulo`). 5) `~b` rotas
  (restos de dientes) en t_e_dinero, t_e_carcajada y t_e_ilusion repintadas a mano; taza suelta borrada
  de t_e_agotado.
- VOZ PROPIA («🎤 Subir mi audio…» en el panel Guion, también sin escenas): el audio se guarda en IndexedDB
  (`VozPropia` {audioId, nombre}, en localStorage `estudio-animacion:voz-propia`); `lecturaPropia`
  (voices.ts) lo manda a 16 kHz mono en trozos de 100 s a `api/transcribir.ts` (ElevenLabs Scribe,
  scribe_v2 y si no scribe_v1; la clave necesita el permiso «Speech to Text») y lo convierte en la misma
  alineación por letras que la voz generada (se guarda `stt-<audioId>`: no se paga dos veces). Las
  escenas escritas se buscan en lo oído (`rangosEnVozPropia`, subsecuencia común; una escena cuenta si se
  reconoce ≥40 % de sus palabras, si no se quita); sin escenas, `escenasDeVoz` las saca de las frases.
  Sus pausas se respetan (solo se acortan las de más de 0,6 s). Probado con el audio de un vídeo real.
- SINCRONÍA IMAGEN-VOZ (tras «no va a tiempo»; la boca SÍ iba al fotograma, lo que fallaba eran los cortes
  a mitad de frase): cada corte de viñeta se lleva al comienzo de la frase o inciso (tras punto o coma)
  si está a 1-3 palabras; rótulos y objetos salen 0,12 s ANTES de su palabra exacta (antes los objetos se
  pasaban a la siguiente «con peso» y salían tarde). La GUIA lo pide también.
- TAMAÑO Y VARIEDAD (tras «le veo muy grande», «escenarios y encuadre muy similares»): `escalaPlano`
  (scenes.ts): lejos 0,55, general 0,8 (se ve el lugar alrededor), medio/primer 1 con zoom. En vertical,
  a cuerpo entero, cada lugar pone al personaje en un sitio (centro, +16 % a la derecha, −12 %). Cada
  lugar del vídeo se pide a fal con `variante` (api/imagen.ts): su paleta dominante (8) y su encuadre (4:
  pared de frente, esquina, exterior con cielo, desde abajo); sin variante, el estilo de antes.
- VIÑETAS DIBUJADAS / INSERTOS (tras «no es dinámico, solo van cambiando los fondos»; vídeo de Tinder: el
  narrador siempre de pie hablando, no se veía NADA de lo que contaba): cada viñeta del director lleva
  `inserto` (en inglés, "" si sale el narrador): un dibujo a pantalla completa de lo que cuenta (el móvil
  con la app, la galería con fotos del DNI, la hermana haciéndole la foto…; puede salir él, dibujado con
  `Character.referencia`, y otra gente). `fondosPorVinetas` lo dibuja con api/imagen tipo «inserto» y lo
  pone como capa `delante` (tapa al narrador) solo en esa viñeta (descripción «inserto: …», se reutiliza);
  los objetos de esa viñeta se quitan; los rótulos se ven encima. La GUIA pide ~1 de cada 3-4 viñetas,
  1,5-3 s, y que la cara/gesto digan lo mismo que la frase (nada de enfado sin enfado; t_cuenta solo para
  «tres»). «Proponer indicaciones» sugiere «Viñeta dibujada en "palabra": …» y el director la cumple.
  «Ver el plan» las muestra (🖼) y las cuenta en el coste. Probado con el director real: 5 insertos
  coherentes en el guion de Tinder (los ejemplos de la GUIA son de otros temas para que no los copie).
- EL PERSONAJE SE MUEVE (tras «tiene que ser como un capítulo de dibujos: se mueve, interactúa, cambia de
  posición»): dos dibujos de paso `t_andar_a/b` (fal «libre» sobre base_gestos.jpg, procesados con
  `procesarDibujo`, en `sinCapas`, sin DESCRIPCIONES: el director no los elige como postura). Cada viñeta
  lleva `movimiento` (ninguno/entra/se_mueve/sale/salta) y `hacia` (izq/centro/der); `moverPersonaje`
  (voices.ts, después de `gesticular`) desliza `part:<raíz>:x` en lineal, alterna los dos pasos cada
  0,16 s con bote en `part:<raíz>:y`, y al ir hacia la derecha pone el canal `pj:espejo` (los dibujos
  andan hacia la izquierda; `drawPersonajeEscena` lo combina con el espejo del lado). Entra por el borde
  más cercano a su destino; «sale» deja el cuadro vacío hasta la viñeta siguiente; «salta» = respingo de
  0,35 s. Se queda donde llegó en las viñetas siguientes del mismo lugar. Con movimiento, medio/primer pasa
  a general (tiene que verse entero). La GUIA pide moverse en 1 de cada 2-3 viñetas con motivo.
- REPARTO / PERSONAJES SECUNDARIOS (tras «solo pone imágenes estáticas; quiero un capítulo de dibujos» y
  elegir la opción de personajes animados en escena): solo el protagonista tiene cabeza magenta, los demás
  son PERSONAS NORMALES con el mismo trazo (petición expresa). `src/model/reparto.ts` (`REPARTO`): la
  hermana (`characters/hermana.ts`, `public/personajes/hermana/`, moño y sudadera mostaza): posturas
  reposo, habla, movil, foto, quita, cruzado, risa, senala, jarras, ilusion y t_andar_a/b, hechas con fal
  editando su dibujo base y preparadas con `herramientas/preparar_secundario.py` (sin fondo, alineadas por
  la cabeza, lienzo común; los pasos se estiraron de la cadera para abajo para que los pies caigan igual).
  En LIBRARY con `secundario: true` (no sale en el selector). El director recibe `reparto` y devuelve
  `secundarios` (quien, escena, palabra, postura o «fuera», lado izq/der, movimiento entra/sale/ninguno);
  `presencias` (voices.ts) saca los tramos en escena (hasta «fuera», «sale» o cambio de lugar) y
  `ponerReparto` crea una instancia por secundario: visible con el canal `pj:visible`, en su lado y mirando
  al narrador (espejo), entrando/saliendo con sus pasos, mismo tamaño relativo (`altura`); el narrador se
  aparta dos pasos al otro lado mirándola y vuelve en el siguiente corte. Con alguien en escena las viñetas
  son generales. `drawFrame` y Stage dibujan el reparto detrás del protagonista (`drawPersonajeEscena` con
  `principal=false`). Probado en el navegador: entra, le quita algo, él se asusta, ella se ríe y se va.
- ANIMACIÓN LIMITADA (opción A elegida por Alejandro tras «sigue sin ser una animación coherente, la hermana
  aparece estática»; descartó el vídeo generativo): `drawExpresivoVivo` (render.ts, para todo expresivo con
  vida) pinta la postura en dos pasadas: el cuerpo sin la cabeza y la cabeza (óvalo por encima del cuello,
  desde `expresivo.cabeza`/`radio`) girando alrededor del cuello, con las capas de cara encima moviéndose
  con ella. La cabeza se balancea siempre (~2°), da un bote al hablar (boca abierta en `face:mouth`) y un
  cabeceo amortiguado al cambiar de postura; el cuerpo respira (escala Y desde los pies ±0,7 %) y hace un
  squash del 3 % al cambiar. Comprobado: a ±5° el recorte queda limpio en los dos personajes. `camaraViva`
  (voices.ts): acercamiento del 3 % muy lento en viñetas de más de 2,5 s y empujón rápido del 10 % en una
  cara exagerada/gag. `actuarSecundario`: quita→movil (1 s), senala→cruzado, ilusion/risa→reposo/jarras, y
  «habla» alterna con «reposo» cada 1,1 s. Pendiente: boca de la hermana y dibujos intermedios.
- MODO ESCENAS (el método actual por defecto; tras «muy soso, todo en la misma escena, se siente forzado» y
  analizar con vidIQ un vídeo real de Estoy Tiesa, azJsKlO8aQ8: ~25 planos en 3 min, 9 lugares, CADA PLANO ES
  UN DIBUJO NUEVO DE LA SITUACIÓN CON ELLA DENTRO en una postura quieta, la gente secundaria dibujada en el
  plano, rótulos y cosas que aparecen en su palabra, cortes secos): selector «Cómo se monta» del panel Guion
  (`modoVideo`, localStorage `estudio-animacion:modo`, por defecto «escenas»; «muneco» = el método de antes).
  En escenas, el director recibe `modo: 'escenas'` (bloque MODO_ESCENAS en api/actuar.ts) y pone casi todas
  las viñetas como `inserto` con él dentro (postura, expresión, «small closed mouth», resto de gente normal),
  sin reparto ni gestos a medida (no gasta en ellos). `generateBackground` tipo «inserto» pasa la imagen por
  `analizarCara` (src/model/caraEscena.ts): busca la mancha magenta más grande (su cabeza: color único),
  localiza el aro, los ojos (blanco dentro de la cabeza) y borra la boca dibujada con el color de la cabeza;
  guarda la imagen limpia y `BgLayer.cara`. `drawLayers` pinta encima con `dibujarCara` la boca de la voz
  (canal `face:mouth` del narrador: cerrada/abierta/O/E) y un parpadeo cada ~3,6 s. En escenas los insertos
  no se cortan a 2,5 s, la cámara también se acerca despacio en ellos y solo se quitan los objetos en mano/
  delante. La prueba de boca sobre una escena real salió bien; con bocas muy abiertas el borrado falla, por
  eso api/imagen pide siempre boca cerrada pequeña y que nada más sea magenta.
- ESCENAS, REVISIÓN 1 (tras «el muñeco se corta, las caras no van con la locución, la hermana es un pegote, un
  dedo color carne»): `sinMarco` conserva la forma del vídeo y rellena lo blanco con el color del borde; si
  la escena salió en franja (`bandas`), `generateBackground` pide a fal ampliarla (edición «extend… fill the
  whole canvas») y la usa si ya no tiene franjas. Con la boca CERRADA se pinta la imagen original
  (`imageIdOrig`, su boca va con su expresión); la boca animada solo al hablar. Fotos suyas (photo/screen…
  of him) no hablan. La hermana sale igual en todas: `public/personajes/hermana/referencia.jpg` como segunda
  referencia (`referencias` en api/imagen) cuando la descripción dice «sister». Manos de él magenta, un solo
  chico magenta, sin gente de relleno. «cambio»/«palabra_cambio» del director: SEGUNDO DIBUJO DEL MISMO
  PLANO (edición de fal del primero, `urlFal`) que se ve desde esa palabra (animación dentro del plano; si
  falla, sigue el primero). Planos de 5 s como mucho. Rótulos evitan también la cara de la escena
  (`carasDeEscena`). `analizarCara` mide la cabeza por lo redondo de arriba (los brazos pegados al cuello la
  confundían).
- COSAS QUE SE MUEVEN EN LA ESCENA (tras «aparecen coches en el vídeo que te pasé»; medido en los fotogramas
  reales: el FONDO de Estoy Tiesa es 100 % estático, 0,1-0,4 % de píxeles cambian por fotograma; lo que vive
  es boca, ojos, brazos que cambian de golpe 1-2 veces por plano y lo que se escribe/dibuja/entra encima):
  `Objeto.mov` (cruza/entra/cae/tiembla/aparece), `hacia`, `tam`; el director los pide en «objetos» con
  «movimiento» (2-4 por vídeo de 30 s). `src/model/movimiento.ts` (`posicionObjeto`, `ladoObjeto`): cruza de
  borde a borde en ~1,4 s con bote, entra con frenada, cae en 0,35 s con rebote, tiembla. Lo usan
  `drawObjetos` (vertical) y `drawContenido` (horizontal, aparte de la columna). Los móviles no pasan a
  bocadillo. Probado en el navegador con los tres movimientos.
- ESCENAS, REVISIÓN 2 (opción A tras descartar Alejandro el prototipo articulado `src/rig/` por «articulaciones
  cutres, no es Estoy Tiesa»; el prototipo sigue en `rig.html` sin integrar): `src/script/planos.ts`: VARIANTES
  ESTABLES de un plano: se pide a fal el mismo dibujo con un cambio y se copia SOLO lo que cambia
  (`mascaraDeCambio` por bloques de 8 px + `componer`), así el resto queda idéntico al píxel. 1) BOCA DIBUJADA:
  `conBocaAbierta` → `BgLayer.imageIdOpen` (el mismo dibujo con su boca abierta; `drawLayers` lo muestra cuando
  la voz abre la boca; la boca pintada por código queda solo de respaldo y nunca si no se le ven los ojos).
  2) Hasta DOS cambios de pose por plano («cambio», «cambio2» con su palabra; encadenados con « ⟶ » en
  `Vineta.cambio`), `conCambio`; si su cabeza no cambia se reutiliza la boca abierta del anterior. 3) LA OTRA
  PERSONA HABLA: `otro_habla_desde/hasta` → `conBocaDelOtro` → `imageIdOtro` + `otroHabla` (tramos): su boca
  se abre y cierra a ~7 Hz. Los planos se dibujan de 3 en 3 a la vez. El esquema completo del director daba
  «compiled grammar is too large»: en escenas se usa `SCHEMA_ESCENAS` (sin secundarios, nuevas, fondos,
  miradas, motivos…). Él siempre de frente; si sale dos veces (`repetido`), se repite el dibujo una vez.
  Coste real: ~38 imágenes (≈1,5 €) por 32 s.
- ESCENAS, REVISIÓN 3 (tras «a veces habla la hermana, los gestos van desacompasados»): 1) SOLO HABLA EL NARRADOR:
  la boca de la otra persona ya no se mueve (se oía la voz de él y parecía que hablaba ella); `otro_habla_*`
  siempre -1 y `voiceScript` lo ignora. 2) La boca abierta dibujada por la IA cambiaba también los OJOS y al
  hablar la mirada parpadeaba en cada sílaba: `conBocaAbierta` solo copia por debajo de los ojos (`desdeY`).
  3) A TIEMPO: la GUIA exige que cada cosa se vea cuando se dice (nada adelantado), un «cambio» en la palabra
  que nombra el gesto («sonrío»), nadie se da la vuelta ni cambia de sitio en un cambio, y TODOS los planos
  con inserto (también el cierre; antes acababa con el muñeco sobre blanco). 4) Si el director no devuelve
  posturas del muñeco (todo son dibujos) el plan ya no se descarta (`dirigir` devolvía null y salía el muñeco
  solo sobre el fondo). 5) Objetos que no cruzan: como mucho 2 s. Pendiente: rótulos que tapan la cara cuando
  la cabeza ocupa medio cuadro, objetos sueltos poco afortunados (pedir menos).
- ESCENAS, REVISIÓN 4 (tras «el muñeco tiembla y se desdibuja, la hermana está muy quieta»; no importa generar
  más): 1) CÁMARA QUIETA en escenas (`camaraViva` no hace nada: el acercamiento lento remuestreaba el plano en
  cada fotograma y el trazo temblaba). 2) La boca abierta se copia solo por debajo del aro (`CaraEscena.bocaY`)
  y con corte limpio por arriba (el borde suave emborronaba ojos y aro). 3) En cada edición (`editar`) va el
  dibujo de referencia de él como segunda imagen y se exige «on model» (antes cada cambio de pose le deformaba
  la cara). 4) LA OTRA PERSONA GESTICULA: `conGestoDelOtro` (planos.ts) pide de cada dibujo con más gente el
  mismo dibujo «un instante después» (otro gesto de brazos y cara, sin girarse) → `imageIdOtro` (+
  `imageIdOtroOpen` con la boca de él) y `otroVive`; `drawLayers` los alterna a golpes de 0,45-1 s. Coste:
  ~47 imágenes por 32 s. Pendiente: algún plano sale mal encuadrado (él diminuto, franjas) y no se detecta.
- ESCENAS, REVISIÓN 5 (tras «hay más elementos pero no son coherentes con la locución»): el segundo dibujo «al
  azar» de la otra persona (revisión 4) se QUITÓ: hacía gestos que nadie contaba (signo de victoria, móvil con
  calavera, de espaldas). Ahora los gestos de los demás los decide el DIRECTOR: hasta TRES cambios por plano
  (`cambio`, `cambio2`, `cambio3`, en lugar de `otro_habla_*`), cada uno en la palabra que cuenta esa acción
  («me dice que así no» → ella niega con el dedo). En escenas NO hay `objetos` sueltos (todo va dibujado en
  el plano; `voiceScript` los ignora). Caras sencillas sin arrugas ni ojeras (api/imagen y `editar`), nada
  que no se diga. Un plano con franjas o con él diminuto se repite una vez. Coste: ~39 imágenes por 32 s.
  Pendiente: los «close-up» pedidos como cambio no cambian de encuadre (deberían ser plano nuevo); el
  último plano a veces no llena el cuadro.
- ESCENAS, REVISIÓN 6 (tras «sigue teniendo fallos»; revisado dibujo a dibujo): 1) MISMO LUGAR = MISMO DECORADO:
  el primer plano de cada lugar (`fondo` del director, nombre corto idéntico: «el sofá de casa») es el maestro
  y los demás planos de ese lugar se dibujan EDITÁNDOLO (`generateBackground(…, lugarDe)`; antes salían tres
  salones y dos pasillos distintos y la hermana cambiaba de tamaño). Los maestros se dibujan primero.
  2) REVISOR (`api/revisar.ts`, Sonnet con visión; `revisarDibujo` en planos.ts): mira cada dibujo y lo rechaza
  si la cara de él está tapada o cortada, alguien le tapa o queda detrás, hay dos protagonistas, franjas,
  texto o no es lo pedido; se repite con la corrección escrita (hasta 2 veces; los cambios, 1). Si el revisor
  falla, se da por bueno. 3) REENCUADRE: el revisor devuelve `caja` (dónde está la gente); si salen pequeños se
  usa solo ese trozo (`BgLayer.recorte`, `reencuadre`/`recortado` en images.ts; las variantes y cambios usan
  el mismo recorte). `BgLayer.gente` = esa caja: los rótulos no tapan a nadie (`carasDeEscena`). 4) Boca
  abierta: solo la mancha de cambio más cercana a la boca dibujada (`semilla` en `mascaraDeCambio`); antes le
  cambiaba los ojos. 5) Planos de DETALLE (descripción sin «boy»: pantalla del móvil, objeto): sin cara ni
  boca animada, no parten del maestro del lugar, y ni el dibujo ni sus cambios llevan la referencia de él
  (la IA lo añadía detrás o le ponía una cabecita). 6) GUIA: lado a lado con hueco, nada delante de su cara,
  móvil a la altura del pecho, nunca contar con los dedos. Coste: ~40-45 imágenes + ~20 revisiones por 32 s.
- ESCENAS, REVISIÓN 7 (tras «el primer plano es muy estático, al cambiar la cara pierde la forma, la expresión
  no cuadra, en "sonrío" no sonríe y va tarde, ya no aparecen elementos como en Estoy Tiesa»): 1) LA CABEZA
  CONSERVA SU CONTORNO en los cambios (`conCambio`: si la cabeza nueva está en el mismo sitio y tamaño, se
  quita de la máscara el anillo del contorno y del dibujo nuevo solo entra la cara de dentro). 2) Sin
  parpadeo pintado por código en escenas (parecían arrugas). 3) La boca abierta se pide «en el mismo ánimo»
  (sonrisa abierta si sonreía). 4) GUIA: ningún dibujo dura más de 7 palabras; el sujeto de cada verbo tiene
  su cambio en ESA palabra («Sonríe» = ella sonríe y se señala la boca; «Sonrío» = él); sorpresa = ojos muy
  abiertos; COSAS QUE APARECEN dibujadas en la escena en su palabra (la llama de Tinder saliendo del móvil,
  seis marcos vacíos, flash, lluvia de fotos, interrogación) en al menos uno de cada dos planos; mínimos de
  planos y dibujos según la duración. 5) SEGUNDA PASADA del director (`rellenarQuietos` en api/actuar.ts):
  detecta los dibujos de más de 8 palabras y pide un cambio intermedio (una reacción) para cada uno.
  La prueba se quedó a medias: fal bloqueó la cuenta por saldo («User is locked», 403) a mitad del vídeo.
- CALIDAD DE LOS DIBUJOS (tras «¿no puedes generar las imágenes que consuma menos?»): selector «Calidad de los
  dibujos» del panel Guion (solo en escenas; `calidad()` en planos.ts, localStorage `estudio-animacion:calidad`).
  «Completa» (por defecto): boca abierta dibujada por la IA para cada dibujo + revisor que repite los malos
  (≈50 imágenes por 30 s, medido 53). «Borrador»: sin boca de IA (la pinta el código, `dibujarCara`; al
  hablar se le borra el aro) y sin repetir lo que el revisor rechaza (el revisor sigue dando el reencuadre):
  medido 22 imágenes por 32 s. Para probar guion y ritmo barato y gastar el completo solo al final.
- DIRECTOR IA (`api/actuar.ts`, lo llama `dirigir` en `voices.ts` al generar voces): recibe las palabras
  de cada escena, la emoción y el catálogo `DESCRIPCIONES` (qué expresa cada postura) y devuelve en qué
  palabra cambia y a qué postura según lo que dice, y `miradas` (catálogo `MIRADAS`) en otras palabras; las claves caen 0,08 s antes de esa palabra. Si
  falla, quedan las reglas de abajo.
- PAUSAS DE LA VOZ (tras «la voz se entrecorta»: ElevenLabs deja 0,5-0,8 s de silencio total en cada punto):
  `acortarPausas` (voices.ts) deja cada pausa entre letras en ~0,3 s, con fundidos de 8 ms, y mueve los
  tiempos de la alineación (boca sincronizada). Se aplica cada vez sobre el audio guardado.
- Gestos a medida: `alinear` recibe el dibujo COMPLETO (no solo el lienzo), si no la cabeza dibujada un
  poco más arriba quedaba cortada en plano. Un bocadillo que repite el objeto del gesto activo se quita.
- Si fal.ai responde 401/403 («clave no válida o sin saldo»), no salen fondos, gestos ni objetos: es el
  saldo de fal de Alejandro (se recarga en fal.ai).
- VOZ SEGUIDA: las escenas duran exactamente su tramo de audio y las escenas seguidas con texto suenan
  como UN trozo continuo (antes se metían 0,2 s de silencio entre escenas y la voz iba a trompicones).
- `animateScenes` (respaldo sin IA): postura por trozo de frase (≥4 palabras, ≤8): «?» → encogerse/pensar, números →
  tres/índice, «coment/suscr» → señalar, «hola» → saludar, «!» → susto/para; si no, de la lista de la
  emoción de la escena. Los gestos del guion son una postura y ocupan solo 1,2 s.

## Personajes por poses (método anterior, «Chico rosa (poses, anterior)»)
La marioneta por piezas giradas quedaba robótica y Alejandro la descartó. Ahora el cuerpo entero es
UNA pieza raíz `cuerpo` con muchos dibujos completos (poses: reposo, hablar_a/b/c, explicar,
manos_juntas, encogerse, senalar_der/izq/abajo, jarras, cruzado, saludar_a/b, pulgar, celebrar,
sorpresa) que se cambian con el canal `part:cuerpo:v`; encima va una cabeza común (`cabeza`, gira y
asiente) con la cara en SVG (ojos, pupilas, párpados, cejas y bocas dibujadas como las del original).
NUNCA vídeo generativo: Alejandro lo rechaza; solo imágenes fijas hechas con IA.
- Las poses se hacen con Magnific (Nano Banana 2.1) EDITANDO la misma imagen base («misma cámara,
  mismo tamaño, solo cambian los brazos»), así encajan al píxel (cabeza y pies en el mismo sitio).
- `herramientas/preparar_poses.py`: limpia los recortes, borra la cabeza de cada pose (la pone la
  pieza `cabeza`), crea la cabeza común sin cara (inpaint) y escribe `chicoRosaPoses.manifest.json`
  (lienzo común, caja y cuello de la cabeza, pies). Imágenes WebP en `public/personajes/chico-rosa/poses/`.
  Para otro personaje: misma receta (es la base de la fase 4).
- CUERPO COMÚN: `preparar_poses.py` monta cada pose (e intermedio) sobre el cuerpo de reposo y solo
  toma de ella los brazos (piel rosa + contorno). Sin esto la camiseta y las zapatillas cambiaban en
  cada pose (dibujadas por separado por la IA) y el personaje «temblaba» al cambiar.
- SIN VIBRACIÓN: en modo poses el cuerpo no se escala, no se balancea ni rebota (en un dibujo se ve
  como temblor); la vida va en cabeza y cara.
- Gesticulación por la voz (`src/script/emocion.ts`, `gesticular`, lo llama `voiceScript` con el tiempo
  de cada palabra): cabeceo y cejas arriba en la palabra importante de cada frase, cejas arriba y
  cabeza ladeada en las preguntas, parpadeo en las pausas, cabeza baja y ladeada en escenas tristes.
  La expresión de la escena también elige el estilo de poses (triste recogido, contento abierto).
- Ritmo al hablar (`animateScenes`): postura de descanso (manos_juntas / hablar_b) 2,2-3,6 s y
  salidas cortas a un acento (hablar_a, explicar, hablar_c) 1,4-2,2 s, siempre entre poses con intermedio.
- Dibujos INTERMEDIOS (sin ellos los brazos «saltan» y Alejandro lo ve poco fluido): variantes
  `entre:A__B` de `cuerpo` (`public/personajes/chico-rosa/poses/entre/`, lista en el manifest), hechas
  con Nano Banana dando las dos poses («edita la primera, brazos a mitad de camino hacia la segunda»,
  2 versiones y se elige la mejor). Hay para cada pareja de poses de conversación y de reposo a cada
  gesto; si no hay directo se usa el de reposo↔pose (`intermedio` en `anim.ts`). `transicion`: 0,1 s
  antes de la clave se ve el intermedio y luego la pose nueva, con fundidos de `Part.fade` (0,07 s) y
  un rebote pequeño. No salen en los selectores (filtro `ENTRE`). La respiración escala desde los pies y
  el cuerpo se balancea muy poco (`withLife`), para que nunca quede congelado.
- Gestos: cada gesto tiene además `poses` (secuencia de poses en el tiempo); `expandGesture` usa
  `expandPoseGesture` cuando la raíz tiene varios dibujos (claves de pose + cabeza y cara).
- `animateScenes`: mientras habla rellena con poses de conversación (hablar_a/b/c, manos_juntas,
  explicar, reposo; 1,3-2,5 s cada una) e inclinaciones de cabeza; quita un reposo si la siguiente
  pose llega antes de 0,9 s (si no, parpadean los brazos). `voiceScript` cuadra los cambios de pose
  con el inicio de las palabras.
- Cámara de los planos (`shot` en `scenes.ts`): nunca sale del vídeo (si no, asoma el color de fondo).

## Postura y naturalidad
- `src/model/idle.ts` (`withIdle`): postura de reposo natural (brazos caídos) calculada del esqueleto;
  `Character.idle` se suma en `poseAt` y TODAS las pistas de giro son relativas a ella (los ángulos de
  reposo del copiloto y los gestos se miden en esta postura, no en la de montaje en «A»).
- Sombra de contacto bajo los pies (`drawShadow` en `render.ts`).
- Gesto «hablar» (manos y cabeza sutiles); `animateScenes` rellena con él los huecos mientras habla.

## Cómo se escriben gestos naturales (lecciones aprendidas)
- Las manos trabajan DELANTE del cuerpo (antebrazo hacia dentro, dir ~190-215 en el lado derecho),
  no hacia fuera en horizontal (parece un espantapájaros).
- Un antebrazo que apunta hacia la cámara se ACORTA (`escala` 0.4-0.6); `expandGesture` compensa la
  mano (escala inversa) para que no encoja. Las transiciones que pasan por delante se acortan a mitad.
- Primero se mueve la mano y luego el codo se abre (no subir el brazo estirado como una barrera).
- Giro continuo: cada clave `dir` elige la vuelta más cercana a la anterior del mismo canal; la malla
  se dibuja rígida si el pliegue supera 150°.
- Movimiento a golpes (llegar, sostener, otro golpe), cada mano a su ritmo; el segundo brazo va
  0,08 s detrás (`DESFASE`); acción superpuesta automática (`withFollowThrough` en `life.ts`); reposo
  asimétrico (`idle.ts`).

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

## Guion
- Panel «📝 Guion» (`src/components/ScriptPanel.tsx`): texto o idea → escenas (`Escena` en types:
  diálogo, acción, plano general/medio/primer, expresión, duración, gestos, fondo deseado).
  «Escenas con IA» llama a `api/guion.ts` (guía y esquema `GUIA_GUION`/`SCHEMA_GUION` en `_guia.ts`);
  «Dividir sin IA» parte por párrafos (`scenesFromText`). Por MCP: `proponer_guion` (lo deja en el
  panel para revisar, abre el panel solo), `guion` (lo monta y anima) y `ver_estudio` devuelve el guion
  montado en "guion" para corregirlo o continuarlo.
- `src/script/scenes.ts` → `animateScenes`: escenas consecutivas, corte de cámara por plano, cejas
  de la expresión, gestos de la biblioteca y boca que «habla» el texto (`textMouthKeys`, por vocales;
  la sustituirá la voz real). Marcas E1, E2… en la regla de la línea de tiempo.

- Estilos de guion (`ScriptStyles.tsx`, `api/estilos.ts`): varios estilos con nombre guardados en
  Upstash (`estudio:estilos`), uno activo. `api/guion.ts` lo añade al system prompt y `ver_estudio`
  del MCP lo devuelve al final, así lo siguen la IA de la web y Claude por igual.

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
   ✅ Voz con ElevenLabs (`api/voz.ts`, variable `ELEVENLABS_API_KEY`, gasta la suscripción del
   usuario): en el panel Guion se elige voz y modelo («Estable», Multilingual v2, por defecto: la v3
   sonaba rara; la elección se recuerda en el navegador) y «Generar voces y animar»
   (`src/script/voices.ts`) lee el guion ENTERO de una vez con `with-timestamps` (entonación
   continua, ajustes guardados de la voz), reparte el audio entre escenas por el tiempo de su primera
   letra, ajusta duraciones y crea la boca por letras (`visemas`: en cada fotograma gana pausa >
   vocal/labios > consonante). Audio y alineación se guardan en IndexedDB (no se paga dos veces).
4. Asistente «Crear personaje»: diseño, vistas, despiece, bocas/ojos con IA (fal.ai).
5. Escenas: ✅ capas de imagen (`project.fondos`, imagen en IndexedDB, detrás o delante del personaje,
   canales `bg:<id>:x|y|scale|rot|opacity`) y ✅ cámara (`cam:x|y|zoom`, `cameraMatrix` en
   `render.ts`, se deshace al convertir clics en `Stage`). Panel «Fondos y cámara» con atajos (acercar,
   desplazar, aparecer, primer plano, zoom lento). ✅ Fondos con IA (`api/imagen.ts`, fal.ai Nano
   Banana, variable `FAL_KEY`): «✨ Generar» en el panel Fondos y «Generar fondos de las escenas» en el
   Guion (`src/script/images.ts`: un fondo por tramo de escenas, visible solo en su tramo, con zoom
   lento). Usan `Character.referencia` (ilustración del personaje en esta web) como referencia de
   estilo. Pendiente: varios personajes, subtítulos, plantillas.

Ideas pendientes anotadas: cinemática inversa (arrastrar la mano mueve todo el brazo),
guardar en IndexedDB cuando haya
imágenes grandes.
