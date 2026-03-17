import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/firebase')) return 'firebase';
          if (id.includes('node_modules/react') || id.includes('node_modules/scheduler')) return 'react-vendor';
          if (id.includes('node_modules/workbox-window') || id.includes('virtual:pwa-register')) return 'pwa';
          if (
            id.includes('/src/components/InsightsPanel.tsx')
            || id.includes('/src/hooks/useMenuInsights.ts')
            || id.includes('/src/lib/insights.ts')
          ) {
            return 'insights';
          }
          return undefined;
        },
      },
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      manifest: {
        name: 'Maresia Grill',
        short_name: 'Maresia Grill',
        description: 'Aplicativo do Maresia Grill',
        theme_color: '#15160f',
        background_color: '#15160f',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,ico}'],
        globIgnores: ['splash/*.png', 'brand/*.svg'],
      },
    }),
  ],
});
