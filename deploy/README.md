# 部署指南：让 https://tianbowen.net 跑起来

目标：本地的站点 → GitHub 仓库 → 服务器 → 公网域名访问。

**主线是第 1–7 步**，做完站点就能通过 https://tianbowen.net 打开。
统计、访客计数器、浏览器后台都是上线之后的事，放在文档后半部分。

预计 40–60 分钟，其中一半在等 DNS 生效和等证书签发。

---

## 现状

域名 **tianbowen.net** 已经写进配置，这几项**不用再做**：

| 文件 | 状态 |
|---|---|
| `astro.config.mjs` → `SITE` | ✅ `https://tianbowen.net` |
| `deploy/Caddyfile` | ✅ 主站 / www 跳转 / stats 三个块 |
| `public/images/avatar.jpg` | ✅ 280×280，12KB |

还没做的：

| 事项 | 影响 |
|---|---|
| `public/admin/config.yml` 的 `repo` | 现在填的是 `ScholarlyLab/TBWBlog`（推断值）。**仓库名不同必须改**，否则后台无法提交 |
| `src/data/*.json` 里的个人信息 | 站点会原样显示 `you@example.com`、`github.com/CHANGEME` 等示例数据 |
| `assets/originals/me.jpg`（3.7MB） | 未决定是否进仓库。提交后永久留在 Git 历史里 |

## 需要准备

| 东西 | 说明 |
|---|---|
| 服务器 | Ubuntu 22.04/24.04，2G 内存起，有 root 或 sudo |
| GitHub 账号 | 仓库公开私有都行 |
| tianbowen.net 的 DNS 管理权 | 要加 3 条 A 记录 |
| 本地 | Node 22（`nvm use`）、pnpm、git、ssh |

服务器上**不装 Node，不装 pnpm**。构建全部在 GitHub Actions 里完成，
服务器只接收构建好的静态文件——这是它能在 2G 机器上跑的原因。

## 两个变量

本地和服务器的终端**各设置一次**，换终端要重设：

```bash
export SERVER=1.2.3.4              # 服务器公网 IP
export GH=TianSuya/TBWBlog     # 你的 GitHub 仓库，格式 用户名/仓库名
```

## 为什么是这个顺序

```
1 DNS（最慢，先起跑）
2 服务器加固 ──→ 3 部署用户+目录 ──┐
4 本地收尾 ──→ 5 建 GitHub 仓库 ──→ 6 密钥+Secrets ←──┘
                                        ↓
                                 7 push → Actions 构建并推送到服务器
                                        ↓
                                 8 装 Caddy → https://tianbowen.net 上线 ✅
```

第 6 步同时需要服务器（第 3 步）和 GitHub 仓库（第 5 步）都已存在。
先把 Secrets 配好再 push，第一次 Actions 就能一次跑通，不会红一次。

---

# 主线：上线

## 1. DNS 解析

三条 A 记录，全部指向服务器 IP：

| 主机记录 | 类型 | 值 | 用途 |
|---|---|---|---|
| `@` | A | `$SERVER` | 主站 tianbowen.net |
| `www` | A | `$SERVER` | 跳转到主站 |
| `stats` | A | `$SERVER` | 统计后台（现在不装也先加上，省得回头再等生效） |

**先做这一步。** 生效要几分钟到几小时，而第 8 步的 HTTPS 证书依赖它：
Let's Encrypt 会来访问 `http://tianbowen.net/.well-known/…`，解析没生效就签不下来。

验证（能看到你的 IP 才算好）：

```bash
dig +short tianbowen.net @1.1.1.1
dig +short www.tianbowen.net @1.1.1.1
dig +short stats.tianbowen.net @1.1.1.1
```

---

## 2. 服务器：基础加固

```bash
ssh root@$SERVER
```

以下在服务器上执行：

```bash
apt update && apt upgrade -y
apt install -y ufw curl jq git rsync

ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
ufw status
```

**只开 22/80/443。** 尤其 **3000 端口不要开**——以后装的 Umami 只监听
`127.0.0.1:3000`，对外一律经 Caddy 的 HTTPS。开放 3000 等于把统计后台
用明文 HTTP 挂在公网上。

---

## 3. 服务器：部署用户与目录

仍以 root 身份：

