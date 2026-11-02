import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'
import { useStore } from './store'

// Modo de pruebas (?pruebas): expone el estado para revisar animaciones de forma automática.
if (new URLSearchParams(location.search).has('pruebas')) Object.assign(window, { estudio: useStore })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
