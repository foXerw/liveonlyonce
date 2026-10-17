# LiveOnlyOnce 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个可自部署的人生精彩瞬间展示应用（黑底蓝色、中英双语、文件即数据、单口令管理页），liveonlyonce.me 为其首个实例。

**Architecture:** Next.js（App Router，RSC）单体应用：`lib/content` 从磁盘内容目录（环境变量 `CONTENT_DIR`）解析每条瞬间的 `moment.yaml` + 图片，按数量/宽高比自动推断类型；前端首页为年份分组的人生时间线（类型自适应卡片），详情页按类型自动选择叙事版式；`/admin` 由单一口令（`ADMIN_KEY`）+ 签名 cookie 保护，可上传/编辑/删除瞬间；图片经 sharp 按需缩放并缓存。无数据库、无 Docker。

**Tech Stack:** Node ≥ 20、TypeScript（strict）、Next.js 15（App Router）、Tailwind CSS v4、Framer Motion、sharp、yaml、Vitest + Testing Library

**Spec:** `docs/superpowers/specs/2026-10-17-liveonlyonce-design.md`

## Global Constraints

- Node ≥ 20 LTS；TypeScript strict 模式
- 不使用 Docker；进程守护用 pm2
- 无数据库：内容 100% 存于 `CONTENT_DIR` 下的文件夹（图片 + `moment.yaml`），备份 = 拷贝目录
- 默认语言中文（`zh`），cookie `loo_locale` 记住切换；英文缺失时回退中文，反之亦然
- 图片允许扩展名：`jpg` `jpeg` `png` `webp`；单瞬间图片上限 60 张；单文件上限 25MB
- UI 禁止出现：已活天数/倒计时类数字、直白励志口号（宣言文案一律读 `site.config.yaml`，终稿由视觉会话与用户共同确定，代码层不写死）
- 个人内容不进代码仓库：仓库自带 `content-example/` 示例数据，真实部署用 `CONTENT_DIR` 指到仓库外
- 色板以 CSS 变量令牌定义（值待视觉会话确认，先用占位值，任务 10 统一替换）

## Review Focus

规格里隐含但单个任务的测试天然不会覆盖、最容易伤害真实使用者的输入，按可能性排序：

- 瞬间缺失某语言文案（只有中文标题没写英文）→ 页面回退显示另一语言，绝不出现空白 → 测试于 Task 2（`resolveText` 回退用例）
- 内容目录存在畸形文件夹（yaml 语法错、日期非法、混入非图片文件）→ 该条被跳过并 `console.warn`，整站不崩溃 → 测试于 Task 2（loader 容错用例）
- 恶意路径穿越（`../` 的 id/文件名）出现在上传文件名或 `/api/asset` 请求里 → 拒绝并保持内容目录完好 → 测试于 Task 4（asset 路由）与 Task 7（store 校验）
- 一条旅行瞬间有 30+ 张图 → 首页只取封面、详情页懒加载、缩放结果落盘复用，页面不因全量处理卡死 → 验证于 Task 4（缓存命中用例）与 Task 6（详情页懒加载步骤）
- 未登录直接访问 `/admin` 或 `/api/admin/*` → 重定向登录页 / 返回 401，绝不泄露内容操作能力 → 测试于 Task 7（middleware 用例）

---

### Task 1: 仓库脚手架与工具链

**Files:**
- Create: Next.js 应用根结构（`package.json`、`tsconfig.json`、`next.config.ts`、`app/layout.tsx`、`app/page.tsx` 占位、`globals.css`）
- Create: `vitest.config.ts`、`test/setup.ts`
- Create: `.gitignore`（含 `node_modules/`、`.next/`、`.cache/`、`content/`、`.superpowers/`、`*.local`）

**Interfaces:**
- Produces: 可运行的 `npm run dev` / `npm run build` / `npm test`（vitest）

- [ ] **Step 1:** 在 `D:\code\liveonlyonce` 执行 `git init`，将现有 `docs/` 首次提交（`chore: add spec and plan`）。远程 `https://github.com/foXerw/liveonlyonce.git` 在 Task 11 推送。
- [ ] **Step 2:** `npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir=false --use-npm`（保留已有 docs，冲突时以脚手架为准合并）。确认 `npm run build` 成功。
- [ ] **Step 3:** 安装 `vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom`，写 `vitest.config.ts`（environment: jsdom，include: `test/**/*.test.ts(x)`），一个示例通过用例 `test/smoke.test.ts`（`expect(1+1).toBe(2)`）。`npm test` 通过。
- [ ] **Step 4:** 安装 `yaml sharp framer-motion`。`npm run build && npm test` 均通过。
- [ ] **Step 5:** Commit `chore: scaffold next.js app with vitest`。

