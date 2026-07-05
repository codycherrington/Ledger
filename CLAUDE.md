# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

TaskTray is a local-only, Mac-only Electron Kanban/task manager. No account, no server, no browser mode — it only runs inside its own Electron shell because persistence goes through `window.boardFS` (exposed via `electron/preload.cjs`), which isn't available in a plain browser tab.

## Commands

```bash
npm run dev          # Vite dev server + Electron window pointed at it (hot reload, real CSV data) — the only supported way to develop
npm run build         # tsc -b && vite build — frontend only, no Electron packaging
npm run app           # build + launch Electron directly, no install
npm run app:build     # build + electron-builder --dir (unsigned, to release/)
npm run app:install   # scripts/package-mac.sh — build, ad-hoc codesign, install to /Applications/TaskTray.app
npm run lint          # oxlint
npm test              # vitest run — unit tests for src/lib, src/store, electron/csv.cjs, electron/store.cjs
npm run test:watch    # vitest, watch mode
```

The unit suite (see [`TESTING.md`](./TESTING.md)) covers business logic — the
board store, persistence adapter, and CSV serialization — but not React
components. For UI changes, `npm run dev` against real data is still the
verification loop: there's no browser fallback to spot-check in. When
testing against the real `data/` folder by hand (not via the test suite,
which never touches it — see TESTING.md), back it up first
(`cp -r data /tmp/...`) since it's the user's real, irreplaceable task data,
not fixtures.

`electron/store.cjs`'s `DATA_DIR`/`LEGACY_DATA_DIR` honor `TASKTRAY_DATA_DIR`/
`TASKTRAY_LEGACY_DATA_DIR` env var overrides used only by its test file to
redirect I/O to disposable temp directories — never set these when actually
running the app.

## Architecture

**Data flow:** `electron/store.cjs` (main process) reads/writes CSV files in `~/Library/Application Support/tasktray/` (`DATA_DIR` — portable, computed from `os.homedir()`, the same for the dev server and any built/installed copy of the app) → exposed over IPC (`board:load`, `board:save`, `attachment:*`) → bridged into the renderer as `window.boardFS` by `electron/preload.cjs` → wrapped as a Zustand `PersistStorage` in `src/store/persist.ts` → backs the single Zustand store in `src/store/board.ts`. Every store mutation triggers a full-state `saveState` write — there's no incremental/diffed persistence. `src/store/saveStatus.ts` is a small separate store tracking saving/saved/error (plus the last error's message, shown on hover in `SaveStatusLight.tsx`) for the UI indicator; it's deliberately not part of the persisted board state (see comment in that file for why). `src/store/viewMode.ts` is a similar ephemeral, unpersisted store — a single app-wide board/table setting (not keyed per board) so the toggle behaves as one consistent switch across every board you navigate to, for the life of the running app.

Checkouts from before `DATA_DIR` became portable had it hardcoded to one specific machine's home directory and project folder (`LEGACY_DATA_DIR` in `store.cjs`). `loadState()` calls `migrateFromLegacyLocation()` first: if the portable location has no data yet but that legacy path does, it copies (never moves — the legacy folder is left in place) the CSVs and attachments over, so upgrading this file on that one original machine doesn't strand its existing board.

One CSV per table: `projects.csv`, `columns.csv`, `cards.csv`, `tags.csv`, `folders.csv`. List-of-id fields are `;`-joined (nanoid's alphabet never contains `;`); nested structures (links, attachment metadata) are JSON-encoded into a single CSV cell (`electron/csv.cjs` / `electron/store.cjs`). Attachments are separate files in `data/attachments/`, named `<id>__<original name>`. `electron/store.cjs` carries legacy-schema read fallbacks (old `columns.csv` had `projectId` instead of `ownerType`/`ownerId`; old `folders.csv` had per-folder sub-columns instead of a flat `taskIds` list) — `loadState()` migrates and immediately re-saves so the on-disk schema doesn't linger stale.

**Domain model** (`src/types.ts`): everything placeable on a board is a `BoardItem` — a `{ kind: 'project' | 'folder' | 'task', ... }` discriminated union wrapping a `Project`, `Folder`, or `Card`. A `Column` belongs to either the Home singleton or a `Project` (`ColumnOwnerType = 'home' | 'project'`) — **folders do not own columns**. A `Folder` is a flat, ordered `taskIds` list, not its own board; it sits as a card inside its owner's board (Home or a project) via its own `columnId`. Folders carry the same descriptive attributes as a `Card` — `priority`, `dueDate`, `tagIds`, `links`, `attachments` — everything except a checklist, which was removed from the app entirely (see `src/store/board.ts`'s `toggleFolderTag`/`addFolderLink`/`addFolderAttachment` etc., mirroring the Card equivalents). A `Card` can belong to a project (`projectId`, optional — undefined for standalone/Home-level tasks) and/or be filed inside a folder (`folderId`, optional); a card's `columnId` is always its status, but while `folderId` is set that status is display-only (shown as a colored pill on the card) since the card isn't in any column's `cardOrder` — it's in the folder's `taskIds` instead. `Tag` is a single global pool (not scoped to a project).

