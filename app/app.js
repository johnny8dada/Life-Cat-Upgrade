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
  },

  startLifecycleHeartbeat() {
    setInterval(() => {
      fetch("/api/heartbeat").catch(() => {});
    }, 3000);

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

  async loadData() {
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

    this.migrateModelSetting();

    // Load local secret API key from /api/apikey or localStorage so data/life_blueprint.json stays safe for Git
    try {
      const kRes = await fetch("/api/apikey");
      if (kRes.ok) {
        const kJson = await kRes.json();
        if (kJson && kJson.apiKey) {
          this.data.settings.apiKey = kJson.apiKey;
          localStorage.setItem("nordic_gemini_api_key", kJson.apiKey);
        }
      }
    } catch (e) {}
    if (!this.data.settings.apiKey) {
      this.data.settings.apiKey = localStorage.getItem("nordic_gemini_api_key") || "";
    }

    await this.loadGithubSyncConfig();
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
      localStorage.setItem("nordic_gemini_api_key", currentKey);
      fetch("/api/apikey", { method: "POST", body: currentKey }).catch(() => {});
    }
    localStorage.setItem("nordic_life_blueprint_v1", JSON.stringify(this.data));

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
  // SECTION A: INTERACTIVE SVG BLUEPRINT GRAPH (ELLIPTICAL RING + INVISIBLE BUFFER + FOCUS HIGHLIGHT)
  // =========================================================================
  graphFocusTaskId: null, // null = ambient overview (all nodes 100%, all lines semi-transparent without labels)
  graphHighlightConnOnly: false,
  graphZoom: 1,
  graphPanX: 0,
  graphPanY: 0,
  _isDraggingGraph: false,
  _dragStartX: 0,
  _dragStartY: 0,

  // Clips a ray from center (cx, cy) toward target (tx, ty) at the node's INVISIBLE outer safety box (halfW, halfH)
  clipPointToInvisibleBox(cx, cy, tx, ty, halfW = 94, halfH = 50) {
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

  // Computes a quadratic Bezier control point that gently arcs and avoids other nodes' invisible bounding boxes
  computeObstacleAvoidingControlPoint(fromPos, toPos, allNodes, idxOffset = 0) {
    const midX = (fromPos.x + toPos.x) / 2;
    const midY = (fromPos.y + toPos.y) / 2;
    const dx = toPos.x - fromPos.x;
    const dy = toPos.y - fromPos.y;
    const dist = Math.max(1, Math.hypot(dx, dy));

    // Normal unit vector perpendicular to AB
    let nx = -dy / dist;
    let ny = dx / dist;

    // Default gentle outward arc (curving slightly toward center or away from obstacles)
    let arcStrength = Math.min(68, dist * 0.18) + (idxOffset % 2 === 0 ? 12 : -12);
    let ctrlX = midX + nx * arcStrength;
    let ctrlY = midY + ny * arcStrength;

    // Repulsion from any intermediate node's invisible safety box (radius ~ 105px)
    const SAFE_RADIUS = 110;
    for (const other of allNodes) {
      if (other.task.id === fromPos.task.id || other.task.id === toPos.task.id) continue;
      // Check distance from curve midpoint (approx 0.5*mid + 0.5*ctrl) to other node
      const curveMidX = 0.5 * midX + 0.5 * ctrlX;
      const curveMidY = 0.5 * midY + 0.5 * ctrlY;
      const odx = curveMidX - other.x;
      const ody = curveMidY - other.y;
      const odist = Math.hypot(odx, ody);
      if (odist < SAFE_RADIUS) {
        const push = (SAFE_RADIUS - odist) * 1.65;
        const pushAngleX = odist > 1 ? odx / odist : nx;
        const pushAngleY = odist > 1 ? ody / odist : ny;
        ctrlX += pushAngleX * push;
        ctrlY += pushAngleY * push;
      }
    }

    return { ctrlX: Math.round(ctrlX), ctrlY: Math.round(ctrlY) };
  },

  resetGraphViewport(clearFocus = false) {
    this.graphZoom = 1;
    this.graphPanX = 0;
    this.graphPanY = 0;
    if (clearFocus) {
      this.graphFocusTaskId = null;
      this.graphHighlightConnOnly = false;
    }
    this.renderBlueprintGraph();
    this.renderConnectionInspector();
  },

  zoomGraph(factor) {
    this.graphZoom = Math.min(2.2, Math.max(0.55, +(this.graphZoom * factor).toFixed(2)));
    this.renderBlueprintGraph();
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

    // Group tasks by pillar so related tasks sit naturally near each other around the Nordic constellation ring
    const pillarMap = {};
    pillars.forEach(p => { pillarMap[p.id] = p; });
    const orderedTasks = [...tasks].sort((a, b) => {
      if (a.pillarId === b.pillarId) return 0;
      return (a.pillarId || "").localeCompare(b.pillarId || "");
    });

    const totalTasks = orderedTasks.length;
    // Dynamically scale elliptical ring radii based on node count so nodes NEVER crowd or overlap
    const baseRx = Math.max(290, totalTasks * 56);
    const baseRy = Math.max(130, totalTasks * 27);
    const centerX = 500;
    const centerY = 240;

    const nodePositions = {};
    orderedTasks.forEach((task, idx) => {
      if (totalTasks === 1) {
        nodePositions[task.id] = {
          x: centerX,
          y: centerY,
          task,
          pillar: pillarMap[task.pillarId] || { title: "未分類", color: "#5F7464", bgSoft: "#E7EFE8" }
        };
        return;
      }
      // Distribute evenly around an elliptical constellation ring (starting from top-left -145 deg)
      const angle = (-Math.PI * 0.78) + (idx / totalTasks) * (Math.PI * 2);
      // Slight radial alternation when > 7 nodes for extra breathing space
      const ringScale = totalTasks > 7 ? (idx % 2 === 0 ? 1.06 : 0.86) : 1.0;
      const x = Math.round(centerX + Math.cos(angle) * baseRx * ringScale);
      const y = Math.round(centerY + Math.sin(angle) * baseRy * ringScale);

      nodePositions[task.id] = {
        x,
        y,
        task,
        pillar: pillarMap[task.pillarId] || { title: "未分類", color: "#5F7464", bgSoft: "#E7EFE8" }
      };
    });

    const allNodesList = Object.values(nodePositions);

    // Compute dynamic bounding box of all nodes + generous invisible outer margin so NOTHING ever goes out of page
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    allNodesList.forEach(n => {
      if (n.x - 135 < minX) minX = n.x - 135;
      if (n.x + 135 > maxX) maxX = n.x + 135;
      if (n.y - 82 < minY) minY = n.y - 82;
      if (n.y + 82 > maxY) maxY = n.y + 82;
    });

    const rawW = Math.max(760, maxX - minX);
    const rawH = Math.max(340, maxY - minY);
    const viewW = Math.round(rawW / this.graphZoom);
    const viewH = Math.round(rawH / this.graphZoom);
    const viewX = Math.round(minX + (rawW - viewW) / 2 - this.graphPanX);
    const viewY = Math.round(minY + (rawH - viewH) / 2 - this.graphPanY);

    // Determine which nodes and connections are currently illuminated
    const focusedTaskId = this.graphFocusTaskId;
    const focusedPillarId = (!focusedTaskId && this.selectedPillarId !== "ALL") ? this.selectedPillarId : null;
    const connectedTaskIds = new Set();
    const activeConnIds = new Set();

    if (focusedTaskId) {
      connectedTaskIds.add(focusedTaskId);
      conns.forEach(c => {
        if (c.fromTaskId === focusedTaskId || c.toTaskId === focusedTaskId) {
          activeConnIds.add(c.id);
          connectedTaskIds.add(c.fromTaskId);
          connectedTaskIds.add(c.toTaskId);
        }
      });
    } else if (focusedPillarId) {
      const pillarTasks = new Set(tasks.filter(t => t.pillarId === focusedPillarId).map(t => t.id));
      pillarTasks.forEach(tid => connectedTaskIds.add(tid));
      conns.forEach(c => {
        if (pillarTasks.has(c.fromTaskId) || pillarTasks.has(c.toTaskId)) {
          activeConnIds.add(c.id);
          connectedTaskIds.add(c.fromTaskId);
          connectedTaskIds.add(c.toTaskId);
        }
      });
    } else if (this.graphHighlightConnOnly && this.selectedConnId) {
      const selConn = conns.find(c => c.id === this.selectedConnId);
      if (selConn) {
        activeConnIds.add(selConn.id);
        connectedTaskIds.add(selConn.fromTaskId);
        connectedTaskIds.add(selConn.toTaskId);
      }
    }

    const hasActiveFilter = (focusedTaskId != null) || (focusedPillarId != null) || (this.graphHighlightConnOnly && activeConnIds.size > 0);

    // Build SVG connections (drawn first, behind nodes; clipped at each node's invisible outer safety box!)
    let pathsHtml = "";
    let labelsHtml = "";

    conns.forEach((conn, idx) => {
      const fromNode = nodePositions[conn.fromTaskId];
      const toNode = nodePositions[conn.toTaskId];
      if (!fromNode || !toNode) return;

      const meta = CONN_TYPE_META[conn.type] || CONN_TYPE_META.synergy;
      const isConnLit = activeConnIds.has(conn.id);
      const isOutgoingFromFocused = (focusedTaskId && conn.fromTaskId === focusedTaskId);

      // Compute obstacle-avoiding control point
      const { ctrlX, ctrlY } = this.computeObstacleAvoidingControlPoint(fromNode, toNode, allNodesList, idx);

      // Clip start & end points at the INVISIBLE outer boundary box (halfW=92, halfH=48) so lines have clean air gap from nodes!
      const startPt = this.clipPointToInvisibleBox(fromNode.x, fromNode.y, ctrlX, ctrlY, 90, 48);
      const endPt = this.clipPointToInvisibleBox(toNode.x, toNode.y, ctrlX, ctrlY, 94, 52);

      const pathD = `M ${Math.round(startPt.x)} ${Math.round(startPt.y)} Q ${ctrlX} ${ctrlY} ${Math.round(endPt.x)} ${Math.round(endPt.y)}`;

      // Default semi-transparent when not focused; bright when focused!
      const strokeOpacity = hasActiveFilter
        ? (isConnLit ? 0.95 : 0.11)
        : 0.24;
      const strokeW = isConnLit ? (isOutgoingFromFocused ? 3.5 : 2.8) : 1.8;

      pathsHtml += `
        <g class="conn-svg-group" style="cursor:pointer"
           onclick="event.stopPropagation(); App.selectConnection('${conn.id}')"
           ondblclick="event.stopPropagation(); App.openEditConnectionModal('${conn.id}')">
          <!-- Wide invisible click area -->
          <path d="${pathD}" stroke="transparent" stroke-width="18" fill="none" />
          ${isConnLit ? `<path d="${pathD}" stroke="${meta.color}" stroke-width="8" stroke-opacity="0.16" fill="none" />` : ""}
          <path d="${pathD}" stroke="${meta.color}" stroke-width="${strokeW}" stroke-opacity="${strokeOpacity}"
                stroke-dasharray="${conn.type === 'nourish' ? '6 4' : 'none'}" fill="none"
                marker-end="url(#arrow-${conn.type}-${isConnLit ? 'lit' : 'dim'})" />
        </g>
      `;

      // ONLY render text labels on lit-up connections so the graph stays 100% clean and uncluttered!
      if (isConnLit) {
        const labelX = Math.round(0.25 * startPt.x + 0.5 * ctrlX + 0.25 * endPt.x);
        const labelY = Math.round(0.25 * startPt.y + 0.5 * ctrlY + 0.25 * endPt.y);
        const labelText = this.truncate(conn.label, 10);
        const pillW = Math.max(88, labelText.length * 12 + 24);

        labelsHtml += `
          <g style="cursor:pointer"
             onclick="event.stopPropagation(); App.selectConnection('${conn.id}')"
             ondblclick="event.stopPropagation(); App.openEditConnectionModal('${conn.id}')">
            <title>單擊檢視詳情，雙擊直接編輯此關聯線</title>
            <rect x="${labelX - pillW / 2}" y="${labelY - 12}" width="${pillW}" height="24" rx="12"
                  fill="${meta.color}" stroke="#FCFBF7" stroke-width="2" />
            <text x="${labelX}" y="${labelY + 4}" text-anchor="middle"
                  font-size="11" font-weight="700" fill="#FFFFFF">
              ${isOutgoingFromFocused ? "↗ " : ""}${this.escapeHtml(labelText)}
            </text>
          </g>
        `;
      }
    });

    // Build SVG task nodes (with invisible outer safety frame & borderless/soft-edge Nordic cards)
    let nodesHtml = "";
    allNodesList.forEach(pos => {
      const { x, y, task, pillar } = pos;
      const isFocused = (focusedTaskId === task.id);
      const isConnectedNeighbor = hasActiveFilter && connectedTaskIds.has(task.id);
      const nodeOpacity = hasActiveFilter
        ? (isConnectedNeighbor ? 1.0 : 0.30)
        : 1.0;

      const scoreBadge = task.enableTracker
        ? `★ ${task.tracker.selfScore}/10`
        : `📓 筆記(${task.notes.length})`;

      const outCount = conns.filter(c => c.fromTaskId === task.id || c.toTaskId === task.id).length;

      nodesHtml += `
        <g class="node-svg-group" transform="translate(${x}, ${y})" style="cursor:pointer; opacity:${nodeOpacity}"
           onclick="event.stopPropagation(); App.selectTaskFromGraph('${task.id}')">
          <!-- Invisible Outer Safety Buffer Frame (184x96) that keeps spacing & click comfort -->
          <rect x="-92" y="-48" width="184" height="96" rx="24" fill="transparent" stroke="none" />

          <!-- Highlight Halo when focused or connected -->
          ${isFocused ? `
            <rect x="-84" y="-38" width="168" height="76" rx="22" fill="${pillar.color}" opacity="0.15" />
            <rect x="-80" y="-34" width="160" height="68" rx="20" fill="none" stroke="${pillar.color}" stroke-width="2" stroke-dasharray="4 3" opacity="0.7" />
          ` : (isConnectedNeighbor ? `
            <rect x="-81" y="-35" width="162" height="70" rx="20" fill="${pillar.color}" opacity="0.10" />
          ` : "")}

          <!-- Soft Borderless Nordic Card (no harsh heavy border) -->
          <rect x="-74" y="-28" width="148" height="58" rx="16"
                fill="${isFocused ? '#FFFFFF' : pillar.bgSoft}"
                stroke="${pillar.color}"
                stroke-width="${isFocused ? 2.2 : (isConnectedNeighbor ? 1.5 : 0)}"
                stroke-opacity="${isFocused ? 0.9 : 0.45}"
                filter="url(#nordic-card-shadow)" />

          <!-- Pillar top floating pill -->
          <rect x="-46" y="-38" width="92" height="18" rx="9" fill="${pillar.color}" />
          <text x="0" y="-25.5" text-anchor="middle" font-size="10" font-weight="700" fill="#FFFFFF">
            ${this.escapeHtml(this.truncate(pillar.title, 7))}
          </text>

          <!-- Task Title -->
          <text x="0" y="-2" text-anchor="middle" font-size="13" font-weight="700" fill="#2C322E">
            ${this.escapeHtml(this.truncate(task.title, 9))}
          </text>

          <!-- Sub status -->
          <text x="0" y="17" text-anchor="middle" font-size="10.8" fill="#5A625C">
            ${scoreBadge}${task.tracker && task.tracker.aiCompletion ? ` · AI ${task.tracker.aiCompletion}%` : ""}${outCount > 0 ? ` · 🔗${outCount}` : ""}
          </text>
        </g>
      `;
    });

    container.innerHTML = `
      <svg id="blueprintSvgEl" viewBox="${viewX} ${viewY} ${viewW} ${viewH}" class="blueprint-svg"
           onClick="App.clearGraphFocus()">
        <defs>
          <filter id="nordic-card-shadow" x="-15%" y="-15%" width="130%" height="135%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" flood-color="#2C322E" flood-opacity="0.07" />
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
        ${labelsHtml}
      </svg>

      <!-- Floating Zoom / Fit / Focus Controls -->
      <div class="graph-floating-controls" onclick="event.stopPropagation()">
        <button type="button" class="graph-ctrl-btn ${!hasActiveFilter ? 'active' : ''}" onclick="App.clearGraphFocus()" title="顯示所有節點並將關聯線轉為半透明無標籤">
          ✨ 全覽待機模式
        </button>
        <span style="color:var(--border-warm)">|</span>
        <button type="button" class="graph-ctrl-btn" onclick="App.zoomGraph(1.18)" title="放大藍圖">＋ 放大</button>
        <button type="button" class="graph-ctrl-btn" onclick="App.zoomGraph(0.85)" title="縮小藍圖">－ 縮小</button>
        <button type="button" class="graph-ctrl-btn" onclick="App.resetGraphViewport(false)" title="自動適應畫面大小">🔍 自動適應 (${Math.round(this.graphZoom * 100)}%)</button>
      </div>
    `;

    this.attachGraphPanZoomEvents();
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

  renderConnectionInspector() {
    const box = document.getElementById("connectionInspector");

    // If a task node is focused, show all connections radiating from / into that task!
    if (this.graphFocusTaskId) {
      const focusedTask = this.data.tasks.find(t => t.id === this.graphFocusTaskId);
      const relatedConns = this.data.connections.filter(
        c => c.fromTaskId === this.graphFocusTaskId || c.toTaskId === this.graphFocusTaskId
      );

      if (focusedTask && relatedConns.length > 0) {
        const itemsHtml = relatedConns.map(c => {
          const isOutgoing = c.fromTaskId === focusedTask.id;
          const otherId = isOutgoing ? c.toTaskId : c.fromTaskId;
          const otherTask = this.data.tasks.find(t => t.id === otherId);
          const meta = CONN_TYPE_META[c.type] || CONN_TYPE_META.synergy;
          return `
            <div style="background:rgba(255,255,255,0.82);border:1px solid var(--border-subtle);border-radius:10px;padding:9px 11px;margin-bottom:8px;cursor:pointer;"
                 onclick="App.selectConnection('${c.id}')">
              <div style="display:flex;justify-content:space-between;align-items:center;font-size:11.5px;margin-bottom:3px;">
                <span style="color:${meta.color};font-weight:700;">${isOutgoing ? "↗ 發射影響" : "↙ 接收支撐"} ・ ${this.escapeHtml(c.label)}</span>
                <div style="display:flex;align-items:center;gap:6px;">
                  <span style="color:var(--ink-muted)">${c.strength || 85}%</span>
                  <button type="button" class="btn-icon-text" style="padding:1px 7px;font-size:11px;"
                          onclick="event.stopPropagation(); App.openEditConnectionModal('${c.id}')" title="編輯此關聯線">✎ 編輯</button>
                </div>
              </div>
              <div style="font-size:12.5px;font-weight:700;color:var(--ink-primary);margin-bottom:3px;">
                ${isOutgoing ? `➔ 連向【${otherTask ? this.escapeHtml(otherTask.title) : ''}】` : `⬅ 來自【${otherTask ? this.escapeHtml(otherTask.title) : ''}】`}
              </div>
              <div style="font-size:12px;color:var(--ink-secondary);line-height:1.5;">
                ${this.escapeHtml(c.reason)}
              </div>
            </div>
          `;
        }).join("");

        box.innerHTML = `
          <div style="overflow-y:auto;max-height:290px;padding-right:4px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
              <span class="inspector-badge" style="background:var(--sage-soft);color:var(--sage-primary);margin-bottom:0;">
                🌟 已點亮【${this.escapeHtml(focusedTask.title)}】的關聯網
              </span>
              <button class="btn-icon-text" onclick="App.clearGraphFocus()">返回全覽</button>
            </div>
            <div style="font-size:12px;color:var(--ink-secondary);margin-bottom:8px;">
              共點亮 <strong>${relatedConns.length}</strong> 條關聯線與連到的項目（點擊可檢視或按「✎ 編輯」修改）：
            </div>
            ${itemsHtml}
          </div>
        `;
        return;
      }
    }

    const conn = this.data.connections.find(c => c.id === this.selectedConnId) || this.data.connections[0];

    if (!conn) {
      box.innerHTML = `
        <div>
          <span class="inspector-badge" style="background:var(--sage-soft);color:var(--sage-primary)">🦌 森林關聯洞察</span>
          <div class="inspector-title">尚無關聯連線</div>
          <p class="inspector-reason">點擊右上角「＋ 手動連結關聯」或「✨ 讓 AI 重新探索關聯」，就能看見不同人生規劃之間如何彼此支持。</p>
        </div>
      `;
      return;
    }

    const fromTask = this.data.tasks.find(t => t.id === conn.fromTaskId);
    const toTask = this.data.tasks.find(t => t.id === conn.toTaskId);
    const meta = CONN_TYPE_META[conn.type] || CONN_TYPE_META.synergy;

    box.innerHTML = `
      <div>
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span class="inspector-badge" style="background:${meta.bg};color:${meta.color}">
            ${meta.label} ・ 關聯度 ${conn.strength || 85}%
          </span>
          <span style="font-size:11px;color:var(--ink-muted)">${conn.source === 'ai' ? '✨ AI 洞察' : '✍️ 手動建立'}</span>
        </div>
        <div class="inspector-title">${this.escapeHtml(conn.label)}</div>
        <div class="inspector-Route">
          <span class="route-pill" onclick="App.selectTaskFromGraph('${fromTask ? fromTask.id : ''}')">
            ${fromTask ? this.escapeHtml(fromTask.title) : '未知任務'}
          </span>
          <span>➔</span>
          <span class="route-pill" onclick="App.selectTaskFromGraph('${toTask ? toTask.id : ''}')">
            ${toTask ? this.escapeHtml(toTask.title) : '未知任務'}
          </span>
        </div>
        <div class="inspector-reason">
          ${this.escapeHtml(conn.reason)}
        </div>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;gap:6px;flex-wrap:wrap;">
        <span style="font-size:11.5px;color:var(--ink-muted)">🐾 點擊左圖任一項目可點亮其連線</span>
        <div style="display:flex;gap:6px;">
          <button class="btn btn-xs btn-soft" onclick="App.openEditConnectionModal('${conn.id}')">✎ 編輯關聯</button>
          <button class="btn btn-xs btn-danger-ghost" onclick="App.deleteConnection('${conn.id}')">移除</button>
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
    this.selectedTaskId = taskId;
    // Toggle focus illumination on the blueprint graph
    this.graphFocusTaskId = (this.graphFocusTaskId === taskId) ? null : taskId;
    this.graphHighlightConnOnly = false;
    const relatedConn = this.data.connections.find(c => c.fromTaskId === taskId || c.toTaskId === taskId);
    if (relatedConn) {
      this.selectedConnId = relatedConn.id;
    }
    this.renderAll();
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

  SaveApiSettingsOnly() {
    if (!this.data.settings) this.data.settings = {};
    this.data.settings.apiKey = document.getElementById("aiApiKeyInput").value.trim();
    this.data.settings.model = document.getElementById("aiModelSelect").value;
    this.saveData("已儲存 Gemini API 設定 🔑");
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
    autoSync: false
  },
  _ghAutoSyncTimer: null,

  async loadGithubSyncConfig() {
    // 1. Try localStorage first
    try {
      const raw = localStorage.getItem("nordic_github_sync_v1");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          this.githubSyncConfig = {
            repo: parsed.repo || "johnny8dada/Life-Cat-Data",
            token: parsed.token || "",
            autoSync: !!parsed.autoSync
          };
        }
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
            autoSync: cfg.autoSync != null ? !!cfg.autoSync : this.githubSyncConfig.autoSync
          };
          localStorage.setItem("nordic_github_sync_v1", JSON.stringify(this.githubSyncConfig));
        }
      }
    } catch (e) {}
  },

  openSettingsModal() {
    const repoInput = document.getElementById("ghRepoInput");
    const tokenInput = document.getElementById("ghTokenInput");
    const autoCheck = document.getElementById("ghAutoSyncCheckbox");
    if (repoInput) repoInput.value = this.githubSyncConfig.repo || "johnny8dada/Life-Cat-Data";
    if (tokenInput) tokenInput.value = this.githubSyncConfig.token || "";
    if (autoCheck) autoCheck.checked = !!this.githubSyncConfig.autoSync;
    this.openModal("settingsModal");
  },

  saveGithubSyncConfig(showNotice = false) {
    const repoInput = document.getElementById("ghRepoInput");
    const tokenInput = document.getElementById("ghTokenInput");
    const autoCheck = document.getElementById("ghAutoSyncCheckbox");
    this.githubSyncConfig = {
      repo: (repoInput ? repoInput.value.trim() : "") || "johnny8dada/Life-Cat-Data",
      token: tokenInput ? tokenInput.value.trim() : "",
      autoSync: autoCheck ? !!autoCheck.checked : false
    };
    localStorage.setItem("nordic_github_sync_v1", JSON.stringify(this.githubSyncConfig));
    fetch("/api/github-sync-config", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(this.githubSyncConfig)
    }).catch(() => {});
    if (showNotice) {
      this.showToast("💾 已儲存 Private Repo 同步設定");
    }
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

      // Preserve current device's Gemini API key
      const currentApiKey = (this.data.settings && this.data.settings.apiKey) || localStorage.getItem("nordic_gemini_api_key") || "";
      this.data = cloudData;
      if (!this.data.settings) this.data.settings = { apiKey: currentApiKey, model: "gemini-3.8-flash" };
      this.data.settings.apiKey = currentApiKey;

      await this.saveData("☁️ 已從 Private Repo 載入個人資料並寫入本地 data/ 資料夾！");
      this.renderAll();

      if (statusBox) {
        const nowStr = new Date().toLocaleTimeString("zh-TW", { hour12: false });
        statusBox.textContent = `✅ 已於 ${nowStr} 從私人儲存庫 (${repo}) 同步最新個人資料！`;
      }
    } catch (err) {
      if (statusBox) {
        statusBox.textContent = `❌ 雲端拉取失敗：${err.message}`;
      }
      this.showToast("雲端拉取失敗：" + err.message);
    }
  },

  async pushToGithubCloud(silent = false) {
    this.saveGithubSyncConfig();
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
