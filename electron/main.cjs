'use strict'

const { app, BrowserWindow, ipcMain, shell, Menu } = require('electron')
const path = require('node:path')
const store = require('./store.cjs')

function createWindow() {
  const win = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 800,
    minHeight: 560,
    show: false,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#0a0d14',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
    },
  })

  win.once('ready-to-show', () => win.show())

  // Resource links on cards should open in the default browser, never
  // navigate the app window.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file://')) {
      event.preventDefault()
      shell.openExternal(url)
    }
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }
}

function buildMenu() {
  const template = [
    { role: 'appMenu' },
    {
      label: 'File',
      submenu: [
        {
          label: 'Open Data Folder',
          accelerator: 'CmdOrCtrl+Shift+O',
          click: () => shell.openPath(store.DATA_DIR),
        },
        { type: 'separator' },
        { role: 'close' },
      ],
    },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

ipcMain.handle('board:load', () => store.loadState())
ipcMain.handle('board:save', (_event, state) => store.saveState(state))
ipcMain.handle('attachment:put', (_event, id, name, data) => store.putAttachment(id, name, data))
ipcMain.handle('attachment:get', (_event, id) => store.getAttachment(id))
ipcMain.handle('attachment:delete', (_event, id) => store.deleteAttachment(id))

app.whenReady().then(() => {
  buildMenu()
  createWindow()

  // Touch the data dir after the window is up: on first launch macOS shows
  // a "allow access to Documents" prompt, and doing this first would block
  // startup behind it with no window visible.
  try {
    store.ensureDirs()
  } catch {
    // Access denied or not yet granted; saves will retry and surface errors.
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  // Standard mac behavior: closing the window leaves the app running in the
  // dock/menu bar. Only Cmd+Q or "Quit" from the menu should actually quit.
  if (process.platform !== 'darwin') app.quit()
})
