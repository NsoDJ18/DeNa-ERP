import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// Configuración de build + PWA para DENA ERP.
// La app queda instalable en celular y PC (ícono propio, pantalla completa,
// funciona con datos en caché aunque se pierda momentáneamente la conexión).
export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/icon-192.png', 'icons/icon-512.png'],
      manifest: {
        name: 'DENA ERP',
        short_name: 'DENA ERP',
        description: 'Sistema de gestión para imprentas y talleres — pedidos, stock y producción en un solo lugar.',
        theme_color: '#0F1B36',
        background_color: '#FFFFFF',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        // cachea la app para que abra rápido y no quede en blanco sin señal;
        // los datos en sí siempre vienen de Supabase (no se cachean acá).
        globPatterns: ['**/*.{js,css,html,svg,png,ico}']
      }
    })
  ],
  server: {
    port: 5173
  }
});
