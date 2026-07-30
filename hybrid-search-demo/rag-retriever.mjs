import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentFile = fileURLToPath(import.meta.url);
const workspaceDir = path.resolve(path.dirname(currentFile), "..");
const lexiconPath = path.join(workspaceDir, "acg_slang_lexicon.zh-CN.json");

const lexicon = JSON.parse(fs.readFileSync(lexiconPath, "utf-8"));
const entries = lexicon.entries;

function normalizeText(text) {
  return String(text ?? "")
    .toLowerCase()
    .replace(/[（）()【】[\]{}，。！？!?,.:;"'“”‘’]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueChars(text) {
  return [...new Set(normalizeText(text).replace(/\s+/g, "").split(""))].filter(Boolean);
}

function bigrams(text) {
  const compact = normalizeText(text).replace(/\s+/g, "");
  const grams = new Set();
  for (let i = 0; i < compact.length - 1; i += 1) {
    grams.add(compact.slice(i, i + 2));
  }
  return [...grams];
}

function overlapScore(a, b) {
  const setA = new Set(a);
  const setB = new Set(b);
  if (!setA.size || !setB.size) return 0;
  let hit = 0;
  for (const item of setA) {
    if (setB.has(item)) hit += 1;
  }
  return hit / Math.max(setA.size, setB.size);
}

function taxonomyMatch(entry, filters = {}) {
  const taxonomy = entry.taxonomy ?? {};
  if (filters.layer1 && taxonomy.layer1?.id !== filters.layer1) return false;
  if (filters.layer2 && taxonomy.layer2?.id !== filters.layer2) return false;
  if (filters.layer3 && taxonomy.layer3?.id !== filters.layer3) return false;
  return true;
}

function buildReason(query, entry, scoreParts) {
  const reasons = [];
  if (scoreParts.alias > 0.2) reasons.push("命中别名/近义表达");
  if (scoreParts.tags > 0.18) reasons.push("命中标签与分类");
  if (scoreParts.context > 0.14) reasons.push("和释义/上下文语义接近");
  if (scoreParts.related > 0.14) reasons.push("与相关词关联较强");
  if (!reasons.length) reasons.push(`根据“${query}”的局部语义相似度召回`);
  return reasons.join("，");
}

function scoreEntry(query, entry) {
  const queryChars = uniqueChars(query);
  const queryBigrams = bigrams(query);
  const queryText = normalizeText(query);

  const aliasText = (entry.aliases ?? []).join(" ");
  const tagsText = (entry.tags ?? []).join(" ");
  const relatedText = (entry.related ?? []).join(" ");
  const contextText = `${entry.definition ?? ""} ${entry.search_text ?? ""} ${entry.rag_context ?? ""}`;

  const aliasScore =
    overlapScore(queryChars, uniqueChars(`${entry.term} ${aliasText}`)) * 0.45 +
    overlapScore(queryBigrams, bigrams(`${entry.term} ${aliasText}`)) * 0.25;

  const tagsScore =
    overlapScore(queryChars, uniqueChars(tagsText)) * 0.24 +
    overlapScore(queryBigrams, bigrams(tagsText)) * 0.08;

  const relatedScore =
    overlapScore(queryChars, uniqueChars(relatedText)) * 0.1 +
    overlapScore(queryBigrams, bigrams(relatedText)) * 0.07;

  const contextScore =
    overlapScore(queryChars, uniqueChars(contextText)) * 0.28 +
    overlapScore(queryBigrams, bigrams(contextText)) * 0.18;

  let exactBoost = 0;
  if (normalizeText(entry.term) === queryText) exactBoost += 0.28;
  if ((entry.aliases ?? []).some((alias) => normalizeText(alias) === queryText)) exactBoost += 0.22;
  if ((entry.fuzzy_terms ?? []).some((term) => normalizeText(term) === queryText)) exactBoost += 0.12;

  const rankBoost = Math.min((entry.search_rank ?? 0) / 1000, 0.08);
  const total = Math.min(1, aliasScore + tagsScore + relatedScore + contextScore + exactBoost + rankBoost);

  return {
    total,
    reason: buildReason(query, entry, {
      alias: aliasScore,
      tags: tagsScore,
      related: relatedScore,
      context: contextScore
    })
  };
}

export function retrieveByVector({
  query,
  topK = 10,
  filters = {}
}) {
  const trimmedQuery = String(query ?? "").trim();
  if (!trimmedQuery) {
    return {
      retrievalMode: "local-pseudo-vector",
      totalCandidates: 0,
      items: []
    };
  }

  const scored = entries
    .filter((entry) => taxonomyMatch(entry, filters))
    .map((entry) => {
      const { total, reason } = scoreEntry(trimmedQuery, entry);
      return {
        id: entry.id,
        term: entry.term,
        score: Number(total.toFixed(4)),
        reason,
        source: "rag",
        taxonomy: entry.taxonomy,
        definition: entry.definition,
        aliases: entry.aliases ?? [],
        related: entry.related ?? []
      };
    })
    .filter((item) => item.score >= 0.08)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return {
    retrievalMode: "local-pseudo-vector",
    totalCandidates: scored.length,
    items: scored
  };
}

export function getLexiconMeta() {
  return {
    meta: lexicon.meta,
    taxonomy_catalog: lexicon.taxonomy_catalog
  };
}
