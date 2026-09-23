# 二次元黑话词典部署说明

当前项目已经改成**静态可部署版本**：

- 不再依赖本地 `Node` 服务提供 `/api/meta` 和 `/api/rag/retrieve`
- `Fuse` 检索继续使用预构建索引
- `RAG` 召回改成浏览器本地运行
- 把整个项目目录上传到静态托管平台即可访问

## 推荐部署方式

当前最推荐的是 **GitHub Pages**，因为：

- 长期免费
- 适合静态词典项目
- 你后续更新词库只需要 `git push`
- 不需要额外服务器

GitHub Pages 专用说明见：

- `GITHUB_PAGES.zh-CN.md`

## GitHub Pages

1. 新建 GitHub 仓库
2. 把当前项目完整推到 `main`
3. 进入仓库 `Settings -> Pages`
4. `Source` 选择 `Deploy from a branch`
5. 分支选 `main`，目录选 `/ (root)`
6. 等待 GitHub Pages 生效

公开地址通常会是：

```txt
https://你的用户名.github.io/你的仓库名/
```

## 其他可选方案

### Vercel

1. 新建项目
2. 导入当前文件夹
3. Framework Preset 选择 `Other`
4. Root Directory 选择项目根目录
5. 不需要 Build Command
6. 不需要 Output Directory
7. 直接部署

部署后访问根地址，会自动跳转到：

```txt
/hybrid-search-demo/
```

### Netlify

1. 新建站点
2. 选择当前项目文件夹
3. Build command 留空
4. Publish directory 留空或设为项目根目录
5. 直接部署

## 公开部署依赖的文件

- `index.html`
- `acg_slang_lexicon.zh-CN.json`
- `fuse-search/`
- `hybrid-search-demo/`
- `.nojekyll`

## 当前页面入口

- 根目录入口：`/`
- 实际词典页面：`/hybrid-search-demo/`

## 本地预览

如果只是本地打开，继续用当前本地服务即可：

```bash
node hybrid-search-demo/server.mjs
```

打开：

```bash
http://localhost:4173
```

## 说明

因为现在 `RAG` 已经改成浏览器本地运行，静态托管后也能正常搜索，不需要后端接口。
