const { app, BrowserWindow, ipcMain } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const axios = require('axios');
const FormData = require('form-data');

let backendProcess;
let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 1000,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // 根据开发或生产环境加载前端页面
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173'); // Vite 开发服务器默认端口
  } else {
    mainWindow.loadFile(path.join(__dirname, '../frontend/index.html')); // 生产环境加载构建后的文件
  }
}

app.whenReady().then(() => {
  // 启动后端服务（打包后的可执行文件）
  backendProcess = spawn(path.join(__dirname, 'dist/app.exe'));

  backendProcess.stdout.on('data', (data) => {
    console.log(`后端输出: ${data}`);
  });
  backendProcess.stderr.on('data', (data) => {
    console.error(`后端错误: ${data}`);
  });

  createWindow();

  // 注册 IPC 处理器，用于自动加载 VRCX 数据库
  ipcMain.handle('auto-load-vrcx-db', async () => {
    try {
      // 拼接 VRCX 默认路径：%USERPROFILE%\AppData\Roaming\VRCX\VRCX.sqlite3
      const vrcxPath = path.join(os.homedir(), 'AppData', 'Roaming', 'VRCX', 'VRCX.sqlite3');
      if (!fs.existsSync(vrcxPath)) {
        return { success: false, message: '未找到VRCX数据库文件，请手动加载' };
      }
      // 读取文件内容
      const fileBuffer = fs.readFileSync(vrcxPath);
      // 构造 FormData 并上传给后端
      const formData = new FormData();
      formData.append('file', fileBuffer, {
        filename: 'VRCX.sqlite3',
        contentType: 'application/octet-stream',
      });
      // 假设后端服务在 http://localhost:5000，并提供 /upload 接口
      const resp = await axios.post('http://localhost:5000/upload', formData, {
        headers: formData.getHeaders(),
      });
      return { success: true, data: resp.data };
    } catch (err) {
      return { success: false, message: err.message };
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('quit', () => {
  if (backendProcess) {
    // Windows 系统下结束进程
    require('child_process').exec('taskkill /F /IM app.exe');
  }
});
