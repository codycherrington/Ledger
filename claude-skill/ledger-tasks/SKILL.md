---
name: ledger-tasks
description: >
  Use this skill whenever the user wants to talk about, create, or manage their tasks, folders, or
  projects in Ledger, their local Mac Kanban app. Triggers include: "add a task to my X project",
  "what's on my board", "create a project in Ledger", "file that under Y", "mark that done", "what
  do I have in progress", or any request to read or change their real Ledger data. Always go
  through the CLI described here rather than guessing at Ledger's CSV format or editing its files
  by hand.
---

# Ledger Tasks

> **Setup required before this skill does anything useful.** See [Setup](#setup) below — you need
> to fill in the path to your own Ledger clone once, after copying this file into place.

Ledger is a local-only, Mac-only Electron Kanban app. It has no server and no API — its only
durable storage is a set of CSV files at `~/Library/Application Support/ledger/` (`projects.csv`,
`columns.csv`, `cards.csv`, `tags.csv`, `folders.csv`). This skill is the standard way for a Claude
session to read or change that real data on the user's behalf, without needing Ledger's own GUI
open.

**Never hand-edit those CSVs and never guess at the format.** Use the CLI below for every read and
write. It reuses Ledger's own serialization code (`electron/store.cjs`) and reimplements the same
invariants the app enforces (fixed columns, id generation, folder-filing rules, delete cascades),
so a write from here produces exactly the same shape of data the app would have written itself.

## Setup

This file ships inside the Ledger repo (`claude-skill/ledger-tasks/SKILL.md`) as a template — it
isn't active until you install a copy of it into a Claude Code skills folder and point it at your
own clone.

1. Make sure you've cloned Ledger and run `npm install` at least once (see the repo's `README.md`
   if not).
2. From inside your Ledger clone, copy this skill folder into place. For a skill that works from
   any Claude Code session regardless of which project you're in:
   ```bash
   cp -r claude-skill/ledger-tasks ~/.claude/skills/ledger-tasks
   ```
   Or, to scope it to one specific project instead, copy it to that project's `.claude/skills/`
   directory instead of `~/.claude/skills/`.
3. Replace every `<PATH_TO_LEDGER_REPO>` placeholder in your copy with the absolute path to your
   Ledger clone. Run this from inside the Ledger repo (adjust the destination path if you used the
   project-scoped location in step 2):
   ```bash
   sed -i '' "s|<PATH_TO_LEDGER_REPO>|$(pwd)|g" ~/.claude/skills/ledger-tasks/SKILL.md
   ```
4. Start a new Claude Code session and ask it about your Ledger tasks — this skill should now
   load automatically.

## The CLI

```
node <PATH_TO_LEDGER_REPO>/scripts/ledger-cli.cjs <command> [args...]
```

Run it with `help` (or no arguments) for the full command reference at any time — treat that as the
source of truth if this document and the CLI's own output ever disagree. Every command prints JSON
to stdout: `{ "ok": true, "command": ..., "result": ... }` on success, or
`{ "ok": false, "error": "..." }` with exit code 1 on failure. Parse `ok` before trusting `result`.

### Command cheatsheet

```
list-projects
list-folders    [--home | --project <id>]
list-tasks      [--home | --project <id>] [--folder <id>] [--unfiled] [--status <name>]
show <id>

create-project  --name <name> [--description <text>] [--status <name>] [--repo-path <path>] [--claude-code]
create-folder   (--home | --project <id>) --name <name> [--status <name>] [--description <text>]
                [--priority low|med|high] [--due-date yyyy-mm-dd] [--tags a,b,c]
create-task     (--home | --project <id>) --title <title> [--folder <id>] [--status <name>]
                [--summary <text>] [--priority low|med|high] [--due-date yyyy-mm-dd] [--tags a,b,c]

update-task     <id> [--title] [--summary] [--clear-summary] [--priority] [--clear-priority]
                [--due-date] [--clear-due-date] [--status <name>]
update-folder   <id> [--name] [--description] [--color] [--priority] [--clear-priority]
                [--due-date] [--clear-due-date] [--status <name>]
update-project  <id> [--name] [--description] [--status <name>] [--repo-path] [--claude-code true|false]

file-task       <id> --folder <folderId>
unfile-task     <id> [--status <name>]          (defaults to the task's current status)

add-tag         <taskId|folderId> --tag <name>  (creates the tag if it doesn't exist yet)
remove-tag      <taskId|folderId> --tag <name>
add-link        <projectId|folderId|taskId> --label <label> --url <url>

delete-task     <id>
delete-folder   <id>   (unfiles its tasks back to the board — doesn't delete them)
delete-project  <id>   (deletes its own columns, its folders, and every task inside them)
```

Status names are always one of: `To Do`, `In Progress`, `Done`, `Stash` (case-insensitive, matched
exactly against those four — there's no custom-column support, Ledger's columns are fixed).
Priority is `low`, `med`, or `high`.

## The data model, briefly

- **Everything lives under Home or a Project.** A card's/folder's/project's board owner is either
  the single Home board or one specific project — pass `--home` or `--project <id>` accordingly.
- **A Folder is a flat task list, not its own board.** It has no sub-columns. Its own `--status`
  is just where the folder *card itself* sits on its owner's board. A task filed inside a folder
  (`file-task`) keeps its own independent `--status` — shown as a colored pill, not a placement —
  so filing a task doesn't change what column it's "in."
- **Tags are one global pool**, shared across every task and folder regardless of project.
- **Attachments aren't supported by this CLI** (binary files, not worth the complexity here) — if
  the user needs to attach a file to something, tell them to do that in the app itself.

## Before you act

1. **Resolve names to ids first.** Nobody types Ledger's ids from memory. If asked to "add a task
   to my website project," run `list-projects` (or `show` on a project you already have the id
   for) to find the right id before calling `create-task`. If more than one plausible match exists,
   ask which one rather than guessing.
2. **Creates and updates don't need extra confirmation** beyond the normal back-and-forth of the
   conversation — they're exactly what the user is asking for when they describe a task in chat.
3. **Deletes need an explicit confirmation first**, the same way the app itself pops a confirm
   dialog before deleting anything. Say what will be removed (`delete-project` in particular cascades
   to every folder and task inside it — mention the counts from a `show`/`list` first) and wait for
   a yes before running the delete command.
4. **Check the `warning` field on every write.** The CLI detects whether Ledger's Electron process
   looks like it's running (`Ledger.app` or its dev server) and adds a warning if so — the app only
   reads these CSVs once at startup and has no live file-watching, so if it's open, the very next
   edit made in the GUI will silently overwrite whatever this CLI just wrote. If you see that
   warning, tell the user: ask them to quit and reopen Ledger to pick up the change, and avoid using
   the GUI to edit anything else in between.
5. **Report back concisely** — after a write, say what happened in plain language ("Added 'Buy
   milk' to your Home board, To Do"), not the raw JSON.
