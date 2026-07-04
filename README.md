# TaskTray

A local-only Kanban project/task manager: create projects, define custom phases (columns), and manage tasks as cards you drag between them. Runs as a Mac app (Electron); all data lives on-device as plain CSV files in `data/` (in this project folder, git-ignored) — no account, no server.

- `projects.csv`, `columns.csv`, `cards.csv`, `tags.csv` — one CSV per table
- `attachments/` — attachment files, named `<id>__<original name>`
- In the app, File → Open Data Folder (⌘⇧O) jumps straight there

## Mac app

```bash
npm install
npm run app:install   # builds, signs, and installs /Applications/TaskTray.app
```

`npm run app` builds and runs the Electron app directly without installing.

## Development

```bash
npm run dev
```

Starts the Vite dev server and opens an Electron window pointed at it — hot reload inside the real app, against the real CSV data. There is no browser mode; the app requires its Electron shell for file access.
