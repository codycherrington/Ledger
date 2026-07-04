import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  // Relative asset paths so the built app works from file:// inside Electron.
  base: './',
  plugins: [react(), tailwindcss()],
})
