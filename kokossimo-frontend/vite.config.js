import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: mode === 'production' ? '/static/' : '/',
  build: {
    rollupOptions: {
      output: {
        entryFileNames: 'js/main.[hash].js',
        chunkFileNames: 'js/[name].[hash].chunk.js',
        assetFileNames: 'js/[name].[hash][extname]',
      },
    },
  },
}))