**Columns are fixed, not user-defined.** `FIXED_COLUMNS` in `src/store/board.ts` hardcodes exactly four phases: `To Do`, `In Progress`, `Done`, `NULLSPACE`. Every board owner (Home, each project) always has all four. `ensureFixedPhases` (run in `onRehydrateStorage`) backfills any missing fixed column and places any project not yet sitting in a Home column into Home's "To Do". `selectOwnerColumns` always returns columns in `FIXED_COLUMNS` order regardless of what's in a project's `columnOrder`; that array is only ever a membership list, never a render order.

**Routing** (`src/App.tsx`): three routes — `/` (`Home.tsx`), `/project/:projectId` (`Board.tsx`), and `/folder/:folderId` (`FolderBoard.tsx`). `Home.tsx`/`Board.tsx` are thin wrappers around `src/components/BoardShell.tsx`, the shared board/table UI (parameterized by `ownerType`/`ownerId`). `FolderBoard.tsx` wraps `src/components/FolderBoardShell.tsx` instead — a sibling to `BoardShell.tsx`, scoped to one folder's `taskIds` rather than a real column-owning board, with its own `DndContext` (folders don't own columns, so it groups the folder's tasks by each card's `columnId` instead of a column's `cardOrder`). Folders can still also expand inline in place on whichever board they sit in (see `FolderCard.tsx`: the arrow toggles the inline expand — its tasks ordered by status then priority via `sortFolderTasksForDisplay` — and the folder name opens the folder's own page, always in whichever board/table mode `src/store/viewMode.ts` currently holds, same as any other navigation, never forcing a specific view) — both remain valid ways to view a folder's tasks.

**`BoardShell.tsx`** owns: the Kanban/Table view toggle, search/priority/tag filter state (`FilterBar.tsx`, a popover — not an always-visible row), the `@dnd-kit` `DndContext` and all drag handling, and mounts `GlobalAddButton.tsx` (a single fixed-position "+" that creates directly into the board's "To Do" column, replacing what used to be per-column add controls).

**Drag-and-drop containers** (`BoardShell.tsx`): an item being dragged can land in one of two container kinds — a column, or a folder's expanded task-list drop zone (registered by `FolderCard`/`FolderTaskList` as a droppable with id `folder-drop:<folderId>`, kept deliberately distinct from the folder card's own sortable id so "drag the folder between columns" and "drop a task onto/into the folder" never collide). `resolveDropTarget`/`resolveActiveLocation` normalize both shapes into one `DropTarget` type so the handlers don't special-case each one. Filing a task into a folder or unfiling it back to a column go through dedicated store actions (`fileTaskInFolder` / `unfileTaskFromFolder`), not the generic `moveItem` — a filed task isn't in any column's `cardOrder`, so routing it through `moveItem` would duplicate it. The same care applies to status changes made via the detail dialog or table view (see `setCardStatus`) — check `card.folderId` before deciding whether to physically move the card or just update its status field.

**State selectors** live at the bottom of `src/store/board.ts` (`selectOwnerColumns`, `selectColumnItems`, `selectFolderTasks`, `selectAllTags`, `resolveItem`, `boardItemId`, `boardItemTitle`) rather than inline in components — follow this pattern for new derived-data reads rather than filtering `Object.values(...)` ad hoc in components.

**Card/Project/Folder detail dialogs** all follow the same shape: a single (i) info icon (not a "..." menu — `Menu.tsx`'s default trigger was removed since nothing uses it anymore) opens a dialog with the entity's editable fields, and a "Delete" action lives inside that dialog rather than a separate menu. `LinksEditor.tsx` and `AttachmentsEditor.tsx` are shared, prop-driven (not store-coupled) components used by both `CardDetailDialog.tsx` and `ProjectDetailDialog.tsx`.

**Styling:** Tailwind v4 (via `@tailwindcss/vite`), dark theme only, `clsx` for conditional classes. Custom title-bar drag regions use `app-drag` / `no-drag` classes because the window uses `titleBarStyle: 'hiddenInset'` — any new full-width header bar or fixed-position control (e.g. `GlobalAddButton`) needs the same treatment. Semantic color mappings (priority, status) live in `src/lib/colors.ts` as `PRIORITY_COLOR`/`STATUS_COLOR` — reuse these rather than re-deriving red/amber/green/slate meaning per component.

**IPC surface is intentionally small** — `main.cjs` wires exactly 5 handlers (`board:load`, `board:save`, `attachment:put/get/delete`). New persisted concerns (e.g. a new table) means adding both a `TABLES` entry in `store.cjs` and updating the `partialize` list in `src/store/board.ts`'s persist config — both must stay in sync or new fields silently won't save.

**Window lifecycle:** closing the window does not quit the app on macOS (`window-all-closed` only calls `app.quit()` off-darwin) — standard mac behavior, the app stays running until Cmd+Q or Quit from the menu.
