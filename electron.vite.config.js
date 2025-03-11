import { defineConfig } from 'electron-vite';
import path from 'path';

export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        input: path.resolve(__dirname, 'main.js'), // 指定主进程入口文件
      },
    },
  },
  renderer: {
    root: 'frontend', // 前端项目根目录
    build: {
      rollupOptions: {
        input: path.resolve(__dirname, 'frontend/index.html'), // 前端入口文件
      },
    },
  },
});