import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages 项目站点部署在 /car-sign-generator/ 子路径下。
  // 由 CI 注入 BASE_PATH；本地开发/预览保持根路径，避免影响 Playwright。
  base: process.env.BASE_PATH ?? '/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  // 单元测试只跑 src/**，e2e 由 Playwright 负责
  test: {
    include: ['src/**/*.test.ts'],
    exclude: ['e2e/**', 'node_modules/**'],
  },
})
