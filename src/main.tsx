import { cargarExtras, dibujarPostura, revisarDibujo } from './script/posturas'
import { activeCharacter } from './store'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'
import { useStore } from './store'

// Modo de pruebas (?pruebas): expone el estado para revisar animaciones de forma automática.
if (new URLSearchParams(location.search).has('pruebas')) Object.assign(window, { estudio: useStore, estudioPosturas: { dibujarPostura, cargarExtras, revisarDibujo, activeCharacter } })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Letra de los rótulos
void document.fonts?.load('700 80px Kalam').catch(() => undefined)
