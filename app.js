// ===== 設定 =====
const PROXY_URL = "https://decklog-proxy.card-master-dm.workers.dev";

const GAME_NAMES = {
  1: "ヴァンガード",
  2: "ヴァイスシュヴァルツ",
  3: "バディファイト",
  5: "Reバース",
  6: "Shadowverse EVOLVE",
  7: "ヴァイスシュヴァルツブラウ",
  8: "ドリームオーダー",
  9: "hololive OCG",
  10: "五等分の花嫁",
  11: "ラブライブ!OCG",
  12: "ヴァイスシュヴァルツロゼ",
  13: "GODZILLA CG",
};

const REGULATION_MAP = {
  N: "ネオスタンダード",
  S: "スタンダード",
  T: "タイトル限定",
};

const CARD_IMAGE_BASE = {
  1: "https://cf-vanguard.com/wordpress/wp-content/images/cardlist/",
  2: "https://ws-tcg.com/wordpress/wp-content/images/cardlist/",
  3: "https://fc-buddyfight.com/wordpress/wp-content/images/card/",
  5: "https://rebirth-fy.com/wordpress/wp-content/images/cardlist/",
  6: "https://shadowverse-evolve.com/wordpress/wp-content/images/cardlist/",
  7: "https://ws-blau.com/wordpress/wp-content/images/cardlist/",
  8: "https://dreamorder.com/wordpress/wp-content/images/cardlist/",
  9: "https://hololive-official-cardgame.com/wp-content/images/cardlist/",
  10: "https://5hanayome-cardgame.com/wordpress/wp-content/images/cardlist/",
  11: "https://llofficial-cardgame.com/wordpress/wp-content/images/cardlist/",
  12: "https://ws-rose.com/wordpress/wp-content/images/cardlist/",
  13: "https://godzilla-cardgame.com/wordpress/wp-content/images/cardlist/",
};

// ===== セクション名（ゲームごと） =====
// p_list / list / sub_list に対応するラベル（Deck Log公式サイトのh3に準拠）
const SECTION_NAMES = {
  1:  { p: "ライドデッキ",     main: "デッキ",         sub: "" },              // VG
  2:  { p: "",                 main: "デッキ",         sub: "" },              // WS
  3:  { p: "フラッグ・バディ", main: "デッキ",         sub: "ロストデッキ" },  // BF
  5:  { p: "パートナー",       main: "デッキ",         sub: "" },              // RE
  6:  { p: "リーダーカード",   main: "メインデッキ",   sub: "エボルヴデッキ" },// SVE
  7:  { p: "",                 main: "デッキ",         sub: "" },              // BLAU
  8:  { p: "オーダーデッキ",   main: "メインデッキ",   sub: "" },              // PDO
  9:  { p: "推しホロメン",     main: "メインデッキ",   sub: "エールデッキ" },  // HOCG
  10: { p: "",                 main: "デッキ",         sub: "" },              // 五等分
  11: { p: "",                 main: "メインデッキ",   sub: "エネルギーデッキ" },// LLC
  12: { p: "",                 main: "デッキ",         sub: "" },              // WSR
  13: { p: "怪獣デッキ",       main: "メインデッキ",   sub: "" },              // GCG
};

function getSectionNames(gameTitleId) {
  return SECTION_NAMES[gameTitleId] || { p: "特殊", main: "メイン", sub: "サブ" };
}

// ===== 列定義 =====
const DEFAULT_COLUMNS = [
  { key: "thumb",    label: "画像",        visible: true },
  { key: "deckCode", label: "デッキコード", visible: true },
  { key: "deckName", label: "デッキ名",    visible: true },
  { key: "section",  label: "区分",        visible: true },
  { key: "kind",     label: "種類",        visible: true },
  { key: "cardId",   label: "カードID",    visible: true },
  { key: "rare",     label: "レアリティ",  visible: true },
  { key: "num",      label: "枚数",        visible: true },
  { key: "cardName", label: "カード名",    visible: true },
  { key: "imageUrl", label: "画像URL",     visible: true },
  { key: "oshiName", label: "推しホロメン", visible: false },
  { key: "deckUrl",  label: "デッキURL",   visible: false },
  { key: "cost",     label: "コスト",      visible: false },
];

