import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { readFileSync } from 'fs'

// Read version from package.json
const packageJson = JSON.parse(readFileSync('./package.json', 'utf-8'))
// Display version as vX.Y (strip .0 patch version for UI display)
const version = packageJson.version.replace(/\.0$/, '')

/**
 * GitHub release asset downloads 302 to release-assets.githubusercontent.com (no CORS).
 * Follow redirects server-side and return the body on same-origin /gh-download/*.
 */
function githubReleaseDownloadProxy(): Plugin {
  return {
    name: 'github-release-download-proxy',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/gh-download/')) return next()
        try {
          const githubPath = req.url.replace(/^\/gh-download/, '')
          const upstream = await fetch(`https://github.com${githubPath}`, {
            headers: { 'User-Agent': 'morpheus-myprovider-dev' },
            redirect: 'follow',
          })
          if (!upstream.ok) {
            res.statusCode = upstream.status
            res.end(`Upstream ${upstream.status}`)
            return
          }
          const buf = Buffer.from(await upstream.arrayBuffer())
          res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/octet-stream')
          res.setHeader('Cache-Control', 'no-store')
          res.end(buf)
        } catch (e) {
          res.statusCode = 502
          res.end(e instanceof Error ? e.message : 'proxy error')
        }
      })
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), githubReleaseDownloadProxy()],
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
    // Bind all interfaces so both localhost and 127.0.0.1 work (macOS IPv6 localhost quirk)
    host: true,
    proxy: {
      // Avoid CORS failures from http://127.0.0.1:3000 (not on CloudFront allowlist)
      '/active-mor': {
        target: 'https://active.mor.org',
        changeOrigin: true,
        secure: true,
        rewrite: (p) => p.replace(/^\/active-mor/, ''),
      },
      '/gh-api': {
        target: 'https://api.github.com',
        changeOrigin: true,
        secure: true,
        rewrite: (p) => p.replace(/^\/gh-api/, ''),
        headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'morpheus-myprovider-dev' },
      },
    },
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
