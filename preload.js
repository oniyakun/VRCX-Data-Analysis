const { contextBridge, ipcRenderer } = require('electron');
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
      const validChannels = ['auto-load-vrcx-db', 'read-config', 'copy-to-clipboard'];
      if (validChannels.includes(channel)) {
        console.log(`调用 IPC 通道: ${channel}`);
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
});