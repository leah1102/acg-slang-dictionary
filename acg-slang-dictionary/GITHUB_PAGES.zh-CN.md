# GitHub Pages 上线说明

这个项目已经整理成适合 **GitHub Pages 长期免费托管** 的静态站点版本。

## 已经准备好的内容

- 根目录入口页：`index.html`
- 实际词典页面：`hybrid-search-demo/`
- 词库文件：`acg_slang_lexicon.zh-CN.json`
- 搜索索引：`fuse-search/`
- 关闭 Jekyll 干扰：`.nojekyll`

## 你要做的事

### 1. 新建 GitHub 仓库

建议仓库名用英文，例如：

```txt
acg-slang-dictionary
```

### 2. 把当前项目上传到仓库

如果你本地已经初始化过 Git，可以在项目根目录执行：

```bash
git init
git branch -M main
git add .
git commit -m "feat: prepare github pages deployment"
git remote add origin 你的仓库地址
git push -u origin main
```

### 3. 打开 GitHub Pages

进入仓库：

`Settings` → `Pages`

然后：

- `Source` 选择 `Deploy from a branch`
- `Branch` 选择 `main`
- 文件夹选择 `/ (root)`

### 4. 等待 Pages 生效

保存后等待一会儿，GitHub Pages 会自动从 `main` 分支根目录发布静态站点。

### 5. 拿到公开链接

部署完成后，链接通常会是：

```txt
https://你的用户名.github.io/你的仓库名/
```

例如：

```txt
https://yourname.github.io/acg-slang-dictionary/
```

访问根地址后，会自动跳转到词典页面。

## 后续更新方式

以后只要改完词库或前端，再执行：

```bash
git add .
git commit -m "chore: update lexicon and ui"
git push
```

GitHub Pages 会自动更新站点内容。

## 适合 GitHub Pages 的原因

这个项目现在已经是纯静态结构：

- 不依赖服务器数据库
- 不依赖 Node API 才能搜索
- `Fuse` 检索和本地 RAG 都在浏览器运行
- 所有数据文件都可以直接静态托管

所以非常适合长期免费放在 GitHub Pages。

## 注意

- GitHub Pages 的公开链接只有在仓库推送并部署成功后才会生成
- 如果仓库是私有仓库，Pages 的可用性取决于你的 GitHub 方案
- 如果你后面想换自定义域名，也可以在 Pages 设置里继续绑定
