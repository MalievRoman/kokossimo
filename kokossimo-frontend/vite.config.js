import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '..', '')
  const backendUrl = env.VITE_BACKEND_URL || 'http://127.0.0.1:8000'

  return {
    envDir: '..',
    plugins: [react()],
    base: mode === 'production' ? '/static/' : '/',
    server: {
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
