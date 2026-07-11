import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// base: subpath do GitHub Pages (https://feliperj05-hue.github.io/barraca-easy/).
// Pode ser sobrescrito no build via --base (ex.: Firebase Hosting usa /).
export default defineConfig({
  base: '/barraca-easy/',
  plugins: [react()],
})
