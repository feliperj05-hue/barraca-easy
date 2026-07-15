import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// base: raiz "/" — host oficial e o Firebase Hosting, que serve na raiz do
// dominio (casa com os caminhos absolutos de index.html: /manifest.json,
// /icon-192.png, /src/main.jsx).
export default defineConfig({
  base: '/',
  plugins: [react()],
})
