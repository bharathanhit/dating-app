import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Force cache invalidation timestamp: 123456
// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  publicDir: 'public', // Explicitly set public directory
  resolve: {
    alias: {
      react: 'c:/Users/abhar/Desktop/BICHAT/node_modules/react',
      'react-dom': 'c:/Users/abhar/Desktop/BICHAT/node_modules/react-dom',
    },
  },
  server: {
    hmr: {
      host: 'localhost',
    },
  },
  build: {
    // manualChunks removed to prevent duplication issues
    chunkSizeWarningLimit: 1000,
  },
})
