import Fuse from "https://cdn.jsdelivr.net/npm/fuse.js@7.1.0/dist/fuse.min.mjs";
import { FUSE_OPTIONS } from "../fuse-search/fuse-options.mjs";
import { initBrowserRag, retrieveByVector, getLexiconMeta } from "./browser-rag.mjs";

const STORAGE_KEY = "acg_dictionary_recent_searches";
const FIXED_RESULT_LIMIT = 6;

const state = {
  docs: [],
  entryMap: new Map(),
  fuse: null,
  taxonomyCatalog: null,
  meta: null,
  recentSearches: [],
  featuredEntry: null
};

const dom = {
  form: document.querySelector("#search-form"),
  queryInput: document.querySelector("#query-input"),
  recentDropdown: document.querySelector("#recent-dropdown"),
  results: document.querySelector("#results"),
  resultSummary: document.querySelector("#result-summary"),
  entryCount: document.querySelector("#entry-count"),
  lexiconVersion: document.querySelector("#lexicon-version"),
  hotTerms: document.querySelector("#hot-terms"),
  recentSearches: document.querySelector("#recent-searches"),
  refreshHot: document.querySelector("#refresh-hot"),
  clearHistory: document.querySelector("#clear-history"),
  featuredTerm: document.querySelector("#featured-term"),
  featuredDefinition: document.querySelector("#featured-definition"),
  featuredAction: document.querySelector("#featured-action"),
  detailOverlay: document.querySelector("#detail-overlay"),
  closeDetail: document.querySelector("#close-detail"),
  detailTerm: document.querySelector("#detail-term"),
  detailTaxonomy: document.querySelector("#detail-taxonomy"),
  detailDefinition: document.querySelector("#detail-definition"),
  detailAliases: document.querySelector("#detail-aliases"),
  detailUsage: document.querySelector("#detail-usage"),
  detailExamples: document.querySelector("#detail-examples"),
  detailRelated: document.querySelector("#detail-related"),
  detailTags: document.querySelector("#detail-tags")
};

function normalizeText(value) {
  return String(value ?? "").trim().toLowerCase();
}

function shuffle(items) {
  const copied = [...items];
  for (let i = copied.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copied[i], copied[j]] = [copied[j], copied[i]];
  }
  return copied;
}

function saveRecentSearches() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.recentSearches.slice(0, 8)));
}

function loadRecentSearches() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    state.recentSearches = raw ? JSON.parse(raw) : [];
  } catch {
    state.recentSearches = [];
  }
}

function addRecentSearch(query) {
  const trimmed = String(query ?? "").trim();
  if (!trimmed) return;
  state.recentSearches = [trimmed, ...state.recentSearches.filter((item) => item !== trimmed)].slice(0, 8);
  saveRecentSearches();
  renderRecentSearches();
}

function makeChip(query, className = "chip") {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.textContent = query;
  button.dataset.query = query;
  return button;
}

function getEntryByTerm(term) {
  return [...state.entryMap.values()].find((entry) => entry.term === term);
}

function openDetail(entryOrId) {
  const entry = typeof entryOrId === "string" ? state.entryMap.get(entryOrId) : entryOrId;
  if (!entry) return;

  dom.detailTerm.textContent = entry.term;
  dom.detailTaxonomy.textContent = `${entry.taxonomy.layer1.name} / ${entry.taxonomy.layer2.name} / ${entry.taxonomy.layer3.name}`;
  dom.detailDefinition.textContent = entry.definition || "暂无";
  dom.detailUsage.textContent = entry.usage || "暂无";

  dom.detailAliases.innerHTML = (entry.aliases ?? []).length
    ? (entry.aliases ?? []).map((alias) => `<button type="button" class="tag detail-query" data-query="${alias}">${alias}</button>`).join("")
    : `<span class="tag">暂无别名</span>`;

  dom.detailExamples.innerHTML = (entry.examples ?? []).length
    ? (entry.examples ?? []).map((example) => `<li>${example}</li>`).join("")
    : `<li>暂无例句</li>`;

  dom.detailRelated.innerHTML = (entry.related ?? []).length
    ? (entry.related ?? []).map((item) => `<button type="button" class="tag detail-query" data-query="${item}">${item}</button>`).join("")
    : `<span class="tag">暂无相关词</span>`;

  dom.detailTags.innerHTML = (entry.tags ?? []).length
    ? (entry.tags ?? []).slice(0, 12).map((tag) => `<span class="tag">${tag}</span>`).join("")
    : `<span class="tag">暂无标签</span>`;

  dom.detailOverlay.classList.remove("hidden");
  dom.detailOverlay.setAttribute("aria-hidden", "false");
}

function closeDetail() {
  dom.detailOverlay.classList.add("hidden");
  dom.detailOverlay.setAttribute("aria-hidden", "true");
}

