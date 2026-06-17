import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 3000,
    open: false,
  },
  // Keep the CRA-compatible output directory so existing deploy steps still work.
  build: {
    outDir: 'build',
  },
  // This project keeps JSX inside .js files (legacy CRA convention).
  // Treat src .js files as JSX during transform (dev + build)...
  esbuild: {
    loader: 'jsx',
    include: /src\/.*\.jsx?$/,
    exclude: [],
  },
  // ...and during esbuild's dependency pre-bundling scan.
  optimizeDeps: {
    esbuildOptions: {
      loader: { '.js': 'jsx' },
    },
  },
})