### Task 2: 内容模型与加载器（核心）

**Files:**
- Create: `lib/types.ts`、`lib/content/loader.ts`、`lib/content/parse.ts`、`scripts/make-fixtures.mjs`
- Create: `content-example/2025-08-15-qinghai-grand-loop/moment.yaml` + 3 张示例图（脚本生成的渐变 PNG）
- Test: `test/content/loader.test.ts`、`test/content/parse.test.ts`

**Interfaces:**
- Produces（后续所有任务依赖，签名精确）:
```ts
// lib/types.ts
export type Locale = 'zh' | 'en';
export type LocalizedText = Partial<Record<Locale, string>>;
export type MomentKind = 'album' | 'photo' | 'text';
export type AspectClass = 'wide' | 'square' | 'tall';
export interface MomentImage { file: string; width: number; height: number }
export interface Moment {
  id: string;            // 文件夹名，如 2025-08-15-qinghai-grand-loop
  date: string;          // ISO 'YYYY-MM-DD'
  pinned: boolean;
  title: LocalizedText; description: LocalizedText; location?: LocalizedText;
  images: MomentImage[]; // 按文件名排序
  kind: MomentKind;
  poster: MomentImage | null;
  posterAspect: AspectClass | null;
}
export interface YearGroup { year: number; moments: Moment[] }
// lib/content/loader.ts
export async function loadMoments(contentDir: string): Promise<Moment[]>
export function groupByYear(moments: Moment[]): YearGroup[]
export async function findMoment(contentDir: string, id: string): Promise<Moment | null>
// lib/content/parse.ts
export function inferKind(imageCount: number): MomentKind           // 0→text, 1→photo, ≥2→album
export function classifyAspect(w: number, h: number): AspectClass   // w/h≥1.4→wide; ≥0.8→square; 其余 tall
export function resolveText(t: LocalizedText, locale: Locale): string // t[locale] ?? 另一语言 ?? ''
export function parseMomentYaml(raw: string, folderName: string): Omit<Moment,'images'|'kind'|'poster'|'posterAspect'> // yaml 非法或 date/title 缺失 → throw
```
- `loadMoments` 规则：跳过 `parseMomentYaml` 抛错或含非法文件名的文件夹并 `console.warn`；日期相同按 id 字典序倒排；用 `sharp.metadata()` 读宽高，读不了的图片文件忽略之；结果带 15s TTL 内存缓存（`lib/content/cache.ts`，写操作调用 `clearContentCache()` 使其立即失效——Task 7 依赖）。

- [ ] **Step 1:** 写 `scripts/make-fixtures.mjs`：用 sharp 生成 `tests/fixtures/content/` —— 含：完整专辑瞬间（4 图）、单图瞬间、纯文本瞬间（无图）、缺英文标题的瞬间、坏 yaml 的瞬间、非法日期（`2025-13-99`）的瞬间各一个。运行一次验证目录生成。
- [ ] **Step 2:** 写失败测试 `test/content/parse.test.ts`：`inferKind(0|1|2)→'text'|'photo'|'album'`；`classifyAspect(2000,1000)→'wide'`、`(1000,1000)→'square'`、`(800,1600)→'tall'`；`resolveText({zh:'a'},'en')==='a'`；`resolveText({},'zh')===''`；`parseMomentYaml('date: 2025-13-99','x')` 抛错。
- [ ] **Step 3:** 实现 `lib/types.ts` + `lib/content/parse.ts`（含 `moment.yaml` 字段：`date,title:{zh,en},description:{zh,en},location?,pinned?`）。测试转绿。
- [ ] **Step 4:** 写失败测试 `test/content/loader.test.ts`（对 fixtures 目录）：`loadMoments` 返回 4 条（坏 yaml、坏日期被跳过）；按日期倒序；`groupByYear` 分组正确；含 4 图的瞬间 `kind==='album'` 且 `posterAspect` 非空；`findMoment(未知id)` 返回 `null`。
- [ ] **Step 5:** 实现 `lib/content/loader.ts` + `lib/content/cache.ts`。测试转绿，`npm test` 全绿。
- [ ] **Step 6:** 用 `make-fixtures.mjs` 同思路生成 `content-example/`（青甘环线 3 图 + 一条单图 + 一条纯文本，文案用占位英文）。提交示例数据（不含真实个人照片）。
- [ ] **Step 7:** Commit `feat: content model and file-based moment loader`。

