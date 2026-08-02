import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],

  build: {
    // Disable sourcemaps in production (saves ~30% bundle size)
    sourcemap: false,
    // Use esbuild minification (fastest)
    minify: 'esbuild',
    // Chunk size warning threshold
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        // Manual chunk splitting — keeps vendor libs separate from app code
        // Browser caches vendor chunks between deploys
        manualChunks: {
          // Core React runtime
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // Framer Motion — large lib, rarely changes
          'vendor-motion': ['framer-motion'],
          // Lucide icons
          'vendor-icons': ['lucide-react'],
          // Socket.io client
          'vendor-socket': ['socket.io-client'],
        },
      },
    },
  },

  // Speed up dev server by pre-bundling heavy dependencies
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'framer-motion',
      'lucide-react',
      'socket.io-client',
      'axios',
      'sweetalert2',
    ],
  },

  // Faster HMR in dev
  server: {
    hmr: {
      overlay: false, // Don't show full-screen error overlay (less rerenders)
    },
  },

  // Vitest unit testing configurations
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/setupTests.js',
  },
})
