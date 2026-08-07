import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const reactDir = path.dirname(require.resolve('react/package.json'))
const reactDomDir = path.dirname(require.resolve('react-dom/package.json'))

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'UniTimetable',
        short_name: 'UniTimetable',
        description: 'Sapientia EMTE órarend – heti nézet és órarendtervező',
        lang: 'hu',
        // Matches index.html's dark-mode default theme-color / background paint.
        theme_color: '#08090a',
        background_color: '#08090a',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache the app shell (JS/CSS/HTML/fonts) only. Supabase API
        // calls are deliberately NOT cached here — the app already has its
        // own localStorage-based offline fallback for schedule data
        // (stores/webStorage.ts), and layering a second, differently-timed
        // cache on top of that would risk showing two different kinds of
        // "stale" with no shared invalidation between them.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      },
    }),
  ],
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: [
      { find: /^react$/, replacement: path.join(reactDir, 'index.js') },
      { find: /^react\/jsx-runtime$/, replacement: path.join(reactDir, 'jsx-runtime.js') },
      { find: /^react\/jsx-dev-runtime$/, replacement: path.join(reactDir, 'jsx-dev-runtime.js') },
      { find: /^react-dom\/client$/, replacement: path.join(reactDomDir, 'client.js') },
      { find: /^react-dom$/, replacement: path.join(reactDomDir, 'index.js') },
      { find: '@shared', replacement: path.resolve(__dirname, '../shared') },
      { find: /^@\//, replacement: `${path.resolve(__dirname, './src')}/` },
    ],
  },
  server: {
    allowedHosts: ['.ngrok-free.app', '.ngrok-free.dev', '.ngrok.io', 'localhost'],
  },
})
