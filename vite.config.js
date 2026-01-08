import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Force cache invalidation timestamp: 123456
// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  publicDir: 'public', // Explicitly set public directory
  server: {
    hmr: {
      host: 'localhost',
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'], // Separate vendor libraries
        },
      },
    },
    chunkSizeWarningLimit: 1000, // Set limit to 1000 kB
  },
})
