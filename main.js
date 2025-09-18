const { app, BrowserWindow, ipcMain, clipboard, nativeImage, shell } = require('electron');
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const axios = require('axios');
const FormData = require('form-data');

let backendProcess;
let mainWindow;
// 添加临时文件跟踪数组
const tempFiles = [];

// 添加创建临时文件的函数，自动跟踪
function createTempFile(prefix, suffix = '.json') {
  // 使用程序目录下的temp文件夹而不是系统临时目录
  const tempDir = path.join(__dirname, 'temp');
  // 确保temp目录存在
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  const tempFile = path.join(tempDir, `${prefix}_${Date.now()}${suffix}`);
  tempFiles.push(tempFile);
  return tempFile;
}

// 添加安全删除临时文件的函数
function safeDeleteFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log('临时文件已删除:', filePath);
      
      // 从跟踪数组中移除
      const index = tempFiles.indexOf(filePath);
      if (index > -1) {
        tempFiles.splice(index, 1);
      }
      return true;
    }
  } catch (err) {
    console.error('删除临时文件失败:', err);
    return false;
  }
  return false;
}

// 添加清理所有临时文件的函数
function cleanupAllTempFiles(forceCleanup = false) {
  console.log('清理所有临时文件...', forceCleanup ? '(强制清理)' : '(定时清理)');
  const filesToRemove = [...tempFiles]; // 创建副本避免迭代时修改原数组
  
  for (const file of filesToRemove) {
    safeDeleteFile(file);
  }
  
  // 查找并清理额外的临时文件
  try {
    const tempDir = path.join(__dirname, 'temp');
    if (fs.existsSync(tempDir)) {
      const files = fs.readdirSync(tempDir);
      for (const file of files) {
        if (file.startsWith('vrcx_') && (file.endsWith('.json') || file.endsWith('.sqlite3'))) {
          const fullPath = path.join(tempDir, file);
          
          if (forceCleanup) {
            // 强制清理模式：删除所有临时文件
            safeDeleteFile(fullPath);
          } else {
            // 定时清理模式：只删除超过30分钟的文件
            const stats = fs.statSync(fullPath);
            const fileAgeMs = Date.now() - stats.mtimeMs;
            if (fileAgeMs > 30 * 60 * 1000) { // 30分钟
              safeDeleteFile(fullPath);
            }
          }
        }
      }
      
      // 如果是强制清理且temp目录为空，则删除temp目录
      if (forceCleanup) {
        try {
          const remainingFiles = fs.readdirSync(tempDir);
          if (remainingFiles.length === 0) {
            fs.rmdirSync(tempDir);
            console.log('已删除空的临时目录:', tempDir);
          }
        } catch (err) {
          console.error('删除临时目录失败:', err);
        }
      }
    }
  } catch (err) {
    console.error('清理额外临时文件时出错:', err);
  }
}

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

// 每小时清理一次临时文件
const CLEANUP_INTERVAL = 60 * 60 * 1000; // 1小时
let cleanupInterval = null;

