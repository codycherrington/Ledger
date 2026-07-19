# Ledger

A local-only Kanban and task manager for the Mac desktop. No account, no server, no sync — every project, task, folder, and tag lives on your machine as plain CSV files you can open, edit, or back up by hand.

## Features

- **Home board** — a top-level Kanban/table board where Projects, Folders, and standalone Tasks all sit as cards you can drag between statuses (To Do / In Progress / Done / Stash).
- **Projects** — each gets its own board with the same four fixed statuses, plus a details view for a description, links, and file attachments.
- **Folders** — group related tasks (e.g. a project phase) without giving up per-task status. A folder expands in place (in both Kanban and Table view) via its arrow, sorted by status then priority; clicking its name opens the folder's own page. A task filed in a folder shows its status as a small colored pill. Folders carry the same tags, priority, due date, links, and attachments a task does.
- **Table view** — toggle any board to a sortable, filterable spreadsheet-style list (type, title, tags, priority, due date, status), with inline editing.
- **Tags, priority, due dates, links, attachments** — tags are a single global pool usable on any task or folder, project-scoped or not.
- **Filter popover** — search plus multi-select Status, Priority, Due date, and Tag filters tucked behind one "Filter" button instead of a permanent row.
- **Save status light** — a persistent dot in the header glows green when everything's saved, amber while saving, and red on failure; hover the red light for the actual error and a button to copy it.
- **Claude Code integration** — enable "Claude Code project" on a project (in its details dialog) and point it at a local repo folder. Any task in that project gets a "Start with Claude" button that opens a Terminal window, `cd`s into the repo, and launches `claude` with the task's title and summary as the prompt — resuming your last Claude Code conversation there if one exists, or starting fresh otherwise. In Table view, select multiple tasks to launch Claude with all of them combined into one prompt.

Everything is stored as CSVs under `~/Library/Application Support/ledger/` (see [Data storage](#data-storage) below). In the app, **File → Open Data Folder** (⌘⇧O) jumps straight there.

## Requirements

- macOS (Apple Silicon or Intel) — this is a Mac-only Electron app; there is no Windows/Linux build and no browser mode.
- [Node.js](https://nodejs.org/) 20 or later, and npm.

## Getting started (cloning the repo)

```bash
git clone https://github.com/codycherrington/Ledger.git
cd Ledger
npm install
```

Nothing else to install — no global tooling, no accounts, no API keys, no env
vars. Optionally sanity-check the install with `npm test && npm run build`;
both should pass cleanly on a fresh clone with zero configuration.

From here you have two paths:

### Run the packaged Mac app

```bash
npm run app:install
```

This builds the frontend, ad-hoc signs the app, and installs it to `/Applications/Ledger.app`. Launch it from Spotlight or `/Applications` like any other Mac app from then on.

To build without installing (e.g. to inspect the bundle), use `npm run app:build` — output lands in `release/`.

### Run in development mode

```bash
npm run dev
```

This starts the Vite dev server and opens an Electron window pointed at it — hot reload on every save in `src/`, working against your real CSV data under `~/Library/Application Support/ledger/`. There is no browser fallback: opening the Vite URL directly in a browser tab won't work, since persistence goes through an Electron-only bridge (`window.boardFS`).

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

- `~/Library/Application Support/ledger/projects.csv`, `columns.csv`, `cards.csv`, `tags.csv`, `folders.csv` — one CSV per table, plain text, safe to open in a spreadsheet app or text editor.
- `~/Library/Application Support/ledger/attachments/` — uploaded files, named `<id>__<original name>`.
- This folder isn't part of the repo — it's your personal task data, computed per-user from your home directory, not git-ignored repo state. Back it up by copying the folder; there's no external sync.
- The dev server and any built/installed copy of the app share this same folder, so running both at once can race on saves — stick to one at a time.
- If you're upgrading a checkout that predates the rename from TaskTray to Ledger, or one that predates the portable data location entirely, your existing board is migrated automatically the first time the app loads: the old folder (`~/Library/Application Support/tasktray/`, or for very old checkouts the `data/` folder inside the repo) is copied (not moved) into the new location, then left in place as a backup.

## Claude Code skill

`claude-skill/ledger-tasks/` is a template [Claude Code](https://claude.com/claude-code) skill
that lets a Claude session read and write your real Ledger data by talking to it in plain
language ("add a task to my website project", "what's on my board", "mark that done") — no need
to open the app. It works through `scripts/ledger-cli.cjs`, a plain-Node CLI that reuses Ledger's
own CSV read/write code, so anything it writes is exactly what the app itself would have written.

It's a template, not active by default — install your own copy and point it at your clone:

```bash
cp -r claude-skill/ledger-tasks ~/.claude/skills/ledger-tasks
sed -i '' "s|<PATH_TO_LEDGER_REPO>|$(pwd)|g" ~/.claude/skills/ledger-tasks/SKILL.md
```

Full setup and usage details, including the CLI's command reference, are in
[`claude-skill/ledger-tasks/SKILL.md`](./claude-skill/ledger-tasks/SKILL.md). One caveat worth
knowing up front: Ledger only reads these CSVs once at startup, so if the app is open while the
CLI writes, its next autosave will overwrite what the CLI just wrote — quit and reopen Ledger
after using it (the CLI warns you about this automatically when it detects the app running).

## Architecture

For a deeper tour of how the pieces fit together (data flow, the Zustand store, drag-and-drop model, folder semantics), see [`CLAUDE.md`](./CLAUDE.md) — written for whoever (human or AI) picks this codebase up next.
