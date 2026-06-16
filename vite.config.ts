import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import Inspector from 'unplugin-vue-dev-locator/vite'
import traeBadgePlugin from 'vite-plugin-trae-solo-badge'
import electron from 'vite-plugin-electron/simple'
import electronRenderer from 'vite-plugin-electron-renderer'

export default defineConfig({
  build: {
    sourcemap: 'hidden',
  },
  plugins: [
    vue(),
    Inspector(),
    traeBadgePlugin({
      variant: 'dark',
      position: 'bottom-right',
      prodOnly: true,
      clickable: true,
      clickUrl: 'https://www.trae.ai/solo?showJoin=1',
      autoTheme: true,
      autoThemeTarget: '#app',
    }),
    electron({
      main: {
        entry: 'electron/main/index.ts',
        vite: {
          build: {
            sourcemap: true,
            outDir: 'dist-electron/main',
            rollupOptions: {
              external: ['electron', 'better-sqlite3']
            }
          },
        },
      },
      preload: {
        input: path.join(__dirname, 'electron/preload/index.mjs'),
        vite: {
          build: {
            sourcemap: true,
            outDir: 'dist-electron/preload',
          },
        },
      },
      renderer: process.env.VSCODE_DEBUG ? {} : undefined,
    }),
    electronRenderer(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    exclude: ['electron']
  }
})
