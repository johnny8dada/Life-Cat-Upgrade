# 📂 個人資料指定資料夾 (`data/`)

此資料夾為 **「北歐森林・人生規劃藍圖」** 讀取個人資料的指定位置。

## 🔒 隱私保護機制（App 架構與個人資料完全分離）
為了讓主專案 (`Life-Cat-Upgrade`) 可以安心設為 **Public（公開）**，主專案的 `.gitignore` 已經忽略此資料夾內的所有個人檔案。

您只要將您的個人資料檔 **`life_blueprint.json`** 放入此 `data/` 資料夾下（路徑為 `data/life_blueprint.json`），啟動 `LifeBlueprint.exe`（Windows）或 `LifeBlueprint-Mac.command`（MacBook）時，程式就會自動讀取並即時儲存您的個人資料！

---

## 💡 搭配個人 Private Repo 的兩種推薦用法

### 方式一：將此 `data/` 資料夾直接連結至您的 Private Repo（電腦端最推薦）
您可以在 GitHub 建立一個 **Private（私人）** 儲存庫（例如命名為 `Life-Cat-Data`），專門存放您的 `life_blueprint.json`：
- 在新電腦下載公開的主程式後，直接將您的私人資料 Repo 放入 `data/` 資料夾，或把裡面的 `life_blueprint.json` 複製進來即可。

### 方式二：透過 App 內建「☁️ 跨裝置雲端同步」直接讀寫您的 Private Repo（iPhone / 電腦皆適用）
1. 打開 App 右上角 **「跨裝置與備份」**。
2. 在 **「GitHub 私人資料倉庫路徑 (Owner/Private-Repo)」** 填入您的私人 Repo（例如 `johnny8dada/Life-Cat-Data`）。
3. 填入您的 GitHub Personal Access Token（需勾選 `repo` 權限）。
4. 點擊 **「⬇️ 從雲端拉取最新」** 或 **「⬆️ 推送目前藍圖至雲端」**，程式就會自動從您的 Private Repo 下載個人資料並寫入本機 `data/life_blueprint.json`！
