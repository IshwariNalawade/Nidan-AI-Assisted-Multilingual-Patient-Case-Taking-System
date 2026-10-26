import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'
import './portal.css'
const defaultRoute = (import.meta.env as Record<string, string | undefined>).VITE_DEFAULT_ROUTE
if (defaultRoute && !window.location.hash) { try { window.location.hash = defaultRoute } catch { /* ignore */ } }
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)
