import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// `vite build --mode pages` targets GitHub Pages, which serves the app from /ema-ops/.
export default defineConfig(({ mode }) => ({
  base: mode === 'pages' ? '/ema-ops/' : '/',
  plugins: [react(), tailwindcss()],
}))
