---
name: sync-private-data
description: >-
  Use this skill whenever the user asks to upload, push, pull, or sync their personal life blueprint data (data/life_blueprint.json) to or from their private GitHub repository, or wants to sync desktop data with their iPhone App.
---

# Sync Personal Data with Private GitHub Repo (`sync-private-data`)

## Overview
This project separates the **Public App Architecture** (`johnny8dada/Life-Cat-Upgrade`) from the user's **Private Personal Data** (`data/life_blueprint.json`).
- The outer repository ignores `data/life_blueprint.json` via `.gitignore`.
- The `data/` folder serves as the designated local folder read automatically by `LifeBlueprint.exe` (Windows) and `LifeBlueprint-Mac.command` (macOS).
- This skill provides the standardized workflow and helper script to push/pull `data/life_blueprint.json` to/from the user's **Private GitHub Repository** (default: `https://github.com/johnny8dada/Life-Cat-Data.git`), keeping Windows, MacBook, and iPhone in sync.

---

## Quick Start

Run the PowerShell helper script from the workspace root (`d:\Antigravity project\Life-Cat-Upgrade`):

```powershell
# Push local personal data (data/life_blueprint.json) to the Private Repo
powershell -ExecutionPolicy Bypass -File .\.agents\skills\sync-private-data\scripts\sync_private_data.ps1 -Action push -Repo "johnny8dada/Life-Cat-Data"

# Pull latest personal data from the Private Repo (e.g. after editing on iPhone)
powershell -ExecutionPolicy Bypass -File .\.agents\skills\sync-private-data\scripts\sync_private_data.ps1 -Action pull -Repo "johnny8dada/Life-Cat-Data"
```

---

## Step-by-Step Agent Workflow

When the user asks to upload/update their personal data to their private repo (e.g., *"幫我把個人資料推到私人 repo"* or *"同步私人資料"*):

### Step 1: Verify & Sanitize `data/life_blueprint.json`
1. Confirm `data/life_blueprint.json` exists and contains valid JSON with `pillars` and `tasks`.
2. Ensure `settings.apiKey` inside `data/life_blueprint.json` is empty (`""`) before committing or uploading (the real Gemini API key must remain in `data/apikey.local` only).

### Step 2: Check Private Repository Target
1. Check if `data/github_sync.local` exists or if `data/.git` already has a `remote.origin.url` configured.
2. Default private repo name is `johnny8dada/Life-Cat-Data` (`https://github.com/johnny8dada/Life-Cat-Data.git`) unless the user specifies another repository name.

### Step 3: Execute Sync (`push` or `pull`)
Run [sync_private_data.ps1](./scripts/sync_private_data.ps1) (or run the Git commands inside `data/`):

1. **Initialize `data/` as an independent Git repo (if `data/.git` does not exist)**:
   - Configures `data/.git/info/exclude` to ignore `*` except `!life_blueprint.json` so ONLY `life_blueprint.json` is tracked in the Private Repo without affecting the outer public repository's `.gitignore`.
   - Runs `git init`, `git branch -M main`, and sets `origin` to `https://github.com/<Repo>.git`.
2. **If Action is `push` (Desktop ➔ Private Repo ➔ iPhone)**:
   - Stages `life_blueprint.json` inside `data/`.
   - Commits with a timestamped message: `Update personal life blueprint (YYYY-MM-DD HH:mm:ss)`.
   - Pushes to `origin main` (`git push -u origin main`).
3. **If Action is `pull` (iPhone ➔ Private Repo ➔ Desktop)**:
   - Backs up current `data/life_blueprint.json` to `data/life_blueprint.backup.json`.
   - Runs `git pull --rebase origin main` inside `data/` so `data/life_blueprint.json` is updated with edits made on iPhone.

### Step 4: Verify iPhone Linkage
Remind or confirm for the user:
- On **iPhone**, open the Home Screen App ➔ **「☁️ 同步設定」** ➔ ensure **個人資料 Private Repo** is set to the same repo name (e.g. `johnny8dada/Life-Cat-Data`) and tap **「⬇️ 從 Private Repo 拉取」** to immediately receive the updated data.
