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
        name: 'PPG iTECH HUB',
        short_name: 'PPG HUB',
        description: 'PPG Employee Management System',
        theme_color: '#0ea5e9',
        background_color: '#0ea5e9',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        orientation: 'portrait-primary',
        categories: ['business', 'productivity'],
        screenshots: [
          {
            src: 'ppg-logo.png',
            sizes: '540x720',
            form_factor: 'narrow'
          },
          {
            src: 'ppg-logo.png',
            sizes: '1280x720',
            form_factor: 'wide'
          }
        ],
        icons: [
          {
            src: 'ppg-logo.png',
            sizes: '144x144',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'ppg-logo.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'ppg-logo.png',
            sizes: '256x256',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'ppg-logo.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          }
        ]
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,png,jpg,jpeg,svg,woff2}'],
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
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
