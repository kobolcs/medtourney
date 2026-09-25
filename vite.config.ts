import { defineConfig } from 'vite';
import compression from 'vite-plugin-compression';

export default defineConfig({
  // Base public path when deployed.
  // Production/GitHub Pages is served under /medtourney/. For E2E (Playwright)
  // we build/serve at the server root so `page.goto('/')` works against a
  // production-equivalent bundle. Set E2E=1 to opt into the root base.
  base: process.env.E2E === '1' ? '/' : '/medtourney/',

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

    // ES2020 features compiled down to the oldest browsers still in use -
    // Safari 12 matters: older iPads / iPhones stop at iOS 12, and senior
    // players are the likeliest to still use one. (These are the versions
    // @vitejs/plugin-legacy used for its modern bundle; the plugin itself
    // - a SystemJS bundle for pre-2018 browsers and inline loader scripts
    // that needed CSP hashes - was dropped.)
    target: ['es2020', 'chrome64', 'edge79', 'firefox67', 'safari12'],

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
    // Don't try to launch a browser when Playwright drives the preview server.
    open: process.env.E2E !== '1',
  },

  // Plugins
  plugins: [
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
