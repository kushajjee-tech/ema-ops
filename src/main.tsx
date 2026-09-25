import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'sonner'
import { App } from './App'
import { ConfirmProvider } from './lib/actions'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ConfirmProvider>
        <App />
      </ConfirmProvider>
      <Toaster position="bottom-right" richColors closeButton />
    </BrowserRouter>
  </StrictMode>,
)
