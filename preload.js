const { contextBridge, ipcRenderer } = require('electron');
const { clipboard, nativeImage } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  ipcRenderer: {
    invoke: (channel, ...args) => {
      const validChannels = ['read-config', 'auto-load-vrcx-db', 'copy-to-clipboard'];
      if (validChannels.includes(channel)) {
        return ipcRenderer.invoke(channel, ...args);
      }
      throw new Error(`未知的 IPC 通道: ${channel}`);
    },
  },
  getDirname: () => __dirname,
});