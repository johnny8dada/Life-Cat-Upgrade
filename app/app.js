// 北歐森林・人生規劃藍圖 (Nordic Life Blueprint) — Core Application Logic

const GUARDIAN_META = {
  deer: { label: "森林引路鹿", key: "deer" },
  cat_pair: { label: "雙貓依偎", key: "cat_pair" },
  cat_cozy: { label: "暖窩貓咪", key: "cat_cozy" },
  hedgehog: { label: "知識小刺蝟", key: "hedgehog" },
  squirrel: { label: "果實小松鼠", key: "squirrel" },
  robin: { label: "北歐小山雀", key: "robin" }
};

const NORDIC_COLORS = [
  { color: "#C87D65", bgSoft: "#F6EAE4", name: "赤陶暖橘" },
  { color: "#5F7464", bgSoft: "#E7EFE8", name: "松針鼠尾草" },
  { color: "#B88B4A", bgSoft: "#F4EFE2", name: "北歐琥珀木" },
  { color: "#6E8898", bgSoft: "#E6EEF2", name: "峽灣霧藍" },
  { color: "#8C6D7E", bgSoft: "#F1EBF0", name: "野莓藕紫" }
];

const CONN_TYPE_META = {
  foundation: { label: "🌱 基礎支撐", color: "#5F7464", bg: "#E5ECE6" },
  synergy: { label: "✨ 相輔相成", color: "#C87D65", bg: "#F7EAE4" },
  nourish: { label: "🍃 滋養充電", color: "#6E8898", bg: "#E5EEF3" }
};