```bash
adduser --disabled-password --gecos "" deploy

# 站点根目录：GitHub Actions rsync 的目标
install -d -o deploy -g deploy /var/www/blog

# 访客计数器目录：故意放在 rsync 目标之外
install -d -o deploy -g deploy /var/www/counter

# 服务器端脚本与配置
install -d -o deploy -g deploy /opt/blog

# Caddy 日志目录（Caddy 还没装，先建，装完改属主）
install -d /var/log/caddy

# deploy 用户的 SSH 目录
install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
```

> `/var/www/counter` 必须在 `/var/www/blog` **之外**。
> Actions 用的是 `rsync --delete`，counter.json 放进站点目录的话每次部署都会被删掉。

---

## 4. 本地收尾

### 4.1 确认 GitHub 仓库名

`public/admin/config.yml` 第 13 行现在是推断值 `ScholarlyLab/TBWBlog`。
仓库名不一样的话改掉，否则浏览器后台点 Publish 会 404：

```bash
sed -i '' "s|repo: .*|repo: $GH|" public/admin/config.yml
grep -n "repo:" public/admin/config.yml
```

> Linux 上把 `sed -i ''` 换成 `sed -i`。

### 4.2 换掉示例数据

这些会**原样显示在站点上**：

```bash
grep -rn 'CHANGEME\|example\.com' src/data/*.json
```

| 文件 | 要改的 |
|---|---|
| `src/data/profile.json` | 邮箱、Scholar / GitHub / arXiv 链接（姓名头衔简介也顺手核对） |
| `src/data/projects.json` | 在研项目，不想要就把数组清成 `[]` |
| `src/data/publications.json` | 论文列表，同上 |

嫌手改 JSON 麻烦，可以 `pnpm dev` 后打开 `http://localhost:4321/admin/`，
点「Work with Local Repository」在后台里可视化地填，字段更清楚还带校验。

### 4.3 决定 me.jpg 去留

`assets/originals/me.jpg` 是 3.7MB 的原图，部署时用不到，但一旦提交就永久留在
Git 历史里（之后删文件也清不掉体积）。建议排除：

```bash
echo "assets/originals/" >> .gitignore
```

换机器时手动带一份原图即可。想留在仓库里也行，只是 clone 慢一点。

### 4.4 本地验证

```bash
nvm use
pnpm install
pnpm verify        # 类型检查 + 构建 + 复古风格自检 + 对比度检查
```

**必须全绿再往下走。** 这一步失败，GitHub Actions 会用同样的检查卡住部署。

---

## 5. 创建 GitHub 仓库

在 github.com 新建仓库，名字与 `$GH` 一致。
**不要勾选初始化 README / .gitignore / license**——本地已有完整内容，加了会 push 冲突。

公开私有都行。私有仓库 Actions 每月 2000 分钟免费，这个站每次构建约 1 分钟。

**先不要 push**，等第 6 步配好 Secrets。

---

## 6. 部署密钥与 GitHub Secrets

这一步是让 GitHub Actions 有权限往你的服务器写文件。

### 6.1 本地生成一对专用密钥

```bash
ssh-keygen -t ed25519 -f ~/.ssh/blog_deploy -N "" -C "github-actions-blog"
```

**用新密钥，不要复用日常登录那把。** 私钥要交给 GitHub，
万一泄露，影响范围应当只限于这台机器的 deploy 用户。

### 6.2 把公钥装到服务器

deploy 用户没设密码，`ssh-copy-id` 会失败，所以在 root 会话里手工写入：

```bash
# 本地：打印公钥
cat ~/.ssh/blog_deploy.pub
```

```bash
# 服务器（root）：粘贴上面的输出
echo '<粘贴公钥>' >> /home/deploy/.ssh/authorized_keys
chown deploy:deploy /home/deploy/.ssh/authorized_keys
chmod 600 /home/deploy/.ssh/authorized_keys
```

验证免密登录：

```bash
ssh -i ~/.ssh/blog_deploy deploy@$SERVER 'echo OK && ls -ld /var/www/blog'
```

必须直接打印 `OK`。还问密码的话，Actions 一定会失败。

### 6.3 填进 GitHub

仓库 → **Settings → Secrets and variables → Actions → Secrets** 标签页，
点 `New repository secret` 建三条：

