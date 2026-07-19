// electron/store.cjs's real default DATA_DIR is a per-user location under
// the current machine's home directory, and PREVIOUS_APP_DATA_DIR /
// LEGACY_DATA_DIR point at real, irreplaceable task data (see CLAUDE.md) —
// the former the old TaskTray-named data folder, the latter one specific
// machine's original hardcoded pre-portable path. To make this module safely
// testable, all three are overridable via env vars (test-only — never set in
// production) so these tests run against disposable temp directories on the
// real filesystem instead of mocking fs, and instead of ever touching a real
// location.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

const tmpDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ledger-store-test-'))
const tmpPreviousAppDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ledger-previous-app-test-'))
const tmpLegacyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ledger-legacy-test-'))
const tmpClaudeProjectsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ledger-claude-projects-test-'))
process.env.LEDGER_DATA_DIR = tmpDataDir
process.env.LEDGER_PREVIOUS_APP_DATA_DIR = tmpPreviousAppDir
process.env.LEDGER_LEGACY_DATA_DIR = tmpLegacyDir
process.env.LEDGER_CLAUDE_PROJECTS_DIR = tmpClaudeProjectsDir
// launchClaudeCode's real implementation shells out to `open` to launch
// Terminal.app and run the `claude` CLI — disabled so the test suite only
// ever inspects the generated script/prompt files, never actually opens a
// window or runs a real command.
process.env.LEDGER_DISABLE_CLAUDE_LAUNCH = '1'

const {
  DATA_DIR,
  saveState,
  loadState,
  putAttachment,
  getAttachment,
  deleteAttachment,
  hasExistingSession,
  launchClaudeCode,
} = await import('../../electron/store.cjs')

// Guardrail: if any of these ever points anywhere near a real data folder,
// every test in this file must refuse to run rather than risk touching real
// user data.
beforeAll(() => {
  if (!DATA_DIR.startsWith(os.tmpdir())) {
    throw new Error(`Refusing to run: DATA_DIR (${DATA_DIR}) is not a temp directory.`)
  }
  if (!tmpPreviousAppDir.startsWith(os.tmpdir())) {
    throw new Error(`Refusing to run: previous-app dir override (${tmpPreviousAppDir}) is not a temp directory.`)
  }
  if (!tmpLegacyDir.startsWith(os.tmpdir())) {
    throw new Error(`Refusing to run: legacy dir override (${tmpLegacyDir}) is not a temp directory.`)
  }
  if (!tmpClaudeProjectsDir.startsWith(os.tmpdir())) {
    throw new Error(`Refusing to run: Claude projects dir override (${tmpClaudeProjectsDir}) is not a temp directory.`)
  }
})

function resetDataDir() {
  fs.rmSync(DATA_DIR, { recursive: true, force: true })
  fs.mkdirSync(DATA_DIR, { recursive: true })
}

function resetPreviousAppDir() {
  fs.rmSync(tmpPreviousAppDir, { recursive: true, force: true })
  fs.mkdirSync(tmpPreviousAppDir, { recursive: true })
}

function resetLegacyDir() {
  fs.rmSync(tmpLegacyDir, { recursive: true, force: true })
  fs.mkdirSync(tmpLegacyDir, { recursive: true })
}

function resetClaudeProjectsDir() {
  fs.rmSync(tmpClaudeProjectsDir, { recursive: true, force: true })
  fs.mkdirSync(tmpClaudeProjectsDir, { recursive: true })
}

function writeCsv(file: string, contents: string) {
  fs.writeFileSync(path.join(DATA_DIR, file), contents, 'utf8')
}

function writePreviousAppCsv(file: string, contents: string) {
  fs.writeFileSync(path.join(tmpPreviousAppDir, file), contents, 'utf8')
}

function writeLegacyCsv(file: string, contents: string) {
  fs.writeFileSync(path.join(tmpLegacyDir, file), contents, 'utf8')
}

