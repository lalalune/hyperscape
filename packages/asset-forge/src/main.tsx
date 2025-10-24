import { createRoot } from 'react-dom/client'

// @ts-ignore - CSS import handled by Vite
import './styles/index.css'
import App from './App'
import { PrivyAuthProvider } from './auth/PrivyAuthProvider'

createRoot(document.getElementById('root')!).render(
  <PrivyAuthProvider>
    <App />
  </PrivyAuthProvider>
)