const STORAGE_KEY = "decklog-columns";

function loadColumnConfig() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return structuredClone(DEFAULT_COLUMNS);
    const parsed = JSON.parse(saved);
    // デフォルトからlabelを復元
    const defaultMap = Object.fromEntries(DEFAULT_COLUMNS.map((c) => [c.key, c]));
    const result = parsed
      .filter((c) => defaultMap[c.key])
      .map((c) => ({ ...defaultMap[c.key], visible: c.visible }));
    // savedにない新列はデフォルトから追加
    const savedKeys = new Set(result.map((c) => c.key));
    for (const def of DEFAULT_COLUMNS) {
      if (!savedKeys.has(def.key)) result.push({ ...def });
    }
    return result;
  } catch {
    return structuredClone(DEFAULT_COLUMNS);
  }
}

function saveColumnConfig() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(columnConfig.map((c) => ({ key: c.key, visible: c.visible })))
  );
}

let columnConfig = loadColumnConfig();

// ===== ページング =====
const REQUEST_INTERVAL = 500; // リクエスト間隔 (ms) 1〜5件目
const REQUEST_INTERVAL_SLOW = 1000; // リクエスト間隔 (ms) 6件目以降
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const DECKS_PER_PAGE = 5;
let currentPage = 0;

// ===== 状態 =====
let allCardRows = [];
let lastDeckList = null;

// ===== DOM要素 =====
const deckCodesInput = document.getElementById("deck-codes");
const searchBtn = document.getElementById("search-btn");
const errorEl = document.getElementById("error");
const loadingEl = document.getElementById("loading");
const deckInfoEl = document.getElementById("deck-info");

// Ctrl+Enter で検索
deckCodesInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) fetchDecks();
});

// URLハッシュからデッキコードを読み取り
window.addEventListener("load", () => {
  const hash = location.hash.replace("#", "").trim();
  if (hash) {
    deckCodesInput.value = hash.replace(/,/g, ", ");
    fetchDecks();
  }
});

// ===== メイン処理 =====
function parseCodes(input) {
  const codes = [];
  // URLからコードを抽出
  const urlPattern = /decklog\.bushiroad\.com\/view\/([A-Za-z0-9]{1,10})/g;
  let m;
  while ((m = urlPattern.exec(input)) !== null) {
    codes.push(m[1].toUpperCase());
  }
  // URLを除去した残りからプレーンコードを抽出
  const withoutUrls = input.replace(/https?:\/\/[^\s,、;]+/g, "");
  const plain = withoutUrls.toUpperCase().split(/[\s,、;]+/).map((s) => s.trim())
    .filter((s) => /^[A-Z0-9]{1,10}$/.test(s));
  codes.push(...plain);
  return [...new Set(codes)];
}

async function fetchDecks() {
  const raw = deckCodesInput.value.trim();
  if (!raw) { showError("デッキコードを入力してください"); return; }
  const codes = parseCodes(raw);
  if (codes.length === 0) { showError("有効なデッキコードがありません（英数字のみ・最大10文字）"); return; }
  history.replaceState(null, "", `#${codes.join(",")}`);
  hideError();
  deckInfoEl.classList.add("hidden");
  loadingEl.classList.remove("hidden");
  searchBtn.disabled = true;
  allCardRows = [];

  const results = [];
  const errors = [];
  for (let i = 0; i < codes.length; i++) {
    if (i > 0) await sleep(i >= 5 ? REQUEST_INTERVAL_SLOW : REQUEST_INTERVAL);
    loadingEl.querySelector("p").textContent = `取得中... (${i + 1}/${codes.length})`;
    const code = codes[i];
    try {
      const url = `${PROXY_URL}?deck_id=${encodeURIComponent(code)}`;
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      if (!data || !data.deck_id) {
        if (Array.isArray(data) && data.length === 0) throw new Error("見つかりません");
        throw new Error("不正なレスポンス");
      }
      results.push(data);
    } catch (e) {
      errors.push(`${code}: ${e.message}`);
    }
  }
  loadingEl.classList.add("hidden");
  searchBtn.disabled = false;
  if (errors.length > 0 && results.length === 0) { showError(errors.join("\n")); return; }
  if (errors.length > 0) showError("一部取得失敗: " + errors.join(", "));
  lastDeckList = results;
  renderDecks(results);
}

