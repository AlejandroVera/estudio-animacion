# Estudio de Animación

Herramienta para animar personajes de dibujo animado por piezas y sacar vídeos, sin After Effects.

## Copiloto IA

Arriba a la derecha. Escribe (o dicta con 🎤) lo que quieres que haga el personaje —«que salude
con la mano derecha y sonría», «que diga hola y parpadee»— y pulsa **Animar ✨**. La primera vez
pide la contraseña del estudio. Lo que hace se añade a la animación y **Ctrl+Z** lo deshace entero.

## Cómo se usa a mano

**Seleccionar una pieza:** púlsala en el dibujo, en la lista de la izquierda o en el desplegable «Pieza».

**Animar:** la animación se hace con *claves* (los rombos amarillos de abajo).
1. Lleva la línea roja al momento que quieras (pulsa o arrastra en la regla de segundos).
2. Pon al personaje en la postura deseada: arrastra una pieza para girarla, Mayús + arrastrar
   para moverla, o usa los deslizadores de la derecha. Se crea una clave en ese instante.
3. Repite en otro momento. Entre clave y clave la herramienta rellena el movimiento.

**Cara:** mirada (arrastra el punto del recuadro), párpados y «Parpadeo aquí», expresiones,
bocas y cejas. Cada cambio también deja una clave.

**Claves:** pulsa un rombo para ir a ese momento y elegir la transición
(*suave*, *lineal* o *salto*) o borrarla. Arrástralo para cambiarlo de momento.

**Articulaciones:** en ese modo ves los puntos de giro de todas las piezas y puedes
arrastrarlos para recolocarlos.

**Exportar MP4:** genera el vídeo 1080×1920 en el propio navegador (usa Chrome o Edge).

**Guardar:** el proyecto se guarda solo en este navegador. «Guardar copia» descarga un archivo
que puedes volver a cargar con «Abrir…».

### Atajos
| Tecla | Acción |
|---|---|
| Espacio | Reproducir / pausar |
| ← / → | Fotograma anterior / siguiente (con Mayús, de 10 en 10) |
| Ctrl+Z / Ctrl+Mayús+Z | Deshacer / rehacer |
| Supr | Borrar la clave seleccionada |
| Alt al girar | Girar de 15 en 15° |
| Esc | Quitar selección |

## Desarrollo
```
npm install
npm run dev
```
