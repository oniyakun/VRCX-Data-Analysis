const { contextBridge, ipcRenderer, shell } = require('electron');
const { clipboard, nativeImage } = require('electron');

// 创建一个函数来处理控制台消息
function handleConsoleMessage(event, { type, message }) {
  switch (type) {
    case 'error':
      console.error(message);
      break;
    case 'warn':
      console.warn(message);
      break;
    case 'info':
      console.info(message);
      break;
    default:
      console.log(message);
  }
}

// 监听console-message事件
ipcRenderer.on('console-message', handleConsoleMessage);

contextBridge.exposeInMainWorld('electronAPI', {
  ipcRenderer: {
    invoke: async (channel, ...args) => {
      const validChannels = ['auto-load-vrcx-db', 'read-config', 'copy-to-clipboard', 'open-external'];
      if (validChannels.includes(channel)) {
        try {
          const result = await ipcRenderer.invoke(channel, ...args);
          console.log(`IPC 调用结果:`, result);
          return result;
        } catch (error) {
          console.error(`IPC 调用失败:`, error);
          throw error;
        }
      }
      throw new Error(`不允许访问 IPC 通道: ${channel}`);
    },
  },
  getDirname: () => __dirname,
  openExternal: async (url) => {
    try {
      const result = await ipcRenderer.invoke('open-external', url);
      if (!result.success) {
        throw new Error(result.error || '打开外部链接失败');
      }
      return true;
    } catch (error) {
      console.error('打开外部链接失败:', error);
      throw error;
    }
  },
  clipboard: {
    writeImage: (dataUrl) => {
      try {
        const image = nativeImage.createFromDataURL(dataUrl);
        clipboard.writeImage(image);
        return true;
      } catch (error) {
        console.error('写入剪贴板失败:', error);
        throw error;
      }
    }
  }
});