const App = {
  data: null,
  selectedPillarId: "ALL",
  selectedTaskId: null,
  selectedConnId: null,
  activeNoteCategory: "ALL",
  selectedGuardianInModal: "deer",
  selectedColorInModal: NORDIC_COLORS[0],
  isAiAnalyzing: false,

  async init() {
    // Inject header & banner SVG illustrations
    document.getElementById("headerGuardianIcon").innerHTML = window.NordicIllustrations.guardians.deer;
    document.getElementById("forestTapestryContainer").innerHTML = window.NordicIllustrations.forestTapestry;
    document.getElementById("aiModalDeerIcon").innerHTML = window.NordicIllustrations.guardians.deer;

    await this.loadData();

    if (this.data.tasks.length > 0) {
      this.selectedTaskId = this.data.tasks[0].id;
    }
    if (this.data.connections.length > 0) {
      this.selectedConnId = this.data.connections[0].id;
    }

    this.renderAll();
    this.startLifecycleHeartbeat();

    // Auto-pull latest data from Private Repo on App startup (both Desktop & iPhone)
    this.autoPullFromGithubOnStartup("startup");
  },

  _lastAutoPullCheckAt: 0,
  startLifecycleHeartbeat() {
    setInterval(() => {
      fetch("/api/heartbeat").catch(() => {});
    }, 3000);

    // When iPhone App or Desktop window is reopened/resumed from background, check Private Repo if not editing
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        const now = Date.now();
        if (now - this._lastAutoPullCheckAt > 8000 && !this._ghAutoSyncTimer && !this.isAiAnalyzing) {
          this.autoPullFromGithubOnStartup("resume");
        }
      }
    });

    window.addEventListener("beforeunload", (e) => {
      if (this.isAiAnalyzing) {
        e.preventDefault();
        e.returnValue = "AI 分析請求正在執行中，確定要離開視窗嗎？";
        return e.returnValue;
      }
    });

    window.addEventListener("pagehide", () => {
      try {
        navigator.sendBeacon("/api/shutdown", "{}");
      } catch (e) {}
    });
  },

  _openSecretVaultDB() {
    return new Promise((resolve) => {
      if (!window.indexedDB) return resolve(null);
      try {
        const req = indexedDB.open("NordicBlueprintVault", 1);
        req.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains("secrets")) {
            db.createObjectStore("secrets");
          }
        };
        req.onsuccess = (e) => resolve(e.target.result);
        req.onerror = () => resolve(null);
      } catch (err) {
        resolve(null);
      }
    });
  },

  async _idbSet(key, val) {
    try {
      const db = await this._openSecretVaultDB();
      if (!db) return;
      const tx = db.transaction("secrets", "readwrite");
      tx.objectStore("secrets").put(val, key);
    } catch (e) {}
  },

  async _idbGet(key) {
    try {
      const db = await this._openSecretVaultDB();
      if (!db) return "";
      return await new Promise((resolve) => {
        const tx = db.transaction("secrets", "readonly");
        const req = tx.objectStore("secrets").get(key);
        req.onsuccess = () => resolve(req.result || "");
        req.onerror = () => resolve("");
      });
    } catch (e) {
      return "";
    }
  },

  setPersistentSecret(key, val) {
    try {
      localStorage.setItem(key, val);
    } catch (e) {}
    try {
      const encoded = encodeURIComponent(val);
      const secureFlag = window.location.protocol === "https:" ? "; Secure" : "";
      document.cookie = `${key}=${encoded}; max-age=31536000; path=/; SameSite=Lax${secureFlag}`;
    } catch (e) {}
    this._idbSet(key, val);
  },

  getPersistentSecret(key) {
    let val = "";
    try {
      val = localStorage.getItem(key) || "";
    } catch (e) {}
    if (!val) {
      try {
        const match = document.cookie.match(new RegExp("(?:^|; )" + key.replace(/([.$?*|{}()[\]\\/+^])/g, "\\$1") + "=([^;]*)"));
        if (match && match[1]) {
          val = decodeURIComponent(match[1]);
          try { localStorage.setItem(key, val); } catch (e) {}
        }
      } catch (e) {}
    }
    return val;
  },

  async getPersistentSecretAsync(key) {
    let val = this.getPersistentSecret(key);
    if (!val) {
      val = await this._idbGet(key);
      if (val) {
        this.setPersistentSecret(key, val);
      }
    } else {
      // Ensure IndexedDB also has a copy of existing localStorage/Cookie secret
      this._idbSet(key, val);
    }
    return val;
  },

  async loadData() {
    // Request persistent storage quota from iOS Safari / WebKit so sandbox is not evicted
    try {
      if (navigator.storage && navigator.storage.persist) {
        navigator.storage.persist().catch(() => {});
      }
    } catch (e) {}

    let serverData = null;
    this.isLocalServerAvailable = false;
    try {
      const res = await fetch("/api/data?t=" + Date.now(), { cache: "no-store" });
      if (res.ok) {
        this.isLocalServerAvailable = true;
        const json = await res.json();
        if (json && Array.isArray(json.pillars)) {
          serverData = json;
        }
      }
    } catch (e) {
      this.isLocalServerAvailable = false;
    }

    let localData = null;
    const cached = localStorage.getItem("nordic_life_blueprint_v1");
    if (cached) {
      try {
        localData = JSON.parse(cached);
      } catch (e) {}
    }

    const statusEl = document.getElementById("saveStatusText");

    if (this.isLocalServerAvailable) {
      // Desktop Mode (Windows / MacBook): Designated folder `data/life_blueprint.json` is the primary source of truth!
      if (serverData) {
        this.data = serverData;
        localStorage.setItem("nordic_life_blueprint_v1", JSON.stringify(serverData));
        if (statusEl) {
          statusEl.textContent = "🟢 已從指定資料夾讀取個人資料 (data/life_blueprint.json)";
        }
      } else {
        // `data/life_blueprint.json` not yet placed in `data/` folder -> show clean example template
        this.data = await this.fetchExampleOrSeedData();
        if (statusEl) {
          statusEl.textContent = "📂 目前為公開版範例（將個人 life_blueprint.json 放入 data/ 資料夾或從 Private Repo 拉取即可載入）";
        }
      }
    } else {
      // iPhone / GitHub Pages Mode: Load personal data synced into localStorage, or fallback to clean example
      if (localData && Array.isArray(localData.pillars)) {
        this.data = localData;
        if (statusEl) {
          statusEl.textContent = "📱 已載入本機個人藍圖（可於「跨裝置與備份」與 Private Repo 同步）";
        }
      } else {
        this.data = await this.fetchExampleOrSeedData();
        if (statusEl) {
          statusEl.textContent = "📱 目前為公開版範例（請至「跨裝置與備份」從您的 Private Repo 拉取個人資料）";
        }
      }
    }

    // Load local secret API key from /api/apikey or localStorage/Cookie/IndexedDB BEFORE migrateModelSetting
    if (!this.data.settings) this.data.settings = { apiKey: "", model: "gemini-3.8-flash" };
    try {
      const kRes = await fetch("/api/apikey");
      if (kRes.ok) {
        const kJson = await kRes.json();
        if (kJson && kJson.apiKey) {
          this.data.settings.apiKey = kJson.apiKey;
          this.setPersistentSecret("nordic_gemini_api_key", kJson.apiKey);
        }
      }
    } catch (e) {}
    if (!this.data.settings.apiKey) {
      this.data.settings.apiKey = (await this.getPersistentSecretAsync("nordic_gemini_api_key")) || "";
    }
    const apiKeyInputEl = document.getElementById("aiApiKeyInput");
    if (apiKeyInputEl && this.data.settings.apiKey) {
      apiKeyInputEl.value = this.data.settings.apiKey;
    }

    await this.loadGithubSyncConfig();
    this.migrateModelSetting();
  },

  async fetchExampleOrSeedData() {
    try {
      const res = await fetch("../data/life_blueprint.example.json?t=" + Date.now());
      if (res.ok) {
        const json = await res.json();
        if (json && Array.isArray(json.pillars)) {
          return json;
        }
      }
    } catch (e) {}
    return this.getDefaultSeedData();
  },

  migrateModelSetting() {
    if (!this.data.settings) this.data.settings = { apiKey: "", model: "gemini-3.8-flash" };
    const legacy = ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash"];
    if (!this.data.settings.model || legacy.includes(this.data.settings.model)) {
      this.data.settings.model = "gemini-3.8-flash";
      this.saveData();
    }
  },

  getDefaultSeedData() {
    return {
      version: "1.0",
      settings: { apiKey: "", model: "gemini-3.8-flash", userName: "旅人" },
      aiOverview: {
        lastAnalyzedAt: "預設範例藍圖",
        forestSummary: "目前的森林藍圖呈現溫暖而向內扎根的節奏。「自我成長」中的情緒覺察與傾聽練習，正像樹根一樣默默滋養著「伴侶關係」裡的關心與親密度；而「娛樂」中的自然散步則為繁忙的生活提供了喘息空間。",
        harmonyScore: 78
      },
      pillars: [
        { id: "pillar-partner", title: "伴侶關係", subtitle: "在日常細節裡練習溫柔與深度連結", guardian: "cat_pair", color: "#C87D65", bgSoft: "#F6EAE4" },
        { id: "pillar-growth", title: "自我成長", subtitle: "安定內在節奏，累積知識與心靈彈性", guardian: "deer", color: "#5F7464", bgSoft: "#E7EFE8" },
        { id: "pillar-family", title: "家庭生活", subtitle: "打造溫暖舒適的北歐避風港與家人連結", guardian: "cat_cozy", color: "#B88B4A", bgSoft: "#F4EFE2" },
        { id: "pillar-play", title: "娛樂與充電", subtitle: "保留純粹的玩心、好奇與生活美感", guardian: "robin", color: "#6E8898", bgSoft: "#E6EEF2" }
      ],
      tasks: [
        {
          id: "task-care",
          pillarId: "pillar-partner",
          title: "練習關心對方",
          summary: "放下給建議的急躁，練習用好奇心傾聽伴侶每天的感受與小事",
          tags: ["傾聽", "日常對話", "同理心"],
          enableTracker: true,
          tracker: {
            goal: "每週至少 3 次在睡前或晚餐時，主動放下手機專注傾聽對方分享 15 分鐘，先同理情緒再給建議。",
            selfScore: 7,
            selfReflection: "這週有記得先問「你今天累不累、心情如何」，但遇到工作話題時還是偶爾會急著幫忙想辦法。",
            aiCompletion: 72,
            aiFeedback: "筆記中已建立具體的提問清單，且能覺察到自己「急著給建議」的習慣，這是最關鍵的突破點！",
            milestones: [
              { id: "m1", text: "整理 5 個溫暖不具壓力的日常關心提問", done: true },
              { id: "m2", text: "練習「先重複對方情緒，3 秒後再回應」", done: true },
              { id: "m3", text: "記住對方提過近期在意的小事並隔天主動關心", done: false }
            ]
          },
          notes: [
            {
              id: "note-1",
              category: "📚 查到的資訊",
              title: "非暴力溝通與伴侶傾聽的三個小技巧",
              content: "1. 區分「需要建議」還是「需要陪伴」：可以先溫柔詢問「這件事聽起來好不容易，你現在希望我陪你一起罵一罵，還是幫你想想辦法？」\n2. 開放式關心取代例行公事：把「今天還好嗎？」換成「今天有沒有哪個瞬間讓你覺得特別累，或是有點開心？」\n3. 眼神與放下手邊事：即使只有 5 分鐘，專注的陪伴也勝過一邊滑手機一邊敷衍。",
              createdAt: "2026-11-08 20:30"
            },
            {
              id: "note-2",
              category: "🌿 日常實踐紀錄",
              title: "週三晚餐後的對話練習",
              content: "今天對方提到專案進度卡住，我忍住沒有馬上教他怎麼處理，而是先泡了一杯熱洋甘菊茶給他，說「難怪你今天看起來特別疲倦」。對方明顯放鬆下來，後來自己聊著聊著就理出頭緒了。",
              createdAt: "2026-11-10 21:45"
            }
          ]
        },
        {
          id: "task-intimacy",
          pillarId: "pillar-partner",
          title: "增加親密度",
          summary: "營造兩人專屬的儀式感與非語言的溫暖肢體接觸",
          tags: ["儀式感", "約會", "親密連結"],
          enableTracker: true,
          tracker: {
            goal: "每天出門與回家時給彼此一個至少 6 秒的擁抱；每月安排一次不滑手機的半日小約會。",
            selfScore: 6,
            selfReflection: "擁抱習慣漸漸養成了，但月底比較忙碌時容易把約會變成只是吃頓飯就回家休息。",
            aiCompletion: 65,
            aiFeedback: "6 秒擁抱的小習慣執行得很棒！可結合「娛樂與充電」的散步計畫，讓約會不需複雜規劃也能充滿新鮮感。",
            milestones: [
              { id: "m4", text: "實踐每日 6 秒溫暖擁抱（催產素分泌練習）", done: true },
              { id: "m5", text: "建立兩人的「想一起去的小店/散步清單」", done: true },
              { id: "m6", text: "睡前 10 分鐘雙人感謝或放鬆伸展時光", done: false }
            ]
          },
          notes: [
            {
              id: "note-3",
              category: "📚 查到的資訊",
              title: "心理學家 John Gottman 的「6秒之吻與擁抱」與情感帳戶",
              content: "研究指出，每天出門與回家時維持 6 秒以上的擁抱，能有效降低皮質醇（壓力荷爾蒙）並提升催產素，讓「回家」在潛意識裡與安全感連結。",
              createdAt: "2026-11-09 15:10"
            }
          ]
        },
        {
          id: "task-mindfulness",
          pillarId: "pillar-growth",
          title: "情緒覺察與慢活書寫",
          summary: "在繁忙日程中留白，察覺自己的壓力訊號與內在需求",
          tags: ["正念", "內在穩定", "書寫"],
          enableTracker: true,
          tracker: {
            goal: "每週寫 2 次 5 分鐘自由書寫，辨識自己的疲勞與焦慮來源。",
            selfScore: 8,
            selfReflection: "開始書寫後，發現自己比較不會把工作上的煩躁帶回家裡。",
            aiCompletion: 82,
            aiFeedback: "這是整個藍圖的核心穩定器，明顯提升了您在伴侶與家庭互動中的從容度。",
            milestones: [
              { id: "m7", text: "準備專屬的睡前呼吸與書寫時段", done: true },
              { id: "m8", text: "記錄自己的三個常見壓力觸發點", done: true }
            ]
          },
          notes: [
            {
              id: "note-4",
              category: "💡 靈感與反思",
              title: "發現急躁背後其實是怕自己沒幫上忙",
              content: "今天回顧時發現，每當伴侶或家人抱怨時我急著給建議，其實是因為我焦慮於「看對方不開心」，並不是不在乎對方。理解這點後，我更能安頓好自己的焦慮，單純陪在對方身邊。",
              createdAt: "2026-11-10 23:00"
            }
          ]
        },
        {
          id: "task-home-vibe",
          pillarId: "pillar-family",
          title: "居家空間暖心整理",
          summary: "不追求進度表的無壓力筆記：收集喜歡的北歐暖光佈置與家常食譜",
          tags: ["空間美學", "無壓力紀錄", "料理"],
          enableTracker: false,
          tracker: { goal: "", selfScore: 5, selfReflection: "", aiCompletion: null, aiFeedback: "", milestones: [] },
          notes: [
            {
              id: "note-5",
              category: "📚 查到的資訊",
              title: "北歐 Hygge 居家燈光配置筆記",
              content: "減少單一慘白的主燈，改用 2700K–3000K 的暖黃光桌燈與角落閱讀燈。餐桌換上亞麻桌巾與小植栽，晚上點亮時整個家的節奏都會慢下來。",
              createdAt: "2026-11-07 19:20"
            }
          ]
        },
        {
          id: "task-nature-walk",
          pillarId: "pillar-play",
          title: "週末森林步道與底片攝影",
          summary: "走進自然觀察光影與小動物，讓大腦離開螢幕徹底放電",
          tags: ["自然", "散步", "攝影"],
          enableTracker: false,
          tracker: { goal: "", selfScore: 7, selfReflection: "", aiCompletion: 75, aiFeedback: "", milestones: [] },
          notes: [
            {
              id: "note-6",
              category: "🌿 日常實踐紀錄",
              title: "收藏的清幽步道清單",
              content: "1. 二子坪步道（平緩好走、林蔭濃密，適合帶熱咖啡散步）\n2. 內洞國家森林遊樂區（瀑布負離子與蕨類生態）",
              createdAt: "2026-11-06 14:00"
            }
          ]
        }
      ],
      connections: [
        { id: "conn-1", fromTaskId: "task-mindfulness", toTaskId: "task-care", type: "foundation", label: "內在穩定支撐傾聽品質", reason: "在「情緒覺察與慢活書寫」中看懂自己急著給建議背後的焦慮，直接幫助了「練習關心對方」時能保持平靜與同理心。", strength: 92, source: "ai" },
        { id: "conn-2", fromTaskId: "task-care", toTaskId: "task-intimacy", type: "synergy", label: "被理解的安全感催生親密", reason: "日常深度傾聽累積的心理安全感，能讓「增加親密度」中的擁抱與約會不再流於形式，形成正向情感循環。", strength: 88, source: "ai" },
        { id: "conn-3", fromTaskId: "task-home-vibe", toTaskId: "task-intimacy", type: "synergy", label: "溫暖居家氛圍催化兩人時光", reason: "Hygge 暖黃光與舒適的居家角落，讓伴侶即使不出門也能在家自然地聊天、擁抱與放鬆。", strength: 79, source: "ai" },
        { id: "conn-4", fromTaskId: "task-nature-walk", toTaskId: "task-mindfulness", type: "nourish", label: "自然離線充電恢復覺察力", reason: "離開螢幕走進森林步道能清空大腦雜訊，為自我成長與情緒反思提供充足的心靈餘裕。", strength: 84, source: "ai" }
      ]
    };
  },

  async saveData(toastMsg = null) {
    this.data.lastModifiedAt = Date.now();
    const currentKey = (this.data.settings && this.data.settings.apiKey) || "";
    if (currentKey) {
      this.setPersistentSecret("nordic_gemini_api_key", currentKey);
      fetch("/api/apikey", { method: "POST", body: currentKey }).catch(() => {});
    }
    try {
      localStorage.setItem("nordic_life_blueprint_v1", JSON.stringify(this.data));
    } catch (e) {}

    // Sanitize apiKey before writing to data/life_blueprint.json so it never leaks to Git
    const diskCopy = JSON.parse(JSON.stringify(this.data));
    if (diskCopy.settings) diskCopy.settings.apiKey = "";

    const statusEl = document.getElementById("saveStatusText");
    try {
      const res = await fetch("/api/data", {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify(diskCopy, null, 2)
      });
      if (res.ok && statusEl) {
        const nowStr = new Date().toLocaleTimeString("zh-TW", { hour12: false });
        statusEl.textContent = `🟢 已即時寫入本地檔案 data/life_blueprint.json (${nowStr})`;
      }
    } catch (e) {
      if (statusEl) {
        statusEl.textContent = `🟡 已儲存於本機記憶（可在「跨裝置與備份」一鍵同步至 GitHub 雲端）`;
      }
    }

    this.autoSyncToGithubIfNeeded();

    if (toastMsg) {
      this.showToast(toastMsg);
    }
  },

  renderAll() {
    this.renderBannerSummary();
    this.renderGraphLeftSidebar();
    this.renderBlueprintGraph();
    this.renderConnectionInspector();
    this.renderPillarsSidebar();
    this.renderTasksSidebar();
    this.renderActiveTaskStudio();
  },

  switchMainView(viewMode) {
    document.querySelectorAll(".nav-tab, .mobile-nav-item[data-tab], .mobile-nav-item[data-mobtab]").forEach(btn => {
      const targetTab = btn.dataset.tab || btn.dataset.mobtab;
      btn.classList.toggle("active", targetTab === viewMode);
    });
    const bpSec = document.getElementById("blueprintSection");
    const stSec = document.getElementById("studioSection");
    if (viewMode === "SplitView") {
      bpSec.classList.remove("hidden");
      stSec.classList.remove("hidden");
    } else if (viewMode === "BlueprintOnly") {
      bpSec.classList.remove("hidden");
      stSec.classList.add("hidden");
    } else if (viewMode === "NotebookOnly") {
      bpSec.classList.add("hidden");
      stSec.classList.remove("hidden");
    }
  },

  renderBannerSummary() {
    const ov = this.data.aiOverview || {};
    document.getElementById("harmonyScoreBadge").textContent = `藍圖和諧度 ${ov.harmonyScore || 78}%`;
    document.getElementById("aiForestSummaryText").textContent = ov.forestSummary || "";

    const totalNotes = this.data.tasks.reduce((acc, t) => acc + (t.notes ? t.notes.length : 0), 0);
    const trackedTasks = this.data.tasks.filter(t => t.enableTracker).length;

    document.getElementById("quickStatsBar").innerHTML = `
      <span class="stat-chip">🌲 人生大項目 <strong>${this.data.pillars.length}</strong></span>
      <span class="stat-chip">🎯 細節任務 <strong>${this.data.tasks.length}</strong>（含進度追蹤 ${trackedTasks} 項）</span>
      <span class="stat-chip">📓 累積筆記 <strong>${totalNotes}</strong> 篇</span>
      <span class="stat-chip">🦌 關聯連結 <strong>${this.data.connections.length}</strong> 條</span>
    `;
  },

  // =========================================================================
  // SECTION A: OBSIDIAN-STYLE CLUSTERED BLUEPRINT GRAPH + LEFT SIDEBAR + RIGHT FLOATING PANEL
  // =========================================================================
  graphFocusTaskId: null, // Protagonist task ID when a specific block is selected
  graphHighlightConnOnly: false,
  graphZoom: 1,
  graphPanX: 0,
  graphPanY: 0,
  graphManualPositions: {}, // Optional user-dragged node coordinates { [taskId]: { x, y } }
  _isDraggingGraph: false,
  _draggingNodeId: null,
  _dragMoved: false,
  _dragStartX: 0,
  _dragStartY: 0,

  // Clips a ray from center (cx, cy) toward target (tx, ty) right at the compact card boundary (halfW, halfH)
  clipPointToCardBox(cx, cy, tx, ty, halfW = 68, halfH = 27) {
    const dx = tx - cx;
    const dy = ty - cy;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return { x: cx, y: cy };
    const scaleX = halfW / Math.max(1, Math.abs(dx));
    const scaleY = halfH / Math.max(1, Math.abs(dy));
    const t = Math.min(scaleX, scaleY);
    return {
      x: cx + dx * t,
      y: cy + dy * t
    };
  },

  // Computes a gentle quadratic Bezier control point between two compact nodes
  computeCurvedControlPoint(fromPos, toPos, idxOffset = 0) {
    const midX = (fromPos.x + toPos.x) / 2;
    const midY = (fromPos.y + toPos.y) / 2;
    const dx = toPos.x - fromPos.x;
    const dy = toPos.y - fromPos.y;
    const dist = Math.max(1, Math.hypot(dx, dy));

    const nx = -dy / dist;
    const ny = dx / dist;

    const direction = (idxOffset % 2 === 0) ? 1 : -1;
    const arcStrength = Math.min(34, dist * 0.14) * direction;
    return {
      ctrlX: Math.round(midX + nx * arcStrength),
      ctrlY: Math.round(midY + ny * arcStrength)
    };
  },

  // Computes an Obsidian-style centralized force-directed cluster layout so blocks stay compactly grouped with legible text
  computeObsidianClusterPositions(tasks, pillars, conns, centerX = 290, centerY = 245) {
    const pillarMap = {};
    pillars.forEach((p, idx) => {
      pillarMap[p.id] = { ...p, sectorIndex: idx };
    });

    const pillarCount = Math.max(1, pillars.length);

    // Group tasks by pillar for initial organic seeding around the center
    const tasksByPillar = {};
    tasks.forEach(t => {
      const pid = t.pillarId || "UNASSIGNED";
      if (!tasksByPillar[pid]) tasksByPillar[pid] = [];
      tasksByPillar[pid].push(t);
    });

    const nodes = tasks.map((task, globalIdx) => {
      const pInfo = pillarMap[task.pillarId] || {
        title: "未分類",
        color: "#5F7464",
        bgSoft: "#E7EFE8",
        sectorIndex: 0
      };

      // If the user manually dragged this node during this session, respect its position
      if (this.graphManualPositions && this.graphManualPositions[task.id]) {
        return {
          id: task.id,
          x: this.graphManualPositions[task.id].x,
          y: this.graphManualPositions[task.id].y,
          vx: 0,
          vy: 0,
          pinned: true,
          task,
          pillar: pInfo
        };
      }

      const siblings = tasksByPillar[task.pillarId || "UNASSIGNED"] || [task];
      const localIdx = Math.max(0, siblings.indexOf(task));
      const sectorAngle = (-Math.PI / 2) + (pInfo.sectorIndex / pillarCount) * (Math.PI * 2);
      const localSpread = (localIdx - (siblings.length - 1) / 2) * 0.42;
      const angle = sectorAngle + localSpread;
      // Expand initial seeding ring naturally as more items exist, without ever shrinking card or font size
      const ringRadius = tasks.length <= 1 ? 0 : (75 + (localIdx % 2) * 44 + Math.sqrt(tasks.length) * 24);

      return {
        id: task.id,
        x: centerX + Math.cos(angle) * ringRadius + ((globalIdx % 3) - 1) * 10,
        y: centerY + Math.sin(angle) * (ringRadius * 0.85) + ((globalIdx % 2) - 0.5) * 10,
        vx: 0,
        vy: 0,
        pinned: false,
        task,
        pillar: pInfo
      };
    });

    const nodeById = {};
    nodes.forEach(n => { nodeById[n.id] = n; });

    // Run deterministic force-directed relaxation (Obsidian-style central gravity + spring attraction + full-size card collision)
    const ITERATIONS = 90;
    const IDEAL_EDGE_DIST = 160;
    const MIN_CARD_DX = 158; // Full-size card width (144) + 14px breathing gap
    const MIN_CARD_DY = 64;  // Full-size card height (50) + 14px breathing gap

    for (let iter = 0; iter < ITERATIONS; iter++) {
      const damping = 0.78 - (iter / ITERATIONS) * 0.35;

      // 1. Gentle central gravity (pulls nodes into a cohesive Obsidian-like cluster without crushing them when count grows)
      for (const n of nodes) {
        if (n.pinned) continue;
        n.vx += (centerX - n.x) * 0.022;
        n.vy += (centerY - n.y) * 0.026;
      }

      // 2. Same-pillar cohesion (keeps tasks of the same Life Pillar gently grouped together)
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i];
          const b = nodes[j];
          if (a.task.pillarId && a.task.pillarId === b.task.pillarId) {
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const dist = Math.hypot(dx, dy);
            if (dist > 150) {
              const pull = (dist - 150) * 0.015;
              if (!a.pinned) { a.vx += (dx / dist) * pull; a.vy += (dy / dist) * pull; }
              if (!b.pinned) { b.vx -= (dx / dist) * pull; b.vy -= (dy / dist) * pull; }
            }
          }
        }
      }

      // 3. Connection spring attraction (connected nodes pull closer together)
      for (const c of conns) {
        const a = nodeById[c.fromTaskId];
        const b = nodeById[c.toTaskId];
        if (!a || !b || a === b) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.max(1, Math.hypot(dx, dy));
        const delta = (dist - IDEAL_EDGE_DIST) * 0.028;
        const fx = (dx / dist) * delta;
        const fy = (dy / dist) * delta;
        if (!a.pinned) { a.vx += fx; a.vy += fy; }
        if (!b.pinned) { b.vx -= fx; b.vy -= fy; }
      }

      // 4. Full-size rectangular card repulsion (guarantees cards never overlap or shrink regardless of item count)
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i];
          const b = nodes[j];
          let dx = b.x - a.x;
          let dy = b.y - a.y;
          if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
            dx = (i % 2 === 0 ? 1 : -1) * 4;
            dy = (j % 2 === 0 ? 1 : -1) * 4;
          }
          const overlapX = MIN_CARD_DX - Math.abs(dx);
          const overlapY = MIN_CARD_DY - Math.abs(dy);
          if (overlapX > 0 && overlapY > 0) {
            if (overlapX < overlapY * 1.6) {
              const pushX = (overlapX * 0.42) * (dx >= 0 ? 1 : -1);
              if (!a.pinned) a.vx -= pushX;
              if (!b.pinned) b.vx += pushX;
            } else {
              const pushY = (overlapY * 0.44) * (dy >= 0 ? 1 : -1);
              if (!a.pinned) a.vy -= pushY;
              if (!b.pinned) b.vy += pushY;
            }
          }
        }
      }

      // Apply velocities
      for (const n of nodes) {
        if (n.pinned) continue;
        n.x += n.vx * damping;
        n.y += n.vy * damping;
        n.vx = 0;
        n.vy = 0;
      }
    }

    const nodePositions = {};
    nodes.forEach(n => {
      nodePositions[n.id] = {
        x: Math.round(n.x),
        y: Math.round(n.y),
        task: n.task,
        pillar: n.pillar
      };
    });
    return nodePositions;
  },

  resetGraphViewport(clearFocus = false) {
    this.graphZoom = 1;
    this.graphPanX = 0;
    this.graphPanY = 0;
    this.graphManualPositions = {};
    if (clearFocus) {
      this.graphFocusTaskId = null;
      this.graphHighlightConnOnly = false;
      this.selectedPillarId = "ALL";
    }
    this.renderAll();
  },

  zoomGraph(factor) {
    this.graphZoom = Math.min(2.4, Math.max(0.55, +(this.graphZoom * factor).toFixed(2)));
    this.renderBlueprintGraph();
  },

  // Renders the Left Sidebar inside the Blueprint Graph section (#graphLeftSidebar)
  renderGraphLeftSidebar() {
    const sidebarEl = document.getElementById("graphLeftSidebar");
    if (!sidebarEl) return;

    // Preserve current scroll positions so clicking items doesn't jump the scrollbars unexpectedly
    const prevOuterScroll = document.getElementById("graphPillarsScrollArea")
      ? document.getElementById("graphPillarsScrollArea").scrollTop
      : 0;
    const prevInnerScrollMap = {};
    sidebarEl.querySelectorAll(".graph-pillar-tasks.expanded[data-pillar-id]").forEach(el => {
      prevInnerScrollMap[el.dataset.pillarId] = el.scrollTop;
    });

    const allTasksCount = this.data.tasks.length;
    const isAllActive = (this.selectedPillarId === "ALL" && !this.graphFocusTaskId);

    let pillarsHtml = `
      <div class="graph-pillar-group ${isAllActive ? 'active' : ''}">
        <button type="button" class="graph-pillar-btn ${isAllActive ? 'active' : ''}" onclick="App.selectGraphPillar('ALL')">
          <span class="graph-pillar-dot" style="background:var(--sage-primary)"></span>
          <span class="graph-pillar-name">全部人生大事項</span>
          <span class="graph-pillar-count">${allTasksCount}</span>
        </button>
      </div>
    `;

    this.data.pillars.forEach(p => {
      const pillarTasks = this.data.tasks.filter(t => t.pillarId === p.id);
      const isPillarSelected = (this.selectedPillarId === p.id);
      const hasFocusedTaskHere = pillarTasks.some(t => t.id === this.graphFocusTaskId);
      const isExpanded = isPillarSelected || hasFocusedTaskHere;

      const tasksListHtml = pillarTasks.length > 0
        ? pillarTasks.map(t => {
            const isTaskProtagonist = (this.graphFocusTaskId === t.id);
            const connCount = this.data.connections.filter(c => c.fromTaskId === t.id || c.toTaskId === t.id).length;
            return `
              <button type="button" class="graph-task-item ${isTaskProtagonist ? 'active' : ''}"
                      data-sidebar-task-id="${t.id}"
                      onclick="event.stopPropagation(); App.focusTaskAsProtagonist('${t.id}')">
                <span class="graph-task-bullet" style="background:${isTaskProtagonist ? p.color : 'var(--ink-muted)'}"></span>
                <span class="graph-task-title" title="${this.escapeHtml(t.title)}">${this.escapeHtml(t.title)}</span>
                ${connCount > 0 ? `<span class="graph-task-conn-badge">🔗${connCount}</span>` : ""}
              </button>
            `;
          }).join("")
        : `<div style="padding:6px 10px;font-size:12px;color:var(--ink-muted);">尚無任務（點擊下方新增）</div>`;

      pillarsHtml += `
        <div class="graph-pillar-group ${isExpanded ? 'active' : ''}"
             data-sidebar-pillar-id="${p.id}"
             style="${isExpanded ? `border-color:${p.color}` : ''}">
          <button type="button" class="graph-pillar-btn ${isPillarSelected && !this.graphFocusTaskId ? 'active' : ''}"
                  onclick="App.selectGraphPillar('${p.id}')">
            <span class="graph-pillar-dot" style="background:${p.color}"></span>
            <span class="graph-pillar-name" title="${this.escapeHtml(p.title)}" style="${isExpanded ? `color:${p.color};font-weight:700;` : ''}">${this.escapeHtml(p.title)}</span>
            <span class="graph-pillar-count">${pillarTasks.length}</span>
          </button>
          <div class="graph-pillar-tasks ${isExpanded ? 'expanded' : ''}" data-pillar-id="${p.id}">
            ${tasksListHtml}
            <button type="button" class="graph-task-item" style="justify-content:center;font-size:11.5px;color:var(--sage-primary);border:1px dashed var(--border-warm);background:transparent;min-height:30px;padding:4px 8px;margin-top:2px;"
                    onclick="event.stopPropagation(); App.openTaskModal()">
              ＋ 在此新增任務
            </button>
          </div>
        </div>
      `;
    });

    sidebarEl.innerHTML = `
      <div class="graph-sidebar-header">
        <span>🧭 人生大事項導覽 (${this.data.pillars.length})</span>
        <div style="display:flex;align-items:center;gap:4px;">
          <button type="button" class="btn-icon-text" style="font-size:11px;padding:2px 6px;" onclick="App.openPillarModal()" title="新增人生大事項">＋大事項</button>
          <button type="button" class="btn-icon-text" style="font-size:11px;padding:2px 6px;" onclick="App.clearGraphFocus()" title="重置為全覽顯示">全覽</button>
        </div>
      </div>
      <div class="graph-pillars-scroll-area" id="graphPillarsScrollArea">
        ${pillarsHtml}
      </div>
    `;

    // Restore scroll positions
    const newOuterScrollEl = document.getElementById("graphPillarsScrollArea");
    if (newOuterScrollEl) {
      newOuterScrollEl.scrollTop = prevOuterScroll;
    }
    sidebarEl.querySelectorAll(".graph-pillar-tasks.expanded[data-pillar-id]").forEach(el => {
      const pid = el.dataset.pillarId;
      if (prevInnerScrollMap[pid] !== undefined) {
        el.scrollTop = prevInnerScrollMap[pid];
      }
    });

    // Ensure the active task or pillar is scrolled into view inside its scrollable list
    if (this.graphFocusTaskId) {
      const activeTaskBtn = sidebarEl.querySelector(`.graph-task-item[data-sidebar-task-id="${this.graphFocusTaskId}"]`);
      if (activeTaskBtn) {
        activeTaskBtn.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    } else if (this.selectedPillarId && this.selectedPillarId !== "ALL") {
      const activePillarGroup = sidebarEl.querySelector(`.graph-pillar-group[data-sidebar-pillar-id="${this.selectedPillarId}"]`);
      if (activePillarGroup) {
        activePillarGroup.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }
  },

  // Clicking a Life Pillar in the left sidebar highlights all its blocks and brings them to the top layer
  selectGraphPillar(pillarId) {
    this.selectedPillarId = pillarId;
    this.graphFocusTaskId = null;
    this.graphHighlightConnOnly = false;

    const filteredTasks = pillarId === "ALL"
      ? this.data.tasks
      : this.data.tasks.filter(t => t.pillarId === pillarId);

    if (filteredTasks.length > 0 && !filteredTasks.some(t => t.id === this.selectedTaskId)) {
      this.selectedTaskId = filteredTasks[0].id;
    }
    this.renderAll();
  },

  // Sets a specific Task block as the Protagonist (主角), lighting up its connected blocks on the very top layer
  focusTaskAsProtagonist(taskId) {
    if (!taskId) return;
    const targetTask = this.data.tasks.find(t => t.id === taskId);
    if (!targetTask) return;

    this.selectedTaskId = taskId;
    this.graphFocusTaskId = taskId;
    this.selectedPillarId = targetTask.pillarId || "ALL";
    this.graphHighlightConnOnly = false;

    const relatedConn = this.data.connections.find(c => c.fromTaskId === taskId || c.toTaskId === taskId);
    if (relatedConn) {
      this.selectedConnId = relatedConn.id;
    }

    // Gently pan the graph if the protagonist node is far from the visible cluster area
    if (this._lastNodePositions && this._lastNodePositions[taskId]) {
      const pos = this._lastNodePositions[taskId];
      const targetCenterX = this._lastClusterCenterX || 290;
      const targetCenterY = this._lastClusterCenterY || 245;
      const offsetX = targetCenterX - pos.x;
      const offsetY = targetCenterY - pos.y;
      if (Math.hypot(offsetX - this.graphPanX, offsetY - this.graphPanY) > 130) {
        this.graphPanX = Math.round(offsetX * 0.65);
        this.graphPanY = Math.round(offsetY * 0.65);
      }
    }

    this.renderAll();
  },

  renderBlueprintGraph() {
    const container = document.getElementById("blueprintGraphContainer");
    const pillars = this.data.pillars;
    const tasks = this.data.tasks;
    const conns = this.data.connections;

    if (tasks.length === 0) {
      container.innerHTML = `<div style="padding:30px;text-align:center;color:var(--ink-secondary);">尚未建立任務節點，請從下方新增您的人生大項目與細節任務 🌿</div>`;
      return;
    }

    // Match SVG base coordinate space 1:1 with actual container pixels so blocks & text NEVER shrink to fit a smaller box!
    const actualW = Math.max(680, container.clientWidth || 880);
    const actualH = Math.max(380, container.clientHeight || 490);
    // Shift cluster center to the center of the uncovered left area (accounting for 330px right floating panel on desktop)
    const isDesktopStage = window.innerWidth > 768;
    const clusterCenterX = isDesktopStage ? Math.max(240, Math.round((actualW - 340) / 2)) : Math.round(actualW / 2);
    const clusterCenterY = Math.round(actualH / 2);
    this._lastClusterCenterX = clusterCenterX;
    this._lastClusterCenterY = clusterCenterY;

    const nodePositions = this.computeObsidianClusterPositions(tasks, pillars, conns, clusterCenterX, clusterCenterY);
    this._lastNodePositions = nodePositions;
    const allNodesList = Object.values(nodePositions);

    const viewW = Math.round(actualW / this.graphZoom);
    const viewH = Math.round(actualH / this.graphZoom);
    const viewX = Math.round((actualW - viewW) / 2 - this.graphPanX);
    const viewY = Math.round((actualH - viewH) / 2 - this.graphPanY);

    // Determine illumination state:
    // Case 1: Protagonist Task selected (focusedTaskId) -> Protagonist + directly connected tasks light up
    // Case 2: Life Pillar selected in sidebar (focusedPillarId) -> All blocks in that Pillar light up on top layer
    // Case 3: Single Connection selected -> Both endpoint blocks light up
    const focusedTaskId = this.graphFocusTaskId;
    const focusedPillarId = (!focusedTaskId && this.selectedPillarId !== "ALL") ? this.selectedPillarId : null;
    const primaryLitTaskIds = new Set(); // Protagonist or Pillar's own tasks
    const connectedNeighborIds = new Set(); // Neighbor tasks connected to Protagonist
    const activeConnIds = new Set();

    if (focusedTaskId) {
      primaryLitTaskIds.add(focusedTaskId);
      conns.forEach(c => {
        if (c.fromTaskId === focusedTaskId || c.toTaskId === focusedTaskId) {
          activeConnIds.add(c.id);
          connectedNeighborIds.add(c.fromTaskId);
          connectedNeighborIds.add(c.toTaskId);
        }
      });
    } else if (focusedPillarId) {
      tasks.forEach(t => {
        if (t.pillarId === focusedPillarId) {
          primaryLitTaskIds.add(t.id);
        }
      });
      conns.forEach(c => {
        if (primaryLitTaskIds.has(c.fromTaskId) && primaryLitTaskIds.has(c.toTaskId)) {
          activeConnIds.add(c.id);
        } else if (primaryLitTaskIds.has(c.fromTaskId) || primaryLitTaskIds.has(c.toTaskId)) {
          activeConnIds.add(c.id);
          connectedNeighborIds.add(c.fromTaskId);
          connectedNeighborIds.add(c.toTaskId);
        }
      });
    } else if (this.graphHighlightConnOnly && this.selectedConnId) {
      const selConn = conns.find(c => c.id === this.selectedConnId);
      if (selConn) {
        activeConnIds.add(selConn.id);
        primaryLitTaskIds.add(selConn.fromTaskId);
        primaryLitTaskIds.add(selConn.toTaskId);
      }
    }

    const hasActiveFilter = (focusedTaskId != null) || (focusedPillarId != null) || (this.graphHighlightConnOnly && activeConnIds.size > 0);

    // Sort connections so illuminated lines render ON TOP OF dimmed lines
    const sortedConns = conns.map((conn, idx) => ({
      conn,
      idx,
      isLit: activeConnIds.has(conn.id)
    })).sort((a, b) => (a.isLit === b.isLit ? 0 : (a.isLit ? 1 : -1)));

    // Build SVG connections (NO text labels on lines, per user specification!)
    let pathsHtml = "";
    sortedConns.forEach(({ conn, idx, isLit }) => {
      const fromNode = nodePositions[conn.fromTaskId];
      const toNode = nodePositions[conn.toTaskId];
      if (!fromNode || !toNode) return;

      const meta = CONN_TYPE_META[conn.type] || CONN_TYPE_META.synergy;
      const isOutgoingFromFocused = (focusedTaskId && conn.fromTaskId === focusedTaskId);

      const { ctrlX, ctrlY } = this.computeCurvedControlPoint(fromNode, toNode, idx);
      const startPt = this.clipPointToCardBox(fromNode.x, fromNode.y, ctrlX, ctrlY, 74, 27);
      const endPt = this.clipPointToCardBox(toNode.x, toNode.y, ctrlX, ctrlY, 76, 29);

      const pathD = `M ${Math.round(startPt.x)} ${Math.round(startPt.y)} Q ${ctrlX} ${ctrlY} ${Math.round(endPt.x)} ${Math.round(endPt.y)}`;

      const strokeOpacity = hasActiveFilter
        ? (isLit ? 0.96 : 0.10)
        : 0.34;
      const strokeW = isLit ? (isOutgoingFromFocused ? 3.2 : 2.6) : 1.6;

      pathsHtml += `
        <g class="conn-svg-group" style="cursor:pointer"
           onclick="event.stopPropagation(); App.selectConnection('${conn.id}')"
           ondblclick="event.stopPropagation(); App.openEditConnectionModal('${conn.id}')">
          <path d="${pathD}" stroke="transparent" stroke-width="14" fill="none" />
          ${isLit ? `<path d="${pathD}" stroke="${meta.color}" stroke-width="7" stroke-opacity="0.18" fill="none" />` : ""}
          <path d="${pathD}" stroke="${meta.color}" stroke-width="${strokeW}" stroke-opacity="${strokeOpacity}"
                stroke-dasharray="${conn.type === 'nourish' ? '6 4' : 'none'}" fill="none"
                marker-end="url(#arrow-${conn.type}-${isLit ? 'lit' : 'dim'})" />
        </g>
      `;
    });

    // Assign z-order priority so illuminated Pillar blocks / Protagonist & connected blocks are rendered LAST (最上層)!
    // 0 = dimmed background node
    // 1 = connected neighbor node
    // 2 = selected Pillar's primary block
    // 3 = Protagonist block (主角)
    const getZPriority = (taskId) => {
      if (focusedTaskId === taskId) return 3;
      if (primaryLitTaskIds.has(taskId)) return 2;
      if (connectedNeighborIds.has(taskId)) return 1;
      return 0;
    };

    const sortedNodes = [...allNodesList].sort((a, b) => getZPriority(a.task.id) - getZPriority(b.task.id));

    // Build compact, high-legibility Obsidian-style task blocks (no giant invisible outer frame!)
    let nodesHtml = "";
    sortedNodes.forEach(pos => {
      const { x, y, task, pillar } = pos;
      const zPriority = getZPriority(task.id);
      const isProtagonist = (zPriority === 3);
      const isPrimaryLit = (zPriority >= 2);
      const isConnectedNeighbor = (zPriority === 1);
      const isLit = !hasActiveFilter || zPriority >= 1;

      const nodeOpacity = hasActiveFilter
        ? (isProtagonist || isPrimaryLit ? 1.0 : (isConnectedNeighbor ? 0.94 : 0.20))
        : 1.0;

      const scaleTransform = isProtagonist
        ? "scale(1.08)"
        : (hasActiveFilter && isPrimaryLit ? "scale(1.04)" : "scale(1)");

      const outCount = conns.filter(c => c.fromTaskId === task.id || c.toTaskId === task.id).length;
      const metaSubText = task.enableTracker
        ? `★ ${task.tracker.selfScore}/10`
        : `📓 ${task.notes ? task.notes.length : 0}`;

      nodesHtml += `
        <g class="node-svg-group" data-task-id="${task.id}"
           transform="translate(${x}, ${y}) ${scaleTransform}"
           style="cursor:pointer; opacity:${nodeOpacity}; transition: opacity 0.18s ease;"
           onmousedown="App.startNodeDrag(event, '${task.id}')"
           onclick="event.stopPropagation(); App.handleNodeClick('${task.id}')">

          <!-- Glow Halo for Protagonist or Selected Pillar Blocks (rendered on top layer) -->
          ${isProtagonist ? `
            <rect x="-80" y="-33" width="160" height="66" rx="19" fill="${pillar.color}" opacity="0.22" />
            <rect x="-76" y="-29" width="152" height="58" rx="17" fill="none" stroke="${pillar.color}" stroke-width="2.2" stroke-dasharray="4 3" opacity="0.9" />
          ` : (hasActiveFilter && isPrimaryLit ? `
            <rect x="-77" y="-30" width="154" height="60" rx="17" fill="${pillar.color}" opacity="0.16" />
          ` : (isConnectedNeighbor ? `
            <rect x="-75" y="-28" width="150" height="56" rx="16" fill="${pillar.color}" opacity="0.11" />
          ` : ""))}

          <!-- Full-Size Crisp Card (144x50) — never shrinks as items increase -->
          <rect x="-72" y="-25" width="144" height="50" rx="14"
                fill="${isProtagonist || (hasActiveFilter && isPrimaryLit) ? '#FFFFFF' : pillar.bgSoft}"
                stroke="${pillar.color}"
                stroke-width="${isProtagonist ? 2.5 : (isPrimaryLit ? 2.0 : (isConnectedNeighbor ? 1.6 : 1.1))}"
                stroke-opacity="${isLit ? 0.92 : 0.42}"
                filter="url(#nordic-card-shadow)" />

          <!-- Pillar Color Dot + Label at top of card -->
          <circle cx="-57" cy="-11" r="4" fill="${pillar.color}" />
          <text x="-49" y="-7.5" text-anchor="start" font-size="10.2" font-weight="700" fill="${pillar.color}">
            ${this.escapeHtml(this.truncate(pillar.title, 8))}
          </text>
          ${outCount > 0 ? `
            <text x="61" y="-7.5" text-anchor="end" font-size="10" font-weight="700" fill="#6E7770">
              🔗${outCount}
            </text>
          ` : `
            <text x="61" y="-7.5" text-anchor="end" font-size="10" fill="#7A827C">
              ${metaSubText}
            </text>
          `}

          <!-- Large Legible Task Title -->
          <text x="0" y="12" text-anchor="middle" font-size="13.5" font-weight="700" fill="#232925">
            ${this.escapeHtml(this.truncate(task.title, 10))}
          </text>
        </g>
      `;
    });

    container.innerHTML = `
      <svg id="blueprintSvgEl" viewBox="${viewX} ${viewY} ${viewW} ${viewH}" class="blueprint-svg"
           onClick="App.clearGraphFocus()">
        <defs>
          <filter id="nordic-card-shadow" x="-15%" y="-15%" width="130%" height="135%">
            <feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="#2C322E" flood-opacity="0.09" />
          </filter>
          <marker id="arrow-foundation-lit" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
            <path d="M0,1 L7,4 L0,7 Z" fill="#5F7464" />
          </marker>
          <marker id="arrow-foundation-dim" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
            <path d="M0,1 L6,3.5 L0,6 Z" fill="#5F7464" fill-opacity="0.35" />
          </marker>
          <marker id="arrow-synergy-lit" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
            <path d="M0,1 L7,4 L0,7 Z" fill="#C87D65" />
          </marker>
          <marker id="arrow-synergy-dim" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
            <path d="M0,1 L6,3.5 L0,6 Z" fill="#C87D65" fill-opacity="0.35" />
          </marker>
          <marker id="arrow-nourish-lit" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
            <path d="M0,1 L7,4 L0,7 Z" fill="#6E8898" />
          </marker>
          <marker id="arrow-nourish-dim" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
            <path d="M0,1 L6,3.5 L0,6 Z" fill="#6E8898" fill-opacity="0.35" />
          </marker>
        </defs>
        ${pathsHtml}
        ${nodesHtml}
      </svg>

      <!-- Floating Zoom / Fit / Focus Controls -->
      <div class="graph-floating-controls" onclick="event.stopPropagation()">
        <button type="button" class="graph-ctrl-btn ${!hasActiveFilter ? 'active' : ''}" onclick="App.clearGraphFocus()" title="顯示所有節點">
          ✨ 全覽模式
        </button>
        <span style="color:var(--border-warm)">|</span>
        <button type="button" class="graph-ctrl-btn" onclick="App.zoomGraph(1.18)" title="放大藍圖">＋</button>
        <button type="button" class="graph-ctrl-btn" onclick="App.zoomGraph(0.85)" title="縮小藍圖">－</button>
        <button type="button" class="graph-ctrl-btn" onclick="App.resetGraphViewport(false)" title="重新集中排列並重設視角">🎯 重新集中 (${Math.round(this.graphZoom * 100)}%)</button>
      </div>
    `;

    this.attachGraphPanZoomEvents();
  },

  startNodeDrag(e, taskId) {
    if (e.button !== 0) return;
    e.stopPropagation();
    this._draggingNodeId = taskId;
    this._dragMoved = false;
    this._dragStartX = e.clientX;
    this._dragStartY = e.clientY;
  },

  handleNodeClick(taskId) {
    if (this._dragMoved) {
      this._dragMoved = false;
      return;
    }
    this.focusTaskAsProtagonist(taskId);
  },

  attachGraphPanZoomEvents() {
    const svg = document.getElementById("blueprintSvgEl");
    if (!svg) return;

    svg.onwheel = (e) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.12 : 0.9;
      this.zoomGraph(factor);
    };

    svg.onmousedown = (e) => {
      if (e.button !== 0) return;
      this._isDraggingGraph = true;
      this._dragStartX = e.clientX;
      this._dragStartY = e.clientY;
    };

    window.onmousemove = (e) => {
      if (this._draggingNodeId) {
        const dx = e.clientX - this._dragStartX;
        const dy = e.clientY - this._dragStartY;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
          this._dragMoved = true;
          const cur = (this._lastNodePositions && this._lastNodePositions[this._draggingNodeId])
            ? this._lastNodePositions[this._draggingNodeId]
            : { x: 310, y: 245 };
          this.graphManualPositions[this._draggingNodeId] = {
            x: Math.round(cur.x + dx / this.graphZoom),
            y: Math.round(cur.y + dy / this.graphZoom)
          };
          this._dragStartX = e.clientX;
          this._dragStartY = e.clientY;
          this.renderBlueprintGraph();
        }
        return;
      }

      if (!this._isDraggingGraph) return;
      const dx = e.clientX - this._dragStartX;
      const dy = e.clientY - this._dragStartY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        this.graphPanX += dx / this.graphZoom;
        this.graphPanY += dy / this.graphZoom;
        this._dragStartX = e.clientX;
        this._dragStartY = e.clientY;
        this.renderBlueprintGraph();
      }
    };

    window.onmouseup = () => {
      this._isDraggingGraph = false;
      this._draggingNodeId = null;
    };

    // Touch events for iPhone / iPad (1-finger pan & 2-finger pinch zoom)
    svg.ontouchstart = (e) => {
      if (e.touches.length === 1) {
        this._isDraggingGraph = true;
        this._dragStartX = e.touches[0].clientX;
        this._dragStartY = e.touches[0].clientY;
      } else if (e.touches.length === 2) {
        this._isDraggingGraph = false;
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        this._pinchStartDist = Math.hypot(dx, dy);
      }
    };

    svg.ontouchmove = (e) => {
      if (e.touches.length === 1 && this._isDraggingGraph) {
        const dx = e.touches[0].clientX - this._dragStartX;
        const dy = e.touches[0].clientY - this._dragStartY;
        if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
          e.preventDefault();
          this.graphPanX += dx / this.graphZoom;
          this.graphPanY += dy / this.graphZoom;
          this._dragStartX = e.touches[0].clientX;
          this._dragStartY = e.touches[0].clientY;
          this.renderBlueprintGraph();
        }
      } else if (e.touches.length === 2 && this._pinchStartDist > 10) {
        e.preventDefault();
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        const ratio = dist / this._pinchStartDist;
        if (Math.abs(ratio - 1) > 0.04) {
          this.zoomGraph(ratio > 1 ? 1.07 : 0.93);
          this._pinchStartDist = dist;
        }
      }
    };

    svg.ontouchend = () => {
      this._isDraggingGraph = false;
      this._pinchStartDist = 0;
    };
  },

  clearGraphFocus() {
    if (this.graphFocusTaskId !== null || this.graphHighlightConnOnly || this.selectedPillarId !== "ALL") {
      this.graphFocusTaskId = null;
      this.graphHighlightConnOnly = false;
      this.selectedPillarId = "ALL";
      this.renderAll();
    }
  },

  // Renders the Right Floating Panel (#connectionInspector) showing selected block details + clickable connected blocks list
  renderConnectionInspector() {
    const box = document.getElementById("connectionInspector");
    if (!box) return;

    // 1. If a Protagonist Task block is focused (via Left Sidebar task click, Graph node click, or Connected Block jump):
    const protagonistTask = this.graphFocusTaskId
      ? this.data.tasks.find(t => t.id === this.graphFocusTaskId)
      : null;

    if (protagonistTask) {
      const pillar = this.data.pillars.find(p => p.id === protagonistTask.pillarId) || {
        title: "未分類",
        color: "#5F7464",
        bgSoft: "#E7EFE8"
      };
      const relatedConns = this.data.connections.filter(
        c => c.fromTaskId === protagonistTask.id || c.toTaskId === protagonistTask.id
      );
      const notesCount = protagonistTask.notes ? protagonistTask.notes.length : 0;

      const connectedCardsHtml = relatedConns.length > 0
        ? relatedConns.map(c => {
            const isOutgoing = c.fromTaskId === protagonistTask.id;
            const otherId = isOutgoing ? c.toTaskId : c.fromTaskId;
            const otherTask = this.data.tasks.find(t => t.id === otherId);
            const otherPillar = otherTask
              ? (this.data.pillars.find(p => p.id === otherTask.pillarId) || { title: "未分類", color: "#5F7464" })
              : { title: "未知", color: "#5F7464" };
            const meta = CONN_TYPE_META[c.type] || CONN_TYPE_META.synergy;

            return `
              <div class="connected-block-card"
                   onclick="App.focusTaskAsProtagonist('${otherTask ? otherTask.id : ''}')"
                   title="點擊立即跳轉至【${otherTask ? this.escapeHtml(otherTask.title) : ''}】作為主角方塊">
                <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;margin-bottom:4px;">
                  <span style="font-size:11px;font-weight:700;color:${meta.color};background:${meta.bg};padding:2px 7px;border-radius:99px;">
                    ${isOutgoing ? "↗ 輸出影響" : "↙ 接收支撐"} ・ ${this.escapeHtml(c.label)}
                  </span>
                  <div style="display:flex;align-items:center;gap:4px;">
                    <button type="button" class="btn-icon-text" style="padding:1px 6px;font-size:10.5px;"
                            onclick="event.stopPropagation(); App.openEditConnectionModal('${c.id}')" title="編輯此關聯線">✎</button>
                  </div>
                </div>
                <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;margin-bottom:4px;">
                  <div style="display:flex;align-items:center;gap:6px;min-width:0;">
                    <span style="width:8px;height:8px;border-radius:50%;background:${otherPillar.color};flex-shrink:0;"></span>
                    <span style="font-size:13px;font-weight:700;color:var(--ink-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                      ${otherTask ? this.escapeHtml(otherTask.title) : "未知方塊"}
                    </span>
                  </div>
                  <span class="jump-protagonist-pill">設為主角 ➔</span>
                </div>
                <div style="font-size:11.5px;color:var(--ink-secondary);line-height:1.45;">
                  ${this.escapeHtml(c.reason || "")}
                </div>
              </div>
            `;
          }).join("")
        : `
          <div style="padding:12px;border-radius:10px;background:rgba(255,255,255,0.65);border:1px dashed var(--border-warm);font-size:12px;color:var(--ink-secondary);text-align:center;">
            此方塊目前尚無關聯連線。<br/>
            <button type="button" class="btn btn-xs btn-soft" style="margin-top:6px;" onclick="App.openConnectionModal('${protagonistTask.id}')">＋ 為此方塊新增關聯</button>
          </div>
        `;

      box.innerHTML = `
        <div class="floating-panel-inner">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;margin-bottom:8px;">
            <span class="inspector-badge" style="background:${pillar.bgSoft || '#E7EFE8'};color:${pillar.color};margin-bottom:0;">
              ● ${this.escapeHtml(pillar.title)}
            </span>
            <button type="button" class="btn-icon-text" style="font-size:11px;padding:2px 8px;" onclick="App.clearGraphFocus()">返回全覽</button>
          </div>

          <!-- Selected Block Details (點選的方塊細節) -->
          <div class="protagonist-detail-card" style="border-left:4px solid ${pillar.color};">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
              <div>
                <div style="font-size:10.5px;font-weight:700;color:${pillar.color};letter-spacing:0.03em;margin-bottom:2px;">🌟 當前主角方塊</div>
                <div style="font-size:15px;font-weight:700;color:var(--ink-primary);line-height:1.35;">
                  ${this.escapeHtml(protagonistTask.title)}
                </div>
              </div>
              <button type="button" class="btn-icon-text" style="font-size:11px;padding:2px 7px;flex-shrink:0;"
                      onclick="App.openTaskModal('${protagonistTask.id}')">✎ 編輯</button>
            </div>
            <p style="font-size:12px;color:var(--ink-secondary);line-height:1.5;margin:6px 0 8px;">
              ${this.escapeHtml(protagonistTask.summary || "尚無任務摘要描述")}
            </p>
            <div style="display:flex;flex-wrap:wrap;gap:6px;font-size:11px;color:var(--ink-muted);">
              ${protagonistTask.enableTracker
                ? `<span style="background:#FFF;padding:2px 8px;border-radius:99px;border:1px solid var(--border-subtle);">🌰 自評 ${protagonistTask.tracker.selfScore}/10</span>
                   <span style="background:#FFF;padding:2px 8px;border-radius:99px;border:1px solid var(--border-subtle);">🤖 AI 完成度 ${protagonistTask.tracker.aiCompletion || 0}%</span>`
                : `<span style="background:#FFF;padding:2px 8px;border-radius:99px;border:1px solid var(--border-subtle);">🌿 無壓力純筆記模式</span>`}
              <span style="background:#FFF;padding:2px 8px;border-radius:99px;border:1px solid var(--border-subtle);">📓 筆記 ${notesCount} 篇</span>
            </div>
          </div>

          <!-- Connected Blocks List (連接的方塊有哪些 + 點擊跳轉為主角) -->
          <div style="display:flex;justify-content:space-between;align-items:center;margin:10px 0 6px;">
            <span style="font-size:12px;font-weight:700;color:var(--ink-primary);">
              🔗 連接的方塊（${relatedConns.length}）
            </span>
            <span style="font-size:11px;color:var(--sage-primary);font-weight:600;">點擊可跳轉為主角</span>
          </div>
          <div class="connected-blocks-list">
            ${connectedCardsHtml}
          </div>
        </div>
      `;
      return;
    }

    // 2. If a Life Pillar is selected in the Left Sidebar (without a single Protagonist task yet):
    if (this.selectedPillarId && this.selectedPillarId !== "ALL" && !this.graphHighlightConnOnly) {
      const activePillar = this.data.pillars.find(p => p.id === this.selectedPillarId);
      if (activePillar) {
        const pillarTasks = this.data.tasks.filter(t => t.pillarId === activePillar.id);
        const cardsHtml = pillarTasks.map(t => {
          const cCount = this.data.connections.filter(c => c.fromTaskId === t.id || c.toTaskId === t.id).length;
          return `
            <div class="connected-block-card" onclick="App.focusTaskAsProtagonist('${t.id}')">
              <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;margin-bottom:3px;">
                <span style="font-size:13px;font-weight:700;color:var(--ink-primary);">
                  ${this.escapeHtml(t.title)}
                </span>
                <span class="jump-protagonist-pill">設為主角 ➔</span>
              </div>
              <div style="font-size:11.5px;color:var(--ink-secondary);line-height:1.4;margin-bottom:4px;">
                ${this.escapeHtml(this.truncate(t.summary || "點擊檢視此方塊與其關聯網路", 36))}
              </div>
              <div style="font-size:11px;color:var(--ink-muted);">
                🔗 關聯方塊 ${cCount} 個 ・ 📓 筆記 ${t.notes ? t.notes.length : 0} 篇
              </div>
            </div>
          `;
        }).join("");

        box.innerHTML = `
          <div class="floating-panel-inner">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
              <span class="inspector-badge" style="background:${activePillar.bgSoft};color:${activePillar.color};margin-bottom:0;">
                🌲 人生大事項已置頂點亮
              </span>
              <button type="button" class="btn-icon-text" style="font-size:11px;padding:2px 8px;" onclick="App.clearGraphFocus()">返回全覽</button>
            </div>
            <div style="font-size:15px;font-weight:700;color:${activePillar.color};margin-bottom:3px;">
              ${this.escapeHtml(activePillar.title)}
            </div>
            <div style="font-size:12px;color:var(--ink-secondary);margin-bottom:10px;">
              ${this.escapeHtml(activePillar.subtitle || "已將此大事項相關方塊移至最上層。點選下方任一任務即可檢視其連線方塊：")}
            </div>
            <div style="font-size:12px;font-weight:700;color:var(--ink-primary);margin-bottom:6px;">
              📌 此大事項的方塊（${pillarTasks.length}）：
            </div>
            <div class="connected-blocks-list">
              ${cardsHtml || `<div style="font-size:12px;color:var(--ink-muted);">尚無方塊</div>`}
            </div>
          </div>
        `;
        return;
      }
    }

    // 3. Fallback / Overview or Specific Connection Line clicked:
    if (this.graphHighlightConnOnly && this.selectedConnId) {
      const conn = this.data.connections.find(c => c.id === this.selectedConnId);
      if (conn) {
        const fromTask = this.data.tasks.find(t => t.id === conn.fromTaskId);
        const toTask = this.data.tasks.find(t => t.id === conn.toTaskId);
        const meta = CONN_TYPE_META[conn.type] || CONN_TYPE_META.synergy;

        box.innerHTML = `
          <div class="floating-panel-inner">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
              <span class="inspector-badge" style="background:${meta.bg};color:${meta.color};margin-bottom:0;">
                ${meta.label} ・ 關聯度 ${conn.strength || 85}%
              </span>
              <button type="button" class="btn-icon-text" style="font-size:11px;padding:2px 8px;" onclick="App.clearGraphFocus()">返回全覽</button>
            </div>
            <div class="inspector-title">${this.escapeHtml(conn.label)}</div>
            <div class="inspector-reason" style="margin-bottom:10px;">
              ${this.escapeHtml(conn.reason)}
            </div>
            <div style="font-size:12px;font-weight:700;color:var(--ink-primary);margin-bottom:6px;">
              🔗 此關聯線連接的兩個方塊（點擊跳轉為主角）：
            </div>
            ${fromTask ? `
              <div class="connected-block-card" onclick="App.focusTaskAsProtagonist('${fromTask.id}')">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                  <span style="font-size:13px;font-weight:700;">↗ 起點：${this.escapeHtml(fromTask.title)}</span>
                  <span class="jump-protagonist-pill">設為主角 ➔</span>
                </div>
              </div>
            ` : ""}
            ${toTask ? `
              <div class="connected-block-card" onclick="App.focusTaskAsProtagonist('${toTask.id}')">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                  <span style="font-size:13px;font-weight:700;">↙ 終點：${this.escapeHtml(toTask.title)}</span>
                  <span class="jump-protagonist-pill">設為主角 ➔</span>
                </div>
              </div>
            ` : ""}
            <div style="display:flex;justify-content:flex-end;gap:6px;margin-top:8px;">
              <button class="btn btn-xs btn-soft" onclick="App.openEditConnectionModal('${conn.id}')">✎ 編輯關聯</button>
              <button class="btn btn-xs btn-danger-ghost" onclick="App.deleteConnection('${conn.id}')">移除</button>
            </div>
          </div>
        `;
        return;
      }
    }

    // 4. Default Standby Overview in Right Floating Panel: list quick access or default selected task preview
    const quickTasks = this.data.tasks.slice(0, 6);
    box.innerHTML = `
      <div class="floating-panel-inner">
        <span class="inspector-badge" style="background:var(--sage-soft);color:var(--sage-primary)">🦌 集中式關聯細節面板</span>
        <div class="inspector-title" style="font-size:14.5px;margin-bottom:4px;">點選任一方塊檢視細節與連線</div>
        <p class="inspector-reason" style="font-size:12px;margin-bottom:10px;">
          • 從<strong>左側選單</strong>點選「人生大事項」，相關方塊會亮起並置於最上層。<br/>
          • 點選任一<strong>任務方塊</strong>，即可顯示方塊細節與連接清單，並快速跳轉主角！
        </p>
        <div style="font-size:12px;font-weight:700;color:var(--ink-primary);margin-bottom:6px;">
          🎯 快速選擇主角方塊：
        </div>
        <div class="connected-blocks-list">
          ${quickTasks.map(t => {
            const p = this.data.pillars.find(pil => pil.id === t.pillarId) || { color: "#5F7464", title: "未分類" };
            const cCount = this.data.connections.filter(c => c.fromTaskId === t.id || c.toTaskId === t.id).length;
            return `
              <div class="connected-block-card" onclick="App.focusTaskAsProtagonist('${t.id}')">
                <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;">
                  <div style="display:flex;align-items:center;gap:6px;min-width:0;">
                    <span style="width:8px;height:8px;border-radius:50%;background:${p.color};flex-shrink:0;"></span>
                    <span style="font-size:12.5px;font-weight:700;color:var(--ink-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                      ${this.escapeHtml(t.title)}
                    </span>
                  </div>
                  <span class="jump-protagonist-pill">🔗${cCount} 設為主角 ➔</span>
                </div>
              </div>
            `;
          }).join("")}
        </div>
      </div>
    `;
  },

  selectConnection(connId) {
    this.selectedConnId = connId;
    this.graphFocusTaskId = null;
    this.graphHighlightConnOnly = true;
    this.renderBlueprintGraph();
    this.renderConnectionInspector();
  },

  selectTaskFromGraph(taskId) {
    if (!taskId) return;
    this.focusTaskAsProtagonist(taskId);
  },

  // =========================================================================
  // SECTION B: PILLARS & TASKS SIDEBAR
  // =========================================================================
  renderPillarsSidebar() {
    const listEl = document.getElementById("pillarsList");
    const allCount = this.data.tasks.length;

    let html = `
      <div class="pillar-item ${this.selectedPillarId === 'ALL' ? 'active' : ''}" onclick="App.selectPillar('ALL')">
        <div class="pillar-guardian-thumb">${window.NordicIllustrations.guardians.deer}</div>
        <div class="pillar-info">
          <div class="pillar-title-row">
            <span class="pillar-name">全部人生大項目</span>
            <span class="pillar-count">${allCount} 項任務</span>
          </div>
          <div class="pillar-desc">一覽所有領域的規劃與進度</div>
        </div>
      </div>
    `;

    this.data.pillars.forEach(p => {
      const count = this.data.tasks.filter(t => t.pillarId === p.id).length;
      const svg = window.NordicIllustrations.guardians[p.guardian] || window.NordicIllustrations.guardians.deer;
      const isActive = this.selectedPillarId === p.id;

      html += `
        <div class="pillar-item ${isActive ? 'active' : ''}" onclick="App.selectPillar('${p.id}')">
          <div class="pillar-guardian-thumb">${svg}</div>
          <div class="pillar-info">
            <div class="pillar-title-row">
              <span class="pillar-name" style="color:${p.color}">${this.escapeHtml(p.title)}</span>
              <div>
                <span class="pillar-count">${count}</span>
                <button class="pillar-edit-btn" title="編輯此大項目" onclick="event.stopPropagation(); App.openPillarModal('${p.id}')">✎</button>
              </div>
            </div>
            <div class="pillar-desc">${this.escapeHtml(p.subtitle || '')}</div>
          </div>
        </div>
      `;
    });

    listEl.innerHTML = html;
  },

  selectPillar(pillarId) {
    this.selectedPillarId = pillarId;
    this.graphFocusTaskId = null;
    this.graphHighlightConnOnly = false;
    const filteredTasks = pillarId === "ALL"
      ? this.data.tasks
      : this.data.tasks.filter(t => t.pillarId === pillarId);

    if (filteredTasks.length > 0 && !filteredTasks.some(t => t.id === this.selectedTaskId)) {
      this.selectedTaskId = filteredTasks[0].id;
    }
    this.renderAll();
  },

  renderTasksSidebar() {
    const listEl = document.getElementById("tasksList");
    const headerEl = document.getElementById("currentPillarTasksHeader");

    const activePillar = this.data.pillars.find(p => p.id === this.selectedPillarId);
    headerEl.textContent = activePillar ? `${activePillar.title} 的細節任務` : "所有細節任務";

    const filtered = this.selectedPillarId === "ALL"
      ? this.data.tasks
      : this.data.tasks.filter(t => t.pillarId === this.selectedPillarId);

    if (filtered.length === 0) {
      listEl.innerHTML = `<div style="padding:14px;text-align:center;font-size:12.5px;color:var(--ink-muted);">此項目下尚無細節任務，請點擊右上角「＋ 新增任務」🌱</div>`;
      return;
    }

    listEl.innerHTML = filtered.map(task => {
      const pillar = this.data.pillars.find(p => p.id === task.pillarId);
      const isActive = this.selectedTaskId === task.id;
      const notesCount = task.notes ? task.notes.length : 0;

      return `
        <div class="task-nav-card ${isActive ? 'active' : ''}" onclick="App.selectTaskFromGraph('${task.id}')">
          <div class="task-nav-top">
            <span class="task-nav-title">${this.escapeHtml(task.title)}</span>
            <div class="task-nav-badges">
              ${task.enableTracker
                ? `<span class="mini-pill score">🌰 ${task.tracker.selfScore}/10</span>`
                : `<span class="mini-pill" style="background:var(--sage-soft);color:var(--sage-primary)">無壓力筆記</span>`}
              <span class="mini-pill notes">📓 ${notesCount}</span>
            </div>
          </div>
          <div class="task-nav-summary">${this.escapeHtml(task.summary || '')}</div>
          ${this.selectedPillarId === 'ALL' && pillar
            ? `<div style="margin-top:6px;font-size:11px;font-weight:700;color:${pillar.color}">● ${this.escapeHtml(pillar.title)}</div>`
            : ''}
        </div>
      `;
    }).join("");
  },

  // =========================================================================
  // ACTIVE TASK STUDIO (HEADER + OPTIONAL TRACKER + CAT NOTEBOOK)
  // =========================================================================
  renderActiveTaskStudio() {
    const area = document.getElementById("taskDetailArea");
    const task = this.data.tasks.find(t => t.id === this.selectedTaskId);

    if (!task) {
      area.innerHTML = `
        <div class="card-surface" style="padding:48px;text-align:center;color:var(--ink-secondary);">
          <div style="width:80px;height:80px;margin:0 auto 12px;">${window.NordicIllustrations.guardians.cat_cozy}</div>
          <h3>選擇左側任一任務，或新增您的第一個細節規劃</h3>
          <p style="font-size:13px;margin-top:6px;">每個任務皆擁有獨立的個人筆記本，並可自由選擇是否開啟進度表與自我評分。</p>
        </div>
      `;
      return;
    }

    const pillar = this.data.pillars.find(p => p.id === task.pillarId) || {
      title: "未分類",
      color: "#5F7464",
      bgSoft: "#E7EFE8",
      guardian: "deer"
    };

    // Find related connections
    const relatedConns = this.data.connections.filter(
      c => c.fromTaskId === task.id || c.toTaskId === task.id
    );

    const relatedHtml = relatedConns.map(c => {
      const otherId = c.fromTaskId === task.id ? c.toTaskId : c.fromTaskId;
      const otherTask = this.data.tasks.find(t => t.id === otherId);
      if (!otherTask) return "";
      const dirArrow = c.fromTaskId === task.id ? "影響 ➔" : "受支撐於 ⬅";
      return `
        <span class="related-chip" onclick="App.selectTaskFromGraph('${otherTask.id}')" title="${this.escapeHtml(c.reason)}">
          <span>🔗 ${dirArrow} ${this.escapeHtml(otherTask.title)}</span>
          <small style="opacity:0.8">(${this.escapeHtml(c.label)})</small>
          <i style="font-style:normal;margin-left:3px;opacity:0.75;padding:0 3px;"
             onclick="event.stopPropagation(); App.openEditConnectionModal('${c.id}')"
             title="編輯此關聯">✎</i>
        </span>
      `;
    }).join("");

    // Filter notes
    const notes = task.notes || [];
    const filteredNotes = this.activeNoteCategory === "ALL"
      ? notes
      : notes.filter(n => n.category === this.activeNoteCategory);

    area.innerHTML = `
      <!-- 1. Task Header Card -->
      <div class="task-header-card card-surface">
        <div class="task-header-top">
          <div>
            <span class="task-pillar-crumb" style="background:${pillar.bgSoft};color:${pillar.color}">
              ● ${this.escapeHtml(pillar.title)}
            </span>
            <h2 class="task-main-title">${this.escapeHtml(task.title)}</h2>
            <p class="task-main-summary">${this.escapeHtml(task.summary || '')}</p>
            <div class="task-tags-row">
              ${(task.tags || []).map(tag => `<span class="tag-badge">#${this.escapeHtml(tag)}</span>`).join("")}
            </div>
          </div>
          <div style="display:flex;gap:8px;">
            <button class="btn btn-xs btn-soft" onclick="App.openTaskModal('${task.id}')">✎ 編輯任務</button>
            <button class="btn btn-xs btn-danger-ghost" onclick="App.deleteTask('${task.id}')">刪除</button>
          </div>
        </div>

        <div class="related-links-strip">
          <span style="font-size:12px;font-weight:700;color:var(--ink-secondary);">🦌 關聯藍圖連結：</span>
          ${relatedHtml || `<span style="font-size:12px;color:var(--ink-muted);">目前尚無關聯連結，可點擊上方「＋ 手動連結關聯」或由 AI 分析產生</span>`}
        </div>
      </div>

      <!-- 2. Optional Progress Tracker & Self-Evaluation Card -->
      <div class="tracker-card card-surface">
        <div class="tracker-top-bar">
          <div class="tracker-title-left">
            <div class="tracker-squirrel-icon">${window.NordicIllustrations.guardians.squirrel}</div>
            <div>
              <h3 style="font-size:16px;">🌰 目標進度表與自我評分欄位</h3>
              <p style="font-size:12px;color:var(--ink-secondary);">您可以自由決定這項任務是否需要設立進度表，或保持單純的筆記紀錄</p>
            </div>
          </div>
          <label class="switch-label" style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;font-weight:700;background:var(--bg-oat);padding:6px 14px;border-radius:999px;border:1px solid var(--border-subtle);">
            <input type="checkbox" ${task.enableTracker ? "checked" : ""} onchange="App.toggleTaskTracker('${task.id}', this.checked)" />
            <span>${task.enableTracker ? "已啟用進度表與自我評分" : "啟用進度表與自我評分"}</span>
          </label>
        </div>

        ${task.enableTracker ? this.renderTrackerExpanded(task) : `
          <div style="margin-top:12px;padding:12px 16px;background:var(--sage-soft);border-radius:var(--radius-sm);font-size:13px;color:var(--sage-primary);display:flex;align-items:center;gap:10px;">
            <span>🍃</span>
            <span>目前此任務為<strong>「無壓力純筆記模式」</strong>——不設立數字目標與評分，讓您輕鬆收集資訊與生活靈感。若想追蹤進度，隨時可勾選右上角開關。</span>
          </div>
        `}
      </div>

      <!-- 3. Personal Notebook Section (with Peeking Nordic Cat!) -->
      <div class="notebook-wrapper">
        <div class="peeking-cat-holder">
          ${window.NordicIllustrations.notebookCatPeeking}
        </div>
        <div class="notebook-card card-surface">
          <div class="section-header" style="margin-bottom:6px;">
            <div style="display:flex;align-items:center;gap:10px;">
              <div style="width:38px;height:38px;">${window.NordicIllustrations.guardians.hedgehog}</div>
              <div>
                <h3 style="font-size:17px;">📓 個人紀錄筆記本（查到的資訊・日常實踐・靈感）</h3>
                <span class="section-subtitle">像翻閱隨身筆記本一樣，隨時記錄您查到的知識、練習心得與微小進步</span>
              </div>
            </div>
            <div style="display:flex;gap:8px;margin-right:95px;">
              <button class="btn btn-xs btn-ai-subtle" onclick="App.askAiForSingleTask('${task.id}')">✨ AI 整理此任務筆記與建議</button>
              <button class="btn btn-primary" onclick="App.openNoteModal()">＋ 新增筆記紀錄</button>
            </div>
          </div>

          <div class="notebook-filter-bar">
            <div class="category-pills">
              ${["ALL", "📚 查到的資訊", "🌿 日常實踐紀錄", "💡 靈感與反思"].map(cat => `
                <button class="cat-filter-btn ${this.activeNoteCategory === cat ? 'active' : ''}"
                        onclick="App.setNoteCategoryFilter('${cat}')">
                  ${cat === "ALL" ? `全部筆記 (${notes.length})` : cat}
                </button>
              `).join("")}
            </div>
          </div>

          ${filteredNotes.length === 0 ? `
            <div style="padding:32px;text-align:center;color:var(--ink-muted);background:rgba(255,255,255,0.65);border-radius:var(--radius-md);border:1px dashed var(--border-warm);">
              目前這個分類還沒有筆記喔！點擊右上角「＋ 新增筆記紀錄」寫下您查到的資訊或日常體會吧 🐾
            </div>
          ` : `
            <div class="notes-grid">
              ${filteredNotes.map(note => `
                <article class="note-entry-card">
                  <div>
                    <span class="note-cat-tag">${this.escapeHtml(note.category || '📚 查到的資訊')}</span>
                    <h4 class="note-entry-title">${this.escapeHtml(note.title)}</h4>
                    <div class="note-entry-content">${this.escapeHtml(note.content)}</div>
                  </div>
                  <div class="note-entry-footer">
                    <span>🕒 ${this.escapeHtml(note.createdAt || '')}</span>
                    <div style="display:flex;gap:8px;">
                      <button class="btn-icon-text" onclick="App.openNoteModal('${note.id}')">編輯</button>
                      <button class="btn-icon-text" style="background:#FDECE9;color:#B95346;" onclick="App.deleteNote('${note.id}')">刪除</button>
                    </div>
                  </div>
                </article>
              `).join("")}
            </div>
          `}
        </div>
      </div>
    `;
  },

  renderTrackerExpanded(task) {
    const tr = task.tracker || { goal: "", selfScore: 5, selfReflection: "", aiCompletion: null, aiFeedback: "", milestones: [] };
    const milestones = tr.milestones || [];
    const doneCount = milestones.filter(m => m.done).length;

    return `
      <div class="tracker-grid">
        <!-- Left Box: Goal & Self-Rating -->
        <div class="tracker-box">
          <div class="tracker-box-label">
            <span>🎯 我的具體目標設定</span>
            <small style="color:var(--ink-muted);font-weight:400;">修改後自動儲存</small>
          </div>
          <textarea class="goal-editable" rows="2" placeholder="寫下您對這個任務的具體期許或習慣目標..."
                    oninput="App.debouncedTrackerSave('${task.id}', 'goal', this.value)"
                    onchange="App.updateTrackerField('${task.id}', 'goal', this.value)">${this.escapeHtml(tr.goal || '')}</textarea>

          <div class="tracker-box-label" style="margin-top:14px;">
            <span>⭐ 自我評分欄位（主觀感受與狀態）</span>
          </div>
          <div class="score-slider-row">
            <span class="score-big-number" id="selfScoreDisplay-${task.id}">${tr.selfScore || 5} <small style="font-size:12px;font-weight:600;color:var(--ink-secondary)">/ 10 分</small></span>
            <input type="range" min="1" max="10" step="1" value="${tr.selfScore || 5}" class="nordic-slider"
                   oninput="document.getElementById('selfScoreDisplay-${task.id}').innerHTML = this.value + ' <small style=\\'font-size:12px;font-weight:600;color:var(--ink-secondary)\\'>/ 10 分</small>'; App.debouncedTrackerSave('${task.id}', 'selfScore', Number(this.value));"
                   onchange="App.updateTrackerField('${task.id}', 'selfScore', Number(this.value))" />
          </div>

          <div class="tracker-box-label" style="margin-top:8px;">
            <span>💬 自我評分心得 / 目前卡關或順利的地方</span>
          </div>
          <textarea class="goal-editable" rows="2" placeholder="記錄為什麼給自己這個分數..."
                    oninput="App.debouncedTrackerSave('${task.id}', 'selfReflection', this.value)"
                    onchange="App.updateTrackerField('${task.id}', 'selfReflection', this.value)">${this.escapeHtml(tr.selfReflection || '')}</textarea>

          <div class="ai-completion-meter">
            <div style="display:flex;justify-content:space-between;font-size:12.5px;font-weight:700;">
              <span style="color:var(--terracotta)">🦌 AI 綜合完成度與回饋評估</span>
              <span>${tr.aiCompletion != null ? `${tr.aiCompletion}%` : "等待 AI 分析"}</span>
            </div>
            <div class="meter-bar-bg">
              <div class="meter-bar-fill" style="width:${tr.aiCompletion || 0}%"></div>
            </div>
            <p style="font-size:12.5px;color:var(--ink-secondary);margin-top:4px;">
              ${this.escapeHtml(tr.aiFeedback || "點擊上方「✨ AI 鹿與貓分析藍圖」，AI 會綜合您的筆記內容、里程碑與自我評分，給出客觀溫暖的完成度洞察。")}
            </p>
          </div>
        </div>

        <!-- Right Box: Actionable Milestones Checklist -->
        <div class="tracker-box">
          <div class="tracker-box-label">
            <span>✅ 實踐小步驟 / 進度里程碑</span>
            <span>已完成 ${doneCount} / ${milestones.length}</span>
          </div>
          <div class="milestones-list">
            ${milestones.length === 0 ? `<div style="font-size:12.5px;color:var(--ink-muted);padding:8px 0;">尚無子步驟，可在下方新增想嘗試的小行動 🌱</div>` : ""}
            ${milestones.map(m => `
              <div class="milestone-row ${m.done ? 'done' : ''}">
                <input type="checkbox" ${m.done ? 'checked' : ''} onchange="App.toggleMilestone('${task.id}', '${m.id}')" style="cursor:pointer;" />
                <span style="flex:1">${this.escapeHtml(m.text)}</span>
                <button style="border:none;background:transparent;color:var(--ink-muted);cursor:pointer;font-size:12px;"
                        onclick="App.deleteMilestone('${task.id}', '${m.id}')">✕</button>
              </div>
            `).join("")}
          </div>
          <div class="milestone-add-row">
            <input type="text" class="form-input" id="newMilestoneInput-${task.id}" placeholder="新增一個具體小行動..."
                   onkeydown="if(event.key==='Enter') App.addMilestone('${task.id}')" />
            <button class="btn btn-xs btn-primary" onclick="App.addMilestone('${task.id}')">新增</button>
          </div>
        </div>
      </div>
    `;
  },

  toggleTaskTracker(taskId, enabled) {
    const task = this.data.tasks.find(t => t.id === taskId);
    if (!task) return;
    task.enableTracker = enabled;
    if (!task.tracker) {
      task.tracker = { goal: "", selfScore: 6, selfReflection: "", aiCompletion: null, aiFeedback: "", milestones: [] };
    }
    this.saveData(enabled ? "已開啟此任務的進度表與自我評分 🌰" : "已切換為無壓力純筆記模式 🍃");
    this.renderAll();
  },

  _trackerSaveTimer: null,
  debouncedTrackerSave(taskId, field, value) {
    const task = this.data.tasks.find(t => t.id === taskId);
    if (!task || !task.tracker) return;
    task.tracker[field] = value;
    if (this._trackerSaveTimer) clearTimeout(this._trackerSaveTimer);
    this._trackerSaveTimer = setTimeout(() => {
      this.saveData();
    }, 300);
  },

  updateTrackerField(taskId, field, value) {
    const task = this.data.tasks.find(t => t.id === taskId);
    if (!task || !task.tracker) return;
    task.tracker[field] = value;
    this.saveData("進度與評分已自動儲存 ✨");
    this.renderBlueprintGraph();
    this.renderTasksSidebar();
  },

  addMilestone(taskId) {
    const input = document.getElementById(`newMilestoneInput-${taskId}`);
    if (!input || !input.value.trim()) return;
    const task = this.data.tasks.find(t => t.id === taskId);
    if (!task) return;
    if (!task.tracker.milestones) task.tracker.milestones = [];
    task.tracker.milestones.push({
      id: "ms-" + Date.now(),
      text: input.value.trim(),
      done: false
    });
    input.value = "";
    this.saveData("已新增實踐小步驟 🌱");
    this.renderActiveTaskStudio();
  },

  toggleMilestone(taskId, msId) {
    const task = this.data.tasks.find(t => t.id === taskId);
    if (!task || !task.tracker || !task.tracker.milestones) return;
    const ms = task.tracker.milestones.find(m => m.id === msId);
    if (ms) ms.done = !ms.done;
    this.saveData();
    this.renderActiveTaskStudio();
  },

  deleteMilestone(taskId, msId) {
    const task = this.data.tasks.find(t => t.id === taskId);
    if (!task || !task.tracker || !task.tracker.milestones) return;
    task.tracker.milestones = task.tracker.milestones.filter(m => m.id !== msId);
    this.saveData();
    this.renderActiveTaskStudio();
  },

  setNoteCategoryFilter(cat) {
    this.activeNoteCategory = cat;
    this.renderActiveTaskStudio();
  },

  // =========================================================================
  // CRUD MODALS FOR PILLARS, TASKS, NOTES, CONNECTIONS
  // =========================================================================
  openModal(id) {
    document.getElementById(id).classList.remove("hidden");
  },
  closeModal(id) {
    if (id === "aiModal" && this.isAiAnalyzing) {
      const warnBanner = document.getElementById("aiCloseWarningBanner");
      if (warnBanner) {
        warnBanner.classList.remove("hidden");
        warnBanner.style.animation = "none";
        void warnBanner.offsetWidth;
        warnBanner.style.animation = "warnPulse 0.35s ease";
      }
      this.showToast("⚠️ AI 分析請求已送出且正在運算中，請確認是否仍要離開！");
      return;
    }
    if (id === "settingsModal") {
      this.saveGithubSyncConfig(false);
    } else if (id === "aiModal") {
      this.saveApiSettingsQuietly(false);
    }
    const warnBanner = document.getElementById("aiCloseWarningBanner");
    if (warnBanner) warnBanner.classList.add("hidden");
    document.getElementById(id).classList.add("hidden");
  },
  dismissCloseWarning() {
    const warnBanner = document.getElementById("aiCloseWarningBanner");
    if (warnBanner) warnBanner.classList.add("hidden");
  },
  forceCloseAiModal() {
    this.isAiAnalyzing = false;
    const warnBanner = document.getElementById("aiCloseWarningBanner");
    if (warnBanner) warnBanner.classList.add("hidden");
    document.getElementById("aiModal").classList.add("hidden");
    this.showToast("已關閉分析設定視窗");
  },

  openPillarModal(pillarId = null) {
    const pillar = pillarId ? this.data.pillars.find(p => p.id === pillarId) : null;
    document.getElementById("pillarModalTitle").textContent = pillar ? "編輯人生大項目" : "新增人生大項目";
    document.getElementById("pillarFormId").value = pillar ? pillar.id : "";
    document.getElementById("pillarFormTitle").value = pillar ? pillar.title : "";
    document.getElementById("pillarFormSubtitle").value = pillar ? (pillar.subtitle || "") : "";
    document.getElementById("pillarDeleteBtn").style.display = pillar ? "inline-flex" : "none";

    this.selectedGuardianInModal = pillar ? pillar.guardian : "deer";
    this.selectedColorInModal = pillar
      ? (NORDIC_COLORS.find(c => c.color === pillar.color) || NORDIC_COLORS[0])
      : NORDIC_COLORS[0];

    this.renderPillarModalPickers();
    this.openModal("pillarModal");
  },

  renderPillarModalPickers() {
    const gPicker = document.getElementById("pillarGuardianPicker");
    gPicker.innerHTML = Object.values(GUARDIAN_META).map(g => `
      <div class="guardian-option ${this.selectedGuardianInModal === g.key ? 'selected' : ''}"
           onclick="App.selectedGuardianInModal='${g.key}'; App.renderPillarModalPickers();">
        ${window.NordicIllustrations.guardians[g.key]}
        <span>${g.label}</span>
      </div>
    `).join("");

    const cPicker = document.getElementById("pillarColorPicker");
    cPicker.innerHTML = NORDIC_COLORS.map((c, idx) => `
      <div class="color-swatch ${this.selectedColorInModal.color === c.color ? 'selected' : ''}"
           style="background:${c.color}" title="${c.name}"
           onclick="App.selectedColorInModal=NORDIC_COLORS[${idx}]; App.renderPillarModalPickers();"></div>
    `).join("");
  },

  savePillarForm() {
    const id = document.getElementById("pillarFormId").value;
    const title = document.getElementById("pillarFormTitle").value.trim();
    const subtitle = document.getElementById("pillarFormSubtitle").value.trim();
    if (!title) {
      this.showToast("請輸入大項目名稱");
      return;
    }

    if (id) {
      const p = this.data.pillars.find(x => x.id === id);
      if (p) {
        p.title = title;
        p.subtitle = subtitle;
        p.guardian = this.selectedGuardianInModal;
        p.color = this.selectedColorInModal.color;
        p.bgSoft = this.selectedColorInModal.bgSoft;
      }
    } else {
      const newId = "pillar-" + Date.now();
      this.data.pillars.push({
        id: newId,
        title,
        subtitle,
        guardian: this.selectedGuardianInModal,
        color: this.selectedColorInModal.color,
        bgSoft: this.selectedColorInModal.bgSoft
      });
      this.selectedPillarId = newId;
    }

    this.closeModal("pillarModal");
    this.saveData("已儲存人生大項目 🌲");
    this.renderAll();
  },

  deleteCurrentPillar() {
    const id = document.getElementById("pillarFormId").value;
    if (!id) return;
    if (!confirm("確定要刪除此大項目嗎？其下的任務將會保留並歸入第一個項目。")) return;

    this.data.pillars = this.data.pillars.filter(p => p.id !== id);
    const fallbackPillarId = this.data.pillars[0] ? this.data.pillars[0].id : "";
    this.data.tasks.forEach(t => {
      if (t.pillarId === id) t.pillarId = fallbackPillarId;
    });
    this.selectedPillarId = "ALL";
    this.closeModal("pillarModal");
    this.saveData("已刪除大項目");
    this.renderAll();
  },

  openTaskModal(taskId = null) {
    const task = taskId ? this.data.tasks.find(t => t.id === taskId) : null;
    document.getElementById("taskModalTitle").textContent = task ? "編輯細節規劃任務" : "新增細節規劃任務";
    document.getElementById("taskFormId").value = task ? task.id : "";

    const selectEl = document.getElementById("taskFormPillarId");
    selectEl.innerHTML = this.data.pillars.map(p =>
      `<option value="${p.id}">${this.escapeHtml(p.title)}</option>`
    ).join("");

    if (task) {
      selectEl.value = task.pillarId;
    } else if (this.selectedPillarId !== "ALL") {
      selectEl.value = this.selectedPillarId;
    }

    document.getElementById("taskFormTitle").value = task ? task.title : "";
    document.getElementById("taskFormSummary").value = task ? (task.summary || "") : "";
    document.getElementById("taskFormTags").value = task && task.tags ? task.tags.join(", ") : "";
    document.getElementById("taskFormEnableTracker").checked = task ? !!task.enableTracker : true;

    this.openModal("taskModal");
  },

  saveTaskForm() {
    const id = document.getElementById("taskFormId").value;
    const pillarId = document.getElementById("taskFormPillarId").value;
    const title = document.getElementById("taskFormTitle").value.trim();
    const summary = document.getElementById("taskFormSummary").value.trim();
    const tagsRaw = document.getElementById("taskFormTags").value;
    const enableTracker = document.getElementById("taskFormEnableTracker").checked;

    if (!title) {
      this.showToast("請輸入任務名稱");
      return;
    }

    const tags = tagsRaw.split(/[,，、]/).map(s => s.trim()).filter(Boolean);

    if (id) {
      const t = this.data.tasks.find(x => x.id === id);
      if (t) {
        t.pillarId = pillarId;
        t.title = title;
        t.summary = summary;
        t.tags = tags;
        t.enableTracker = enableTracker;
      }
    } else {
      const newTask = {
        id: "task-" + Date.now(),
        pillarId,
        title,
        summary,
        tags,
        enableTracker,
        tracker: {
          goal: "",
          selfScore: 6,
          selfReflection: "",
          aiCompletion: null,
          aiFeedback: "",
          milestones: []
        },
        notes: []
      };
      this.data.tasks.push(newTask);
      this.selectedTaskId = newTask.id;
    }

    this.closeModal("taskModal");
    this.saveData("已儲存細節任務 🎯");
    this.renderAll();
  },

  deleteTask(taskId) {
    if (!confirm("確定要刪除這項任務與其中的筆記嗎？")) return;
    this.data.tasks = this.data.tasks.filter(t => t.id !== taskId);
    this.data.connections = this.data.connections.filter(c => c.fromTaskId !== taskId && c.toTaskId !== taskId);
    this.selectedTaskId = this.data.tasks[0] ? this.data.tasks[0].id : null;
    this.saveData("已刪除任務");
    this.renderAll();
  },

  openNoteModal(noteId = null) {
    const task = this.data.tasks.find(t => t.id === this.selectedTaskId);
    if (!task) return;
    const note = noteId ? (task.notes || []).find(n => n.id === noteId) : null;

    document.getElementById("noteModalTitle").textContent = note ? "🐱 編輯筆記紀錄" : "🐱 撰寫任務筆記紀錄";
    document.getElementById("noteFormId").value = note ? note.id : "";
    document.getElementById("noteFormCategory").value = note ? note.category : "📚 查到的資訊";
    document.getElementById("noteFormTitle").value = note ? note.title : "";
    document.getElementById("noteFormContent").value = note ? note.content : "";

    this.openModal("noteModal");
  },

  saveNoteForm() {
    const task = this.data.tasks.find(t => t.id === this.selectedTaskId);
    if (!task) return;
    const id = document.getElementById("noteFormId").value;
    const category = document.getElementById("noteFormCategory").value;
    const title = document.getElementById("noteFormTitle").value.trim();
    const content = document.getElementById("noteFormContent").value.trim();

    if (!title && !content) {
      this.showToast("請填寫筆記標題或內容");
      return;
    }

    if (!task.notes) task.notes = [];
    if (id) {
      const existing = task.notes.find(n => n.id === id);
      if (existing) {
        existing.category = category;
        existing.title = title || "無標題筆記";
        existing.content = content;
      }
    } else {
      const now = new Date();
      const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      task.notes.unshift({
        id: "note-" + Date.now(),
        category,
        title: title || "日常筆記",
        content,
        createdAt: dateStr
      });
    }

    this.closeModal("noteModal");
    this.saveData("筆記已收進貓咪筆記本 📓");
    this.renderAll();
  },

  deleteNote(noteId) {
    const task = this.data.tasks.find(t => t.id === this.selectedTaskId);
    if (!task || !task.notes) return;
    task.notes = task.notes.filter(n => n.id !== noteId);
    this.saveData("已移除該篇筆記");
    this.renderAll();
  },

  openAddConnectionModal(connId = null) {
    if (this.data.tasks.length < 2) {
      this.showToast("請先建立至少兩個任務，才能連結它們之間的關聯喔！");
      return;
    }
    const existing = connId ? this.data.connections.find(c => c.id === connId) : null;

    const opts = this.data.tasks.map(t => {
      const p = this.data.pillars.find(x => x.id === t.pillarId);
      return `<option value="${t.id}">【${p ? this.escapeHtml(p.title) : ''}】${this.escapeHtml(t.title)}</option>`;
    }).join("");

    document.getElementById("connFormFrom").innerHTML = opts;
    document.getElementById("connFormTo").innerHTML = opts;

    const titleEl = document.getElementById("connModalTitle");
    const saveBtnEl = document.getElementById("connSaveBtn");
    const delBtnEl = document.getElementById("connDeleteInModalBtn");

    if (existing) {
      document.getElementById("connFormId").value = existing.id;
      document.getElementById("connFormFrom").value = existing.fromTaskId;
      document.getElementById("connFormTo").value = existing.toTaskId;
      document.getElementById("connFormType").value = existing.type || "synergy";
      document.getElementById("connFormLabel").value = existing.label || "";
      document.getElementById("connFormReason").value = existing.reason || "";
      const stVal = existing.strength || 85;
      document.getElementById("connFormStrength").value = stVal;
      document.getElementById("connStrengthVal").textContent = stVal;
      if (titleEl) titleEl.textContent = "🦌 編輯人生規劃間的關聯";
      if (saveBtnEl) saveBtnEl.textContent = "儲存關聯修改";
      if (delBtnEl) delBtnEl.style.display = "inline-flex";
    } else {
      document.getElementById("connFormId").value = "";
      if (this.data.tasks.length >= 2) {
        const defaultFrom = this.selectedTaskId || this.data.tasks[0].id;
        const defaultTo = this.data.tasks.find(t => t.id !== defaultFrom)?.id || this.data.tasks[1].id;
        document.getElementById("connFormFrom").value = defaultFrom;
        document.getElementById("connFormTo").value = defaultTo;
      }
      document.getElementById("connFormType").value = "foundation";
      document.getElementById("connFormLabel").value = "";
      document.getElementById("connFormReason").value = "";
      document.getElementById("connFormStrength").value = 85;
      document.getElementById("connStrengthVal").textContent = 85;
      if (titleEl) titleEl.textContent = "🦌 建立人生規劃間的關聯";
      if (saveBtnEl) saveBtnEl.textContent = "新增關聯線";
      if (delBtnEl) delBtnEl.style.display = "none";
    }

    this.openModal("connectionModal");
  },

  openEditConnectionModal(connId) {
    if (!connId) return;
    this.openAddConnectionModal(connId);
  },

  swapConnectionEndpoints() {
    const fromEl = document.getElementById("connFormFrom");
    const toEl = document.getElementById("connFormTo");
    const tmp = fromEl.value;
    fromEl.value = toEl.value;
    toEl.value = tmp;
  },

  deleteConnFromModal() {
    const id = document.getElementById("connFormId").value;
    if (!id) return;
    this.closeModal("connectionModal");
    this.deleteConnection(id);
  },

  saveConnectionForm() {
    const connId = document.getElementById("connFormId").value;
    const fromTaskId = document.getElementById("connFormFrom").value;
    const toTaskId = document.getElementById("connFormTo").value;
    const type = document.getElementById("connFormType").value;
    const label = document.getElementById("connFormLabel").value.trim() || "彼此影響";
    const reason = document.getElementById("connFormReason").value.trim() || "這兩個規劃在生活中互相支持。";
    const strength = Number(document.getElementById("connFormStrength").value) || 85;

    if (fromTaskId === toTaskId) {
      this.showToast("請選擇兩個不同的任務進行連結");
      return;
    }

    if (connId) {
      const existing = this.data.connections.find(c => c.id === connId);
      if (existing) {
        existing.fromTaskId = fromTaskId;
        existing.toTaskId = toTaskId;
        existing.type = type;
        existing.label = label;
        existing.reason = reason;
        existing.strength = strength;
        existing.source = "manual"; // Preserve user-edited connection across future AI runs
        this.selectedConnId = existing.id;
      }
      this.closeModal("connectionModal");
      this.saveData("已儲存關聯線修改 ✨");
    } else {
      const newConn = {
        id: "conn-" + Date.now(),
        fromTaskId,
        toTaskId,
        type,
        label,
        reason,
        strength,
        source: "manual"
      };
      this.data.connections.push(newConn);
      this.selectedConnId = newConn.id;
      this.closeModal("connectionModal");
      this.saveData("已建立新的藍圖關聯線 🦌");
    }

    this.renderAll();
  },

  deleteConnection(connId) {
    this.data.connections = this.data.connections.filter(c => c.id !== connId);
    this.selectedConnId = this.data.connections[0] ? this.data.connections[0].id : null;
    this.saveData("已移除關聯線");
    this.renderAll();
  },

  // =========================================================================
  // GEMINI AI INTEGRATION (API DIRECT + GOOGLE AI PRO WEB BRIDGE)
  // =========================================================================
  getModelAdequacyLabel(modelId, rankIndex = 0) {
    if (modelId.includes("pro")) {
      if (rankIndex === 2) {
        return `${modelId} 【🌿 標準夠用・穩定備援｜進階邏輯分析】`;
      }
      return `${modelId} 【🧠 極度夠用・深度洞察｜適合大量筆記深層推理】`;
    }
    if (modelId.includes("flash")) {
      if (rankIndex === 0) {
        return `${modelId} 【⭐ 非常夠用・最推薦｜速度與推理兼具】`;
      }
      return `${modelId} 【🌿 標準夠用・穩定備援｜日常關聯分析】`;
    }
    return `${modelId} 【🌿 標準夠用】`;
  },

  populateTop3ModelSelect(modelList, selectedModel) {
    const selectEl = document.getElementById("aiModelSelect");
    if (!selectEl) return;
    const top3 = modelList.slice(0, 3);
    selectEl.innerHTML = top3
      .map((m, idx) => `<option value="${m}">${this.escapeHtml(this.getModelAdequacyLabel(m, idx))}</option>`)
      .join("");
    if (top3.includes(selectedModel)) {
      selectEl.value = selectedModel;
    } else if (top3.length > 0) {
      selectEl.value = top3[0];
    }
  },

  openAIAnalysisModal() {
    document.getElementById("aiApiKeyInput").value = (this.data.settings && this.data.settings.apiKey) || "";
    const currentModel = (this.data.settings && this.data.settings.model) || "gemini-3.8-flash";
    const defaultMainstream3 = ["gemini-3.8-flash", "gemini-3.8-pro", "gemini-3.5-pro"];
    if (!defaultMainstream3.includes(currentModel)) {
      defaultMainstream3[0] = currentModel;
    }
    this.populateTop3ModelSelect(defaultMainstream3, currentModel);
    const warnBanner = document.getElementById("aiCloseWarningBanner");
    if (warnBanner) warnBanner.classList.add("hidden");
    if (!this.isAiAnalyzing) {
      document.getElementById("aiApiStatusBox").classList.add("hidden");
    }
    this.openModal("aiModal");
  },

  async fetchAvailableModels() {
    const apiKey = document.getElementById("aiApiKeyInput").value.trim();
    const statusBox = document.getElementById("aiApiStatusBox");
    if (!apiKey) {
      this.showToast("請先在左方輸入 API Key 再點擊自動偵測 🔑");
      return;
    }
    statusBox.classList.remove("hidden");
    statusBox.innerHTML = "🔄 正在向 Google AI Studio 偵測並篩選前三大主流模型（自動排除過輕量模型）...";
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      // Exclude lightweight (lite/nano/8b) and specialized/experimental models; keep only mainstream flash & pro
      const rawModels = (data.models || [])
        .filter(m => (m.supportedGenerationMethods || []).includes("generateContent"))
        .map(m => m.name.replace(/^models\//, ""))
        .filter(name => /^gemini-\d+\.\d+-(flash|pro)$/.test(name));

      // Sort by version descending, preferring flash first as daily recommended, then pro
      rawModels.sort((a, b) => {
        const verA = parseFloat((a.match(/gemini-(\d+\.\d+)/) || [0, 0])[1]);
        const verB = parseFloat((b.match(/gemini-(\d+\.\d+)/) || [0, 0])[1]);
        if (verB !== verA) return verB - verA;
        if (a.endsWith("-flash") && b.endsWith("-pro")) return -1;
        if (a.endsWith("-pro") && b.endsWith("-flash")) return 1;
        return 0;
      });

      const curated3 = rawModels.length >= 1
        ? rawModels.slice(0, 3)
        : ["gemini-3.8-flash", "gemini-3.8-pro", "gemini-3.5-pro"];

      this.populateTop3ModelSelect(curated3, curated3[0]);
      this.SaveApiSettingsOnly();
      statusBox.innerHTML = `✅ 已為您篩選出 <strong>${curated3.length} 個主流模型</strong>（已排除過輕量 Lite 模型），目前選用：<strong>${curated3[0]}</strong>`;
    } catch (e) {
      statusBox.innerHTML = `❌ 無法查詢模型清單 (${this.escapeHtml(e.message)})，請確認 API Key 是否正確。`;
    }
  },

  switchAiTab(mode) {
    document.getElementById("tabBtnApi").classList.toggle("active", mode === "api");
    document.getElementById("tabBtnBridge").classList.toggle("active", mode === "bridge");
    document.getElementById("aiTabContentApi").classList.toggle("hidden", mode !== "api");
    document.getElementById("aiTabContentBridge").classList.toggle("hidden", mode !== "bridge");
  },

  saveApiSettingsQuietly(showNotice = false) {
    if (!this.data.settings) this.data.settings = {};
    const aiModalEl = document.getElementById("aiModal");
    const isModalOpen = aiModalEl && !aiModalEl.classList.contains("hidden");
    const keyInput = document.getElementById("aiApiKeyInput");
    const modelInput = document.getElementById("aiModelSelect");
    if (keyInput) {
      const k = keyInput.value.trim();
      // Only update apiKey if non-empty, preventing uninitialized DOM input from wiping a saved key
      if (k) {
        this.data.settings.apiKey = k;
        this.setPersistentSecret("nordic_gemini_api_key", k);
        fetch("/api/apikey", { method: "POST", body: k }).catch(() => {});
      } else if (isModalOpen && this.data.settings.apiKey) {
        // Restore input value from memory if modal was closed without typing
        keyInput.value = this.data.settings.apiKey;
      }
    }
    if (modelInput && modelInput.value) {
      this.data.settings.model = modelInput.value;
    }
    try {
      localStorage.setItem("nordic_life_blueprint_v1", JSON.stringify(this.data));
    } catch (e) {}
    this.renderSandboxInspector();
    if (showNotice) {
      this.showToast("已儲存 Gemini API 設定 🔑");
    }
  },

  SaveApiSettingsOnly() {
    this.saveApiSettingsQuietly(true);
    this.saveData();
  },

  runFullAIAnalysis() {
    if (this.data.settings && this.data.settings.apiKey) {
      this.openAIAnalysisModal();
      this.executeGeminiApiAnalysis();
    } else {
      this.openAIAnalysisModal();
    }
  },

  buildBlueprintPrompt() {
    const payload = {
      pillars: this.data.pillars.map(p => ({ id: p.id, title: p.title, subtitle: p.subtitle })),
      tasks: this.data.tasks.map(t => ({
        id: t.id,
        pillarId: t.pillarId,
        title: t.title,
        summary: t.summary,
        enableTracker: t.enableTracker,
        goal: t.tracker ? t.tracker.goal : "",
        selfScore: t.tracker ? t.tracker.selfScore : null,
        selfReflection: t.tracker ? t.tracker.selfReflection : "",
        milestones: t.tracker ? t.tracker.milestones : [],
        notes: (t.notes || []).map(n => ({ category: n.category, title: n.title, content: n.content }))
      }))
    };

    return `你是一位溫柔、深刻且具洞察力的「北歐森林人生藍圖智者」。
請根據使用者目前的人生大項目(pillars)、細節任務(tasks)、個人筆記(notes)、目標與自我評分(selfScore)，進行全方位的「跨任務關聯性分析」與「完成度客觀評估」。

使用者目前的藍圖資料如下 (JSON)：
${JSON.stringify(payload, null, 2)}

請回傳純 JSON 格式（不要加其他解釋文字），結構必須嚴格符合以下格式：
{
  "forestSummary": "100字以內，溫柔點出使用者目前人生各項目間的能量流動、哪個基礎習慣正在支撐其他項目，以及給繁忙生活的一句安定建議",
  "harmonyScore": 82,
  "taskEvaluations": [
    {
      "taskId": "對應的 task.id",
      "aiCompletion": 75,
      "aiFeedback": "60字以內，綜合他的筆記內容、小步驟與自我評分，給予溫暖客觀的完成度分析與一個微小下一步建議"
    }
  ],
  "discoveredConnections": [
    {
      "fromTaskId": "起點 task.id",
      "toTaskId": "終點 task.id",
      "type": "foundation 或 synergy 或 nourish 其一",
      "label": "10字以內的關聯短標題",
      "reason": "70字以內，具體說明為什麼這兩個任務在他的筆記與生活中會互相影響",
      "strength": 88
    }
  ]
}`;
  },

  // =========================================================================
  // LOW-PROFILE BACKGROUND INSPECTOR & REAL-TIME STREAMING ENGINE
  // =========================================================================
  traceState: {
    logs: [],
    streamText: "",
    model: "—",
    httpStatus: "—",
    chunks: 0,
    chars: 0,
    startTime: 0,
    elapsedSec: "0.0",
    status: "idle", // idle | active | ok | error
    timerId: null,
    abortController: null
  },

  toggleModalTraceBody() {
    const body = document.getElementById("modalTraceBody");
    const link = document.getElementById("modalTraceToggleText");
    if (!body) return;
    const isHidden = body.classList.toggle("hidden");
    if (link) {
      link.textContent = isHidden ? "🔍 展開呼叫與即時生成過程 ▾" : "🔼 收起低調後台檢視 ▴";
    }
  },

  toggleSubtleInspector() {
    const drawer = document.getElementById("subtleInspectorDrawer");
    if (drawer) drawer.classList.toggle("hidden");
  },

  clearTraceLogs() {
    this.traceState.logs = [];
    this.traceState.streamText = "";
    this.traceState.chunks = 0;
    this.traceState.chars = 0;
    this.syncTraceUI("已清除紀錄");
  },

  appendTraceLog(msg) {
    const now = new Date();
    const ts = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}.${String(Math.floor(now.getMilliseconds() / 100))}`;
    this.traceState.logs.push(`[${ts}] ${msg}`);
    this.syncTraceUI();
  },

  syncTraceUI(summaryText = null) {
    const st = this.traceState;
    const dotClass = `inspector-dot ${st.status === "idle" ? "" : st.status}`;

    ["inspectorDot", "modalTraceDot", "drawerTraceDot"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.className = dotClass;
    });

    const summary = summaryText || (
      st.status === "active"
        ? `🐾 幕後呼叫中：${st.model} (${st.elapsedSec}s ・ ${st.chars} 字)`
        : st.status === "ok"
          ? `🐾 上次呼叫成功：${st.model} (耗時 ${st.elapsedSec}s ・ 共 ${st.chars} 字)`
          : st.status === "error"
            ? `🐾 呼叫發生異常 (${st.httpStatus})`
            : `🐾 幕後呼叫檢視：待機`
    );

    const footerLabel = document.getElementById("inspectorFooterLabel");
    if (footerLabel) footerLabel.textContent = summary;

    const modalSummary = document.getElementById("modalTraceSummary");
    if (modalSummary) modalSummary.textContent = summary;

    const metricsHtml = `
      <span>模型：<strong>${this.escapeHtml(st.model)}</strong></span>
      <span>HTTP：<strong>${this.escapeHtml(String(st.httpStatus))}</strong></span>
      <span>耗時：<strong>${st.elapsedSec}s</strong></span>
      <span>已接收：<strong>${st.chunks} 片段 / ${st.chars} 字元</strong></span>
    `;
    const m1 = document.getElementById("modalTraceMetrics");
    if (m1) m1.innerHTML = metricsHtml;
    const m2 = document.getElementById("drawerTraceMetrics");
    if (m2) m2.innerHTML = metricsHtml;

    const logText = st.logs.length > 0 ? st.logs.join("\n") : "等待呼叫中...";
    ["modalTraceLog", "drawerTraceLog"].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.textContent = logText;
        el.scrollTop = el.scrollHeight;
      }
    });

    const streamDisplay = st.streamText || (st.status === "active" ? "⏳ 已連上模型，等待第一個字元產出..." : "尚未開始生成...");
    ["modalTraceStream", "drawerTraceStream"].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.textContent = streamDisplay;
        el.scrollTop = el.scrollHeight;
      }
    });
  },

  abortCurrentAiCall() {
    if (this.traceState.abortController) {
      this.traceState.abortController.abort();
      this.appendTraceLog("⏹️ 使用者手動中止了此次 API 請求");
    }
  },

  async callGeminiGenerateJson(apiKey, model, prompt, temperature = 0.4, onProgress = null) {
    const st = this.traceState;
    st.logs = [];
    st.streamText = "";
    st.model = model;
    st.httpStatus = "連線中...";
    st.chunks = 0;
    st.chars = 0;
    st.startTime = performance.now();
    st.elapsedSec = "0.0";
    st.status = "active";
    st.abortController = new AbortController();

    const abortBtn = document.getElementById("btnAbortAiCall");
    if (abortBtn) abortBtn.classList.remove("hidden");

    if (st.timerId) clearInterval(st.timerId);
    st.timerId = setInterval(() => {
      st.elapsedSec = ((performance.now() - st.startTime) / 1000).toFixed(1);
      this.syncTraceUI();
      if (onProgress) onProgress(st);
    }, 150);

    const thinkingModeEl = document.getElementById("aiThinkingModeSelect");
    const thinkingMode = thinkingModeEl ? thinkingModeEl.value : "fast";
    let thinkingConfig = undefined;
    if (thinkingMode === "fast") {
      // Disable deep multi-minute thinking so response streams in 3~8 seconds
      thinkingConfig = { thinkingBudget: 0 };
    } else if (thinkingMode === "light") {
      thinkingConfig = { thinkingBudget: 512, includeThoughts: true };
    } else {
      thinkingConfig = { includeThoughts: true };
    }

    this.appendTraceLog(`📤 送出請求 -> 模型: ${model}, 模式: ${thinkingMode} (Prompt: ${prompt.length} 字)`);

    const doStreamRequest = async (targetModel, customThinkingCfg) => {
      st.model = targetModel;
      const genConfig = {
        responseMimeType: "application/json",
        temperature
      };
      if (customThinkingCfg) {
        genConfig.thinkingConfig = customThinkingCfg;
      }
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(targetModel)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`;
      return await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: st.abortController.signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: genConfig
        })
      });
    };

    try {
      let res = await doStreamRequest(model, thinkingConfig);
      const connectMs = Math.round(performance.now() - st.startTime);
      st.httpStatus = `${res.status} ${res.statusText || ""}`.trim();

      // If a Pro model rejects thinkingBudget: 0 with 400, fallback to light thinking automatically
      if (res.status === 400 && thinkingConfig && thinkingConfig.thinkingBudget === 0) {
        this.appendTraceLog(`ℹ️ 此模型不支援完全關閉思考，自動切換為「輕量思考模式 (512 tokens)」重試...`);
        res = await doStreamRequest(model, { thinkingBudget: 512, includeThoughts: true });
        st.httpStatus = `${res.status} ${res.statusText || ""}`.trim();
        if (res.status === 400) {
          res = await doStreamRequest(model, undefined);
          st.httpStatus = `${res.status} ${res.statusText || ""}`.trim();
        }
      }

      if (res.status === 404) {
        const errText = await res.text();
        this.appendTraceLog(`⚠️ 模型 ${model} 回傳 404，嘗試自動切換可用模型...`);
        const match = errText.match(/models\/(gemini-[a-zA-Z0-9._-]+)/);
        const fallbackModel = match ? match[1] : (model !== "gemini-3.8-flash" ? "gemini-3.8-flash" : null);
        if (fallbackModel && fallbackModel !== model) {
          this.data.settings.model = fallbackModel;
          this.saveData();
          this.appendTraceLog(`🔄 自動改用模型: ${fallbackModel} 重新發送請求...`);
          res = await doStreamRequest(fallbackModel, thinkingConfig);
          st.httpStatus = `${res.status} ${res.statusText || ""}`.trim();
        } else {
          throw new Error(`API 回應錯誤 (404): ${errText}`);
        }
      }

      if (!res.ok) {
        const errText = await res.text();
        this.appendTraceLog(`❌ 伺服器回傳錯誤 (${res.status}): ${errText.slice(0, 200)}`);
        throw new Error(`API 回應錯誤 (${res.status}): ${errText}`);
      }

      this.appendTraceLog(`🟢 HTTP ${res.status} 已成功連線至 Google Gemini (連線耗時 ${connectMs}ms)`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let sseBuffer = "";
      let fullJsonText = "";
      let thoughtPreview = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        sseBuffer += decoder.decode(value, { stream: true });

        const lines = sseBuffer.split(/\r?\n/);
        sseBuffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const dataStr = trimmed.slice(5).trim();
          if (!dataStr || dataStr === "[DONE]") continue;

          try {
            const chunkObj = JSON.parse(dataStr);
            const parts = chunkObj?.candidates?.[0]?.content?.parts || [];
            for (const part of parts) {
              if (part.thought) {
                thoughtPreview += (part.text || "");
                st.chunks++;
                st.chars = fullJsonText.length + thoughtPreview.length;
                st.streamText = `💭 [模型思考推理中...]\n${thoughtPreview}\n\n${fullJsonText}`;
              } else if (part.text) {
                fullJsonText += part.text;
                st.chunks++;
                st.chars = fullJsonText.length;
                st.streamText = thoughtPreview
                  ? `💭 [思考完成]\n\n📥 [正在生成 JSON 結構]:\n${fullJsonText}`
                  : fullJsonText;
                if (st.chunks === 1) {
                  const firstTokenMs = Math.round(performance.now() - st.startTime);
                  this.appendTraceLog(`✨ 收到第 1 個生成片段 (首字產出 ${firstTokenMs}ms)，開始串流接收內容...`);
                }
              }
            }
            this.syncTraceUI();
            if (onProgress) onProgress(st);
          } catch (parseErr) {
            // Ignore partial SSE line parse error
          }
        }
      }

      // Fallback if response wasn't SSE formatted
      if (!fullJsonText && sseBuffer.trim()) {
        try {
          const singleObj = JSON.parse(sseBuffer.trim());
          fullJsonText = singleObj?.candidates?.[0]?.content?.parts?.[0]?.text || "";
          st.streamText = fullJsonText;
          st.chars = fullJsonText.length;
        } catch (e) {}
      }

      if (!fullJsonText) {
        throw new Error("未收到有效的 JSON 生成內容");
      }

      st.status = "ok";
      st.elapsedSec = ((performance.now() - st.startTime) / 1000).toFixed(1);
      this.appendTraceLog(`✅ 生成與接收完成！共 ${st.chunks} 個片段、${st.chars} 字元，總耗時 ${st.elapsedSec}s`);

      const clean = fullJsonText.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
      return JSON.parse(clean);
    } catch (err) {
      st.status = "error";
      if (err.name === "AbortError") {
        throw new Error("已手動中止 AI 分析請求");
      }
      this.appendTraceLog(`❌ 執行中斷: ${err.message}`);
      throw err;
    } finally {
      if (st.timerId) {
        clearInterval(st.timerId);
        st.timerId = null;
      }
      if (abortBtn) abortBtn.classList.add("hidden");
      this.syncTraceUI();
    }
  },

  async executeGeminiApiAnalysis() {
    const apiKey = document.getElementById("aiApiKeyInput").value.trim();
    const model = document.getElementById("aiModelSelect").value || "gemini-3.8-flash";
    const statusBox = document.getElementById("aiApiStatusBox");
    const btn = document.getElementById("btnRunApiAnalysis");

    if (!apiKey) {
      statusBox.classList.remove("hidden");
      statusBox.innerHTML = `⚠️ 請先輸入您的 Google Gemini API Key，或切換至「方式二：搭配您的 Google AI Pro 網頁版對話」免費複製提示詞分析！`;
      return;
    }

    this.SaveApiSettingsOnly();
    this.isAiAnalyzing = true;
    btn.disabled = true;
    this.dismissCloseWarning();
    statusBox.classList.remove("hidden");
    statusBox.innerHTML = `🦌 正在連線至 <strong>${this.escapeHtml(model)}</strong>...（可點擊下方「🔍 展開呼叫與即時生成過程」即時觀看生成文字）`;

    try {
      const prompt = this.buildBlueprintPrompt();
      const parsed = await this.callGeminiGenerateJson(apiKey, model, prompt, 0.4, (st) => {
        statusBox.innerHTML = `🦌 <strong>${this.escapeHtml(st.model)}</strong> 即時生成中（HTTP: ${this.escapeHtml(String(st.httpStatus))}）— 已耗時 <strong>${st.elapsedSec}s</strong>，已接收 <strong>${st.chunks} 個片段（${st.chars} 字元）</strong>...`;
      });

      this.isAiAnalyzing = false;
      this.dismissCloseWarning();
      this.applyAiResultObject(parsed);
      statusBox.innerHTML = `✅ 分析完成（總耗時 ${this.traceState.elapsedSec}s，共生成 ${this.traceState.chars} 字）！已為您更新全景關聯星圖與完成度評估。`;
      setTimeout(() => this.closeModal("aiModal"), 1500);
    } catch (err) {
      this.isAiAnalyzing = false;
      this.dismissCloseWarning();
      statusBox.innerHTML = `❌ 呼叫未完成：${this.escapeHtml(err.message)}<br><small>您可以展開下方「🐾 低調後台檢視」查看詳細原因，或點選「🔄 自動偵測主流模型」。</small>`;
    } finally {
      this.isAiAnalyzing = false;
      btn.disabled = false;
    }
  },

  async askAiForSingleTask(taskId) {
    const task = this.data.tasks.find(t => t.id === taskId);
    if (!task) return;
    const apiKey = this.data.settings && this.data.settings.apiKey;
    const model = (this.data.settings && this.data.settings.model) || "gemini-3.8-flash";

    if (!apiKey) {
      this.openAIAnalysisModal();
      this.showToast("請先設定 Gemini API Key 或使用網頁版橋接功能 ✨");
      return;
    }

    this.isAiAnalyzing = true;
    this.showToast("🐱 AI 貓咪正在閱讀此任務的筆記...");
    const prompt = `請針對以下單一人生任務與筆記，提供：
1. 根據目前筆記與自我評分的「AI 客觀完成度百分比 (0-100)」
2. 65字以內的溫暖洞察與具體微調建議 (aiFeedback)
3. 幫使用者自動整理出一篇簡短的「💡 靈感與反思」筆記摘要 (suggestedNoteTitle, suggestedNoteContent)

任務名稱：${task.title}
任務初衷：${task.summary}
目標：${task.tracker ? task.tracker.goal : ""}
自我評分：${task.tracker ? task.tracker.selfScore : ""}/10 (${task.tracker ? task.tracker.selfReflection : ""})
現有筆記：${JSON.stringify(task.notes || [])}

請只回傳 JSON：
{
  "aiCompletion": 78,
  "aiFeedback": "...",
  "suggestedNoteTitle": "✨ AI 森林筆記整理：...",
  "suggestedNoteContent": "..."
}`;

    try {
      const parsed = await this.callGeminiGenerateJson(apiKey, model, prompt, 0.5);

      if (task.tracker) {
        task.tracker.aiCompletion = parsed.aiCompletion;
        task.tracker.aiFeedback = parsed.aiFeedback;
      }
      if (parsed.suggestedNoteContent) {
        const now = new Date();
        const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
        task.notes.unshift({
          id: "note-" + Date.now(),
          category: "💡 靈感與反思",
          title: parsed.suggestedNoteTitle || "✨ AI 筆記重點與練習建議",
          content: parsed.suggestedNoteContent,
          createdAt: dateStr
        });
      }
      this.saveData("✨ AI 已更新任務完成度並新增一篇靈感筆記！");
      this.renderAll();
    } catch (e) {
      this.showToast("AI 分析失敗：" + e.message);
    } finally {
      this.isAiAnalyzing = false;
    }
  },

  copyPromptForWebGemini() {
    const prompt = this.buildBlueprintPrompt();
    navigator.clipboard.writeText(prompt).then(() => {
      this.showToast("📋 已複製結構化 Prompt！請貼到 Gemini 網頁版對話視窗");
    });
  },

  applyBridgeJsonResponse() {
    const raw = document.getElementById("bridgeJsonInput").value.trim();
    if (!raw) {
      this.showToast("請先貼上 Gemini 回覆的 JSON 內容");
      return;
    }
    try {
      const clean = raw.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
      const parsed = JSON.parse(clean);
      this.applyAiResultObject(parsed);
      this.closeModal("aiModal");
    } catch (e) {
      this.showToast("JSON 格式解析失敗，請確認貼上的是完整的 JSON 區塊");
    }
  },

  applyAiResultObject(resObj) {
    if (resObj.forestSummary) {
      this.data.aiOverview = {
        lastAnalyzedAt: new Date().toLocaleString("zh-TW"),
        forestSummary: resObj.forestSummary,
        harmonyScore: resObj.harmonyScore || 80
      };
    }

    if (Array.isArray(resObj.taskEvaluations)) {
      resObj.taskEvaluations.forEach(ev => {
        const task = this.data.tasks.find(t => t.id === ev.taskId);
        if (task && task.tracker) {
          task.tracker.aiCompletion = ev.aiCompletion;
          task.tracker.aiFeedback = ev.aiFeedback;
        }
      });
    }

    if (Array.isArray(resObj.discoveredConnections) && resObj.discoveredConnections.length > 0) {
      // Keep manual connections, replace AI connections
      const manualConns = this.data.connections.filter(c => c.source === "manual");
      const newAiConns = resObj.discoveredConnections.map((c, idx) => ({
        id: "conn-ai-" + Date.now() + "-" + idx,
        fromTaskId: c.fromTaskId,
        toTaskId: c.toTaskId,
        type: ["foundation", "synergy", "nourish"].includes(c.type) ? c.type : "synergy",
        label: c.label || "AI 關聯洞察",
        reason: c.reason || "",
        strength: c.strength || 85,
        source: "ai"
      }));
      this.data.connections = [...manualConns, ...newAiConns];
      if (this.data.connections.length > 0) {
        this.selectedConnId = this.data.connections[0].id;
      }
    }

    this.saveData("✨ 已成功更新 AI 人生藍圖關聯與完成度評估！");
    this.renderAll();
  },

  // =========================================================================
  // PORTABLE SETTINGS, PRIVATE REPO CLOUD SYNC & DESIGNATED FOLDER (`data/`)
  // =========================================================================
  githubSyncConfig: {
    repo: "johnny8dada/Life-Cat-Data",
    token: "",
    autoSync: true
  },
  _ghAutoSyncTimer: null,

  async loadGithubSyncConfig() {
    // 1. Try localStorage + Cookie + IndexedDB (via getPersistentSecretAsync) first
    try {
      const raw = await this.getPersistentSecretAsync("nordic_github_sync_v1");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          this.githubSyncConfig = {
            repo: parsed.repo || "johnny8dada/Life-Cat-Data",
            token: parsed.token || "",
            autoSync: parsed.autoSync != null ? !!parsed.autoSync : true
          };
        }
      }
      // Also check dedicated standalone backup key `nordic_github_pat_token`
      if (!this.githubSyncConfig.token) {
        const backupToken = await this.getPersistentSecretAsync("nordic_github_pat_token");
        if (backupToken) {
          this.githubSyncConfig.token = backupToken;
          this.setPersistentSecret("nordic_github_sync_v1", JSON.stringify(this.githubSyncConfig));
        }
      } else {
        this.setPersistentSecret("nordic_github_pat_token", this.githubSyncConfig.token);
      }
    } catch (e) {}

    // 2. Try local server /api/github-sync-config (stored in git-ignored data/github_sync.local)
    try {
      const res = await fetch("/api/github-sync-config");
      if (res.ok) {
        const cfg = await res.json();
        if (cfg && cfg.token) {
          this.githubSyncConfig = {
            repo: cfg.repo || this.githubSyncConfig.repo || "johnny8dada/Life-Cat-Data",
            token: cfg.token,
            autoSync: cfg.autoSync != null ? !!cfg.autoSync : true
          };
          this.setPersistentSecret("nordic_github_sync_v1", JSON.stringify(this.githubSyncConfig));
          this.setPersistentSecret("nordic_github_pat_token", cfg.token);
        }
      }
    } catch (e) {}

    // CRITICAL: Immediately populate the DOM inputs on startup so they are never empty in the background!
    const repoInput = document.getElementById("ghRepoInput");
    const tokenInput = document.getElementById("ghTokenInput");
    const autoCheck = document.getElementById("ghAutoSyncCheckbox");
    if (repoInput) repoInput.value = this.githubSyncConfig.repo || "johnny8dada/Life-Cat-Data";
    if (tokenInput && this.githubSyncConfig.token) tokenInput.value = this.githubSyncConfig.token;
    if (autoCheck) autoCheck.checked = !!this.githubSyncConfig.autoSync;

    this.renderSandboxInspector();
  },

  openSettingsModal() {
    const repoInput = document.getElementById("ghRepoInput");
    const tokenInput = document.getElementById("ghTokenInput");
    const autoCheck = document.getElementById("ghAutoSyncCheckbox");
    if (repoInput) repoInput.value = this.githubSyncConfig.repo || "johnny8dada/Life-Cat-Data";
    if (tokenInput) tokenInput.value = this.githubSyncConfig.token || "";
    if (autoCheck) autoCheck.checked = !!this.githubSyncConfig.autoSync;
    this.renderSandboxInspector();
    this.openModal("settingsModal");
  },

  saveGithubSyncConfig(showNotice = false) {
    const repoInput = document.getElementById("ghRepoInput");
    const tokenInput = document.getElementById("ghTokenInput");
    const autoCheck = document.getElementById("ghAutoSyncCheckbox");

    const inputRepo = repoInput ? repoInput.value.trim() : "";
    const inputToken = tokenInput ? tokenInput.value.trim() : "";
    const existingToken = (this.githubSyncConfig && this.githubSyncConfig.token) || this.getPersistentSecret("nordic_github_pat_token") || "";

    // CRITICAL PROTECTION: Never allow an empty DOM input to wipe out an already-saved Token!
    const finalToken = inputToken || existingToken;
    if (!inputToken && existingToken && tokenInput) {
      tokenInput.value = existingToken;
    }

    this.githubSyncConfig = {
      repo: inputRepo || (this.githubSyncConfig && this.githubSyncConfig.repo) || "johnny8dada/Life-Cat-Data",
      token: finalToken,
      autoSync: autoCheck ? !!autoCheck.checked : true
    };
    this.setPersistentSecret("nordic_github_sync_v1", JSON.stringify(this.githubSyncConfig));
    if (finalToken) {
      this.setPersistentSecret("nordic_github_pat_token", finalToken);
    }
    fetch("/api/github-sync-config", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(this.githubSyncConfig)
    }).catch(() => {});
    this.renderSandboxInspector();
    if (showNotice) {
      this.showToast("💾 已寫入本機沙盒 (LocalStorage + Cookie + IndexedDB 三重保存)");
    }
  },

  maskSecret(str) {
    if (!str) return "尚未儲存";
    if (str.length <= 8) return "••••" + str.slice(-2);
    return str.slice(0, 4) + "••••" + str.slice(-4);
  },

  renderSandboxInspector() {
    const box = document.getElementById("sandboxInspectorBox");
    const badge = document.getElementById("ghSyncStatusBadge");
    const savedApiKey = this.getPersistentSecret("nordic_gemini_api_key") || (this.data && this.data.settings && this.data.settings.apiKey) || "";
    const savedSyncRaw = this.getPersistentSecret("nordic_github_sync_v1");
    let savedToken = this.githubSyncConfig ? this.githubSyncConfig.token : "";
    let savedRepo = this.githubSyncConfig ? this.githubSyncConfig.repo : "johnny8dada/Life-Cat-Data";
    if (savedSyncRaw) {
      try {
        const p = JSON.parse(savedSyncRaw);
        if (p.token) savedToken = p.token;
        if (p.repo) savedRepo = p.repo;
      } catch (e) {}
    }

    if (badge) {
      badge.textContent = savedToken ? "🟢 已綁定沙盒金鑰" : "⚪ 尚未設定 Token";
      badge.style.color = savedToken ? "var(--sage-primary)" : "var(--ink-muted)";
    }

    if (!box) return;
    let lsAvailable = false;
    try {
      localStorage.setItem("__sandbox_test__", "1");
      lsAvailable = localStorage.getItem("__sandbox_test__") === "1";
      localStorage.removeItem("__sandbox_test__");
    } catch (e) {
      lsAvailable = false;
    }

    const isStandalonePWA = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
    const envLabel = this.isLocalServerAvailable
      ? "💻 電腦本地桌面模式 (同時寫入 data/*.local 與沙盒)"
      : (isStandalonePWA ? "📱 iPhone 主畫面獨立 App 沙盒" : "🌐 瀏覽器分頁沙盒 (建議加入主畫面後再設定)");

    box.innerHTML = `
      <div style="font-weight:700;color:var(--ink-primary);margin-bottom:4px;">
        🔍 本機沙盒儲存空間即時檢視 (${lsAvailable ? "🟢 可正常讀寫" : "🔴 被瀏覽器無痕模式阻擋"})
      </div>
      <div>• <strong>目前執行環境</strong>：${envLabel}</div>
      <div>• <strong>沙盒內 GitHub Token</strong>：<code>${this.escapeHtml(this.maskSecret(savedToken))}</code> （目標倉庫：<code>${this.escapeHtml(savedRepo)}</code>）</div>
      <div>• <strong>沙盒內 Gemini API Key</strong>：<code>${this.escapeHtml(this.maskSecret(savedApiKey))}</code></div>
      <div style="margin-top:4px;font-size:11px;color:var(--ink-muted);">
        💡 只要上方顯示 <code>ghp_••••...</code> 與 <code>AIza••••...</code>，代表已透過 <strong>LocalStorage + 365天 Cookie 雙重寫入</strong>您的手機本機沙盒，重開 App 也不會消失！（請勿使用 Safari「私密瀏覽」黑底無痕模式，否則 iOS 關閉時會強制清空）。
      </div>
    `;
  },

  utf8ToBase64(str) {
    const bytes = new TextEncoder().encode(str);
    let binary = "";
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary);
  },

  base64ToUtf8(b64) {
    const clean = b64.replace(/\s/g, "");
    const binary = atob(clean);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder("utf-8").decode(bytes);
  },

  async saveDataFromCloud(cloudData, cloudSha = "") {
    const currentApiKey = (this.data && this.data.settings && this.data.settings.apiKey) || this.getPersistentSecret("nordic_gemini_api_key") || "";
    this.data = cloudData;
    if (!this.data.settings) this.data.settings = { apiKey: currentApiKey, model: "gemini-3.8-flash" };
    this.data.settings.apiKey = currentApiKey;

    if (cloudSha) {
      this.setPersistentSecret("nordic_last_synced_sha", cloudSha);
    }
    this.setPersistentSecret("nordic_last_synced_ts", String(this.data.lastModifiedAt || Date.now()));

    try {
      localStorage.setItem("nordic_life_blueprint_v1", JSON.stringify(this.data));
    } catch (e) {}

    // Also persist to local `data/life_blueprint.json` if running on Windows/MacBook desktop server
    const diskCopy = JSON.parse(JSON.stringify(this.data));
    if (diskCopy.settings) diskCopy.settings.apiKey = "";
    try {
      await fetch("/api/data", {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify(diskCopy, null, 2)
      });
    } catch (e) {}

    if (this.data.tasks.length > 0 && !this.data.tasks.some(t => t.id === this.selectedTaskId)) {
      this.selectedTaskId = this.data.tasks[0].id;
    }
    if (this.data.connections.length > 0 && !this.data.connections.some(c => c.id === this.selectedConnId)) {
      this.selectedConnId = this.data.connections[0].id;
    }
    this.renderAll();
  },

  async autoPullFromGithubOnStartup(triggerReason = "startup") {
    if (!this.githubSyncConfig || !this.githubSyncConfig.token || !this.githubSyncConfig.repo) {
      return;
    }
    if (triggerReason === "resume" && !this.githubSyncConfig.autoSync) {
      return;
    }
    if (this._ghAutoSyncTimer || this.isAiAnalyzing) {
      return; // User is actively editing or running AI; do not overwrite
    }
    this._lastAutoPullCheckAt = Date.now();
    const { repo, token } = this.githubSyncConfig;
    const footerStatus = document.getElementById("saveStatusText");

    try {
      const headers = {
        "Accept": "application/vnd.github.v3+json",
        "Authorization": `token ${token}`
      };

      let res = await fetch(`https://api.github.com/repos/${repo}/contents/life_blueprint.json?t=${Date.now()}`, {
        headers,
        cache: "no-store"
      });
      if (res.status === 404) {
        res = await fetch(`https://api.github.com/repos/${repo}/contents/data/life_blueprint.json?t=${Date.now()}`, {
          headers,
          cache: "no-store"
        });
      }
      if (!res.ok) return;

      const meta = await res.json();
      if (!meta || !meta.content) return;

      const jsonStr = this.base64ToUtf8(meta.content);
      const cloudData = JSON.parse(jsonStr);
      if (!cloudData || !Array.isArray(cloudData.pillars)) return;

      const cloudTs = Number(cloudData.lastModifiedAt || 0);
      const localTs = Number((this.data && this.data.lastModifiedAt) || 0);
      const lastSyncedSha = this.getPersistentSecret("nordic_last_synced_sha");
      const lastSyncedTs = Number(this.getPersistentSecret("nordic_last_synced_ts") || 0);
      const isLocalDefaultExample = !localTs && ((this.data?.aiOverview?.lastAnalyzedAt || "").includes("預設範例"));

      // Re-check user didn't start typing while fetch was in flight
      if (this._ghAutoSyncTimer) return;

      // Decide whether to update local from cloud or push newer offline local to cloud:
      // 1. If cloud has a newer timestamp (`cloudTs > localTs`), OR local is just the example template,
      //    OR cloud SHA changed and local has no unsynced offline edits (`localTs <= lastSyncedTs`) -> Pull cloudData!
      if (cloudTs > localTs || isLocalDefaultExample || (meta.sha && meta.sha !== lastSyncedSha && localTs <= lastSyncedTs)) {
        const contentChanged = JSON.stringify(cloudData.tasks) !== JSON.stringify(this.data.tasks) ||
                               JSON.stringify(cloudData.pillars) !== JSON.stringify(this.data.pillars) ||
                               JSON.stringify(cloudData.connections) !== JSON.stringify(this.data.connections) ||
                               isLocalDefaultExample;
        await this.saveDataFromCloud(cloudData, meta.sha || "");
        const nowStr = new Date().toLocaleTimeString("zh-TW", { hour12: false });
        if (footerStatus) {
          footerStatus.textContent = `🟢 已於開啟時自動從 Private Repo (${repo}) 同步最新資料 (${nowStr})`;
        }
        if (contentChanged) {
          this.showToast("☁️ 已自動從 GitHub Private Repo 更新最新資料！");
        }
      } else if (localTs > cloudTs && this.githubSyncConfig.autoSync && meta.sha !== lastSyncedSha) {
        // Local device has newer edits made while offline -> push them up to Private Repo
        this.pushToGithubCloud(true);
      } else {
        if (meta.sha) this.setPersistentSecret("nordic_last_synced_sha", meta.sha);
        const nowStr = new Date().toLocaleTimeString("zh-TW", { hour12: false });
        if (footerStatus) {
          footerStatus.textContent = `🟢 本機與 Private Repo (${repo}) 已是最新同步狀態 (${nowStr})`;
        }
      }
    } catch (e) {
      // Silent fallback when offline
    }
  },

  async pullFromGithubCloud() {
    this.saveGithubSyncConfig();
    const { repo, token } = this.githubSyncConfig;
    const statusBox = document.getElementById("ghSyncStatusBox");
    if (statusBox) {
      statusBox.classList.remove("hidden");
      statusBox.textContent = `☁️ 正在從私人儲存庫 (${repo}) 讀取您的個人資料...`;
    }

    try {
      const headers = { "Accept": "application/vnd.github.v3+json" };
      if (token) headers["Authorization"] = `token ${token}`;

      // Try root `life_blueprint.json` first (matches cloning Private Repo directly into `data/`), fallback to `data/life_blueprint.json`
      let res = await fetch(`https://api.github.com/repos/${repo}/contents/life_blueprint.json?t=${Date.now()}`, {
        headers,
        cache: "no-store"
      });
      if (res.status === 404) {
        res = await fetch(`https://api.github.com/repos/${repo}/contents/data/life_blueprint.json?t=${Date.now()}`, {
          headers,
          cache: "no-store"
        });
      }

      if (!res.ok) {
        throw new Error(`HTTP ${res.status} — 請確認 Private Repo 名稱 (${repo}) 已建立且 Token 具備 repo 權限`);
      }
      const meta = await res.json();
      if (!meta || !meta.content) {
        throw new Error("在該儲存庫中找不到 life_blueprint.json 內容");
      }

      const jsonStr = this.base64ToUtf8(meta.content);
      const cloudData = JSON.parse(jsonStr);
      if (!cloudData || !Array.isArray(cloudData.pillars)) {
        throw new Error("雲端 JSON 結構格式不正確");
      }

      await this.saveDataFromCloud(cloudData, meta.sha || "");
      this.showToast("☁️ 已從 Private Repo 載入最新個人資料！");

      const nowStr = new Date().toLocaleTimeString("zh-TW", { hour12: false });
      if (statusBox) {
        statusBox.textContent = `✅ 已於 ${nowStr} 從私人儲存庫 (${repo}) 同步最新個人資料！`;
      }
      const footerStatus = document.getElementById("saveStatusText");
      if (footerStatus) {
        footerStatus.textContent = `🟢 已從私人庫 ${repo} 載入最新資料 (${nowStr})`;
      }
    } catch (err) {
      if (statusBox) {
        statusBox.textContent = `❌ 雲端拉取失敗：${err.message}`;
      }
      this.showToast("雲端拉取失敗：" + err.message);
    }
  },

  async pushToGithubCloud(silent = false) {
    if (!silent) {
      this.saveGithubSyncConfig();
    }
    const { repo, token } = this.githubSyncConfig;
    const statusBox = document.getElementById("ghSyncStatusBox");

    if (!token) {
      if (!silent) {
        if (statusBox) {
          statusBox.classList.remove("hidden");
          statusBox.textContent = "⚠️ 推送至 Private Repo 需要填寫 GitHub Personal Access Token (勾選 repo 權限)。";
        }
        this.showToast("請先輸入 GitHub Token 才能推送至 Private Repo");
      }
      return;
    }

    if (!silent && statusBox) {
      statusBox.classList.remove("hidden");
      statusBox.textContent = `☁️ 正在將個人資料加密推送至私人儲存庫 (${repo})...`;
    }

    try {
      const headers = {
        "Accept": "application/vnd.github.v3+json",
        "Authorization": `token ${token}`,
        "Content-Type": "application/json"
      };

      // 1. Check whether `life_blueprint.json` (root) or `data/life_blueprint.json` exists in Private Repo
      let targetPath = "life_blueprint.json";
      let currentSha = undefined;
      let getRes = await fetch(`https://api.github.com/repos/${repo}/contents/life_blueprint.json?t=${Date.now()}`, {
        headers,
        cache: "no-store"
      });
      if (getRes.ok) {
        const getMeta = await getRes.json();
        currentSha = getMeta.sha;
        targetPath = "life_blueprint.json";
      } else {
        const altRes = await fetch(`https://api.github.com/repos/${repo}/contents/data/life_blueprint.json?t=${Date.now()}`, {
          headers,
          cache: "no-store"
        });
        if (altRes.ok) {
          const altMeta = await altRes.json();
          currentSha = altMeta.sha;
          targetPath = "data/life_blueprint.json";
        }
      }

      // 2. Sanitize API key before uploading to GitHub
      if (!this.data.lastModifiedAt) this.data.lastModifiedAt = Date.now();
      const cleanCopy = JSON.parse(JSON.stringify(this.data));
      if (cleanCopy.settings) cleanCopy.settings.apiKey = "";
      const contentB64 = this.utf8ToBase64(JSON.stringify(cleanCopy, null, 2));

      const putBody = {
        message: `Update personal life blueprint (${new Date().toLocaleString("zh-TW")})`,
        content: contentB64
      };
      if (currentSha) putBody.sha = currentSha;

      const putRes = await fetch(`https://api.github.com/repos/${repo}/contents/${targetPath}`, {
        method: "PUT",
        headers,
        body: JSON.stringify(putBody)
      });

      if (!putRes.ok) {
        const errText = await putRes.text();
        throw new Error(`HTTP ${putRes.status}: 請確認已在 GitHub 建立名為 ${repo} 的 Private Repo (${errText.slice(0, 80)})`);
      }

      try {
        const putJson = await putRes.json();
        if (putJson && putJson.content && putJson.content.sha) {
          this.setPersistentSecret("nordic_last_synced_sha", putJson.content.sha);
        }
      } catch (e) {}
      this.setPersistentSecret("nordic_last_synced_ts", String(this.data.lastModifiedAt));

      const nowStr = new Date().toLocaleTimeString("zh-TW", { hour12: false });
      if (statusBox) {
        statusBox.classList.remove("hidden");
        statusBox.textContent = `✅ 已於 ${nowStr} 成功推送個人資料至私人庫 ${repo} (${targetPath})！`;
      }
      const footerStatus = document.getElementById("saveStatusText");
      if (footerStatus) {
        footerStatus.textContent = `🟢 已同步至本地 data/ 與私人庫 ${repo} (${nowStr})`;
      }
      if (!silent) {
        this.showToast(`☁️ 已成功推送個人資料至私人庫 ${repo}！`);
      }
    } catch (err) {
      if (!silent && statusBox) {
        statusBox.textContent = `❌ 雲端推送失敗：${err.message}`;
      }
      if (!silent) {
        this.showToast("雲端推送失敗：" + err.message);
      }
    }
  },

  autoSyncToGithubIfNeeded() {
    if (!this.githubSyncConfig || !this.githubSyncConfig.autoSync || !this.githubSyncConfig.token) {
      return;
    }
    if (this._ghAutoSyncTimer) clearTimeout(this._ghAutoSyncTimer);
    this._ghAutoSyncTimer = setTimeout(() => {
      this.pushToGithubCloud(true);
    }, 1800);
  },

  openLocalDataFolder() {
    fetch("/api/open-folder", { method: "POST" }).catch(() => {});
    this.showToast("📂 已為您打開指定個人資料夾 data/");
  },

  exportBlueprintJson() {
    const cleanCopy = JSON.parse(JSON.stringify(this.data));
    if (cleanCopy.settings) cleanCopy.settings.apiKey = "";
    const blob = new Blob([JSON.stringify(cleanCopy, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "life_blueprint.json";
    a.click();
    URL.revokeObjectURL(url);
    this.showToast("⬇️ 已匯出個人資料檔 life_blueprint.json（可直接放入 data/ 資料夾或上傳至 Private Repo）");
  },

  importBlueprintJson(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const imported = JSON.parse(e.target.result);
        if (imported && Array.isArray(imported.pillars) && Array.isArray(imported.tasks)) {
          this.data = imported;
          this.selectedTaskId = this.data.tasks[0] ? this.data.tasks[0].id : null;
          this.saveData("⬆️ 已成功載入備份藍圖資料！");
          this.renderAll();
          this.closeModal("settingsModal");
        } else {
          this.showToast("檔案格式不符");
        }
      } catch (err) {
        this.showToast("無法解析 JSON 檔案");
      }
    };
    reader.readAsText(file);
  },

  // =========================================================================
  // UTILITIES
  // =========================================================================
  showToast(msg) {
    const container = document.getElementById("toastContainer");
    const el = document.createElement("div");
    el.className = "toast-item";
    el.textContent = msg;
    container.appendChild(el);
    setTimeout(() => {
      el.remove();
    }, 3200);
  },

  escapeHtml(str) {
    if (str == null) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  },

  truncate(str, maxLen) {
    if (!str) return "";
    return str.length > maxLen ? str.slice(0, maxLen) + "…" : str;
  }
};

window.addEventListener("DOMContentLoaded", () => App.init());
