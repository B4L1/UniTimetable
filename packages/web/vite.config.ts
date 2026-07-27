import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const reactDir = path.dirname(require.resolve('react/package.json'))
const reactDomDir = path.dirname(require.resolve('react-dom/package.json'))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
