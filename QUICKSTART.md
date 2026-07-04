# Quickstart Guide

## Install & Run

**Mac app (recommended):**
```bash
npm install
npm run app:install
```
Then launch **TaskTray** from /Applications (or Spotlight). Data is stored as CSV files in `data/` in this project folder (git-ignored).

**Development (hot reload in the real app):**
```bash
npm run dev
```

Starts Vite and opens an Electron window pointed at it. Edits to `src/` hot-reload instantly, using your real CSV data.

**Build the frontend only:**
```bash
npm run build
```

## Git Setup

**Initialize repo:**
```bash
git init
git add .
git commit -m "initial commit"
```

**Connect to GitHub (after creating repo on GitHub):**
```bash
git remote add origin https://github.com/YOUR_USERNAME/tasktray.git
git branch -M main
git push -u origin main
```

## Common Git Commands

| Command | What it does |
|---|---|
| `git status` | See what's changed |
| `git add .` | Stage all changes |
| `git add <file>` | Stage a specific file |
| `git commit -m "message"` | Commit staged changes |
| `git push` | Push to remote |
| `git pull` | Pull latest from remote |
| `git log --oneline` | See commit history |
| `git checkout -b <branch>` | Create and switch to new branch |
| `git merge <branch>` | Merge branch into current |
| `git stash` | Temporarily shelve changes |
| `git stash pop` | Restore stashed changes |

## Tips

- All data (projects, columns, cards, tags) lives in CSV files at `data/` in this project folder (git-ignored), with uploaded files in `attachments/` — easy to back up, inspect, or edit. Dev mode and the installed app share the same data.
- Commit early and often — small commits are easier to debug.
