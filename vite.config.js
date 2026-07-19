import { defineConfig } from 'vite'
import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// base: raiz "/" — host oficial e o Firebase Hosting, que serve na raiz do
// dominio (casa com os caminhos absolutos de index.html: /manifest.json,
// /icon-192.png, /src/main.jsx).
//
// MULTI-PAGINA (#107). O site comercial NAO e rota do React: cada pagina
// publica e um .html de verdade, gerado no build.
//
// Por que nao rota do app: pagina de vendas precisa ser achada no Google, e
// SPA chega no navegador vazia, com o conteudo aparecendo depois por
// JavaScript. Alem disso a home carregaria os ~530 kB do app inteiro para
// mostrar um titulo e um botao — no 4G do dono de barraca, que e exatamente
// quem vai abrir esse link. Sendo HTML estatico, o buscador le tudo de
// primeira e a home nao baixa uma linha do app.
//
// Isso tambem E a separacao de carregamento entre site e app: nao ha chunk
// compartilhado porque nao ha React nenhum nas paginas publicas.
//
// O `index.html` da raiz continua sendo o APP, de proposito. Trocar a raiz
// para a home comercial mexe no start_url do PWA e faria o tablet ja
// instalado abrir na pagina de vendas — decisao pendente do dono do produto
// (#107, item 3), por isso o site vive sob /site/ por enquanto.
export default defineConfig({
  base: '/',
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        app: resolve(__dirname, 'index.html'),
        site: resolve(__dirname, 'site/index.html'),
        planos: resolve(__dirname, 'site/planos.html'),
        sobre: resolve(__dirname, 'site/sobre.html'),
        contato: resolve(__dirname, 'site/contato.html'),
        privacidade: resolve(__dirname, 'site/privacidade.html'),
        termos: resolve(__dirname, 'site/termos.html'),
      },
    },
  },
})
