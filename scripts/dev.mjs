// Dev mode: starts the Vite dev server, then opens the Electron app pointed
// at it — hot reload inside the real app, with real CSV storage.
import { spawn } from 'node:child_process'

const DEV_URL = 'http://localhost:5173'

const vite = spawn('npx', ['vite', '--port', '5173', '--strictPort'], {
  stdio: ['ignore', 'inherit', 'inherit'],
})

let electron = null

async function waitForVite() {
  for (let i = 0; i < 100; i++) {
    try {
      await fetch(DEV_URL)
      return true
    } catch {
      await new Promise((r) => setTimeout(r, 200))
    }
  }
  return false
}

const ready = await waitForVite()
if (!ready) {
  console.error('Vite dev server did not come up on', DEV_URL)
  vite.kill()
  process.exit(1)
}

electron = spawn('npx', ['electron', '.'], {
  stdio: 'inherit',
  env: { ...process.env, VITE_DEV_SERVER_URL: DEV_URL },
})

electron.on('exit', () => {
  vite.kill()
  process.exit(0)
})
vite.on('exit', () => {
  if (electron) electron.kill()
})
