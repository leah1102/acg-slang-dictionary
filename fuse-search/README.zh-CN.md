# Fuse.js 搜索接入说明

这套文件基于当前的 `acg_slang_lexicon.zh-CN.json` 生成，目标是让你在前端直接接入：

- 模糊搜索
- 词条别名召回
- 分类筛选
- 预构建 Fuse 索引

## 文件说明

- `fuse-options.mjs`
  Fuse.js 的统一配置，定义了搜索字段和权重。
- `build-fuse-index.mjs`
  从词库 JSON 生成两个前端用文件：
  - `acg_slang_search_docs.json`
  - `acg_slang_fuse_index.json`
- `browser-search.mjs`
  浏览器端搜索模块，支持直接加载预构建索引并执行查询。
- `acg_slang_search_docs.json`
  预处理后的轻量搜索文档。
- `acg_slang_fuse_index.json`
  预构建的 Fuse 索引。

## 推荐搜索字段

当前配置会重点使用这些字段：

- `term`
- `aliases`
- `fuzzy_terms`
- `tags`
- `definition`
- `related`
- `search_text`
- `rag_context`

其中：

- `term` 和 `aliases` 权重最高，适合精确查词
- `fuzzy_terms` 适合处理简称、近义表达、圈内别称
- `search_text` 和 `rag_context` 更适合长句查询和弱语义召回

## 当前默认权重

```js
[
  { name: "term", weight: 8 },
  { name: "aliases", weight: 6 },
  { name: "fuzzy_terms", weight: 5 },
  { name: "tags", weight: 3 },
  { name: "definition", weight: 2 },
  { name: "related", weight: 2 },
  { name: "search_text", weight: 2 },
  { name: "rag_context", weight: 1 }
]
```

这套权重偏“词典搜索”，也就是优先命中词条本身、别名和圈内常见说法，而不是把长文本语义匹配放得太重。

## 构建索引

如果你的前端项目里已经安装了 `fuse.js`，可以直接运行：

```bash
node ./fuse-search/build-fuse-index.mjs
```

如果你还没安装：

```bash
npm install fuse.js
node ./fuse-search/build-fuse-index.mjs
```

## 前端直接使用

```js
import { createLexiconSearcher } from "./fuse-search/browser-search.mjs";

const searcher = await createLexiconSearcher({
  docsUrl: "/fuse-search/acg_slang_search_docs.json",
  indexUrl: "/fuse-search/acg_slang_fuse_index.json"
});

const results = searcher.search("发刀", {
  limit: 10
});

console.log(results);
```

## 分类筛选

支持直接按三级分类过滤：

```js
const results = searcher.search("抽卡", {
  limit: 20,
  layer1: "game_play",
  layer2: "gacha_system"
});
```

## 返回结果结构

`search()` 返回的是 Fuse 原始结果的增强版，额外加了：

- `adjustedScore`

这个分数做了两层处理：

- 对 `term` 完全命中和 `aliases` 完全命中的词条做加权提升
- 对 `search_rank` 高的词条做轻微前排提升

这样比纯 Fuse 默认排序更适合词典场景。

## 什么时候需要重建索引

以下情况建议重新跑一次 `build-fuse-index.mjs`：

- 词库新增词条
- 改了 `fuzzy_terms`
- 改了 `search_text`
- 改了 Fuse 权重配置

## 接前端时的建议

- 搜索框输入时做 `200ms ~ 300ms` 防抖
- 默认展示 `10 ~ 20` 条结果
- 空查询时按 `search_rank` 展示热门/核心词条
- 结果卡片里优先显示：`term`、`aliases`、`definition`、`taxonomy`
- 点进详情页再展示：`examples`、`related`、`rag_context`
