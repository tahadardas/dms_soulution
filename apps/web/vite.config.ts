import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
    base: './',
    plugins: [react()],
    optimizeDeps: {
        include: ['@dms/shared', '@dms/ui']
    },
    build: {
        commonjsOptions: {
            include: [/packages\/shared/, /packages\/ui/, /node_modules/],
            transformMixedEsModules: true
        }
    },
    server: {
        port: 5173,
        proxy: {
            '/api': {
                target: 'http://localhost:3000',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/api/, '')
            }
        }
    }
})
