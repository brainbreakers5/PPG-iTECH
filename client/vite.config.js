import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      registerType: 'prompt',
      manifestFilename: 'manifest.json',
      includeAssets: ['ppg-logo.png', 'ppg-bg.jpg'],
      manifest: {
        name: 'PPG EMP HUB',
        short_name: 'PPG HUB',
        description: 'PPG Employee Management Hub',
        theme_color: '#0ea5e9',
        background_color: '#0ea5e9',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: 'ppg-logo.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'ppg-logo.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'ppg-logo.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,png,jpg,jpeg,svg,woff2}'],
        cleanupOutdatedCaches: true,
      }
    })
  ],
  build: {
    chunkSizeWarningLimit: 2000, // Increase limit for larger chunks
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom', 'framer-motion'],
        },
      },
    },
  },
  server: {
    port: 5173,
    // Proxy /api calls to the HTTPS backend, ignoring self-signed cert errors
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false, // allow self-signed certs in dev
      }
    },
    // Enable HTTPS on Vite dev server using the same certs
    https: (() => {
      const keyPath = path.resolve(__dirname, '../server/ssl/privkey.pem')
      const certPath = path.resolve(__dirname, '../server/ssl/fullchain.pem')
      if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
        return {
          key: fs.readFileSync(keyPath),
          cert: fs.readFileSync(certPath),
        }
      }
      return false
    })(),
  },
})
