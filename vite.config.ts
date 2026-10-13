import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png'],
      manifest: {
        name: 'Misterio en WhatsApp',
        short_name: 'Misterio WA',
        description:
          'Resuelve un crimen hablando por WhatsApp con NPCs impulsados por IA local.',
        lang: 'es',
        theme_color: '#020617',
        background_color: '#020617',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: '/icons/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/icons/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: '/icons/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,jpg,jpeg,webp,woff2}'],
        // El motor de IA (~6 MB) se queda fuera del precache: así la primera
        // visita descarga solo el app shell. Al ser un import dinámico se pide
        // on-demand y queda cacheado por HTTP (lleva hash y se sirve immutable
        // durante un año). Se excluye por nombre porque con el límite de tamaño
        // por defecto (2 MiB) vite-plugin-pwa no avisa: directamente falla el
        // build. El chunk se llama 'webllm' por el manualChunks de abajo.
        globIgnores: ['**/webllm-*.js'],
        navigateFallback: '/index.html'
      }
    })
  ],
  build: {
    target: 'esnext',
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('@mlc-ai/web-llm')) return 'webllm';
          return undefined;
        }
      }
    }
  }
});
