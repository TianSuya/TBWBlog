# 个人学术主页 + 博客

一个 90 年代学术主页风格的静态站，但功能是完备的：浏览器内所见即所得编辑、
LaTeX 公式、代码高亮、深色模式、全文搜索、RSS。站点外壳中英双语，
博客文章只用中文。

服务器上只跑 Caddy，**没有 CMS、Node 或数据库进程**。后台是一个纯客户端 SPA，
直接通过 GitHub API 读写仓库。

## 架构

```
        浏览器 https://<域名>/admin/
                 │ Sveltia CMS（纯静态 SPA，PAT 登录，零服务器组件）
                 ↓ GitHub API 直接 commit
        GitHub 仓库（源码 + Markdown + 图片）
                 ↓ push 触发
        GitHub Actions：pnpm build → Pagefind 索引 → rsync over SSH
                 ↓
        服务器 /var/www/blog  ←── Caddy ──→ <域名>
```

服务器只承担静态文件与 HTTPS 服务，常驻资源主要来自 Caddy。

## 快速开始

```bash
nvm use                    # Node 22（.nvmrc）
pnpm install
pnpm dev                   # http://localhost:4321
```

**日常写作只需要这一条命令。** 同一个 dev server 同时提供前台和后台：

| 地址 | 用途 |
|---|---|
| `http://localhost:4321/` | 前台，改动即时热更新 |
| `http://localhost:4321/admin/` | 后台编辑器（本地模式，无需 token） |

后台存盘 → 文件写入 `src/content/blog/` → dev server 热更新 → 前台立刻可见。

部署到服务器见 [deploy/README.md](deploy/README.md)，那里有逐条可复制的命令。

### 别在 4322 上验收改动

`astro preview` 的名字有误导性：它是个**纯静态文件服务器**，只把 `dist/` 端出来，
自己不做构建。dist 是上一次 `pnpm build` 的快照，所以在 4322 上你会看到冻结在
那一刻的旧内容，改多少次后台都不会变——而且不报错，是正常的 200。

要看构建产物（检查 Pagefind 搜索索引、`sitemap.xml`、真实的资源路径）就用：

```bash
pnpm serve                 # = pnpm build && astro preview，保证不看到陈旧快照
```

改 `slug` 时这个坑格外阴险：dist 里还留着旧 slug 生成的目录，老地址照常返回 200，
于是"内容没更新"看起来像 CMS 没存盘，实际是你停在一个早该消失的页面上。

线上不存在这个问题——GitHub Actions 收到 push 后会重新构建再 rsync。

## 目录结构

| 路径 | 用途 |
|---|---|
| `src/content/blog/` | 博客文章（Markdown）。CMS 写入这里 |
| `src/data/*.json` | 首页内容：个人信息、项目、论文。CMS 也能改 |
| `src/i18n/ui.ts` | 中英双语 UI 字典 |
| `src/styles/global.css` | **全部**视觉样式，约 330 行 |
| `src/styles/shiki-themes.mjs` | 手写的代码高亮主题（亮/暗各一套） |
| `public/admin/` | Sveltia CMS 后台 |
| `assets/originals/` | 头像等图片的**原图**，不参与部署 |
| `deploy/` | Caddyfile、docker-compose、服务器手册 |
| `scripts/` | 自检与冒烟测试 |

## 换头像

`public/` 下的文件不走 Astro 图片优化，会被**原样部署**。相机直出的照片动辄
几 MB，而头像只显示 140px，所以要先处理：

```bash
pnpm avatar assets/originals/me.jpg          # 生成 public/images/avatar.jpg
pnpm avatar path/to/photo.jpg --size 400     # 需要更大尺寸时
```

脚本用 sharp 的显著区域检测做方形裁切（横向照片直接中心裁会把人切一半），
输出 280×280（140px 显示位的 2 倍图）。原图放在 `assets/originals/`，
不在 `public/` 下，因此不会被部署。

> 当前这张：3776×2832 / 3.9 MB → 280×280 / 12 KB，小了 328 倍。

## 页面结构

- **首页**带 masthead（姓名 + 头衔 + 单位），并用姓名作为 `<h1>`
- **其他页面不显示 masthead**，直接以自己的标题开头，专注内容；
  回首页走侧栏的 Home 链接

## 后台管理

`/admin/` 是唯一的内容管理入口，覆盖情况由 `pnpm lint:cms` 强制校验：

| 内容 | 字段数 | 后台可改 |
|---|---|---|
| 博客文章 | 8 + Markdown 正文 | ✅ 所见即所得编辑器 |
| `profile.json`（姓名/头衔/简介/研究兴趣/链接） | 20 | ✅ 每项 en/zh 成对 |
| `projects.json`（在研项目） | 12 | ✅ 每项 en/zh 成对 |
| `publications.json`（论文） | 10 | ✅ |
| `src/i18n/ui.ts`（界面文案） | 56 条 | ❌ **改代码** |

界面文案（导航标签、区块标题、页脚签名档）刻意留在代码里：这些词几乎不会改，
放进后台只会把真正常用的内容埋掉，而且留在 TS 里能享受类型检查。

`pnpm lint:cms` 会比对 `public/admin/config.yml` 和 `src/data/*.json`，
以及 CMS 字段与 `src/content.config.ts` 的 Zod schema。两边漂移时的故障是隐蔽的
——网站照常渲染，但那个字段在后台里悄悄消失——所以把它变成构建失败。

### 编辑器形态

后台**关掉了预览面板**，正文固定为 **Markdown 源码模式**（等宽字体）：

- Sveltia 的预览面板用 `marked` 渲染，不认识 LaTeX，也没有 Shiki 高亮和本站排版
  ——它显示的东西和实际发布的不一致，误导性大于价值
