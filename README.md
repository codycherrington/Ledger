# TaskTray

A local-only Kanban and task manager for the Mac desktop. No account, no server, no sync — every project, task, folder, and tag lives on your machine as plain CSV files you can open, edit, or back up by hand.

## Features

- **Home board** — a top-level Kanban/table board where Projects, Folders, and standalone Tasks all sit as cards you can drag between statuses (To Do / In Progress / Done / Nullspace).
- **Projects** — each gets its own board with the same four fixed statuses, plus a details view for a description, links, and file attachments.
- **Folders** — group related tasks (e.g. a project phase) without giving up per-task status. A folder expands in place on the board; drag tasks in or out, or add new ones directly inside it. A task filed in a folder shows its status as a small colored pill.
- **Table view** — toggle any board to a sortable, filterable spreadsheet-style list (title, category, priority, due date, status), with inline editing.
- **Tags, priority, due dates, checklists, links, attachments** — tags are a single global pool usable on any task, project-scoped or not.
- **Filter popover** — search plus priority/tag filters tucked behind one "Filter" button instead of a permanent row.
- **Save indicator** — a small "Saving…" / "Saved" status in the header confirms every change actually landed on disk.

Everything is stored as CSVs under `~/Library/Application Support/tasktray/` (see [Data storage](#data-storage) below). In the app, **File → Open Data Folder** (⌘⇧O) jumps straight there.

## Requirements

- macOS (Apple Silicon or Intel) — this is a Mac-only Electron app; there is no Windows/Linux build and no browser mode.
- [Node.js](https://nodejs.org/) 20 or later, and npm.

## Getting started (cloning the repo)

```bash
git clone https://github.com/codycherrington/TaskTray.git
cd TaskTray
npm install
```

From here you have two paths:

### Run the packaged Mac app

```bash
npm run app:install
```

This builds the frontend, ad-hoc signs the app, and installs it to `/Applications/TaskTray.app`. Launch it from Spotlight or `/Applications` like any other Mac app from then on.

To build without installing (e.g. to inspect the bundle), use `npm run app:build` — output lands in `release/`.

### Run in development mode

```bash
npm run dev
```

This starts the Vite dev server and opens an Electron window pointed at it — hot reload on every save in `src/`, working against your real CSV data under `~/Library/Application Support/tasktray/`. There is no browser fallback: opening the Vite URL directly in a browser tab won't work, since persistence goes through an Electron-only bridge (`window.boardFS`).

## Other commands

```bash
npm run build   # tsc -b && vite build — typecheck + build the frontend only, no Electron packaging
npm run lint    # oxlint
npm test        # run the unit test suite (see TESTING.md)
```

The unit test suite covers business logic (the board store, CSV
persistence) — see [`TESTING.md`](./TESTING.md) for scope and how it's run.
For UI changes, `npm run dev` against real data is still the verification
loop; there's no browser fallback to spot-check in.

## Data storage

- `~/Library/Application Support/tasktray/projects.csv`, `columns.csv`, `cards.csv`, `tags.csv`, `folders.csv` — one CSV per table, plain text, safe to open in a spreadsheet app or text editor.
- `~/Library/Application Support/tasktray/attachments/` — uploaded files, named `<id>__<original name>`.
- This folder isn't part of the repo — it's your personal task data, computed per-user from your home directory, not git-ignored repo state. Back it up by copying the folder; there's no external sync.
- The dev server and any built/installed copy of the app share this same folder, so running both at once can race on saves — stick to one at a time.
- If you're upgrading a checkout that predates this portable location, your existing board is migrated automatically the first time the app loads: the old `data/` folder inside the repo is copied (not moved) into the new location, then left in place as a backup.

## Architecture

For a deeper tour of how the pieces fit together (data flow, the Zustand store, drag-and-drop model, folder semantics), see [`CLAUDE.md`](./CLAUDE.md) — written for whoever (human or AI) picks this codebase up next.