### Task 3: 站点配置与双语系统

**Files:**
- Create: `site.config.yaml`、`lib/config/site.ts`、`messages/zh.json`、`messages/en.json`、`lib/i18n/server.ts`、`lib/i18n/client.tsx`
- Modify: `app/layout.tsx`
- Test: `test/config/site.test.ts`、`test/i18n/i18n.test.ts`

**Interfaces:**
- Produces:
```ts
// lib/config/site.ts
export interface SiteConfig { siteName: string; heroLine: LocalizedText; heroNote: LocalizedText; contactEmail: string; about: LocalizedText; footer: LocalizedText }
export function loadSiteConfig(path?: string): SiteConfig // 默认 'site.config.yaml'；缺文件回退内置占位值
export const siteConfig: SiteConfig // 模块级单例（server only）
// lib/i18n/server.ts
export const LOCALE_COOKIE = 'loo_locale';
export function getLocale(h: Headers): Locale // cookie → accept-language(zh*→zh else en) → 'zh'
export function t(key: string, locale: Locale): string // flat keys: 'nav.about','admin.title','timeline.year' 等，缺 key 返回 key 本身
// lib/i18n/client.tsx
export function LocaleToggle(): JSX.Element // client component：写 cookie + router.refresh()
```
- `site.config.yaml` 的 `heroLine`/`heroNote` 先填占位宣言（中文一句隐晦短句 + 直译英文），视觉会话定稿后仅改此文件。UI chrome 文案（按钮、admin、关于页标题）全部来自 `messages/*.json`。

- [ ] **Step 1:** 写失败测试：`getLocale(new Headers({cookie:'loo_locale=en'}))==='en'`；无 cookie 且 accept-language 为 `zh-CN` 时 `'zh'`；`t('nav.about','en')==='About'` 且 `t('nonexistent.key','zh')==='nonexistent.key'`；`loadSiteConfig()` 读到真实 `site.config.yaml` 的 `siteName`。
- [ ] **Step 2:** 实现上述模块与两个 messages 文件（chrome 文案 key 一次列全：导航、页脚、语言切换、详情页返回、灯箱关闭、admin 各字段标签）。测试转绿。
- [ ] **Step 3:** `app/layout.tsx` 挂 `<html lang={locale}>`（server 读 `headers()`），顶栏占位含 `LocaleToggle`。`npm run build` 通过。
- [ ] **Step 4:** Commit `feat: site config and bilingual i18n with locale cookie`。

### Task 4: 图片资产管线（sharp 缩放 + 缓存 + 防穿越）

**Files:**
- Create: `lib/media/url.ts`、`app/api/asset/[...path]/route.ts`、`lib/media/serve.ts`、`lib/media/loader.ts`
- Modify: `next.config.ts`（`images.loaderFile`）
- Test: `test/media/serve.test.ts`

**Interfaces:**
- Consumes: `CONTENT_DIR`（env，缺省 `./content`，Task 2 的目录结构）
- Produces:
```ts
// lib/media/url.ts
export function assetUrl(momentId: string, file: string, w: 640|1280|1920): string
// → `/api/asset/${momentId}/${encodeURIComponent(file)}?w=${w}`
// lib/media/serve.ts
export function resolveAssetPath(contentDir: string, momentId: string, file: string): string | null
// 用 path.resolve 后必须以 contentDir 为前缀、扩展名合法，否则 null
export async function getTransformed(srcAbs: string, w: number): Promise<{body: Buffer; contentType: string}>
// sharp resize(w, { withoutEnlargement }) → 缓存 .cache/media/<sha1(srcAbs+mtime+w)>.<ext>，命中直读
```
- `GET /api/asset/[...path]?w=`：路径非法或文件不存在 → 404；`w` 不在档位 → 400；成功 → 图片 + `Cache-Control: public, max-age=31536000, immutable`。

