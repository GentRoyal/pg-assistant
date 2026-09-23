import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react(), tailwindcss()],

    server: {
      host: true,
      port: 5173,

      proxy: {
        '/api': {
          target: env.API_TARGET || 'http://localhost:8000',
          changeOrigin: true,
          secure: true,

          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },
  }
})