import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { readFileSync } from 'fs'

// Read version from package.json
const packageJson = JSON.parse(readFileSync('./package.json', 'utf-8'))
// Display version as vX.Y (strip .0 patch version for UI display)
const version = packageJson.version.replace(/\.0$/, '')

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  // Tauri expects a fixed port, or use 0 for random
  server: {
    port: 3000,
    strictPort: false,
  },
  // Tauri will look for the build output in dist
  build: {
    outDir: 'dist',
    // Generate sourcemaps for better debugging
    sourcemap: true,
  },
  // Clear the screen on file changes
  clearScreen: false,
})