- [ ] **Step 1:** 写失败测试 `resolveAssetPath`：`('..%2f..%2fetc','passwd')` 类输入（以解码后的 `['../../etc','passwd']` 传入）返回 `null`；合法 id+file 返回绝对路径；`.exe` 扩展名返回 `null`。`getTransformed` 对 fixtures 图：两次调用第二次从缓存读（断言第二次不重新跑 sharp：给 `run` 加调用计数注入点）。
- [ ] **Step 2:** 实现 `lib/media/serve.ts` + 路由。`next/image` 走自定义 loader：`lib/media/loader.ts` 把 `src` 按 `?w=` 透传（src 本身就是 `assetUrl` 产物）。测试转绿。
- [ ] **Step 3:** 手动验证：dev 模式下 `/api/asset/2025-08-15-qinghai-grand-loop/xxx.jpg?w=640` 返回缩放图。
- [ ] **Step 4:** Commit `feat: on-demand sharp image pipeline with disk cache and traversal guard`。

### Task 5: 首页——Hero 与人生时间线

**Files:**
- Create: `app/page.tsx`（替换占位）、`components/hero/Hero.tsx`、`components/timeline/Timeline.tsx`、`components/timeline/YearMarker.tsx`、`components/timeline/MomentCard.tsx`、`components/timeline/cards/{AlbumCard,PosterCard,PhotoCard,QuoteCard}.tsx`、`lib/timeline/selectCard.ts`、`app/globals.css`（设计令牌）
- Test: `test/timeline/selectCard.test.ts`

**Interfaces:**
- Consumes: `loadMoments`、`groupByYear`、`resolveText`、`assetUrl`、`siteConfig`、`t`/`Locale`（Tasks 2–4）
- Produces: `selectCard(m: Moment): 'album'|'poster'|'photo'|'quote'`；`globals.css` 中令牌 `--color-ink`(黑底)、`--color-blue-deep/-bright/-ice/-glow`（占位色值，Task 10 替换）、`--font-serif-cn` 等字体族变量。

- [ ] **Step 1:** 写失败测试 `selectCard`：album 且封面 `wide|square`→`'album'`；album 且封面 `tall`→`'poster'`（竖版海报场景）；photo→`'photo'`；text→`'quote'`。
- [ ] **Step 2:** 实现 `lib/timeline/selectCard.ts`，测试转绿。
- [ ] **Step 3:** 实现首页（server component）：Hero（隐晦宣言两行：`heroLine` 大字 + `heroNote` 小字，黑底 + 蓝色微光渐变，无任何数字）；`groupByYear` → 中轴时间线；节点卡按 `selectCard` 分发；`pinned` 瞬间排在最顶（在 `loadMoments` 结果上稳定二次排序，Task 5 页面内做）。瞬间 ≤3 条时尾部追加"故事刚刚开始"式收束区（文案取自 messages，key：`timeline.storyStart`）。
- [ ] **Step 4:** 视觉冒烟：dev 打开首页（示例内容），确认四类卡各自渲染、时间线随年份分组、语言切换文案变化。此步截图留存，作为视觉会话比对基线。
- [ ] **Step 5:** `npm run build` 通过；Commit `feat: home timeline with type-adaptive cards and hero`。

### Task 6: 详情页——三种自动叙事

**Files:**
- Create: `app/moments/[id]/page.tsx`、`components/detail/{AlbumStory,FeatureMoment,TextEssay}.tsx`、`components/MomentLightbox.tsx`、`lib/detail/layoutFor.ts`
- Test: `test/detail/layoutFor.test.ts`

**Interfaces:**
- Consumes: `findMoment`、`assetUrl`、`resolveText`
- Produces: `layoutFor(m: Moment): 'story'|'feature'|'essay'`（album→story, photo→feature, text→essay）；photo 型瞬间在首页点击直接开灯箱，不导航（由 MomentCard 按 `kind==='photo'` 处理，Task 5 组件加 props）。

- [ ] **Step 1:** 写失败测试 `layoutFor` 三断言。转绿。
- [ ] **Step 2:** `app/moments/[id]/page.tsx`：`findMoment` 找不到 → `notFound()`；否则按 `layoutFor` 渲染。
- [ ] **Step 3:** `AlbumStory`：Framer Motion 滚动叙事（`useScroll`+`useTransform` 大图视差/浮现，感想段落穿插图间；`loading="lazy"`，30+ 图不首屏全量）。`FeatureMoment`：大特写单图 + 标题/感想版式。`TextEssay`：窄栏衬线正文，首行大字。`MomentLightbox`：全屏图 + 键盘左右/ESC。
- [ ] **Step 4:** 视觉冒烟三类详情页各开一次；构建通过。Commit `feat: adaptive detail narratives (scroll story, feature, essay) and lightbox`。

