import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
