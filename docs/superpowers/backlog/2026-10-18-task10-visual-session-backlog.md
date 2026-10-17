# Task 10 视觉会话待办清单（设计打磨门禁）

生成于 2026-10-18，SDD 执行完 Task 1–9、11 之后。Task 10 被裁决 R4 门禁：**蓝色色卡终选、宣言终稿文案、布局/动效确认**需与站长在浏览器视觉会话中共同完成后才可执行。本清单随仓库持久化（.superpowers/ 工作区是临时的）。

## 一、视觉会话必须产出的决定

1. **蓝色色卡终值**：替换 `app/globals.css` `@theme` 中的占位令牌 `--color-ink`、`--color-blue-deep/-bright/-ice/-glow`（当前为 tasteful 占位深海军蓝→冰蓝）。全部 UI 蓝色均引用令牌，零硬编码 hex（最终评审已验证），换色只动这一个文件。
2. **宣言终稿**：✅ 已定（2026-10-18 站长亲选）——heroLine「有几天发了光 / A few days that glowed」+ heroNote「都收在这儿了 / All kept here」，site.config.yaml 与 lib/config/site.ts 内置回退值均已同步。剩余待确认：页脚"只活一次，记下来。"的祈使语气（Task 3 缓议项）。
3. **动效过目**：滚动驱动动画目前是双向 scrub（往回滚卡片淡出、再进入重播）——确认是否喜欢，或改回一次性入场。
4. **对比度重验**：现有 AA 达标是按占位色板算的；终选色板必须重跑对比度校验（正文 ≥4.5:1，大号 ≥3:1）。

## 二、已囤积的视觉/结构打磨项（缓议 Minor，按收益排序）

- 三个图卡（Album/Photo/Poster）约 90% 外壳重复 → 抽共享 image-card shell，重绘时一处改全站生效
- 精选区标题层级 h1→h3 跳级 → 加视觉隐藏 h2 或降级卡题
- LocaleToggle 无当前语言态显示；layout 用 `[&_button]` 耦合其内部 → 一并重整
- 编辑模式已有图块 alt 与文件名文本重复播报 → 镜像 MomentList 的 `alt=""` 做法
- `placeholder:text-blue-ice/40` 死规则（低于 /55 AA 乘数）→ 提到 /55 或删除
- focus-visible 未显式 outline-color（全局规则已部分兜底）→ 统一为 blue-bright
- AlbumStory 感想只出现一次，非真"穿插图间" → 结合 description 分段（splitParagraphs 已有实现可复用）
- 灯箱：滚动条宽度补偿、背景 inert、方向键 repeat 守卫
- 多图灯箱 prev/next 生产不可达 → 考虑给 AlbumStory 图版接灯箱
- README 首屏截图（当前为 HTML 注释占位）→ 终稿设计定型后补真图
- LICENSE 持有人 "LiveOnlyOnce contributors" → 站长可改为署名

## 三、快速跟进（非视觉）

- **I1/R13**：加载器全库串行扫描（每张图 sharp.metadata 逐个读）——数百瞬间规模会出现多秒停顿；方案：有界并发 + 按文件夹 mtime 缓存 + createMoment 读回只加载新文件夹。DEPLOY §10 已有排障行。
- **Next 17 升级前**：`middleware.ts` 须改名 `proxy.ts`（Next 16 已打弃用警告，README 已记录）。
- Task 10 若需要动效库：framer-motion 已在最终修复波移除（零引用死依赖，R14），用时重新安装。
- 200MB 传输上限 vs 60×25MB 存储上限的组合：单次请求总量 >200MB 会以损坏表单 400 失败（文档已框定；分次上传即可）。

## 四、执行记录入口

完整 SDD 台账（11 项裁决 R1–R17、全部评审/修复轮记录）在 `.superpowers/sdd/2026-10-17-liveonlyonce/progress.md`（gitignored，本地保留至 Task 10 完成）。
