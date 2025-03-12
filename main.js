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
    height: 1200,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.setMenuBarVisibility(false);

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../frontend/index.html'));
  }
}

app.whenReady().then(() => {
  backendProcess = spawn(path.join(process.resourcesPath, 'dist/app.exe'));

  backendProcess.stdout.on('data', (data) => {
    console.log(`后端输出: ${data}`);
  });
  backendProcess.stderr.on('data', (data) => {
    console.error(`后端错误: ${data}`);
  });

  createWindow();

  // 自动加载 VRCX 数据库
  ipcMain.handle('auto-load-vrcx-db', async () => {
    try {
      const vrcxPath = path.join(os.homedir(), 'AppData', 'Roaming', 'VRCX', 'VRCX.sqlite3');
      if (!fs.existsSync(vrcxPath)) {
        return { success: false, message: '未找到VRCX数据库文件，请手动加载' };
      }
      const fileBuffer = fs.readFileSync(vrcxPath);
      const formData = new FormData();
      formData.append('file', fileBuffer, {
        filename: 'VRCX.sqlite3',
        contentType: 'application/octet-stream',
      });
      const resp = await axios.post('http://localhost:5000/upload', formData, {
        headers: formData.getHeaders(),
      });
      return { success: true, data: resp.data };
    } catch (err) {
      return { success: false, message: err.message };
    }
  });

  // 读取本地配置文件 config.ini 中的预设 prompt
  ipcMain.handle('read-config', async () => {
    try {
      const configPath = path.join(__dirname, 'config.ini');
      if (!fs.existsSync(configPath)) {
        return { success: false, message: '配置文件不存在' };
      }
      const content = fs.readFileSync(configPath, 'utf-8');
      const prompts = [];
      const lines = content.split(/\r?\n/);
      let inPrompts = false;
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('[')) {
          inPrompts = trimmed.toLowerCase() === '[prompts]';
        } else if (inPrompts && trimmed && !trimmed.startsWith(';') && trimmed.includes('=')) {
          const parts = trimmed.split('=');
          if (parts.length >= 2) {
            const value = parts.slice(1).join('=').trim();
            prompts.push(value);
          }
        }
      }
      return { success: true, prompts };
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
    require('child_process').exec('taskkill /F /IM app.exe');
  }
});