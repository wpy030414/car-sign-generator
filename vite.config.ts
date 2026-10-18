import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite-plus';

// 本地开发与预览恒为根路径；
// CI 注入 PAGES_BASE_PATH 决定线上前缀：项目页 /<repo>/，自定义域或用户页 /
// 代码不做任何域名或仓库名推断
const base = process.env.PAGES_BASE_PATH || '/';

export default defineConfig({
  base,
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, 'src') },
  },
  server: { host: '0.0.0.0', port: 5173 },
  preview: { host: '0.0.0.0', port: 4173 },
  // 沿用仓库既有代码风格（分号 + 单引号），避免整库无意义重排
  fmt: { semi: true, singleQuote: true },
  lint: {
    // 必须显式排除，否则 vp lint 会扫描 node_modules
    ignorePatterns: ['node_modules/**', 'dist/**', 'e2e/**', 'test-results/**'],
    options: { typeAware: true, typeCheck: true },
  },
  // 单元测试只跑 src/**，e2e 由 Playwright 负责
  test: {
    include: ['src/**/*.test.ts'],
    exclude: ['e2e/**', 'node_modules/**'],
  },
});