| Name | 值 |
|---|---|
| `DEPLOY_SSH_KEY` | `cat ~/.ssh/blog_deploy` 的**完整内容**，含首尾 `-----BEGIN/END-----` 行 |
| `DEPLOY_KNOWN_HOSTS` | `ssh-keyscan -t ed25519 $SERVER` 的输出（整行） |
| `DEPLOY_TARGET` | `deploy@1.2.3.4:/var/www/blog/` ← **结尾的斜杠不能少** |

方便复制：

```bash
cat ~/.ssh/blog_deploy
ssh-keyscan -t ed25519 $SERVER
echo "deploy@$SERVER:/var/www/blog/"
```

> `DEPLOY_KNOWN_HOSTS` 的作用是让 Actions 确认连的是你的服务器而不是被换掉的另一台。
>
> `DEPLOY_TARGET` 末尾漏斜杠，rsync 会把 `dist` 目录本身复制进去，变成
> `/var/www/blog/dist/`——**结果是全站 404 而 Actions 显示绿灯**，这个组合最难查。

**Variables 标签页先留空**，那是统计用的，第 10 步再说。

---

## 7. 推送：内容上服务器

```bash
git add -A
git commit -m "Initial commit: academic homepage and blog"
git branch -M main
git remote add origin git@github.com:$GH.git      # 或 https://github.com/$GH.git
git push -u origin main
```

到仓库 **Actions** 标签页看这次运行：
`pnpm install` → `pnpm build`（含 Pagefind 索引）→ 复古风格自检 → rsync over SSH，
约 1–2 分钟。

绿灯后确认文件落地：

```bash
ssh deploy@$SERVER 'ls /var/www/blog && echo --- && ls /var/www/blog/pagefind | head -3'
```

应看到 `index.html`、`blog/`、`zh/`、`assets/`、`pagefind/`、`admin/`。
此时文件已在服务器上，只差一个 Web 服务器把它端出去。

> **已经用 zip 传过一次的话**这一步仍然要做。zip 只是把静态文件搬上去，
> 而 GitHub 才是源码的家：不推上去，源码就只有本地这一份，浏览器后台也用不了。

---

## 8. Caddy：站点上线

### 8.1 把服务器配置传上去

**在本地执行**：

```bash
scp -r deploy/* deploy@$SERVER:/opt/blog/
```

传的是已经写好 tianbowen.net 的 Caddyfile，以及后面要用的 docker-compose.yml
和 update-counter.sh。本地没有 `deploy/.env`，不会误传密钥。

> GitHub Actions 只同步 `dist/`，不碰 `/opt/blog`。
> 以后改了 `deploy/` 下的文件，要重跑这条 scp。

### 8.2 装 Caddy

服务器，root 身份：

```bash
apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
  | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
  | tee /etc/apt/sources.list.d/caddy-stable.list
apt update && apt install -y caddy
chown -R caddy:caddy /var/log/caddy
```

### 8.3 应用配置

```bash
cp /opt/blog/Caddyfile /etc/caddy/Caddyfile
chmod +x /opt/blog/update-counter.sh
caddy validate --config /etc/caddy/Caddyfile      # 先校验语法
systemctl reload caddy
systemctl status caddy --no-pager
```

Caddy 自动向 Let's Encrypt 申请证书，10–60 秒。盯日志：

```bash
journalctl -u caddy -f
```

看到 `certificate obtained successfully` 就成了，**Ctrl-C 退出**。

> `stats.tianbowen.net` 这个块现在会反代到一个还没启动的 Umami，
> 访问它会 502——正常，不影响主站。装完 Umami 就好了。

### 8.4 验收

```bash
for p in / /zh/ /blog/ /zh/blog/ /publications /zh/publications \
         /archive /zh/archive /sitemap /zh/sitemap /search /zh/search \
         /blog/attention-sinks/ /zh/blog/attention-sinks/ \
         /rss.xml /sitemap-index.xml; do
  printf '%-32s %s\n' "$p" "$(curl -s -o /dev/null -w '%{http_code}' https://tianbowen.net$p)"
done
```

全部应为 `200`。再确认：

```bash
curl -I http://tianbowen.net           # 308 → https
curl -I https://www.tianbowen.net      # 301 → 主站
```

浏览器打开 https://tianbowen.net 检查：

- [ ] 证书有效（地址栏没有警告）
- [ ] 亮/暗模式切换正常，刷新不闪烁
- [ ] 侧栏 `[English] | [中文]` 切换正常，文章页也能切
- [ ] `/search` 和 `/zh/search` 都能搜到文章
- [ ] 文章页 LaTeX 公式和代码高亮渲染正确
- [ ] 页脚计数器不显示（还没配，静默隐藏是设计好的降级行为）

