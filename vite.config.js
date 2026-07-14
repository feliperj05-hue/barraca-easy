import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// base: raiz "/" — host de producao aprovado e o Firebase Hosting, que serve na
// raiz do dominio (casa com os caminhos absolutos de index.html: /manifest.json,
// /icon-192.png, /src/main.jsx).
// O fallback manual do GitHub Pages roda num subpath e sobrescreve isto via
// --base (ver .github/workflows/pages.yml: build --base /barraca-easy/).
export default defineConfig({
  base: '/',
  plugins: [react()],
})
