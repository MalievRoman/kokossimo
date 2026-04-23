import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

const parseUrl = (value, fallback) => {
  try {
    return new URL(value)
  } catch {
    return new URL(fallback)
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '..', '')
  const apiUrl = env.VITE_API_URL || 'http://127.0.0.1:8000/api'
  const backendUrl = env.VITE_BACKEND_URL || new URL(apiUrl).origin
  const frontendUrl = parseUrl(env.FRONTEND_URL || 'http://localhost:5173', 'http://localhost:5173')
  const frontendPort = Number(frontendUrl.port || (frontendUrl.protocol === 'https:' ? '443' : '80'))

  return {
    envDir: '..',
    plugins: [react()],
    base: mode === 'production' ? '/static/' : '/',
    server: {
      host: frontendUrl.hostname,
      port: frontendPort,
      strictPort: true,
      proxy: {
        '/api': {
          target: backendUrl,
          changeOrigin: true,
        },
        '/admin': {
          target: backendUrl,
          changeOrigin: true,
        },
        '/static': {
          target: backendUrl,
          changeOrigin: true,
        },
        '/media': {
          target: backendUrl,
          changeOrigin: true,
        },
      },
    },
    build: {
      rollupOptions: {
        output: {
          entryFileNames: 'js/main.[hash].js',
          chunkFileNames: 'js/[name].[hash].chunk.js',
          assetFileNames: 'js/[name].[hash][extname]',
        },
      },
    },
  }
})
