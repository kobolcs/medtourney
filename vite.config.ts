import { defineConfig } from 'vite';
import legacy from '@vitejs/plugin-legacy';
import compression from 'vite-plugin-compression';

export default defineConfig({
  // Base public path when deployed
  base: '/medtourney/',

  // Build configuration
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    emptyOutDir: true,

    // Rollup options for optimization
    rollupOptions: {
      output: {
        // Manual chunks for better caching
        manualChunks: {
          // Separate vendor code if we add dependencies
          // vendor: ['dependency-name'],
        },
        // Asset naming
        assetFileNames: 'assets/[name]-[hash][extname]',
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
      },
    },

    // Minification
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // Remove console.logs in production
        drop_debugger: true,
      },
    },

    // Source maps for debugging (disable in production)
    sourcemap: false,

    // CSS code splitting
    cssCodeSplit: true,

    // Target modern browsers
    target: 'es2020',

    // Chunk size warnings
    chunkSizeWarningLimit: 500,
  },

  // Dev server configuration
  server: {
    port: 3000,
    open: true,
    cors: true,
  },

  // Preview server (for testing production build)
  preview: {
    port: 4173,
    open: true,
  },

  // Plugins
  plugins: [
    // Legacy browser support (optional - adds polyfills)
    legacy({
      targets: ['defaults', 'not IE 11'],
    }),

    // Gzip compression
    compression({
      algorithm: 'gzip',
      ext: '.gz',
    }),

    // Brotli compression (better than gzip)
    compression({
      algorithm: 'brotliCompress',
      ext: '.br',
    }),
  ],

  // Dependency optimization
  optimizeDeps: {
    include: [],
  },

  // TypeScript configuration
  esbuild: {
    target: 'es2020',
  },
});
