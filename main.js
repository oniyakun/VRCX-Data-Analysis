const { app, BrowserWindow, ipcMain, clipboard, nativeImage } = require('electron');
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const axios = require('axios');
const FormData = require('form-data');

let backendProcess;
let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1550,
    height: 1050,
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
  // 启动后端进程
  const backendPath = process.env.NODE_ENV === 'development'
    ? path.join(__dirname, 'dist/app/app.exe') // 开发环境路径
    : path.join(process.resourcesPath, 'dist/app.exe'); // 打包后路径
  backendProcess = spawn(backendPath);

  backendProcess.stdout.on('data', (data) => {
    console.log(`后端输出: ${data}`);
  });
  backendProcess.stderr.on('data', (data) => {
    console.error(`后端错误: ${data}`);
  });

  createWindow();

  // 添加openExternal的IPC处理程序
  ipcMain.handle('open-external', async (event, url) => {
    try {
      await shell.openExternal(url);
      return { success: true };
    } catch (error) {
      console.error('打开外部链接失败:', error);
      return { success: false, error: error.message };
    }
  });
  // 自动加载 VRCX 数据库
  ipcMain.handle('auto-load-vrcx-db', async () => {
    try {
      console.log('开始自动加载VRCX数据库...');
      const vrcxPath = path.join(os.homedir(), 'AppData', 'Roaming', 'VRCX', 'VRCX.sqlite3');
      console.log('VRCX数据库路径:', vrcxPath);
      
      if (!fs.existsSync(vrcxPath)) {
        console.error('未找到VRCX数据库文件');
        return { success: false, message: '未找到VRCX数据库文件，请手动加载' };
      }
      
      console.log('读取VRCX数据库文件...');
      const fileBuffer = fs.readFileSync(vrcxPath);
      console.log('文件大小:', fileBuffer.length, '字节');
      
      const formData = new FormData();
      formData.append('file', fileBuffer, {
        filename: 'VRCX.sqlite3',
        contentType: 'application/octet-stream',
      });
      
      console.log('发送请求到后端...');
      const resp = await axios.post('http://localhost:5000/upload', formData, {
        headers: formData.getHeaders(),
        maxContentLength: Number.POSITIVE_INFINITY,
        maxBodyLength: Number.POSITIVE_INFINITY,
        timeout: 120000 // 增加超时时间到120秒
      });
      
      console.log('后端响应状态:', resp.status);
      
      if (!resp.data || !resp.data.tables_metadata) {
        console.error('后端响应数据格式不正确:', resp.data);
        return { success: false, message: '后端响应数据格式不正确' };
      }
      
      console.log('表格数量:', resp.data.tables_metadata.length);
      
      // 检查每个表格的结构并打印详细信息
      for (const table of resp.data.tables_metadata) {
        console.log('表格名称:', table.name);
        console.log('列数量:', table.columns ? table.columns.length : 'undefined');
        console.log('数据行数:', table.data ? table.data.length : 'undefined');
        
        // 打印前几列的名称，帮助调试
        if (table.columns && table.columns.length > 0) {
          console.log('前几列名称:', table.columns.slice(0, Math.min(5, table.columns.length)));
        }
        
        // 打印第一行数据，帮助调试
        if (table.data && table.data.length > 0) {
          console.log('第一行数据示例:', table.data[0]);
        }
      }
      
      // 确保数据格式正确
      const validatedData = {
        tables_metadata: resp.data.tables_metadata.map(table => {
          // 确保name是字符串
          const name = String(table.name || '');
          // 确保columns是数组
          const columns = Array.isArray(table.columns) ? table.columns : [];
          // 确保data是二维数组
          let data = [];
          if (Array.isArray(table.data)) {
            data = table.data.map(row => {
              if (Array.isArray(row)) {
                // 确保所有单元格都是字符串，并且处理null和undefined
                return row.map(cell => {
                  if (cell === null || cell === undefined) {
                    return '';
                  }
                  
                  // 尝试确保字符串编码正确
                  try {
                    const cellStr = String(cell);
                    
                    // 检查是否包含可能的编码问题
                    if (cellStr.includes('鈥') || cellStr.includes('銆') || cellStr.includes('鍦')) {
                      console.log('检测到可能的编码问题:', cellStr);
                      
                      // 尝试修复编码问题 - 这只是一个示例，可能需要更复杂的处理
                      try {
                        // 如果是UTF-8编码被错误解析为其他编码，可以尝试重新编码
                        // 这里我们只是记录问题，实际修复可能需要更复杂的逻辑
                        console.log('原始数据类型:', typeof cell);
                      } catch (encodeErr) {
                        console.error('尝试修复编码时出错:', encodeErr);
                      }
                    }
                    
                    // 尝试解决编码问题 - 将可能的乱码替换为空格
                    // 这是一个临时解决方案，可能需要更复杂的处理
                    const cleanedStr = cellStr
                      .replace(/鈥/g, ' ')
                      .replace(/銆/g, ' ')
                      .replace(/鍦/g, ' ')
                      .replace(/\uFFFD/g, ' '); // 替换Unicode替换字符
                    
                    return cleanedStr;
                  } catch (e) {
                    console.error('转换单元格到字符串时出错:', e);
                    return '';
                  }
                });
              }
              return [];
            });
          }
          
          // 打印一些示例数据用于调试
          if (data.length > 0 && columns.length > 0) {
            console.log(`表格 ${name} 第一行数据示例:`);
            const sampleRow = data[0];
            for (let i = 0; i < Math.min(5, columns.length); i++) {
              if (i < sampleRow.length) {
                console.log(`  ${columns[i]}: ${sampleRow[i]}`);
                // 检查编码
                if (typeof sampleRow[i] === 'string' && sampleRow[i].length > 0) {
                  console.log(`  ${columns[i]} 的前10个字符编码:`, 
                    Array.from(sampleRow[i].slice(0, 10)).map(c => c.charCodeAt(0).toString(16)).join(' '));
                }
              }
            }
          }
          
          return { name, columns, data };
        })
      };
      
      console.log('验证后的表格数量:', validatedData.tables_metadata.length);
      
      // 确保数据不会太大，可能导致IPC通信问题
      const jsonSize = JSON.stringify(validatedData).length;
      console.log('数据大小:', jsonSize, '字节');
      
      return { success: true, data: validatedData };
    } catch (err) {
      console.error('自动加载VRCX数据库错误:', err);
      return { success: false, message: err.message };
    }
  });

  // 读取本地配置文件 config.ini 中的预设 prompt
  ipcMain.handle('read-config', async () => {
    try {
      const configPath = process.env.NODE_ENV === 'development'
        ? path.join(__dirname, 'config.ini') // 开发环境路径
        : path.join(__dirname, '../frontend/config.ini'); // 打包后路径
      if (!fs.existsSync(configPath)) {
        return { success: false, message: '配置文件不存在' };
      }
      const content = fs.readFileSync(configPath, 'utf-8');
      if (!content || content.trim().length === 0) {
        return { success: false, message: '配置文件为空' };
      }
      const lines = content.split('\n');
      const prompts = [];
      let inPrompts = false;
      
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed === '[prompts]') {
          inPrompts = true;
          continue;
        } else if (inPrompts && trimmed && !trimmed.startsWith(';')) {
          const parts = trimmed.split('=');
          if (parts.length >= 2) {
            const value = parts.slice(1).join('=').trim();
            if (value) {
              prompts.push(value);
            }
          }
        }
      }
      
      if (prompts.length === 0) {
        return { success: false, message: '未找到有效的预设提示词' };
      }
      console.log('成功读取到预设提示词:', prompts);
      return { success: true, prompts };
    } catch (err) {
      console.error('读取配置文件错误:', err);
      return { success: false, message: err.message };
    }
  });

  // 添加copy-to-clipboard的IPC处理程序
  ipcMain.handle('copy-to-clipboard', async (event, dataUrl) => {
    try {
      const image = nativeImage.createFromDataURL(dataUrl);
      clipboard.writeImage(image);
      return { success: true };
    } catch (error) {
      console.error('写入剪贴板失败:', error);
      return { success: false, error: error.message };
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
    require('node:child_process').exec('taskkill /F /IM app.exe');
  }
});