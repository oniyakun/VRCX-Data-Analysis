import { defineConfig } from 'electron-vite';
import path from 'path';

export default defineConfig({
  main: {
    build: {
      outDir: 'frontend/dist',
      rollupOptions: {
        input: path.resolve(__dirname, 'main.js'), // 指定主进程入口文件
      },
    },
  },
  preload: {
    build: {
      outDir: 'frontend/dist',
      rollupOptions: {
        input: path.resolve(__dirname, 'preload.js'), // 添加 preload 脚本入口
      },
    },
  },
  renderer: {
    root: 'frontend', // 前端项目根目录
    build: {
      outDir: 'frontend/dist',
      rollupOptions: {
        input: path.resolve(__dirname, 'frontend/index.html'), // 前端入口文件
      },
    },
  },
});