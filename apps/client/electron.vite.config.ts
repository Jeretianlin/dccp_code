import { resolve } from 'path';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
      },
    },
    plugins: [react()],
    esbuild: {
      charset: 'utf8',
    },
    build: {
      rollupOptions: {
        output: {
          format: 'es',
        },
      },
      minify: false, // 避免压缩导致中文乱码
    },
  },
});