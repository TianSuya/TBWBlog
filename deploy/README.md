# 部署指南：tianbowen.net

本站是 Astro 生成的静态网站。GitHub Actions 负责构建并通过 SSH/rsync 发布，
服务器只运行 Caddy，不运行 Node、CMS 或数据库。

## 架构

```text
本地或 /admin/ -> GitHub 仓库 -> GitHub Actions
                                      |
                                      | pnpm build + rsync
                                      v
                               /var/www/blog
                                      |
                                      v
                               Caddy + HTTPS
                                      |
                                      v
                              https://tianbowen.net
```

## 1. DNS

将以下 A 记录指向服务器公网 IP：

| 主机记录 | 用途 |
|---|---|
| `@` | 主站 `tianbowen.net` |
| `www` | 跳转到主站 |

验证：

```bash
dig +short tianbowen.net @1.1.1.1
dig +short www.tianbowen.net @1.1.1.1
```

## 2. 服务器初始化

以下命令以 root 或 sudo 用户执行：

```bash
apt update
apt install -y ufw curl git rsync

ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

adduser --disabled-password --gecos "" deploy
install -d -o deploy -g deploy /var/www/blog
install -d -o deploy -g deploy /opt/blog
install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
install -d /var/log/caddy
```

服务器只需开放 `22`、`80` 和 `443` 端口。

## 3. GitHub Actions 部署密钥

在可信环境生成一对专用密钥：

```bash
ssh-keygen -t ed25519 -f ~/.ssh/blog_deploy -N "" -C "github-actions-blog"
```

将公钥追加到服务器：

```bash
cat ~/.ssh/blog_deploy.pub
```

```bash
echo '<公钥内容>' >> /home/deploy/.ssh/authorized_keys
chown deploy:deploy /home/deploy/.ssh/authorized_keys
chmod 600 /home/deploy/.ssh/authorized_keys
```

验证：

```bash
ssh -i ~/.ssh/blog_deploy deploy@SERVER_IP 'echo OK'
```

在 GitHub 仓库的 `Settings -> Secrets and variables -> Actions` 中添加：

| Secret | 值 |
|---|---|
| `DEPLOY_SSH_KEY` | `~/.ssh/blog_deploy` 的完整私钥内容 |
| `DEPLOY_KNOWN_HOSTS` | `ssh-keyscan -t ed25519 SERVER_IP` 的输出 |
| `DEPLOY_TARGET` | `deploy@SERVER_IP:/var/www/blog/` |

`DEPLOY_TARGET` 结尾的 `/` 不能省略。

## 4. Caddy 与 HTTPS

安装 Caddy：

```bash
apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
  | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
  | tee /etc/apt/sources.list.d/caddy-stable.list
apt update
apt install -y caddy
```

安装仓库中的配置：

```bash
scp deploy/Caddyfile deploy@SERVER_IP:/opt/blog/Caddyfile
cp /opt/blog/Caddyfile /etc/caddy/Caddyfile
chown -R caddy:caddy /var/log/caddy
caddy validate --config /etc/caddy/Caddyfile
systemctl reload caddy
systemctl enable caddy
```

Caddy 会自动申请和续期 HTTPS 证书。

## 5. 首次发布

推送 `main` 分支会触发 `.github/workflows/deploy.yml`：

```bash
git push origin main
```

工作流依次执行依赖安装、静态构建、风格检查和 rsync 部署。

验收：

```bash
curl -I http://tianbowen.net
curl -I https://tianbowen.net
curl -I https://www.tianbowen.net
```

预期结果：HTTP 自动跳转 HTTPS，主站返回 `200`，`www` 跳转到主域名。

## 6. CMS

后台地址为 `https://tianbowen.net/admin/`。它是随静态网站发布的客户端应用，
通过 GitHub API 将内容提交到 `TianSuya/TBWBlog`，不需要服务器端 CMS 进程。

使用 GitHub Personal Access Token 登录时，私有仓库需要 `repo` 权限。发布内容后，
GitHub commit 会自动触发 Actions 并更新网站。

## 7. 日常维护

```bash
# Caddy 状态与日志
systemctl status caddy --no-pager
journalctl -u caddy -n 50 --no-pager
tail -f /var/log/caddy/blog.log

# 资源使用
free -h
df -h
```

修改 `deploy/Caddyfile` 后，重新上传、校验并 reload。修改网站源码或内容只需 push，
不要在服务器上手工改 `/var/www/blog`，下次 Actions 部署会覆盖它。

## 排错

**Actions 报 `Permission denied (publickey)`**

检查 `DEPLOY_SSH_KEY` 是否包含完整首尾行，并在本地验证部署密钥可登录。

**Actions 报 `Host key verification failed`**

重新生成 `ssh-keyscan -t ed25519 SERVER_IP` 并更新 `DEPLOY_KNOWN_HOSTS`。

**Actions 成功但全站 404**

检查 `DEPLOY_TARGET` 是否以 `/var/www/blog/` 结尾，文件不应进入额外的 `dist/` 子目录。

**HTTPS 证书申请失败**

确认 DNS 已指向服务器，并确认防火墙允许 `80/tcp` 与 `443/tcp`。

**CMS 发布后网站没有更新**

检查 GitHub 是否产生了 commit，以及 `Build and deploy` 工作流是否成功完成。