function renderFeaturedEntry() {
  const candidates = [...state.entryMap.values()]
    .sort((a, b) => (b.search_rank ?? 0) - (a.search_rank ?? 0))
    .slice(0, 40);

  state.featuredEntry = shuffle(candidates)[0] ?? candidates[0] ?? null;
  if (!state.featuredEntry) return;

  dom.featuredTerm.textContent = state.featuredEntry.term;
  dom.featuredDefinition.textContent = state.featuredEntry.definition;
}

function renderHotTerms() {
  const hotEntries = shuffle(
    [...state.entryMap.values()].sort((a, b) => (b.search_rank ?? 0) - (a.search_rank ?? 0)).slice(0, 40)
  ).slice(0, 10);

  dom.hotTerms.innerHTML = "";
  hotEntries.forEach((entry) => {
    const chip = makeChip(entry.term);
    chip.title = entry.definition;
    dom.hotTerms.appendChild(chip);
  });
}

function renderRecentSearches() {
  if (!state.recentSearches.length) {
    dom.recentSearches.innerHTML = `<div class="dropdown-empty">还没有最近搜索</div>`;
    return;
  }

  dom.recentSearches.innerHTML = state.recentSearches
    .map(
      (query) => `
        <button type="button" class="dropdown-history-item recent-item" data-query="${query}">
          <div>
            <strong>${query}</strong>
            <span>点一下重新搜索</span>
          </div>
          <span class="mini-tag">历史</span>
        </button>
      `
    )
    .join("");
}

function applyHighlight(text, query) {
  const safeText = String(text ?? "");
  const trimmedQuery = String(query ?? "").trim();
  if (!trimmedQuery) return safeText;

  const normalized = normalizeText(safeText);
  const normalizedQuery = normalizeText(trimmedQuery);
  const index = normalized.indexOf(normalizedQuery);
  if (index === -1) return safeText;

  return `${safeText.slice(0, index)}<mark>${safeText.slice(index, index + trimmedQuery.length)}</mark>${safeText.slice(index + trimmedQuery.length)}`;
}

function renderEmpty(message) {
  dom.results.innerHTML = `<div class="empty-state">${message}</div>`;
}

function exactBoost(query, entry) {
  const q = normalizeText(query);
  if (!q) return 0;
  if (normalizeText(entry.term) === q) return 0.22;
  if ((entry.aliases ?? []).some((alias) => normalizeText(alias) === q)) return 0.14;
  if ((entry.fuzzy_terms ?? []).some((term) => normalizeText(term) === q)) return 0.08;
  if (normalizeText(entry.term).startsWith(q)) return 0.04;
  return 0;
}

function getFuseMatchTier(query, entry) {
  const q = normalizeText(query);
  if (!q) return "fuzzy";

  const term = normalizeText(entry.term);
  const aliases = (entry.aliases ?? []).map(normalizeText);
  const fuzzyTerms = (entry.fuzzy_terms ?? []).map(normalizeText);

  if (term === q) return "keyword";
  if (aliases.includes(q)) return "keyword";
  if (fuzzyTerms.includes(q)) return "keyword";
  if (term.startsWith(q)) return "keyword";
  if (aliases.some((alias) => alias.startsWith(q))) return "keyword";
  return "fuzzy";
}

function runFuseSearch(query, limit) {
  if (!state.fuse) return [];
  const rawResults = state.fuse.search(query, { limit: Math.max(limit * 3, 40) });

  return rawResults
    .map((result) => {
      const fuseScore = typeof result.score === "number" ? result.score : 1;
      const normalizedScore = Math.max(
        0,
        1 - fuseScore + exactBoost(query, result.item) + Math.min((result.item.search_rank ?? 0) / 1000, 0.08)
      );

      return {
        id: result.item.id,
        source: "fuse",
        fuseScore,
        fuseNormalized: Number(Math.min(normalizedScore, 1).toFixed(4)),
        matches: result.matches ?? [],
        item: result.item
      };
    })
    .sort((a, b) => b.fuseNormalized - a.fuseNormalized)
    .slice(0, limit);
}

async function runRagSearch(query, limit) {
  const payload = retrieveByVector({
    query,
    topK: Math.max(limit * 2, 20)
  });
  return (payload.items ?? []).map((item) => ({
    id: item.id,
    source: "rag",
    ragScore: item.score,
    reason: item.reason,
    item: state.entryMap.get(item.id) ?? item
  }));
}

