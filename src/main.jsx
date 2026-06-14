import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { scheduleAnalytics } from './analytics.js'
import App from './App.jsx'
import './styles.css'

if (import.meta.env.DEV) {
  import('react-grab')
}

if (document.readyState === 'complete') {
  scheduleAnalytics()
} else {
  window.addEventListener('load', scheduleAnalytics, { once: true })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
