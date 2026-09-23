# 最小可运行前端页面

这个目录是一个不依赖前端框架的最小示例，用来把当前的 500 条词库、`Fuse.js` 模糊搜索和“本地 RAG 召回”接起来。

当前版本已经改成 `无分层检索`：

- 不要求用户先选一级/二级/三级分类
- 默认直接搜全库
- 词条分类只在结果卡片中展示，帮助理解词语来源和语境

## 目录结构

- `index.html`
  搜索页面
- `styles.css`
  基础搜索界面样式
- `app.js`
  浏览器端逻辑
- `server.mjs`
  本地静态服务 + RAG 接口
- `rag-retriever.mjs`
  本地 RAG 召回适配层

## 运行方式

在这个目录里启动：

```bash
node ./hybrid-search-demo/server.mjs
```

默认地址：

```bash
http://localhost:4173
```

## 现在的搜索架构

当前页面用了两路召回：

1. `Fuse.js`
   浏览器端直接加载预构建索引，对这些字段做模糊匹配：
   - `term`
   - `aliases`
   - `fuzzy_terms`
   - `tags`
   - `search_text`
   - `definition`
   - `related`
   - `rag_context`

2. `本地 RAG 召回接口`
   页面会请求：

```http
POST /api/rag/retrieve
Content-Type: application/json
```

请求体：

```json
{
  "query": "先甜后虐",
  "topK": 12
}
```

返回体：

```json
{
  "retrievalMode": "local-pseudo-vector",
  "totalCandidates": 12,
  "items": [
    {
      "id": "acg_0047",
      "term": "糖刀",
      "score": 0.73,
      "reason": "和释义/上下文语义接近",
      "source": "rag",
      "taxonomy": { "...": "..." },
      "definition": "..."
    }
  ]
}
```

## 为什么叫“本地 RAG 接口设计”

这里我把 RAG 召回做成了一个独立接口层，前端只关心：

- 发什么请求
- 收什么结果
- 怎么和 Fuse 结果合并

目前 `rag-retriever.mjs` 内部为了保持最小可运行，用的是“本地相似度召回”占位实现：

- 字符重叠
- 二元片段重叠
- 标签、相关词、上下文加权

这能先把页面跑起来，并且保留真实向量检索的接口形态。

## 后面怎么替换成真正的向量检索

你后续如果做本地 embedding / 向量库，只需要替换 `rag-retriever.mjs` 里的：

```js
retrieveByVector({ query, topK, filters })
```

推荐替换成下面任一方案：

- 本地 embedding + JSON 向量文件
- SQLite + sqlite-vec
- LanceDB / Chroma / Qdrant 本地实例
- WebAssembly 向量检索

前端 `app.js` 不用改接口协议，只需要继续请求 `/api/rag/retrieve`。

## 当前综合排序

综合结果会把两路结果合并：

```txt
HybridScore = FuseNormalized * 0.62 + RagScore * 0.33 + SearchRankBoost
```

排序思路偏“词典场景”：

- 词条名精确命中优先
- 别名与 `fuzzy_terms` 命中优先
- 自然语言问法可被 RAG 拉回
- `search_rank` 只做轻微修正，不压过真实命中

## 为什么去掉分层检索

三级分类更适合后台管理、数据治理和高级筛选，不适合放在词典首页当第一层交互。

现在的做法是：

- 首页统一搜索，降低上手门槛
- 搜索结果中继续展示分类
- 后续如果你要加“高级筛选”，可以折叠进高级面板，而不是放在主搜索路径上

## 页面适合后续怎么扩

下一步最适合继续加的是：

- 结果高亮匹配片段
- 词条详情抽屉
- 搜索历史
- 热门词条/随机词条
- 真正的 embedding 向量召回
- `Fuse + 向量` 的可调权重面板