// ===== ユーティリティ =====
function getOshiName(deck) {
  if (deck.p_list && deck.p_list.length > 0) return deck.p_list[0].name || "";
  return "";
}

function getCardImageUrl(deck, card) {
  const base = CARD_IMAGE_BASE[deck.game_title_id];
  if (!base || !card.img) return "";
  return base + card.img;
}

function getDeckUrl(deckId) {
  return `https://decklog.bushiroad.com/view/${deckId}`;
}

// ===== セル値取得 =====
function getCellHtml(row, key) {
  switch (key) {
    case "thumb":
      return row.imageUrl
        ? `<img class="card-thumb" src="${esc(row.imageUrl)}" alt="${esc(row.cardName)}" loading="lazy">`
        : "";
    case "deckCode": return esc(row.deckCode);
    case "deckName": return esc(row.deckName);
    case "oshiName": return esc(row.oshiName);
    case "deckUrl":  return `<a href="${esc(row.deckUrl)}" target="_blank" rel="noopener">${esc(row.deckCode)}</a>`;
    case "section":  return esc(row.section);
    case "cardId":   return esc(row.cardId);
    case "cardName": return esc(row.cardName);
    case "num":      return row.num;
    case "kind":     return esc(row.kind);
    case "rare":     return esc(row.rare);
    case "cost":     return esc(row.cost);
    case "imageUrl": return `<a href="${esc(row.imageUrl)}" target="_blank" rel="noopener">link</a>`;
    default: return "";
  }
}

function getCellText(row, key) {
  switch (key) {
    case "thumb":    return ""; // コピーには含めない
    case "deckCode": return row.deckCode;
    case "deckName": return row.deckName;
    case "oshiName": return row.oshiName;
    case "deckUrl":  return row.deckUrl;
    case "section":  return row.section;
    case "cardId":   return row.cardId;
    case "cardName": return row.cardName;
    case "num":      return row.num;
    case "kind":     return row.kind;
    case "rare":     return row.rare;
    case "cost":     return row.cost;
    case "imageUrl": return row.imageUrl;
    default: return "";
  }
}

// ===== 描画 =====
function renderDecks(deckList) {
  currentPage = 0;

  // カードデータ構築
  allCardRows = [];
  for (const deck of deckList) {
    const deckUrl = getDeckUrl(deck.deck_id);
    const oshiName = getOshiName(deck);
    const sn = getSectionNames(deck.game_title_id);
    const sections = [
      { cards: deck.p_list || [], section: sn.p, type: "p" },
      { cards: deck.list || [], section: sn.main, type: "main" },
      { cards: deck.sub_list || [], section: sn.sub, type: "sub" },
    ];
    for (const { cards, section, type } of sections) {
      for (const card of cards) {
        allCardRows.push({
          deckCode: deck.deck_id,
          deckName: deck.title || "",
          oshiName, deckUrl, section, sectionType: type,
          cardId: card.card_number || "",
          cardName: card.name || "",
          num: card.num,
          kind: card.card_kind || "",
          rare: card.rare || "",
          cost: card.cost || "",
          imageUrl: getCardImageUrl(deck, card),
        });
      }
    }
  }

  renderPage();
  deckInfoEl.classList.remove("hidden");
}

