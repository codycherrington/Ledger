import { defineConfig } from 'vitest/config'

// Separate from vite.config.ts on purpose: the test config's coverage scope
// and environment concerns are unrelated to the app build/dev config, and
// keeping them apart avoids the tailwind/react plugins running under test.
export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      // Scoped to the code this suite actually exercises (business logic:
      // storage, persistence, the board store, shared utils) rather than the
      // React component tree, which this project verifies by hand via
      // `npm run dev` against real data (see CLAUDE.md/TESTING.md) — a global
      // percentage that averaged in untested components would be noise.
      include: ['electron/csv.cjs', 'electron/store.cjs', 'src/lib/**', 'src/store/**'],
      // A thin @dnd-kit/sortable wrapper — DOM/drag-and-drop wiring, not
      // business logic, and out of this suite's scope (see TESTING.md).
      exclude: ['src/lib/useSortableItem.ts'],
    },
  },
})