**到这里主线就完成了，站点已经在公网上。**

---

## 之后：日常发文章

改完内容 push 就行，30–60 秒后线上更新：

```bash
git add -A && git commit -m "..." && git push
```

也可以本地 `pnpm dev` 写，在 `http://localhost:4321/` 实时看效果，满意了再 push。

**不要用 `astro preview`（4322 端口）验收改动**——它是纯静态文件服务器，
只把上次构建的 `dist/` 端出来，改多少次都不会变，而且返回正常的 200。
要看构建产物用 `pnpm serve`。

想在浏览器里写、不碰命令行的话，装完可选部分的第 11 步。

---

# 可选：统计、计数器、浏览器后台

主线跑通后再做，任何一项都不影响站点正常访问。

## 9. Umami 统计

### 9.1 装 Docker

服务器，root：

```bash
curl -fsSL https://get.docker.com | sh
usermod -aG docker deploy
```

### 9.2 生成密钥

**必须退出重连**，`usermod` 加的组才生效：

```bash
exit
ssh deploy@$SERVER
cd /opt/blog

cp umami.env.example .env
chmod 600 .env
sed -i "s|CHANGEME_SECRET|$(openssl rand -base64 32)|"       .env
sed -i "s|CHANGEME_DBPASS|$(openssl rand -base64 24)|"       .env
sed -i "s|CHANGEME_COUNTER_PASS|$(openssl rand -base64 18)|" .env

grep UMAMI_PASSWORD .env     # 记下，9.4 步建用户要用
```

> 这个 `.env` 只存在于服务器的 `/opt/blog/.env`，永远不要提交。

### 9.3 启动

```bash
docker compose up -d
docker compose ps            # 等两个容器变 healthy，约 1 分钟
```

首次启动要建表，慢一点正常。卡住看 `docker compose logs -f umami`。

### 9.4 初始化

浏览器打开 https://stats.tianbowen.net ，默认账号 **admin / umami**。

1. **立刻改掉 admin 密码**（Settings → Profile）——这个后台在公网上。
2. Settings → Websites → **Add website**：Domain 填 `tianbowen.net`。
3. 点进去 → Edit，复制 **Website ID**（一串 UUID）。
4. Settings → Users → **Add user**：用户名 `counter`，密码用 9.2 生成的那个，
   角色选 **View only**。

> 单独建只读用户，是为了让计数器脚本即使被读到也拿不到管理权限。

### 9.5 回填 Website ID

```bash
cd /opt/blog
sed -i "s|CHANGEME_WEBSITE_ID|<粘贴 UUID>|" .env
grep UMAMI_WEBSITE_ID .env
```

## 10. 让站点发送统计数据

统计脚本的地址和 ID 是**构建期**变量，所以要回 GitHub 填。

仓库 → Settings → Secrets and variables → Actions → **Variables** 标签页
（不是 Secrets——这两个值本来就会出现在页面 HTML 里）：

| Name | 值 |
|---|---|
| `PUBLIC_UMAMI_SRC` | `https://stats.tianbowen.net/script.js` |
| `PUBLIC_UMAMI_ID` | 9.4 步的 Website ID |

然后 Actions → 最近一次运行 → **Re-run all jobs**。

```bash
curl -s https://tianbowen.net/ | grep -o 'stats\.[^"]*script\.js'
```

浏览器访问几个页面，Umami 的 Realtime 应出现记录。
**测试时关掉广告拦截插件**——uBlock 之类会拦掉 `script.js`，看起来像没配好。

## 11. 访客计数器

```bash
/opt/blog/update-counter.sh          # 手动跑一次
cat /var/www/counter/counter.json    # 应输出 {"pageviews":N,...}
```

跑通后挂 cron：

```bash
crontab -e
# 加一行：
*/5 * * * * /opt/blog/update-counter.sh >> /var/log/counter.log 2>&1
```

验证：`curl -s https://tianbowen.net/api/counter.json`

再跑一次部署，确认 `rsync --delete` 没把它删掉。

## 12. 浏览器后台

github.com → Settings → Developer settings → **Personal access tokens (classic)**
→ Generate new token：

