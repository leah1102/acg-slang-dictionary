import Fuse from "fuse.js";
import { DEFAULT_SEARCH_LIMIT, FUSE_OPTIONS } from "./fuse-options.mjs";

function normalizeText(value) {
  return String(value ?? "").trim().toLowerCase();
}

function exactMatchBoost(query, item) {
  const q = normalizeText(query);
  if (!q) return 0;

  if (normalizeText(item.term) === q) return 0.18;
  if ((item.aliases ?? []).some((alias) => normalizeText(alias) === q)) return 0.12;
  if ((item.fuzzy_terms ?? []).some((term) => normalizeText(term) === q)) return 0.08;
  if (normalizeText(item.term).startsWith(q)) return 0.05;

  return 0;
}

function taxonomyMatch(entry, filters = {}) {
  const taxonomy = entry.taxonomy ?? {};

  if (filters.layer1 && taxonomy.layer1?.id !== filters.layer1) return false;
  if (filters.layer2 && taxonomy.layer2?.id !== filters.layer2) return false;
  if (filters.layer3 && taxonomy.layer3?.id !== filters.layer3) return false;

  return true;
}

function rerank(query, results) {
  return results
    .map((result) => {
      const baseScore = typeof result.score === "number" ? result.score : 1;
      const rankBonus = Math.min((result.item.search_rank ?? 0) / 1000, 0.12);
      const exactBonus = exactMatchBoost(query, result.item);
      const adjustedScore = Math.max(0, baseScore - exactBonus - rankBonus);

      return {
        ...result,
        adjustedScore
      };
    })
    .sort((a, b) => {
      if (a.adjustedScore !== b.adjustedScore) return a.adjustedScore - b.adjustedScore;
      return (b.item.search_rank ?? 0) - (a.item.search_rank ?? 0);
    });
}

export async function createLexiconSearcher({
  docsUrl = "/fuse-search/acg_slang_search_docs.json",
  indexUrl = "/fuse-search/acg_slang_fuse_index.json"
} = {}) {
  const [docsResponse, indexResponse] = await Promise.all([fetch(docsUrl), fetch(indexUrl)]);
  const docsPayload = await docsResponse.json();
  const indexPayload = await indexResponse.json();

  const parsedIndex = Fuse.parseIndex(indexPayload.index);
  const fuse = new Fuse(docsPayload, FUSE_OPTIONS, parsedIndex);

  return {
    docs: docsPayload,
    meta: indexPayload.meta,
    search(query, options = {}) {
      const {
        limit = DEFAULT_SEARCH_LIMIT,
        layer1,
        layer2,
        layer3
      } = options;

      const trimmedQuery = String(query ?? "").trim();
      const filters = { layer1, layer2, layer3 };

      if (!trimmedQuery) {
        return docsPayload
          .filter((entry) => taxonomyMatch(entry, filters))
          .sort((a, b) => (b.search_rank ?? 0) - (a.search_rank ?? 0))
          .slice(0, limit)
          .map((item) => ({
            item,
            score: 1,
            adjustedScore: 1,
            matches: []
          }));
      }

      const rawResults = fuse.search(trimmedQuery, { limit: Math.max(limit * 3, 50) });
      const filtered = rawResults.filter((result) => taxonomyMatch(result.item, filters));
      return rerank(trimmedQuery, filtered).slice(0, limit);
    }
  };
}