app.whenReady().then(() => {
  // 启动时清理临时文件
  cleanupAllTempFiles();
  
  // 设置定时清理临时文件
  cleanupInterval = setInterval(cleanupAllTempFiles, CLEANUP_INTERVAL);
  
  // 启动后端进程
  if (process.env.NODE_ENV === 'development') {
    // 开发环境：直接运行Python脚本
    const pythonPath = path.join(__dirname, '.venv', 'Scripts', 'python.exe');
    const scriptPath = path.join(__dirname, 'app.py');
    backendProcess = spawn(pythonPath, [scriptPath], {
      env: {
        ...process.env,
        PYTHONIOENCODING: 'utf-8',
        PYTHONLEGACYWINDOWSSTDIO: '1'
      }
    });
  } else {
    // 生产环境：使用编译后的exe
    const backendPath = path.join(process.resourcesPath, 'dist/app.exe');
    backendProcess = spawn(backendPath);
  }

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
        responseType: 'arraybuffer',  // 使用arraybuffer类型，避免过早转换成字符串
        timeout: 120000 // 增加超时时间到120秒
      });
      
      console.log('后端响应状态:', resp.status);
      
      // 分块处理大型JSON
      try {
        // 将buffer分割成更小的部分来处理
        const buffer = Buffer.from(resp.data);
        const totalSize = buffer.length;
        
        console.log('总响应大小:', totalSize, '字节');
        
        // 处理方法：将响应写入临时文件，然后使用流式处理而不是一次性读取
        const tempFile = createTempFile('vrcx_response');
        fs.writeFileSync(tempFile, buffer);
        console.log('已写入临时文件:', tempFile);
        console.log('临时文件大小:', fs.statSync(tempFile).size, '字节');
        
        // 使用更直接的方法处理大型JSON
        // 先获取响应中所有表格的元数据部分
        const { parser } = require('stream-json');
        const { streamValues } = require('stream-json/streamers/StreamValues');
        
        // 开始计时
        const startTime = Date.now();
        
        // 创建一个表元数据数组来存储结果
        const tables_metadata = [];
        
        // 处理数据的promise
        const processData = new Promise((resolve, reject) => {
          try {
            const pipeline = fs.createReadStream(tempFile, {
              highWaterMark: 1024 * 1024 // 增大缓冲区大小为1MB
            })
              .pipe(parser())
              .pipe(streamValues());
            
            let dataReceived = false;
            let tableCount = 0;
            
            pipeline.on('data', data => {
              // 记录进度
              dataReceived = true;
              console.log('正在处理JSON流数据...');
              
              // 仅收集tables_metadata数组的内容
              if (data?.value?.tables_metadata && Array.isArray(data.value.tables_metadata)) {
                tableCount = data.value.tables_metadata.length;
                console.log(`找到${tableCount}个表格的元数据`);
                // 一次性获取完整的表格元数据数组
                resolve(data.value.tables_metadata);
              }
            });
            
            pipeline.on('end', () => {
              const endTime = Date.now();
              console.log(`JSON处理完成，耗时: ${(endTime - startTime) / 1000} 秒`);
              
              // 如果正常结束但没有找到表格元数据
              if (!dataReceived) {
                console.warn('未找到任何表格元数据，JSON可能格式不正确');
                // 在完成解析后删除临时文件
                safeDeleteFile(tempFile);
                resolve([]);
              } else if (!tableCount) {
                // 处理完流但没有解析到tables_metadata的情况
                safeDeleteFile(tempFile);
                resolve([]);
              }
            });
            
            pipeline.on('error', err => {
              console.error('处理JSON流时出错:', err);
              // 确保错误情况下也删除临时文件
              safeDeleteFile(tempFile);
              reject(err);
            });
          } catch (err) {
            console.error('创建流处理管道时出错:', err);
            // 确保在设置流处理器时出错也删除临时文件
            safeDeleteFile(tempFile);
            reject(err);
          }
        });
        
        // 等待处理完成
        const tables_metadata_array = await processData;
        const jsonData = { tables_metadata: tables_metadata_array };
        
        if (!jsonData.tables_metadata || !Array.isArray(jsonData.tables_metadata)) {
          console.error('后端响应数据格式不正确');
          return { success: false, message: '后端响应数据格式不正确' };
        }
        
        console.log('表格数量:', jsonData.tables_metadata.length);
        
        // 检查每个表格的结构并打印详细信息
        for (const table of jsonData.tables_metadata) {
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
          tables_metadata: jsonData.tables_metadata.map(table => {
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
        
        // 计算数据大小并决定如何传输
        try {
          // 先估算数据大小
          const sampleTable = validatedData.tables_metadata[0];
          const sampleSize = JSON.stringify(sampleTable).length;
          const estimatedSize = sampleSize * validatedData.tables_metadata.length;
          
          console.log('估计数据大小:', estimatedSize, '字节');
          
          // 如果数据预计超过50MB，则使用文件传输方式
          if (estimatedSize > 50 * 1024 * 1024) {
            console.log('数据量较大，使用临时文件传输...');
            
            // 创建临时文件
            const tempDataFile = createTempFile('vrcx_data');
            
            // 流式写入JSON到临时文件
            await new Promise((resolve, reject) => {
              const writeStream = fs.createWriteStream(tempDataFile);
              
              writeStream.write('{"tables_metadata":[');
              
              let first = true;
              for (const table of validatedData.tables_metadata) {
                if (!first) {
                  writeStream.write(',');
                }
                first = false;
                
                // 将表数据序列化为JSON字符串片段
                const tableString = JSON.stringify(table);
                writeStream.write(tableString);
              }
              
              writeStream.write(']}');
              writeStream.end();
              
              writeStream.on('finish', resolve);
              writeStream.on('error', (err) => {
                console.error('写入临时文件出错:', err);
                // 尝试清理可能部分写入的临时文件
                safeDeleteFile(tempDataFile);
                reject(err);
              });
            }).catch(err => {
              console.error('写入临时文件失败:', err);
              // 确保在catch中也清理文件
              safeDeleteFile(tempDataFile);
              throw err; // 重新抛出以便外层catch处理
            });
            
            console.log('数据已写入临时文件:', tempDataFile);
            console.log('文件大小:', fs.statSync(tempDataFile).size, '字节');
            
            // 返回文件路径而不是实际数据
            return { 
              success: true, 
              useFile: true,
              filePath: tempDataFile,
              tableCount: validatedData.tables_metadata.length
            };
          }
          
          // 数据量较小，直接返回数据
          return { success: true, data: validatedData };
        } catch (err) {
          console.error('准备数据传输时出错:', err);
          return { success: false, message: err.message };
        }
      } catch (err) {
        console.error('解析响应数据失败:', err);
        return { success: false, message: err.message };
      }
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
      const filterPrompts = [];
      const analysisPrompts = [];
      let currentSection = '';
      
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed === '[filter_prompts]') {
          currentSection = 'filter';
        } else if (trimmed === '[analysis_prompts]') {
          currentSection = 'analysis';
        } else if (trimmed && !trimmed.startsWith(';')) {
          const parts = trimmed.split('=');
          if (parts.length >= 2) {
            const value = parts.slice(1).join('=').trim();
            if (value) {
              if (currentSection === 'filter') {
                filterPrompts.push(value);
              } else if (currentSection === 'analysis') {
                analysisPrompts.push(value);
              }
            }
          }
        }
      }
      
      console.log('成功读取到筛选页面预设提示词:', filterPrompts);
      console.log('成功读取到分析结果页面预设提示词:', analysisPrompts);
      return { 
        success: true, 
        filterPrompts: filterPrompts,
        analysisPrompts: analysisPrompts 
      };
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

  // 添加临时文件读取的IPC处理程序
  ipcMain.handle('load-temp-file', async (event, filePath) => {
    try {
      console.log('请求读取临时文件:', filePath);
      
      // 检查文件是否存在
      if (!fs.existsSync(filePath)) {
        console.error('临时文件不存在:', filePath);
        return { success: false, message: '临时文件不存在' };
      }
      
      // 检查文件大小
      const stats = fs.statSync(filePath);
      console.log('临时文件大小:', stats.size, '字节');
      
      // 使用流式解析JSON
      const { parser } = require('stream-json');
      const { streamObject } = require('stream-json/streamers/StreamObject');
      
      // 创建一个解析数据结构
      try {
        const result = await new Promise((resolve, reject) => {
          const pipeline = fs.createReadStream(filePath)
            .pipe(parser())
            .pipe(streamObject());
          
          const fileData = {};
          
          pipeline.on('data', data => {
            // 存储JSON对象中的键值对
            fileData[data.key] = data.value;
          });
          
          pipeline.on('end', () => {
            console.log('临时文件解析完成');
            
            // 完成后删除临时文件
            safeDeleteFile(filePath);
            
            resolve(fileData);
          });
          
          pipeline.on('error', err => {
            console.error('解析临时文件出错:', err);
            // 确保错误情况下也删除临时文件
            safeDeleteFile(filePath);
            reject(err);
          });
        });
        
        return { 
          success: true, 
          data: result
        };
      } catch (parseError) {
        console.error('解析临时文件数据失败:', parseError);
        // 确保解析失败时也删除临时文件
        safeDeleteFile(filePath);
        return { success: false, message: `解析临时文件数据失败: ${parseError.message}` };
      }
    } catch (error) {
      console.error('读取临时文件失败:', error);
      // 尝试删除临时文件
      try {
        safeDeleteFile(filePath);
      } catch (cleanupError) {
        console.error('删除临时文件失败:', cleanupError);
      }
      return { success: false, message: error.message };
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// 在应用即将退出时清理临时文件
app.on('before-quit', () => {
  console.log('应用即将退出，开始清理临时文件...');
  cleanupAllTempFiles(true);
});

app.on('quit', () => {
  if (backendProcess) {
    require('node:child_process').exec('taskkill /F /IM app.exe');
  }
  
  // 应用退出时强制清理所有临时文件（备用清理）
  cleanupAllTempFiles(true);
});

// 停止定时器
app.on('will-quit', () => {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
  }
  
  // 最后一次清理机会
  console.log('应用即将完全退出，最后一次清理临时文件...');
  cleanupAllTempFiles(true);
});