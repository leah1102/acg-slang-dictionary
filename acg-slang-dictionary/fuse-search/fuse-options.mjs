export const FUSE_INDEX_KEYS = [
  "term",
  "aliases",
  "circle_tags",
  "ip_tags",
  "fuzzy_terms",
  "tags",
  "search_text",
  "definition",
  "related",
  "rag_context"
];

export const FUSE_OPTIONS = {
  includeScore: true,
  includeMatches: true,
  shouldSort: true,
  ignoreDiacritics: true,
  ignoreLocation: true,
  findAllMatches: true,
  threshold: 0.32,
  distance: 120,
  minMatchCharLength: 1,
  fieldNormWeight: 0.2,
  keys: [
    { name: "term", weight: 8 },
    { name: "aliases", weight: 6 },
    { name: "circle_tags", weight: 5 },
    { name: "ip_tags", weight: 5 },
    { name: "fuzzy_terms", weight: 5 },
    { name: "tags", weight: 4 },
    { name: "definition", weight: 2 },
    { name: "related", weight: 2 },
    { name: "search_text", weight: 2 },
    { name: "rag_context", weight: 1 }
  ]
};

export const DEFAULT_SEARCH_LIMIT = 20;

export function createFuseSearchPlan() {
  return {
    dataSource: "acg_slang_lexicon.zh-CN.json",
    indexSource: "acg_slang_fuse_index.json",
    listPath: "entries",
    options: FUSE_OPTIONS,
    searchKeys: FUSE_INDEX_KEYS,
    sortStrategy: [
      "1. Fuse score 越低越好",
      "2. 完全命中 `term` 的结果优先",
      "3. 命中 `aliases` / `fuzzy_terms` 的结果优先",
      "4. 若分数接近，则按 `search_rank` 倒序"
    ]
  };
}
