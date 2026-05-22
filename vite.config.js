import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/',
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('react-dom') || id.includes('react/') || id.includes('react\\')) return 'vendor'
          if (id.includes('react-router')) return 'router'
          if (id.includes('@supabase')) return 'supabase'
          if (id.includes('recharts')) return 'charts'
        },
      },
    },
  },
})