- Note：`sveltia-cms`
- Expiration：90 天
- Scopes：勾 **`repo`**（私有仓库必需；公开仓库勾 `public_repo` 即可）

复制 token，**页面关掉就再也看不到**。

打开 https://tianbowen.net/admin/ ，选 GitHub 登录，粘贴 token。

发一篇测试文章 → Publish → GitHub 出现 commit → Actions 绿灯 → 30–60 秒后线上可见。

> 后台能工作的前提是第 4.1 步的 `repo` 填对了。
> Token 90 天过期，重新生成即可；嫌烦可换 OAuth 登录
> （部署一个免费的 `sveltia/sveltia-cms-auth` Cloudflare Worker，约 5 分钟）。

---

# 维护

## 更新服务器配置

改了 `deploy/` 下的文件后：

```bash
scp -r deploy/* deploy@$SERVER:/opt/blog/
ssh deploy@$SERVER 'sudo cp /opt/blog/Caddyfile /etc/caddy/Caddyfile && sudo systemctl reload caddy'
```

## 常用命令

```bash
# Caddy
systemctl status caddy
journalctl -u caddy -n 50 --no-pager
tail -f /var/log/caddy/blog.log

# Umami
cd /opt/blog && docker compose ps
docker compose logs -f umami
docker compose pull && docker compose up -d      # 升级

# 计数器
tail -20 /var/log/counter.log

# 系统
free -m && df -h
```

## 备份

只有两样需要备份：

```bash
# 1. Umami 数据库
cd /opt/blog
docker compose exec -T db pg_dump -U umami umami | gzip > ~/umami-$(date +%F).sql.gz

# 2. /opt/blog/.env —— 里面是无法再生的密钥
```

站点内容在 GitHub 上，不需要额外备份。服务器整个炸掉，重跑这份指南 + 恢复上面两样就回来了。

---

# 排错

**Actions 里 rsync 报 `Permission denied (publickey)`**
公钥没装对，或 `DEPLOY_SSH_KEY` 少了首尾的 `-----BEGIN/END-----` 行。
先在本地验证 `ssh -i ~/.ssh/blog_deploy deploy@$SERVER` 免密能进。

**Actions 里 `Host key verification failed`**
`DEPLOY_KNOWN_HOSTS` 没填或填错。重跑 `ssh-keyscan -t ed25519 $SERVER`，整行粘贴。

**全站 404，但 Actions 是绿的**
`DEPLOY_TARGET` 结尾漏了斜杠，文件进了 `/var/www/blog/dist/`。
`ssh deploy@$SERVER 'ls /var/www/blog'` 一看便知。

**证书签不下来**
DNS 还没生效，或 80 端口没开。
`dig +short tianbowen.net` 确认解析，`ufw status` 确认 80/tcp 是 ALLOW。
Let's Encrypt 有速率限制，同一域名连续失败要等一会儿再试。

**push 时报 `failed to push some refs`**
建仓库时勾了初始化 README。`git pull --rebase origin main` 后再 push。

**`stats.tianbowen.net` 返回 502**
Umami 没启动。只做了主线的话这是预期的，不影响主站。

**`/api/counter.json` 返回 404**
`/var/www/counter/counter.json` 不存在——手动跑一次 `update-counter.sh` 看报错。

**后台点 Publish 没反应**
`config.yml` 里的 `repo` 填错，或 token 过期。浏览器控制台会有 401/404。

**改了文章但线上没变**
Actions 还在跑（30–60 秒），或构建失败了——去 Actions 页面看有没有红灯。
本地看不到变化则多半是在 4322 端口上看的，见「日常发文章」那节。

---

# 架构备忘

```
本地 pnpm dev ─┐
               ├─→ GitHub 仓库 ──push──→ Actions
浏览器 /admin/ ┘   （源码的家）           │ pnpm build + pagefind
                                          ↓ rsync over SSH
                                   /var/www/blog
                                          ↑
   tianbowen.net ────────── Caddy ───────┘
   stats.tianbowen.net ──→ 127.0.0.1:3000 (Umami, Docker)
   /api/counter.json ────→ /var/www/counter/ ←── cron 每 5 分钟
```

服务器上跑的：Caddy（~20MB）、Umami（~150MB）、PostgreSQL（~150MB）。
**没有 CMS 进程，没有 Node，没有数据库存文章**——文章就是 Git 仓库里的 Markdown 文件。
