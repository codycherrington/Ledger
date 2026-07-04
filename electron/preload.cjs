'use strict'

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('boardFS', {
  loadState: () => ipcRenderer.invoke('board:load'),
  saveState: (state) => ipcRenderer.invoke('board:save', state),
  putAttachment: (id, name, data) => ipcRenderer.invoke('attachment:put', id, name, data),
  getAttachment: (id) => ipcRenderer.invoke('attachment:get', id),
  deleteAttachment: (id) => ipcRenderer.invoke('attachment:delete', id),
})
