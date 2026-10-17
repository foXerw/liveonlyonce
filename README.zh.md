# LiveOnlyOnce 只活一次

> 只活一次，记下来。

一个可以自由自托管的**人生瞬间**小站。那些只发生一次、再也不会重来的
事情：某次通勤路上的晨雾、搬离一座城市前的最后一个夜晚。每个瞬间就是
一个带日期的文件夹——几张照片加一小段双语说明；首页把它们铺成一条安静
的时间线，供你慢慢回看。

没有数据库，没有账号体系，内容不在构建时烧死：你写下的一切都存成普通
文件，集中在一个文件夹里，站点运行时直接读它。克隆下来，指向你自己的
内容，瞬间就归你了。

<!-- 这里放首页时间线截图，等设计打磨阶段补上。 -->


## 特性

- **文件即内容** —— 一个瞬间就是 `<YYYY-MM-DD-slug>/` 文件夹（图片 +
  `moment.yaml`）；拷走这个文件夹，就带走了全部记忆。
- **双语（中文/English）** —— 每条文案都带两种语言，读者可即时切换；
  没有机器翻译。
- **口令后台** —— 在 `/admin` 上传、编辑、置顶瞬间；口令就是环境变量
  `ADMIN_KEY`。没有多用户体系。
- **按需图片处理** —— 每个请求经 [sharp](https://sharp.pixelplumbing.com/)
  实时缩放优化并落盘缓存；不需要 CDN 或构建管线。
- **适合分享** —— 每页自带 Open Graph / Twitter 元数据，`og:image`
  用该瞬间的首图。

## 快速开始

```bash
git clone https://github.com/foXerw/liveonlyonce.git
cd liveonlyonce
npm ci

# 创建 ./content 并拷入自带示例
npm run init:content

ADMIN_KEY="你的长随机口令" npm run dev
```

（Windows PowerShell 写法：`$env:ADMIN_KEY="你的长随机口令"; npm run dev`。）

打开 <http://localhost:3000>。后台在 `/admin`（故意外不公开链接，知道
地址即可进入）。Linux 服务器上的生产部署——pm2/systemd、nginx、HTTPS、
备份——请看 **[docs/DEPLOY.md](docs/DEPLOY.md)**。后台登录没有内置限流，
请在反向代理上对 `/api/admin/login` 限速（nginx `limit_req` 配置见
docs/DEPLOY.md 第 6 节）。

## 配置：环境变量

| 变量          | 必填       | 默认值              | 作用                                                                                                                     |
| ------------- | ---------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `CONTENT_DIR` | 否         | `./content`（相对 cwd） | 内容目录位置。生产环境建议用**绝对路径**；用后台上传时需对进程可写。                                                       |
| `ADMIN_KEY`   | 后台必填   | *（未设置）*        | 管理口令，同时用于签发后台会话。未设置时后台一律拒绝访问（`/api/admin/login` 返回 `500 "ADMIN_KEY not configured"`）。     |
| `SITE_URL`    | 否         | *（未设置）*        | 站点公网地址（如 `https://liveonlyonce.me`），用于生成绝对 `og:image` 与元数据链接；格式错误会打警告并忽略。                |
| `NODE_ENV`    | 否         | 由 npm 脚本设置     | `next start` 用 `production`；npm 脚本已代管。                                                                            |
| `PORT`        | 否         | `3000`              | `next start` 监听端口。                                                                                                   |

## 添加内容——两条路随你选

发布瞬间有两条完全等价的通路，产出的文件一模一样，混用无妨。

### 通路一：后台界面

用 `ADMIN_KEY` 登录 `/admin`，表单里填标题、描述、地点（都可双语），
上传图片（jpg / jpeg / png / webp，最多 60 张、单张 ≤25 MB）。服务器
替你写好文件夹，时间线立刻更新。

### 通路二：直接操作文件夹（命令行党）

一个瞬间就是 `CONTENT_DIR` 下的一个目录：

```
content/
└── 2026-04-06-city-harvest/
    ├── 01-rooftop.png      # 文件名按字母序即展示顺序
    ├── 02-market.jpg       # jpg / jpeg / png / webp 会被收集
    └── moment.yaml         # 全部元数据在这里
```

`moment.yaml` 完整示例：

```yaml
date: 2026-04-06 # YYYY-MM-DD，决定时间线顺序
title:
  zh: 城市收获日
  en: City Harvest Day
description:
  zh: 一张照片也能讲一个下午。
  en: A single photo can carry a whole afternoon.
location: # 可选
  zh: 家附近
  en: Close to home
pinned: true # 可选，默认 false——最新的置顶瞬间会展示在
             # 时间线上方的精选位（时间线内仍保留）
```

注意：文件夹名必须匹配 `YYYY-MM-DD-小写slug`（正则
`^\d{4}-\d{2}-\d{2}-[a-z0-9][a-z0-9-]*$`），不合法或被解析拒绝的文件夹
会被跳过并打服务端日志；首张图（字母序第一）作为封面与卡片图；列表缓存
15 秒，新拷入的文件夹最多 15 秒后自动出现，无需重启。
`npm run init:content` 做的就是把 [content-example/](content-example)
原样拷进 `CONTENT_DIR`——这些示例也是现成的模板。图片带 **一年期
immutable 缓存**（`Cache-Control: public, max-age=31536000, immutable`）：
要换图请使用**新文件名**——就地覆盖同名文件的字节，浏览器/CDN 可能最长
一年仍在展示旧图。

## 个性化

- **[site.config.yaml](site.config.yaml)** —— 站名、首页标语/副句、
  关于页、页脚、联系邮箱；仅 `heroLine`、`heroNote`、`about`、`footer`
  四个字段支持 `zh`/`en` 一对，`siteName` 与 `contactEmail` 只接受纯
  字符串（写成双语映射会静默回退内置占位值）。文件缺失或字段不全时
  同样自动回退占位文案。
- **[app/globals.css](app/globals.css)** —— `@theme` 块集中了配色变量
  （`--color-ink`、`--color-blue-*` 等）与字体；换肤改这里。
- **[messages/zh.json](messages/zh.json) / [messages/en.json](messages/en.json)** ——
  界面字符串目录（导航、按钮、后台标签）。

## 开发

```bash
npm run dev     # 开发服务器 :3000（Turbopack）
npm test        # vitest 测试
npm run lint    # eslint
npm run build   # 生产构建
npm start       # 运行生产构建
```

已知小坑：

- **开发时改 `messages/*.json` 可能不立刻生效** —— Turbopack 会缓存
  导入的 JSON，重启 dev server 即可。
- **Next 16 会打出 `middleware` → `proxy` 弃用警告** —— 升级到 Next 17
  之前，把 `middleware.ts` 改名为 `proxy.ts`（导出内容不变）。

## 备份与恢复

站点的全部状态就是 `CONTENT_DIR` 文件夹——拷走它（`rsync -a`、压缩打包
皆可）就是完整备份。`.cache/media` 只是可再生的图片缓存，放心删，无需
备份。

## 许可证

[MIT](LICENSE)

---

English documentation: [README.md](README.md)。
