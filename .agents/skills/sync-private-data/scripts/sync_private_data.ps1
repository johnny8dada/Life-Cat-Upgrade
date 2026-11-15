param(
    [ValidateSet("push", "pull", "status")]
    [string]$Action = "push",
    [string]$Repo = ""
)

$ErrorActionPreference = "Stop"
$WorkspaceRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..\..")).Path
$DataDir = Join-Path $WorkspaceRoot "data"
$DataFile = Join-Path $DataDir "life_blueprint.json"
$BackupFile = Join-Path $DataDir "life_blueprint.backup.json"
$SyncConfigFile = Join-Path $DataDir "github_sync.local"

if (-not (Test-Path $DataDir)) {
    Write-Error "找不到 data/ 資料夾: $DataDir"
    exit 1
}

# 1. 決定目標 Private Repo 名稱
if ([string]::IsNullOrWhiteSpace($Repo)) {
    if (Test-Path $SyncConfigFile) {
        try {
            $cfg = Get-Content $SyncConfigFile -Raw -Encoding UTF8 | ConvertFrom-Json
            if ($cfg.repo -and $cfg.repo -ne "johnny8dada/Life-Cat-Upgrade") {
                $Repo = $cfg.repo
            }
        } catch {}
    }
    if ([string]::IsNullOrWhiteSpace($Repo)) {
        $Repo = "johnny8dada/Life-Cat-Data"
    }
}

$RemoteUrl = if ($Repo -match "^https?://") { $Repo } else { "https://github.com/$Repo.git" }

# 2. 檢查並清除 life_blueprint.json 內的 apiKey 欄位（確保安全），並在 push 時更新 lastModifiedAt 時間戳
if (Test-Path $DataFile) {
    Copy-Item $DataFile $BackupFile -Force
    try {
        $jsonObj = Get-Content $DataFile -Raw -Encoding UTF8 | ConvertFrom-Json
        $changed = $false
        if ($jsonObj.settings -and $jsonObj.settings.apiKey) {
            $jsonObj.settings.apiKey = ""
            $changed = $true
            Write-Host "🔒 已自動清除 life_blueprint.json 中的 API Key 欄位。"
        }
        if ($Action -eq "push") {
            $nowMs = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
            $jsonObj | Add-Member -NotePropertyName "lastModifiedAt" -NotePropertyValue $nowMs -Force
            $changed = $true
        }
        if ($changed) {
            $cleanJson = $jsonObj | ConvertTo-Json -Depth 20
            [System.IO.File]::WriteAllText($DataFile, $cleanJson, (New-Object System.Text.UTF8Encoding($false)))
        }
    } catch {
        Write-Warning "JSON 檢查略過: $_"
    }
} else {
    if ($Action -eq "push") {
        Write-Error "找不到個人資料檔 data/life_blueprint.json，無法執行推送。"
        exit 1
    }
}

Push-Location $DataDir
try {
    # 3. 若 data/.git 尚未初始化，自動建立獨立 Git 倉庫
    if (-not (Test-Path (Join-Path $DataDir ".git"))) {
        Write-Host "🌱 正在將 data/ 資料夾初始化為獨立的私人資料 Git 倉庫..."
        git init
        git branch -M main
        git remote add origin $RemoteUrl
    } else {
        $existingRemote = ""
        try { $existingRemote = (git remote get-url origin 2>$null) } catch {}
        if ([string]::IsNullOrWhiteSpace($existingRemote)) {
            git remote add origin $RemoteUrl
        } elseif ($existingRemote -ne $RemoteUrl) {
            git remote set-url origin $RemoteUrl
        }
    }

    # 使用 .git/info/exclude 設定私人 Repo 只追蹤 life_blueprint.json，不干擾外層公開 Repo 的 .gitignore
    $ExcludeFile = Join-Path $DataDir ".git\info\exclude"
    $excludeContent = @"
# 私人資料 Repo 專用 exclude：只追蹤 life_blueprint.json，排除本機金鑰與快取
*
!life_blueprint.json
"@
    Set-Content -Path $ExcludeFile -Value $excludeContent -Encoding UTF8

    if ($Action -eq "status") {
        Write-Host "📦 目前私人資料 Repo 遠端網址: $(git remote get-url origin)"
        git status -sb
        exit 0
    }

    if ($Action -eq "pull") {
        Write-Host "⬇️ 正在從私人 Repo ($RemoteUrl) 拉取最新個人資料..."
        git pull --rebase origin main
        Write-Host "✅ 已成功從私人 Repo 更新本地 data/life_blueprint.json！"
        exit 0
    }

    if ($Action -eq "push") {
        git add -f life_blueprint.json
        $status = git status --porcelain
        if (-not [string]::IsNullOrWhiteSpace($status)) {
            $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
            git commit -m "Sync personal life blueprint ($ts)"
            Write-Host "📝 已建立個人資料更新 Commit ($ts)"
        } else {
            Write-Host "ℹ️ 本地 life_blueprint.json 內容無新變更，準備確認遠端同步狀態..."
        }

        Write-Host "⬆️ 正在推送個人資料至私人 Repo: $RemoteUrl ..."
        git push -u origin main
        Write-Host "✅ 成功！您的個人資料已同步至私人 Repo ($Repo)，現在可在 iPhone 點擊「⬇️ 從 Private Repo 拉取」同步！"
    }
} finally {
    Pop-Location
}