function mergeResults(query, fuseResults, ragResults, limit) {
  const bucket = new Map();

  fuseResults.forEach((result) => {
    bucket.set(result.id, {
      id: result.id,
      entry: state.entryMap.get(result.id) ?? result.item,
      fuseScore: result.fuseNormalized ?? 0,
      ragScore: 0,
      fuseRawScore: result.fuseScore ?? 1,
      reason: "",
      sources: new Set(["Fuse"])
    });
  });

  ragResults.forEach((result) => {
    const current = bucket.get(result.id) ?? {
      id: result.id,
      entry: state.entryMap.get(result.id) ?? result.item,
      fuseScore: 0,
      ragScore: 0,
      fuseRawScore: 1,
      reason: "",
      sources: new Set()
    };
    current.ragScore = Math.max(current.ragScore, result.ragScore ?? 0);
    current.reason = result.reason || current.reason;
    current.sources.add("RAG");
    bucket.set(result.id, current);
  });

  const merged = [...bucket.values()].map((item) => {
    const rankBoost = Math.min((item.entry.search_rank ?? 0) / 1000, 0.08);
    const hybridScore = Number(
      Math.min(1, item.fuseScore * 0.62 + item.ragScore * 0.33 + rankBoost).toFixed(4)
    );

    item.hybridScore = hybridScore;
    item.sources.add("Hybrid");
    item.query = query;
    return item;
  });

  const sorted = merged.sort((a, b) => b.hybridScore - a.hybridScore);

  if (sorted.length < limit) {
    const existingIds = new Set(sorted.map((item) => item.id));
    const fallbackEntries = [...state.entryMap.values()]
      .sort((a, b) => (b.search_rank ?? 0) - (a.search_rank ?? 0))
      .filter((entry) => !existingIds.has(entry.id))
      .slice(0, limit - sorted.length)
      .map((entry) => ({
        id: entry.id,
        entry,
        fuseScore: 0,
        ragScore: 0,
        fuseRawScore: 1,
        reason: "可先从这些常见词里看看有没有接近的说法",
        sources: new Set(["RAG", "Hybrid"]),
        hybridScore: 0.2,
        query
      }));

    return [...sorted, ...fallbackEntries].slice(0, limit);
  }

  return sorted.slice(0, limit);
}

function renderResults(query, results) {
  if (!results.length) {
    renderEmpty("没有找到匹配结果。可以试试别名、近义说法，或者改成一句描述来搜。");
    return;
  }

  const groups = {
    keyword: [],
    fuzzy: [],
    semantic: []
  };

  results.forEach((result) => {
    const entry = result.entry;
    if (result.sources.has("Fuse")) {
      const tier = getFuseMatchTier(query, entry);
      if (tier === "keyword") {
        groups.keyword.push(result);
      } else {
        groups.fuzzy.push(result);
      }
      return;
    }
    groups.semantic.push(result);
  });

  const groupMeta = [
    {
      key: "keyword",
      title: "你可能想找",
      desc: "优先展示和你输入最接近的词。",
      cardClass: "keyword-card"
    },
    {
      key: "fuzzy",
      title: "相关词条",
      desc: "适合别名、近义说法或记不全的时候看一眼。",
      cardClass: "fuzzy-card"
    },
    {
      key: "semantic",
      title: "你也许想看",
      desc: "根据意思和上下文给你补一些相关说法。",
      cardClass: "semantic-card"
    }
  ];

  const renderCard = (result, cardClass) => {
    const entry = result.entry;
    const aliases = (entry.aliases ?? []).slice(0, cardClass === "semantic-card" ? 3 : 6);
    const tags = (entry.tags ?? []).slice(0, cardClass === "semantic-card" ? 4 : 8);

    return `
      <article class="result-card ${cardClass}" data-entry-id="${entry.id}">
        <div class="result-top">
          <div>
            <div class="result-title">
              <h3>${applyHighlight(entry.term, query)}</h3>
              ${aliases.length ? `<span class="tag">别名：${aliases.join(" / ")}</span>` : ""}
            </div>
            <p class="taxonomy-line"><strong>分类：</strong>${entry.taxonomy.layer1.name} / ${entry.taxonomy.layer2.name} / ${entry.taxonomy.layer3.name}</p>
            <p class="definition"><strong>释义：</strong>${applyHighlight(entry.definition, query)}</p>
            ${cardClass !== "semantic-card" && entry.usage ? `<p class="usage"><strong>使用场景：</strong>${entry.usage}</p>` : ""}
            ${result.reason ? `<p class="reason"><strong>推荐理由：</strong>${result.reason}</p>` : ""}
          </div>
          <div class="score-box">
            <span class="meta-label">推荐度</span>
            <strong>${result.hybridScore.toFixed(3)}</strong>
            <div class="result-sources">
              ${result.sources.has("Fuse") ? `<span class="badge badge-fuse">直接命中</span>` : ""}
              ${result.sources.has("RAG") ? `<span class="badge badge-rag">相关联想</span>` : ""}
              <span class="badge badge-hybrid">优先推荐</span>
            </div>
          </div>
        </div>

        ${tags.length ? `<div class="tag-list">${tags.map((tag) => `<span class="tag">${tag}</span>`).join("")}</div>` : ""}
      </article>
    `;
  };

  dom.results.innerHTML = groupMeta
    .filter((group) => groups[group.key].length)
    .map(
      (group) => `
        <section class="result-group result-group-${group.key}">
          <div class="result-group-head">
            <div>
              <h3>${group.title}</h3>
              <p>${group.desc}</p>
            </div>
            <span class="group-count">${groups[group.key].length} 条</span>
          </div>
          <div class="group-results">
            ${groups[group.key].map((result) => renderCard(result, group.cardClass)).join("")}
          </div>
        </section>
      `
    )
    .join("");
}

