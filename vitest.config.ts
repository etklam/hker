import { defineConfig } from 'vitest/config'
import path from 'path'
import { transformSync } from 'esbuild'

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.test.tsx',
        'src/test/**',
        'src/db/**',
        'src/**/*.d.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  plugins: [
    {
      name: 'jsx-transform',
      enforce: 'pre',
      transform(code, id) {
        if (id.endsWith('.tsx') && !id.includes('node_modules')) {
          const result = transformSync(code, {
            loader: 'tsx',
            jsx: 'automatic',
            target: 'esnext',
          })
          return { code: result.code, map: result.map }
        }
      },
    },
  ],
})