### Task 7: Admin 后端——口令、会话与内容写入

**Files:**
- Create: `lib/admin/auth.ts`、`lib/admin/store.ts`、`middleware.ts`、`app/api/admin/login/route.ts`、`app/api/admin/logout/route.ts`、`app/api/admin/moments/route.ts`、`app/api/admin/moments/[id]/route.ts`
- Test: `test/admin/auth.test.ts`、`test/admin/store.test.ts`

**Interfaces:**
- Consumes: `clearContentCache()`（Task 2 cache）、`parseMomentYaml` 的字段约定（写同一 schema）
- Produces:
```ts
// lib/admin/auth.ts
export const SESSION_COOKIE = 'loo_admin'; export const SESSION_TTL_S = 12*3600;
export function checkPasscode(input: string): boolean // timingSafeEqual vs process.env.ADMIN_KEY；未设 env → false 且路由层 500 提示
export function signSession(secret: string): string   // `${exp}.${hmacSha256(secret, exp)}`，secret = sha256(ADMIN_KEY)
export function verifySession(token?: string): boolean
// lib/admin/store.ts
export const ALLOWED_EXT=['jpg','jpeg','png','webp']; export const MAX_IMAGES=60; export const MAX_IMAGE_BYTES=25*1024*1024;
export function sanitizeFolderName(date: string, titleZh: string): string // 'YYYY-MM-DD-拼音/ascii-slug'，非法字符剔除，冲突加 -2
export async function createMoment(contentDir: string, input: MomentInput, files: {name:string;bytes:Buffer}[]): Promise<Moment>
export async function updateMoment(contentDir, id, input, files?): Promise<void>
export async function deleteMoment(contentDir, id): Promise<void>
export function validateUpload(f: {name:string;bytes:Buffer}): void // 扩展名/大小/文件名含路径分隔符 → throw
// MomentInput = { date: string; title: LocalizedText; description: LocalizedText; pinned: boolean; location?: LocalizedText }
```
- API 约定：`POST /api/admin/login {passcode}` → 设 cookie 200 / 401；`POST /api/admin/moments`（multipart：字段 + files）→ 201；`PATCH/DELETE /api/admin/moments/[id]`；`GET /api/admin/moments`（列表，含未发布校验错误信息）。全部经 `middleware.ts`：`/admin/*` 与 `/api/admin/*`（login 除外）无有效 cookie → 页面 302 `/admin/login`，API 401。写成功后调用 `clearContentCache()`。

- [ ] **Step 1:** 写失败测试 auth：正确/错误口令；篡改/过期 token 校验为 false；`checkPasscode` 对空输入不抛错。
- [ ] **Step 2:** 实现 `auth.ts`，转绿。
- [ ] **Step 3:** 写失败测试 store：`sanitizeFolderName('2026-10-17','新工作')` 得到合法 `2026-10-17-` 前缀 slug；`validateUpload` 拒绝 `.exe`、26MB、`name:'../evil.jpg'`；`createMoment` 在临时目录写出 `moment.yaml`+图片且能被 `loadMoments` 读回（集成断言）；`deleteMoment` 移走整个文件夹。
- [ ] **Step 4:** 实现 `store.ts`、`middleware.ts`、四个 API 路由，测试转绿。
- [ ] **Step 5:** `curl` 冒烟：无 cookie GET `/api/admin/moments` → 401；登录错误口令 → 401；正确口令 → 200 + Set-Cookie。Commit `feat: passcode-gated admin API and content store writer`。

### Task 8: Admin 前端——登录与管理页

**Files:**
- Create: `app/admin/login/page.tsx`、`app/admin/page.tsx`、`components/admin/{PasscodeForm,MomentForm,MomentList,ImageDropzone}.tsx`
- Test: `test/admin/form.test.tsx`（MomentForm 提交 payload 组装）

**Interfaces:**
- Consumes: Task 7 API、`t()` 文案、`siteConfig`
- Produces: 可用浏览器完成"新建瞬间（日期、中英标题描述、多图上传、置顶）→ 首页立即可见"全流程；编辑/删除既有瞬间。