async function search(query) {
  const trimmedQuery = String(query ?? "").trim();
  const limit = FIXED_RESULT_LIMIT;

  if (!trimmedQuery) {
    renderEmpty("输入一个黑话、别名，或者一句自然语言开始搜索。");
    dom.resultSummary.textContent = "支持黑话、别名和自然语言描述搜索。";
    return;
  }

  dom.resultSummary.textContent = `正在为你查找“${trimmedQuery}”...`;

  const [fuseResults, ragResults] = await Promise.all([
    Promise.resolve(runFuseSearch(trimmedQuery, limit)),
    runRagSearch(trimmedQuery, limit)
  ]);

  const merged = mergeResults(trimmedQuery, fuseResults, ragResults, limit);

  if (!merged.length || (merged[0]?.hybridScore ?? 0) < 0.3) {
    dom.resultSummary.textContent = "未查询到您想要的词汇，可以看看下方联想词";
  } else {
    dom.resultSummary.textContent = "为你整理了 6 个相关词，点开就能看详细解释。";
  }

  renderResults(trimmedQuery, merged);
  addRecentSearch(trimmedQuery);
  dom.recentDropdown?.removeAttribute("open");
}

async function loadData() {
  const [lexiconResponse, docsResponse, indexResponse] = await Promise.all([
    fetch("../acg_slang_lexicon.zh-CN.json"),
    fetch("../fuse-search/acg_slang_search_docs.json"),
    fetch("../fuse-search/acg_slang_fuse_index.json")
  ]);

  const lexiconPayload = await lexiconResponse.json();
  const docs = await docsResponse.json();
  const indexPayload = await indexResponse.json();
  initBrowserRag(lexiconPayload);
  const metaPayload = getLexiconMeta();

  state.docs = docs;
  state.meta = metaPayload.meta;
  state.taxonomyCatalog = metaPayload.taxonomy_catalog;
  state.entryMap = new Map(lexiconPayload.entries.map((entry) => [entry.id, entry]));

  const parsedIndex = Fuse.parseIndex(indexPayload.index);
  state.fuse = new Fuse(docs, FUSE_OPTIONS, parsedIndex);

  dom.entryCount.textContent = String(metaPayload.meta.entry_count);
  dom.lexiconVersion.textContent = metaPayload.meta.version;

  renderFeaturedEntry();
  renderHotTerms();
  loadRecentSearches();
  renderRecentSearches();
}

function bindEvents() {
  dom.form.addEventListener("submit", async (event) => {
    event.preventDefault();
    await search(dom.queryInput.value);
  });

  document.addEventListener("click", async (event) => {
    const queryTarget = event.target.closest("[data-query]");
    if (queryTarget) {
      dom.queryInput.value = queryTarget.dataset.query ?? "";
      await search(dom.queryInput.value);
      return;
    }

    const entryTarget = event.target.closest("[data-entry-id]");
    if (entryTarget) {
      openDetail(entryTarget.dataset.entryId);
      return;
    }

    const closeTarget = event.target.closest("[data-close-detail='true']");
    if (closeTarget) {
      closeDetail();
    }
  });

  dom.refreshHot.addEventListener("click", () => {
    renderHotTerms();
  });

  dom.clearHistory.addEventListener("click", () => {
    state.recentSearches = [];
    saveRecentSearches();
    renderRecentSearches();
    dom.recentDropdown?.setAttribute("open", "true");
  });

  dom.featuredAction.addEventListener("click", () => {
    if (state.featuredEntry) {
      openDetail(state.featuredEntry);
    }
  });

  dom.closeDetail.addEventListener("click", closeDetail);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeDetail();
    }
  });
}

async function main() {
  try {
    await loadData();
    bindEvents();
    renderEmpty("输入一个黑话、别名，或者一句自然语言开始搜索。");
  } catch (error) {
    console.error(error);
    renderEmpty(`页面初始化失败：${error.message}`);
  }
}

main();