function renderPage() {
  const deckList = lastDeckList;
  const totalPages = Math.ceil(deckList.length / DECKS_PER_PAGE);
  const start = currentPage * DECKS_PER_PAGE;
  const pageDecks = deckList.slice(start, start + DECKS_PER_PAGE);

  // ヘッダー
  document.getElementById("deck-name").textContent =
    deckList.length === 1 ? (deckList[0].title || deckList[0].deck_id) : `${deckList.length}件のデッキ`;

  // バッジ（現在ページのみ）
  const metaEl = document.querySelector(".deck-meta");
  metaEl.innerHTML = pageDecks
    .map((d, i) => {
      const globalIdx = start + i;
      const url = getDeckUrl(d.deck_id);
      const title = d.title || "";
      const firstCard = (d.list && d.list.length > 0) ? d.list[0].name || "" : "";
      const label = `${globalIdx + 1} / ${d.deck_id}` + (title ? ` / ${title}` : "") + (firstCard ? ` / ${firstCard}` : "");
      return `<span class="badge-group"><a class="badge badge-link" href="${url}" target="_blank" rel="noopener">${label}</a><button class="badge-copy-btn" onclick="copySingleDeck('${d.deck_id}')" title="このデッキをコピー"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg></button></span>`;
    })
    .join("");

  // ページネーション
  renderPagination(totalPages);

  // テーブル（現在ページのデッキのみ）
  const pageDeckIds = new Set(pageDecks.map((d) => d.deck_id));
  const pageRows = allCardRows.filter((r) => pageDeckIds.has(r.deckCode));
  renderTableRows(pageRows);
}

function renderTable() {
  // 列設定変更時: ページ付きで再描画
  if (lastDeckList && lastDeckList.length > 0) {
    renderPage();
  }
}

function renderTableRows(rows) {
  const visibleCols = columnConfig.filter((c) => c.visible);
  const thead = document.querySelector("#deck-table thead tr");
  thead.innerHTML = visibleCols
    .map((c) => {
      const cls = c.key === "thumb" ? ' class="thumb-cell"' : "";
      return `<th${cls}>${esc(c.label)}</th>`;
    })
    .join("");

  const tbody = document.getElementById("deck-tbody");
  let prevDeckCode = null;
  tbody.innerHTML = rows
    .map((r) => {
      const sectionCls = r.sectionType === "p" ? "oshi-row" : r.sectionType === "sub" ? "partner-row" : "";
      const borderCls = prevDeckCode !== null && r.deckCode !== prevDeckCode ? "deck-border" : "";
      prevDeckCode = r.deckCode;
      const cls = [sectionCls, borderCls].filter(Boolean).join(" ");
      const cells = visibleCols
        .map((c) => {
          const tdCls = c.key === "thumb" ? ' class="thumb-cell"' : "";
          return `<td${tdCls}>${getCellHtml(r, c.key)}</td>`;
        })
        .join("");
      return `<tr${cls ? ` class="${cls}"` : ""}>${cells}</tr>`;
    })
    .join("");
}

function renderPagination(totalPages) {
  let paginationEl = document.getElementById("pagination");
  if (!paginationEl) {
    paginationEl = document.createElement("div");
    paginationEl.id = "pagination";
    paginationEl.className = "pagination";
    document.getElementById("deck-table").before(paginationEl);
  }
  if (totalPages <= 1) {
    paginationEl.classList.add("hidden");
    return;
  }
  paginationEl.classList.remove("hidden");

  let html = `<button class="page-btn" onclick="goPage(${currentPage - 1})" ${currentPage === 0 ? "disabled" : ""}>&laquo; 前</button>`;
  for (let i = 0; i < totalPages; i++) {
    const active = i === currentPage ? " active" : "";
    html += `<button class="page-btn${active}" onclick="goPage(${i})">${i + 1}</button>`;
  }
  html += `<button class="page-btn" onclick="goPage(${currentPage + 1})" ${currentPage === totalPages - 1 ? "disabled" : ""}">次 &raquo;</button>`;
  html += `<span class="page-info">${lastDeckList.length}件中 ${currentPage * DECKS_PER_PAGE + 1}-${Math.min((currentPage + 1) * DECKS_PER_PAGE, lastDeckList.length)}件表示</span>`;
  paginationEl.innerHTML = html;
}

function goPage(page) {
  const totalPages = Math.ceil(lastDeckList.length / DECKS_PER_PAGE);
  if (page < 0 || page >= totalPages) return;
  currentPage = page;
  renderPage();
  document.getElementById("deck-info").scrollIntoView({ behavior: "smooth" });
}