beforeEach(() => {
  resetDataDir()
  resetPreviousAppDir()
  resetLegacyDir()
  resetClaudeProjectsDir()
})

afterAll(() => {
  fs.rmSync(tmpDataDir, { recursive: true, force: true })
  fs.rmSync(tmpPreviousAppDir, { recursive: true, force: true })
  fs.rmSync(tmpLegacyDir, { recursive: true, force: true })
  fs.rmSync(tmpClaudeProjectsDir, { recursive: true, force: true })
  // launchClaudeCode always writes its script/prompt files under the real
  // os.tmpdir() (that part isn't overridable, unlike DATA_DIR) — sweep up
  // this run's leftovers so the suite doesn't litter the system temp dir.
  for (const f of fs.readdirSync(os.tmpdir())) {
    if (f.startsWith('ledger-claude-launch-') || f.startsWith('ledger-claude-prompt-')) {
      fs.rmSync(path.join(os.tmpdir(), f), { force: true })
    }
  }
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function emptyState(): Record<string, Record<string, any>> {
  return { projects: {}, columns: {}, cards: {}, tags: {}, folders: {} }
}

describe('loadState', () => {
  it('returns null when no data files exist yet', () => {
    expect(loadState()).toBeNull()
  })

  it('round-trips a full board through saveState -> loadState', () => {
    const state = {
      projects: {
        p1: {
          id: 'p1',
          name: 'Project One',
          description: 'desc',
          links: [{ id: 'l1', label: 'Docs', url: 'https://example.com' }],
          attachments: [],
          createdAt: 1000,
          updatedAt: 2000,
          columnOrder: ['c1', 'c2'],
          columnId: 'home1',
          claudeCodeEnabled: true,
          repoPath: '/Users/test/repo',
        },
      },
      columns: {
        c1: { id: 'c1', ownerType: 'project', ownerId: 'p1', name: 'To Do', color: 'slate', cardOrder: ['card1'] },
        home1: { id: 'home1', ownerType: 'home', ownerId: undefined, name: 'To Do', color: 'slate', cardOrder: ['p1'] },
      },
      cards: {
        card1: {
          id: 'card1',
          projectId: 'p1',
          folderId: undefined,
          columnId: 'c1',
          title: 'Do the thing',
          summary: 'a summary',
          priority: 'high',
          dueDate: '2026-08-01',
          tagIds: ['t1', 't2'],
          links: [],
          attachments: [],
          createdAt: 1500,
          updatedAt: 2500,
        },
      },
      tags: {
        t1: { id: 't1', name: 'urgent', color: 'red' },
      },
      folders: {
        f1: {
          id: 'f1',
          ownerType: 'home',
          ownerId: undefined,
          name: 'Phase 1',
          color: 'blue',
          description: 'folder desc',
          priority: 'med',
          dueDate: '2026-09-01',
          tagIds: ['t1'],
          links: [{ id: 'l2', label: 'Spec', url: 'https://example.com/spec' }],
          attachments: [],
          columnId: 'home1',
          taskIds: [],
          createdAt: 1200,
          updatedAt: 2200,
        },
      },
    }

    saveState(state)
    const loaded = loadState()!

    expect(loaded.projects.p1).toEqual(state.projects.p1)
    expect(loaded.cards.card1).toEqual(state.cards.card1)
    expect(loaded.columns.c1).toEqual(state.columns.c1)
    expect(loaded.tags.t1).toEqual(state.tags.t1)
    expect(loaded.folders.f1).toEqual(state.folders.f1)
  })

  it('skips rows with no id', () => {
    writeCsv('tags.csv', 'id,name,color\r\n,Orphan,red\r\nt1,Real,blue\r\n')
    for (const file of ['projects.csv', 'columns.csv', 'cards.csv', 'folders.csv']) {
      writeCsv(file, '')
    }
    const loaded = loadState()!
    expect(Object.keys(loaded.tags)).toEqual(['t1'])
  })

  it('defaults a project missing columnId to empty string (backfilled later by ensureFixedPhases)', () => {
    writeCsv(
      'projects.csv',
      'id,name,description,links,attachments,createdAt,updatedAt,columnOrder,columnId\r\n' +
        'p1,Legacy Project,,[],[],1000,1000,c1;c2,\r\n',
    )
    for (const file of ['columns.csv', 'cards.csv', 'tags.csv', 'folders.csv']) {
      writeCsv(file, '')
    }
    const loaded = loadState()!
    expect(loaded.projects.p1.columnId).toBe('')
    expect(loaded.projects.p1.columnOrder).toEqual(['c1', 'c2'])
  })

  it('defaults a legacy project row with no claudeCodeEnabled/repoPath columns to disabled/unset', () => {
    writeCsv(
      'projects.csv',
      'id,name,description,links,attachments,createdAt,updatedAt,columnOrder,columnId\r\n' +
        'p1,Legacy Project,,[],[],1000,1000,c1;c2,col1\r\n',
    )
    for (const file of ['columns.csv', 'cards.csv', 'tags.csv', 'folders.csv']) {
      writeCsv(file, '')
    }
    const loaded = loadState()!
    expect(loaded.projects.p1.claudeCodeEnabled).toBe(false)
    expect(loaded.projects.p1.repoPath).toBeUndefined()
  })

  it('falls back to an empty array when a JSON-encoded cell is malformed', () => {
    writeCsv(
      'cards.csv',
      'id,projectId,folderId,columnId,title,summary,priority,dueDate,tagIds,links,attachments,createdAt,updatedAt\r\n' +
        'card1,,,col1,Task,,,,,not valid json,[],1000,1000\r\n',
    )
    for (const file of ['projects.csv', 'columns.csv', 'tags.csv', 'folders.csv']) {
      writeCsv(file, '')
    }
    const loaded = loadState()!
    expect(loaded.cards.card1.links).toEqual([])
  })

  it('migrates legacy columns.csv rows that carry projectId instead of ownerType/ownerId', () => {
    writeCsv('columns.csv', 'id,projectId,name,color,cardOrder\r\nc1,p1,To Do,slate,\r\n')
    for (const file of ['projects.csv', 'cards.csv', 'tags.csv', 'folders.csv']) {
      writeCsv(file, '')
    }
    const loaded = loadState()!
    expect(loaded.columns.c1.ownerType).toBe('project')
    expect(loaded.columns.c1.ownerId).toBe('p1')
  })

  it('migrates legacy folder-owned columns into a flat taskIds list and remaps card columnIds', () => {
    // Pre-migration schema: a folder owned its own 4 sub-columns, and filed
    // cards lived in those columns' cardOrder rather than in a taskIds list.
    writeCsv(
      'folders.csv',
      'id,ownerType,ownerId,name,color,description,columnId,taskIds,createdAt,updatedAt\r\n' +
        'f1,home,,Phase 1,blue,,home-todo,,1000,1000\r\n',
    )
    writeCsv(
      'columns.csv',
      'id,ownerType,ownerId,name,color,cardOrder\r\n' +
        'home-todo,home,,To Do,slate,f1\r\n' +
        'folder-sub-todo,folder,f1,To Do,slate,card1\r\n',
    )
    writeCsv(
      'cards.csv',
      'id,projectId,folderId,columnId,title,summary,priority,dueDate,tagIds,links,attachments,createdAt,updatedAt\r\n' +
        'card1,,,folder-sub-todo,Filed task,,,,,[],[],1000,1000\r\n',
    )
    writeCsv('projects.csv', '')
    writeCsv('tags.csv', '')

    const loaded = loadState()!

    expect(loaded.folders.f1.taskIds).toEqual(['card1'])
    // The folder's own sub-column is discarded post-migration.
    expect(loaded.columns['folder-sub-todo']).toBeUndefined()
    // The card's status is remapped onto the real "To Do" column of the
    // folder's owner board (Home), matched by name.
    expect(loaded.cards.card1.columnId).toBe('home-todo')

    // Migration is persisted immediately so the on-disk schema doesn't linger stale.
    const reloaded = loadState()!
    expect(reloaded.folders.f1.taskIds).toEqual(['card1'])
  })
})

describe('migrateFromLegacyLocation (previous app name, TaskTray)', () => {
  it('copies CSVs and attachments from the previous-app dir when the portable dir is empty', () => {
    writePreviousAppCsv('tags.csv', 'id,name,color\r\nt1,urgent,red\r\n')
    for (const file of ['projects.csv', 'columns.csv', 'cards.csv', 'folders.csv']) {
      writePreviousAppCsv(file, '')
    }
    fs.mkdirSync(path.join(tmpPreviousAppDir, 'attachments'), { recursive: true })
    fs.writeFileSync(path.join(tmpPreviousAppDir, 'attachments', 'att1__notes.txt'), 'hello')

    const loaded = loadState()!

    expect(Object.keys(loaded.tags)).toEqual(['t1'])
    expect(fs.readFileSync(path.join(DATA_DIR, 'attachments', 'att1__notes.txt'), 'utf8')).toBe('hello')
  })

  it('copies, never moves — the previous-app dir is left untouched after migrating', () => {
    writePreviousAppCsv('tags.csv', 'id,name,color\r\nt1,urgent,red\r\n')
    for (const file of ['projects.csv', 'columns.csv', 'cards.csv', 'folders.csv']) {
      writePreviousAppCsv(file, '')
    }

    loadState()

    expect(fs.existsSync(path.join(tmpPreviousAppDir, 'tags.csv'))).toBe(true)
    expect(fs.readFileSync(path.join(tmpPreviousAppDir, 'tags.csv'), 'utf8')).toContain('urgent')
  })

  it('takes priority over the older hardcoded legacy dir when both have data', () => {
    writePreviousAppCsv('tags.csv', 'id,name,color\r\nnew1,from-tasktray,blue\r\n')
    for (const file of ['projects.csv', 'columns.csv', 'cards.csv', 'folders.csv']) {
      writePreviousAppCsv(file, '')
    }
    writeLegacyCsv('tags.csv', 'id,name,color\r\nold1,should-not-appear,red\r\n')
    for (const file of ['projects.csv', 'columns.csv', 'cards.csv', 'folders.csv']) {
      writeLegacyCsv(file, '')
    }

    const loaded = loadState()!

    expect(Object.keys(loaded.tags)).toEqual(['new1'])
  })
})

describe('migrateFromLegacyLocation (checkouts still on the old hardcoded path)', () => {
  it('copies CSVs and attachments from the legacy dir when the portable dir is empty', () => {
    writeLegacyCsv('tags.csv', 'id,name,color\r\nt1,urgent,red\r\n')
    for (const file of ['projects.csv', 'columns.csv', 'cards.csv', 'folders.csv']) {
      writeLegacyCsv(file, '')
    }
    fs.mkdirSync(path.join(tmpLegacyDir, 'attachments'), { recursive: true })
    fs.writeFileSync(path.join(tmpLegacyDir, 'attachments', 'att1__notes.txt'), 'hello')

    const loaded = loadState()!

    expect(Object.keys(loaded.tags)).toEqual(['t1'])
    expect(fs.readFileSync(path.join(DATA_DIR, 'attachments', 'att1__notes.txt'), 'utf8')).toBe('hello')
  })

  it('copies, never moves — the legacy dir is left untouched after migrating', () => {
    writeLegacyCsv('tags.csv', 'id,name,color\r\nt1,urgent,red\r\n')
    for (const file of ['projects.csv', 'columns.csv', 'cards.csv', 'folders.csv']) {
      writeLegacyCsv(file, '')
    }

    loadState()

    expect(fs.existsSync(path.join(tmpLegacyDir, 'tags.csv'))).toBe(true)
    expect(fs.readFileSync(path.join(tmpLegacyDir, 'tags.csv'), 'utf8')).toContain('urgent')
  })

  it('does not touch the portable dir if it already has data, even if the legacy dir also has data', () => {
    writeCsv('tags.csv', 'id,name,color\r\nnew1,keep-me,blue\r\n')
    for (const file of ['projects.csv', 'columns.csv', 'cards.csv', 'folders.csv']) {
      writeCsv(file, '')
    }
    writeLegacyCsv('tags.csv', 'id,name,color\r\nold1,should-not-appear,red\r\n')
    for (const file of ['projects.csv', 'columns.csv', 'cards.csv', 'folders.csv']) {
      writeLegacyCsv(file, '')
    }

    const loaded = loadState()!

    expect(Object.keys(loaded.tags)).toEqual(['new1'])
  })

  it('does nothing when the legacy dir does not exist', () => {
    fs.rmSync(tmpLegacyDir, { recursive: true, force: true })
    expect(loadState()).toBeNull()
    expect(fs.existsSync(tmpLegacyDir)).toBe(false)
  })

  it('does nothing when the legacy dir exists but has no data files either', () => {
    expect(loadState()).toBeNull()
  })
})

describe('saveState', () => {
  it('writes one CSV file per table into DATA_DIR', () => {
    saveState(emptyState())
    for (const file of ['projects.csv', 'columns.csv', 'cards.csv', 'tags.csv', 'folders.csv']) {
      expect(fs.existsSync(path.join(DATA_DIR, file))).toBe(true)
    }
  })

  it('writes via a temp file + rename rather than a direct write', () => {
    saveState(emptyState())
    // writeFileAtomic writes to "<file>.tmp" then renames over the real path
    // — after saveState returns, no ".tmp" file should remain.
    const leftoverTmp = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith('.tmp'))
    expect(leftoverTmp).toEqual([])
  })

  it('serializes list-of-id fields joined with ";"', () => {
    const state = emptyState()
    state.columns.c1 = { id: 'c1', ownerType: 'home', ownerId: undefined, name: 'To Do', color: 'slate', cardOrder: ['a', 'b', 'c'] }
    saveState(state)
    const csv = fs.readFileSync(path.join(DATA_DIR, 'columns.csv'), 'utf8')
    expect(csv).toContain('a;b;c')
  })
})

describe('attachments', () => {
  it('putAttachment then getAttachment round-trips name and bytes', () => {
    const data = new TextEncoder().encode('hello world').buffer
    putAttachment('att1', 'notes.txt', data)
    const result = getAttachment('att1')
    expect(result).not.toBeNull()
    expect(result!.name).toBe('notes.txt')
    expect(Buffer.from(result!.data).toString()).toBe('hello world')
  })

  it('sanitizes path-unsafe characters out of the stored filename', () => {
    putAttachment('att2', 'weird/name:here.txt', new ArrayBuffer(0))
    const result = getAttachment('att2')
    expect(result!.name).toBe('weird_name_here.txt')
  })

  it('getAttachment returns null for an unknown id', () => {
    expect(getAttachment('does-not-exist')).toBeNull()
  })

  it('deleteAttachment removes the file so a later get returns null', () => {
    putAttachment('att3', 'file.bin', new ArrayBuffer(4))
    deleteAttachment('att3')
    expect(getAttachment('att3')).toBeNull()
  })

  it('deleteAttachment on a missing id is a no-op rather than throwing', () => {
    expect(() => deleteAttachment('never-existed')).not.toThrow()
  })
})

describe('hasExistingSession', () => {
  it('returns false when no session directory exists for the repo path', () => {
    expect(hasExistingSession('/some/repo')).toBe(false)
  })

  it('returns true when the encoded session directory has at least one .jsonl file', () => {
    const encoded = '/some/repo'.replace(/\//g, '-')
    fs.mkdirSync(path.join(tmpClaudeProjectsDir, encoded), { recursive: true })
    fs.writeFileSync(path.join(tmpClaudeProjectsDir, encoded, 'session.jsonl'), '{}')
    expect(hasExistingSession('/some/repo')).toBe(true)
  })

  it('returns false when the session directory exists but has no .jsonl files', () => {
    const encoded = '/some/repo'.replace(/\//g, '-')
    fs.mkdirSync(path.join(tmpClaudeProjectsDir, encoded), { recursive: true })
    expect(hasExistingSession('/some/repo')).toBe(false)
  })
})

describe('launchClaudeCode', () => {
  function scriptContent(repoPath: string, prompt: string): string {
    const { scriptFile } = launchClaudeCode(repoPath, prompt)
    return fs.readFileSync(scriptFile, 'utf8')
  }

  it('writes an executable .command script and a separate prompt file', () => {
    const { scriptFile, promptFile } = launchClaudeCode('/some/repo', 'do the thing')
    expect(fs.existsSync(scriptFile)).toBe(true)
    expect(fs.existsSync(promptFile)).toBe(true)
    expect(fs.statSync(scriptFile).mode & 0o111).not.toBe(0)
    expect(fs.readFileSync(promptFile, 'utf8')).toBe('do the thing')
  })

  it('cds into the repo path and reads the prompt back via a quoted command substitution', () => {
    const script = scriptContent('/some/repo', 'do the thing')
    expect(script).toContain("cd '/some/repo'")
    expect(script).toMatch(/claude\s+"\$\(cat '.*'\)"/)
  })

  it('never passes --continue to the main claude invocation, session or no session', () => {
    const script = scriptContent('/some/repo', 'do the thing')
    expect(script).not.toMatch(/claude --continue/)
    expect(script).not.toContain('RECAP')
  })

  it('generates a recap from the last session via a non-interactive claude -p --continue call when a session exists', () => {
    const encoded = '/some/repo'.replace(/\//g, '-')
    fs.mkdirSync(path.join(tmpClaudeProjectsDir, encoded), { recursive: true })
    fs.writeFileSync(path.join(tmpClaudeProjectsDir, encoded, 'session.jsonl'), '{}')
    const script = scriptContent('/some/repo', 'do the thing')
    expect(script).toMatch(/RECAP="\$\(claude -p '.*' --continue/)
    // The main interactive call itself still never gets --continue — only
    // the recap subprocess does.
    expect(script).not.toMatch(/claude --continue/)
  })

  it('folds a produced recap into the prompt but falls back to the plain prompt if the recap call comes up empty', () => {
    const encoded = '/some/repo'.replace(/\//g, '-')
    fs.mkdirSync(path.join(tmpClaudeProjectsDir, encoded), { recursive: true })
    fs.writeFileSync(path.join(tmpClaudeProjectsDir, encoded, 'session.jsonl'), '{}')
    const script = scriptContent('/some/repo', 'do the thing')
    expect(script).toContain('if [ -n "$RECAP" ]')
    // $RECAP is only ever used as a double-quoted variable expansion, never
    // interpolated unquoted or eval'd — same shell-injection guard as the
    // prompt file mechanism below.
    expect(script).toMatch(/\$RECAP"/)
  })

  it('writes the prompt to its own file rather than interpolating it into the script', () => {
    // A prompt containing shell metacharacters must never appear literally in
    // the script's own source — only via the `cat` of its dedicated temp file
    // inside a double-quoted command substitution. This is the regression
    // test for the shell-injection risk this feature was designed against.
    const tricky = 'quote " backtick ` dollar $(whoami) newline\nend'
    const { scriptFile, promptFile } = launchClaudeCode('/some/repo', tricky)
    const script = fs.readFileSync(scriptFile, 'utf8')
    expect(script).not.toContain(tricky)
    expect(fs.readFileSync(promptFile, 'utf8')).toBe(tricky)
  })

  it('single-quotes a repo path that itself contains a single quote', () => {
    const script = scriptContent("/some/repo's folder", 'x')
    expect(script).toContain(`cd '/some/repo'\\''s folder'`)
  })
})
