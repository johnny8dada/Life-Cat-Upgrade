#!/usr/bin/env bash
# 北歐森林・人生規劃藍圖 — 跨平台個人資料 Private Repo 同步腳本 (macOS / Linux)
set -e

ACTION="${1:-push}"
REPO="${2:-johnny8dada/Life-Cat-Data}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WORKSPACE_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
DATA_DIR="$WORKSPACE_ROOT/data"
DATA_FILE="$DATA_DIR/life_blueprint.json"
BACKUP_FILE="$DATA_DIR/life_blueprint.backup.json"

mkdir -p "$DATA_DIR"

if [[ "$REPO" == http* ]]; then
  REMOTE_URL="$REPO"
else
  REMOTE_URL="https://github.com/$REPO.git"
fi

if [ -f "$DATA_FILE" ]; then
  cp "$DATA_FILE" "$BACKUP_FILE"
  python3 -c '
import json, sys
p = sys.argv[1]
with open(p, "r", encoding="utf-8") as f:
    d = json.load(f)
if isinstance(d, dict) and isinstance(d.get("settings"), dict) and d["settings"].get("apiKey"):
    d["settings"]["apiKey"] = ""
    with open(p, "w", encoding="utf-8") as f:
        json.dump(d, f, ensure_ascii=False, indent=2)
' "$DATA_FILE"
fi

cd "$DATA_DIR"
if [ ! -d ".git" ]; then
  git init
  git branch -M main
  git remote add origin "$REMOTE_URL"
else
  git remote set-url origin "$REMOTE_URL" 2>/dev/null || git remote add origin "$REMOTE_URL"
fi

cat > "$DATA_DIR/.git/info/exclude" << 'EOF'
# 私人資料 Repo 專用 exclude：只追蹤 life_blueprint.json，排除本機金鑰與快取
*
!life_blueprint.json
EOF

if [ "$ACTION" = "pull" ]; then
  git pull --rebase origin main
  echo "✅ 已成功從私人 Repo ($REPO) 拉取最新個人資料！"
elif [ "$ACTION" = "push" ]; then
  git add -f life_blueprint.json
  if ! git diff --cached --quiet; then
    git commit -m "Sync personal life blueprint ($(date '+%Y-%m-%d %H:%M:%S'))"
  fi
  git push -u origin main
  echo "✅ 已成功將個人資料推送至私人 Repo ($REPO)！"
else
  git status -sb
fi