// ===== コピー =====
function getCopyColumns() {
  return columnConfig.filter((c) => c.visible && c.key !== "thumb");
}

function buildCopyText(rows, format) {
  const sep = format === "csv" ? "," : "\t";
  const includeHeader = document.getElementById("include-header").checked;
  const cols = getCopyColumns();

  const lines = [];
  if (includeHeader) {
    lines.push(cols.map((c) => c.label).join(sep));
  }
  for (const r of rows) {
    const vals = cols.map((c) => getCellText(r, c.key));
    if (format === "csv") {
      lines.push(vals.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
    } else {
      lines.push(vals.join("\t"));
    }
  }
  return lines.join("\n");
}

function copyToClipboard(format) {
  if (allCardRows.length === 0) return;
  const text = buildCopyText(allCardRows, format);
  navigator.clipboard.writeText(text).then(() => {
    showCopyStatus(`${format === "csv" ? "CSV" : "TSV"}をコピーしました (${allCardRows.length}行)`);
  });
}

function copySingleDeck(deckCode) {
  const rows = allCardRows.filter((r) => r.deckCode === deckCode);
  if (rows.length === 0) return;
  const text = buildCopyText(rows, "tsv");
  navigator.clipboard.writeText(text).then(() => {
    showCopyStatus(`${deckCode} をコピーしました (${rows.length}行)`);
  });
}

function copyShareUrl() {
  const url = location.href;
  navigator.clipboard.writeText(url).then(() => {
    showCopyStatus("共有URLをコピーしました");
  });
}

function showCopyStatus(msg) {
  const status = document.getElementById("copy-status");
  status.textContent = msg;
  setTimeout(() => (status.textContent = ""), 3000);
}

// ===== 列設定パネル =====
function toggleColumnSettings() {
  const panel = document.getElementById("column-settings");
  panel.classList.toggle("hidden");
  if (!panel.classList.contains("hidden")) renderColumnSettings();
}

function renderColumnSettings() {
  const list = document.getElementById("column-list");
  list.innerHTML = columnConfig
    .map((c, i) => {
      const checked = c.visible ? "checked" : "";
      return `<li draggable="true" data-index="${i}">
        <span class="drag-handle">&#x2630;</span>
        <label><input type="checkbox" ${checked} onchange="toggleColumn(${i}, this.checked)"> ${esc(c.label || "(画像)")}</label>
      </li>`;
    })
    .join("");

  // ドラッグ&ドロップ
  let dragIdx = null;
  list.querySelectorAll("li").forEach((li) => {
    li.addEventListener("dragstart", (e) => {
      dragIdx = +li.dataset.index;
      li.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
    });
    li.addEventListener("dragend", () => {
      li.classList.remove("dragging");
      dragIdx = null;
    });
    li.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      li.classList.add("drag-over");
    });
    li.addEventListener("dragleave", () => {
      li.classList.remove("drag-over");
    });
    li.addEventListener("drop", (e) => {
      e.preventDefault();
      li.classList.remove("drag-over");
      const dropIdx = +li.dataset.index;
      if (dragIdx === null || dragIdx === dropIdx) return;
      const item = columnConfig.splice(dragIdx, 1)[0];
      columnConfig.splice(dropIdx, 0, item);
      saveColumnConfig();
      renderColumnSettings();
      if (allCardRows.length > 0) renderTable();
    });
  });
}

function toggleColumn(index, visible) {
  columnConfig[index].visible = visible;
  saveColumnConfig();
  if (allCardRows.length > 0) renderTable();
}

function resetColumns() {
  if (!confirm("列設定をデフォルトに戻しますか？")) return;
  columnConfig = structuredClone(DEFAULT_COLUMNS);
  saveColumnConfig();
  renderColumnSettings();
  if (allCardRows.length > 0) renderTable();
}

// ===== ユーティリティ =====
function showError(msg) {
  errorEl.textContent = msg;
  errorEl.classList.remove("hidden");
}

function hideError() {
  errorEl.classList.add("hidden");
}

function esc(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
