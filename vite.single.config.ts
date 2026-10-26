import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'
export default defineConfig({ define: { 'import.meta.env.VITE_DEFAULT_ROUTE': JSON.stringify('#/dashboard') }, plugins: [react(), viteSingleFile()], build: { outDir: 'dist-single', assetsInlineLimit: 100000000, cssCodeSplit: false } })
