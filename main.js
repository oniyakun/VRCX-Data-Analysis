const { app, BrowserWindow } = require('electron');
const { spawn } = require('child_process');
const path = require('path');

let backendProcess;

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
  });

  // 根据开发或生产环境加载前端
  if (process.env.NODE_ENV === 'development') {
    win.loadURL('http://localhost:5173');  // Vite 开发服务器默认端口
  } else {
    win.loadFile(path.join(__dirname, '../frontend/dist/index.html'));  // 生产环境加载构建文件
  }
}

app.whenReady().then(() => {
  // 启动后端服务器
  backendProcess = spawn(path.join(__dirname, 'app'));  // 运行打包后的可执行文件
  backendProcess.stdout.on('data', (data) => {
    console.log(`后端输出: ${data}`);
  });
  backendProcess.stderr.on('data', (data) => {
    console.error(`后端错误: ${data}`);
  });

  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('quit', () => {
  // 关闭后端进程
  if (backendProcess) {
    backendProcess.kill();
  }
});