- 正文用 `modes: [raw]` 锁定源码模式。`modes` 数组第一项是默认模式，
  且 Sveltia 只在配置了多个模式时才显示切换按钮，所以单值即可锁死
- 关掉预览后编辑器独占整个窗口宽度；Sveltia 对表单字段硬编码了
  `max-width: 768px` 且无配置项，因此在 `public/admin/index.html` 里用 CSS
  放宽到 1200px（选择器锚在 `aria-label="Content Editor"` 这个语义属性上，
  不依赖编译期的 `svelte-xxxxxxx` 哈希；万一 Sveltia 改名，字段只是退回 768px）

**公式和代码高亮请在本地确认**：`pnpm dev` 看渲染结果。长公式文章建议直接在
Typora / Obsidian / VS Code 里写好，丢进 `src/content/blog/`。

### 上线前先在本地试后台

不需要 GitHub 仓库、不需要 token：

```bash
pnpm dev
# 打开 http://localhost:4321/admin/
# 点「Work with Local Repository」，选中本仓库根目录
```

Sveltia 通过浏览器的文件系统 API 直接读写本地文件，改动立刻反映到 `src/` 下，
dev server 热更新可见。

## 写文章

推荐用后台：`https://<域名>/admin/`。也可以直接在 `src/content/blog/` 建 `.md` 文件：

```markdown
---
title: 文章标题
slug: url-slug-here          # 决定文件名和 URL，中文文章也用 ASCII
date: 2026-07-27
summary: 一句话摘要
tags: [标签1, 标签2]
draft: false
---

正文。支持 $E = mc^2$ 行内公式、$$\sum_i a_i$$ 独立公式，以及带高亮的代码块。
```

### 文章一律中文，站点外壳仍是双语

**文章没有 `lang` 字段**——博客只用中文写，不做逐篇翻译，也就不需要在两种语言之间
维护两份。首页简介、Publications、归档这些**结构化内容仍然是双语**，在
`src/data/*.json` 里按 `{ en, zh }` 成对存放。

一篇文章会同时出现在两套外壳下，是同一篇内容配不同语言的导航：

| URL | 导航语言 | 正文 |
|---|---|---|
| `/blog/<slug>/` | English | 中文 |
| `/zh/blog/<slug>/` | 中文 | 中文 |

两边都生成，是为了让侧栏的 `[English] | [中文]` 切换在文章页上也有落点——只生成一
边的话，切换链接会指向 404。

搜索索引**只建中文那一份**。同一篇文章索引两次会让它在 `en` 索引里以未分词的中文
形式存在，等于搜不到。Pagefind 找不到 `en` 索引时会自动回退到页数最多的索引，所以
英文 `/search` 照样能搜到全部文章。

`src/content.config.ts` 的 schema 和 `public/admin/config.yml` 的字段必须保持一致，
改一个就要改另一个，否则后台会写出构建不通过的文章。

## 验证

```bash
pnpm verify        # 类型检查 + 构建 + 风格自检 + 对比度检查
pnpm smoke         # 浏览器冒烟测试（需先构建并起一个本地服务器）
```

`pnpm smoke` 用本机已安装的 Chrome 驱动真实浏览器，覆盖只有跑起 JS 才存在的功能：
主题切换与持久化、Pagefind 中英文搜索、KaTeX 与 Shiki 渲染、
以及"首页零字体请求"这条硬约束。跑它之前需要一个本地服务器：

```bash
pnpm build
npx serve dist -p 8899      # 或用 Caddy，见 deploy/Caddyfile
pnpm smoke http://localhost:8899
```

## 设计约束

视觉风格不是随手写的 CSS，是一组会被 CI 强制执行的规则：

- 不覆盖浏览器默认样式：Times New Roman、`#0000EE` 蓝色下划线链接、
  `#551A8B` 已访问链接（现代站点普遍丢掉的细节）
- **禁止** `border-radius`、`box-shadow`、`text-shadow`、渐变、`transition`、
  `animation`、`backdrop-filter`、`@font-face`
- 全站零 web font。KaTeX 是唯一例外，且只在文章页加载——
  浏览器只在实际渲染到某字体的字形时才下载它，所以没有公式的文章不产生字体请求
- 深色模式做成 CRT 琥珀磷光（`#FFB000` on `#0A0A0A`），而不是现代的灰
- 正文版心固定 44em ≈ **74 字符/行**（衬线体舒适区是 60–80）。宽屏上多出来的
  空间给右侧导航栏，而不是把正文拉长——加宽到 56em 会变成 101 字符/行，
  全宽则是 157 字符/行，都超出可读上限

整块内容（正文 + 侧栏）在视口中**居中**。当年的页面是齐左的，但那时屏幕只有
800×600——在那个尺寸上齐左和居中是同一幅画面。在现代显示器上照搬齐左会让整块
内容贴到一边，所以这里遵循的是原意（固定的可读版心），而不是字面的写法。

布局在 62em 以下折叠成单栏：导航变回方括号内联样式，「最近文章」隐藏
（首页本来就有），语言/显示/订阅压成一行，让正文尽早出现。

`scripts/check-retro.sh` 会在 CI 里检查这些约束，`scripts/check-contrast.mjs`
验证全部 24 组配色达到 WCAG AA。

想换回现代风格：替换 `src/styles/global.css` 一个文件即可，结构层不用动。

## 已知取舍

- **发布延迟 30–60 秒**：点发布 → commit → Actions 构建 → rsync
- **GitHub PAT 默认 90 天过期**，到期需重新生成（或改用 OAuth，见 deploy/README.md）
- **CMS 上传的图片不走 Astro 图片优化**：`public/` 下的文件原图直出，建议上传前压缩
- **Sveltia CMS 仍处 beta**，1.0 前可能有破坏性变更；官方不支持多人协同编辑
