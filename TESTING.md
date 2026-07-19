# Testing

Ledger has an automated unit test suite covering the app's business logic:
CSV serialization, the persistence layer, and the Zustand board store. It
does not cover React components — see [Scope](#scope) for why, and
[`CLAUDE.md`](./CLAUDE.md) for the manual verification loop that covers the UI.

## Running tests

```bash
npm test            # run the full suite once
npm run test:watch  # re-run on file changes
npm run test:coverage  # run once with a coverage report (text + html in coverage/)
```

Tests run under [Vitest](https://vitest.dev) with a `jsdom` environment (needed
because `src/store/persist.ts` reads `window.boardFS`). Config lives in
`vitest.config.ts`, separate from `vite.config.ts` since the test environment
and coverage scope aren't relevant to the app build.

## Layout

Tests live under `tests/`, mirroring the source tree:

```
tests/
  setup.ts                    # global setup: fakes window.boardFS before each test
  lib/                        # src/lib/* — pure utility functions
  electron/
    csv.test.ts                # electron/csv.cjs — CSV encode/parse
    store.test.ts               # electron/store.cjs — CSV load/save, legacy migrations, attachments
  store/
    board.test.ts               # src/store/board.ts — the whole Zustand store
    persist.test.ts             # src/store/persist.ts — the boardStorage() PersistStorage adapter
    attachments.test.ts         # src/store/attachments.ts — attachment blob helpers
    saveStatus.test.ts          # src/store/saveStatus.ts
```

## Scope

**Covered:** everything that isn't a React component — `src/lib/**`,
`src/store/**`, and `electron/csv.cjs` / `electron/store.cjs`. This is where
Ledger's actual invariants live: column ownership rules, the filed/unfiled
card state machine, cascade deletes, CSV round-tripping, and legacy-schema
migrations. Bugs here are silent-data-corruption bugs, which is exactly what
a test suite should guard against.

**Not covered:** React components (`src/components/**`, `src/routes/**`,
`App.tsx`) and the `useSortableItem` dnd-kit hook. Ledger's own
`CLAUDE.md` already documents the project's verification loop for these:
`npm run dev` against real data, since there's no browser fallback to spot
check in (persistence requires the Electron-only `window.boardFS` bridge).
Adding component tests would mean building a second, parallel harness
(React Testing Library + a mocked `@dnd-kit` `DndContext`) whose main value —
catching drag-and-drop regressions — is already covered more reliably by
actually dragging things in the running app. If that trade-off changes
(e.g. the component tree grows non-drag-and-drop logic worth locking down),
add `@testing-library/react` and put those tests under `tests/components/`
following the same layout.

## How real user data is kept out of harm's way

`electron/store.cjs` resolves `DATA_DIR` to `~/Library/Application
Support/ledger` — the user's real, irreplaceable task data (see
`CLAUDE.md`) — and also reads from `PREVIOUS_APP_DATA_DIR` (the old
TaskTray-named data folder) and `LEGACY_DATA_DIR` (a hardcoded path from
before the data location became portable at all) to migrate old checkouts.
Tests for this module must never touch any real location. Rather than mock
`node:fs` (which turned out to be unreliable — Vite's CJS interop let
`require('node:fs')` calls resolve to the real module regardless of
`vi.mock`), `store.cjs` honors three environment variable overrides:

```js
const DATA_DIR = process.env.LEDGER_DATA_DIR || DEFAULT_DATA_DIR
const PREVIOUS_APP_DATA_DIR = process.env.LEDGER_PREVIOUS_APP_DATA_DIR || '~/Library/Application Support/tasktray'
const LEGACY_DATA_DIR = process.env.LEDGER_LEGACY_DATA_DIR || '/…/tasktray/data'
```

None of these variables is ever set outside `tests/electron/store.test.ts`,
which points all three at disposable `mkdtemp` directories and asserts (in a
`beforeAll` guard) that each actually resolves under `os.tmpdir()` before
running anything — if that guard ever fails, every test in the file refuses
to run rather than risk writing to or reading from a real folder. This means
`store.cjs` tests exercise the real filesystem (real atomic writes, real
`readdirSync`, real `cpSync` for the migration path) rather than a
hand-rolled fake, while still being fully isolated.

`src/store/persist.ts` and `src/store/board.ts` are safe to test directly
without this concern: they only ever touch `window.boardFS`, which
`tests/setup.ts` fakes with an in-memory stand-in before every test.

## Coverage

`npm run test:coverage` scopes its report to the covered modules listed
above (`vitest.config.ts`'s `coverage.include`) rather than the whole repo —
a repo-wide percentage would just measure how much of the untested UI
happens to exist, not how well-tested the logic is. As of this writing that
scoped report sits around 94–99% statement/line coverage.
