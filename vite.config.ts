import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'node:path'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
      },
      manifest: {
        name: 'CaseNavigator — Investigation Intelligence',
        short_name: 'CaseNavigator',
        description:
          'Graph-driven case management for investigators: entity graphs, evidence, mail, reports and recommendations.',
        theme_color: '#060B18',
        background_color: '#060B18',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        categories: ['productivity', 'business'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  // Honour PORT so a harness or container can place the dev server; 5173 stays
  // the default for a plain `npm run dev`.
  server: { port: Number(process.env.PORT) || 5173 },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          flow: ['@xyflow/react'],
          vendor: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
})
