# 🦌🐱 北歐森林・人生規劃藍圖 (Life-Cat-Upgrade)

一款採用 **北歐式簡約插圖風（Scandinavian Minimalist Illustration）** 的三平台共用人生規劃系統（支援 **Windows 桌面版**、**MacBook 桌面版** 與 **Apple iPhone / iOS 獨立 App 版**）。由**北歐森林引路鹿**與**暖窩貓咪**（以及小刺蝟、小松鼠、北歐小山雀）陪伴，在繁忙的生活中梳理人生重大項目、日常實踐筆記與跨領域的隱藏關聯。

## ✨ 核心功能
- **🌲 人生大項目與細節任務規劃**：自由建立人生各大領域（如自我成長、伴侶關係、家庭生活、娛樂充電等）與具體細節任務。
- **📓 個人紀錄筆記本（Cat Notebook）**：每個任務皆有獨立筆記本，支援分類記錄「📚 查到的資訊」、「🌿 日常實踐紀錄」、「💡 靈感與反思」。
- **🌰 彈性進度表與自我評分（Optional Tracker）**：每個任務皆可自由決定是否啟用進度表、1–10 分自我評分與具體小步驟清單，或保持無壓力的純筆記模式。
- **🪐 互動式星環關聯藍圖（Constellation Blueprint）**：
  - 採用北歐星環佈局與智慧避障曲線，支援電腦滑鼠滾輪縮放、拖曳平移，以及 **iPhone 單指拖曳、雙指捏合縮放（Pinch-to-Zoom）**。
  - 預設半透明待機連線；點選任一項目即可點亮其發射出去的關聯線、線上標籤與連到的目標項目；雙擊連線或點擊「✎ 編輯」可隨時修改關聯內容。
- **✨ Gemini AI 森林智者整合**：
  - 支援 Google Gemini API（`gemini-3.8-flash` / `gemini-3.8-pro` / `gemini-3.5-pro`）即時串流分析（SSE Streaming）與 Google AI Pro 網頁版 Prompt 橋接模式。
  - 內建「🐾 低調幕後觀察窗」，可即時檢視 API 呼叫狀態與模型生成內容串流。
- **☁️ 跨裝置 GitHub 雲端同步（Windows / MacBook / iPhone 共用資料）**：
  - 內建 GitHub API 雲端拉取（Pull）與推送（Push），並支援修改後自動同步，讓電腦與手機隨時共享最新筆記。

---

## 🚀 三平台啟動方式（同一個 GitHub Repo 完整支援）

### 1. 💻 Windows 桌面版（免安裝 Portable）
- 直接雙擊專案根目錄的 **`LifeBlueprint.exe`** 即可開啟無網址列的獨立桌面視窗。
- 所有修改皆即時自動寫入本地 `data/life_blueprint.json`。

### 2. 🍎 MacBook (macOS) 桌面版
- 在 MacBook 下載或 `git clone` 此專案後，直接雙擊 **`LifeBlueprint-Mac.command`** 即可啟動本地伺服器並開啟獨立桌面視窗（自動支援 Chrome / Edge / Brave App 模式或 Safari）。
- 初次在 macOS 雙擊若遇到權限提示，可在終端機執行一次：
  ```bash
  chmod +x LifeBlueprint-Mac.command
  ```

### 3. 📱 Apple iPhone / iPad (iOS 主畫面獨立 App 版)
1. 在 GitHub Repo 進入 **Settings ➔ Pages**，將 Source 設為 `Deploy from a branch` ➔ 選擇 `main` 分支（`/(root)`）並儲存。
2. 用 iPhone 的 **Safari** 開啟您的專屬網址：
   `https://johnny8dada.github.io/Life-Cat-Upgrade/app/`
3. 點擊 Safari 下方「**分享**」按鈕 ➔ 選擇「**加入主畫面（Add to Home Screen）**」。
4. 桌面上即會出現北歐鹿與貓圖示的獨立 App，點開即為全螢幕原生操作體驗（底部配備專屬手機導覽列）。
5. 點擊 App 內「**跨裝置與備份**」設定您的 GitHub Personal Access Token，即可在 iPhone 與 Windows / MacBook 之間一鍵雙向同步最新資料！

---

## 🔒 架構與個人資料分離設計（Public App + Private Data）
為了讓此主專案 (`Life-Cat-Upgrade`) 可以完全安心設為 **Public（公開）** 並開啟免費 GitHub Pages：
1. **此儲存庫僅保留純淨的 App 程式架構**與無個資的預設範例模板 (`data/life_blueprint.example.json`)。
2. **電腦端指定資料夾自動讀取 (`data/life_blueprint.json`)**：
   - `.gitignore` 已自動排除 `data/` 資料夾內的所有個人檔案。
   - 您只要將個人的 `life_blueprint.json` 放入專案的 **`data/`** 資料夾下（或將您的個人資料 **Private Repo** 直接 `git clone` 為 `data/` 資料夾），開啟 `LifeBlueprint.exe` 或 `LifeBlueprint-Mac.command` 時就會自動讀取您的個人資料！
3. **跨裝置 Private Repo 雲端同步（電腦 & iPhone 共用）**：
   - 您可以另外建立一個 **Private（私人）** GitHub 儲存庫（例如 `Life-Cat-Data`）專門存放 `life_blueprint.json`。
   - 在 App 右上角「**跨裝置與備份**」填入您的 Private Repo 名稱與 GitHub Token，即可在 iPhone 與電腦之間加密同步個人資料，公開的 App 網址絕對不會暴露任何個人筆記！