- [ ] **Step 1:** 登录页：口令输入 + 错误提示（401 后显示）。不做防暴力验证码（YAGNI，口令 + 反代层限流足够，README 提示）。
- [ ] **Step 2:** 写失败组件测试：`MomentForm` 提交时组装 multipart 含 `date/title[zh]/...` 字段与 files，且中英标题都为空时阻止提交并显示校验信息。
- [ ] **Step 3:** 实现 `MomentForm`（复用校验信息文案 key `admin.*`）、`ImageDropzone`（预览缩略、超 60 张/超 25MB 前端预检报 `admin.tooManyImages`/`admin.tooLarge`）、`MomentList`（日期倒序、编辑/删除按钮带确认）。转绿。
- [ ] **Step 4:** 浏览器全流程冒烟：登录 → 建一条 2 图瞬间 → 首页出现 → 编辑 → 删除 → 首页消失。Commit `feat: admin login, moment list and create/edit form with image upload`。

### Task 9: 关于页、页脚与分享元数据

**Files:**
- Create: `app/about/page.tsx`、`components/SiteFooter.tsx`、`lib/seo.ts`
- Modify: `app/layout.tsx`（metadata）、`app/moments/[id]/page.tsx`（per-page metadata）

**Interfaces:**
- Consumes: `siteConfig.about/contactEmail`、`assetUrl`
- Produces: `buildPageMetadata({title, description, imageFile?, momentId?}): Metadata`（og:title/description、og:image 指向该瞬间首图、twitter:card）

- [ ] **Step 1:** 实现关于页（一两句"这个站是什么"+ `heroLine` 呼应 + 邮箱链接）与页脚（siteName、关于链接、邮箱）。顶栏加导航（首页/关于/极小的 admin 链接不出现——admin 入口不公开摆放）。
- [ ] **Step 2:** `lib/seo.ts` + 首页与详情页 metadata。构建后 `curl` 详情页 head 含 og:image URL。
- [ ] **Step 3:** Commit `feat: about page, footer and share metadata`。

### Task 10: 设计打磨——色板、字体与动效（依赖视觉会话）

**前置:** 视觉会话产出并经用户确认：蓝色色卡终值、宣言终稿文案、时间线/详情页样式反馈。**未确认前本任务不开始。**

**Files:**
- Modify: `app/globals.css`（令牌实值）、`tailwind` 主题、字体加载（`next/font`：西文一款，中文走系统栈/思源 web font）、各组件动效参数、`site.config.yaml`（宣言终稿）

- [ ] **Step 1:** 按确认色卡替换 `--color-blue-*` 占位值；校验 WCAG AA 对比度（正文/底 ≥ 4.5:1，大号标题 ≥ 3:1，用脚本或手测记录）。
- [ ] **Step 2:** 按视觉稿逐屏比对首页/三类详情页/关于/admin，修排版与动效节奏（进场动画统一时长与缓动令牌 `--dur-*`/`--ease-*`）。
- [ ] **Step 3:** `npm run build` + 全量测试通过；截图存 `docs/design-baseline/`。Commit `style: final palette, typography and motion polish`。

### Task 11: 部署与文档

**Files:**
- Create: `ecosystem.config.cjs`、`scripts/init-content.mjs`、`README.md`、`README.zh.md`、`docs/DEPLOY.md`
- Modify: `package.json`（`postinstall` 可选、`npm run init:content`）

**Interfaces:**
- Consumes: 全部
- Produces: 他人可照文档 10 分钟内完成部署

- [ ] **Step 1:** `scripts/init-content.mjs`：`CONTENT_DIR` 不存在或为空时从 `content-example/` 拷贝。README 覆盖：环境变量表（`CONTENT_DIR`、`ADMIN_KEY`、`NODE_ENV`、`PORT`）、开发步骤、pm2 启动（`pm2 start ecosystem.config.cjs`）、systemd 服务示例、nginx 反代 + 静态缓存/上传大小 `client_max_body_size 60m` 示例、HTTPS 建议（certbot）、内容文件夹格式说明（给不走 admin 的极客）。双语 README。
- [ ] **Step 2:** 生产自检：`npm run build && npm start`（PORT=3001），curl 首页/详情页/asset/admin 401 各一条，记录输出。
- [ ] **Step 3:** `git remote add origin https://github.com/foXerw/liveonlyonce.git && git push -u origin main`；确认 `content/`（真实内容）未被提交。Commit `docs: deployment guide and example content bootstrap`。
