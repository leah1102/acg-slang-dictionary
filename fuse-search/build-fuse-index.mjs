import fs from "node:fs";
import path from "node:path";
import Fuse from "fuse.js";
import { fileURLToPath } from "node:url";
import { FUSE_INDEX_KEYS, FUSE_OPTIONS } from "./fuse-options.mjs";

const currentFile = fileURLToPath(import.meta.url);
const workspaceDir = path.resolve(path.dirname(currentFile), "..");
const lexiconPath = path.join(workspaceDir, "acg_slang_lexicon.zh-CN.json");
const indexPath = path.join(workspaceDir, "fuse-search", "acg_slang_fuse_index.json");
const docsPath = path.join(workspaceDir, "fuse-search", "acg_slang_search_docs.json");

function buildSearchDoc(entry) {
  return {
    id: entry.id,
    term: entry.term,
    aliases: entry.aliases ?? [],
    circle_tags: entry.circle_tags ?? [],
    ip_tags: entry.ip_tags ?? [],
    fuzzy_terms: entry.fuzzy_terms ?? [],
    tags: entry.tags ?? [],
    definition: entry.definition ?? "",
    related: entry.related ?? [],
    search_text: entry.search_text ?? "",
    rag_context: entry.rag_context ?? "",
    search_rank: entry.search_rank ?? 0,
    taxonomy: entry.taxonomy ?? null
  };
}

const lexicon = JSON.parse(fs.readFileSync(lexiconPath, "utf-8"));
const docs = lexicon.entries.map(buildSearchDoc);

const fuseIndex = Fuse.createIndex(FUSE_INDEX_KEYS, docs);
const serializedIndex = fuseIndex.toJSON();

fs.writeFileSync(docsPath, JSON.stringify(docs, null, 2) + "\n", "utf-8");
fs.writeFileSync(
  indexPath,
  JSON.stringify(
    {
      meta: {
        lexicon_version: lexicon.meta?.version ?? "unknown",
        generated_at: lexicon.meta?.generated_at ?? null,
        entry_count: docs.length,
        index_keys: FUSE_INDEX_KEYS,
        options: FUSE_OPTIONS
      },
      index: serializedIndex
    },
    null,
    2
  ) + "\n",
  "utf-8"
);

console.log(`已写入文档副本：${docsPath}`);
console.log(`已写入 Fuse 索引：${indexPath}`);
console.log(`索引条目数：${docs.length}`);
