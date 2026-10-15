# Codex 执行指令集：奖项标准改造

配套诊断见 [奖项标准审视](2026-10-15-award-standard-audit.md)。本文件是可直接粘贴给 Codex 的指令。

## 使用方式

1. 每批指令**独立提交**，一批做完再开始下一批。批间不要合并。
2. 每批指令都以 `Read 本文件第 N 批：...` 开头，让 Codex 先读上下文再动手。
3. 若某批要求与 Codex 自己的判断冲突，以本文件为准，但要求 Codex 在回复中说明冲突点。
4. 任何批次都**不允许**：修改产品行为、改写课程内容、改动认证/同步逻辑、上传原始文件、把服务端密钥带进浏览器、编造用户数据或评价。

---

## 第 0 批：基线冻结（任何改动前必须先做）

```
任务：冻结视觉基线，供后续批次比对。不要修改任何产品代码。

1. 在当前主分支上运行一次构建与相关测试，记录结果。
2. 在 1440×900 与 390×844 两个视口下，对以下路由各截一张首屏 PNG：
   / /auth /dashboard?guest=1 /courses /papers /data /projects /settings
   存到 outputs/award-audit-2026-10-15/baseline/，文件名 <route>-<width>.png。
   /dashboard 与 /projects 需要先以 /dashboard?guest=1 建立访客态。
3. 对每个路由运行以下脚本并把输出存为 baseline-<route>.json：
   读取 h1/h2/h3 的计算 fontSize/fontWeight/letterSpacing，以及所有 button 的 backgroundColor/height/borderRadius。
4. 不要自动更新 Playwright 视觉基线。不要删除或改写 tests/ 下的任何基线文件。
5. 完成后只回复：构建与测试结果、截图路径、脚本输出路径。不要开始任何修复。
```

---

## 第 1 批：S 级收敛（低风险单点，收益最快）

```
Read docs/reviews/2026-10-15-award-standard-audit.md 第 2 节 S 级，然后按 S0 → S8 顺序执行。一次只做一项，每项做完跑一次 lint，全部做完跑一次构建与相关用例。

S0 侧栏展开不得遮挡内容（本轮最高优先级）
- 复现：1440×900 打开 /courses，把指针移入左侧侧栏（或键盘 TAB 进入），侧栏展开到 232px，页面 H1「课程中心」被完全盖住，课程名与段落首字被遮。
- 机制：.app-sidebar 是 position:absolute / width:72px / z-index:20，外层 .sidebar-auto-slot 是 position:sticky / z-index:40 且宽度固定 72px；展开只改侧栏自身宽度（hover-navigation.css:11），外层轨道与内容列都不参与布局，所以是纯覆盖。
- 要求：修成「展开时内容不被遮挡」。可选实现：
  (a) 让轨道宽度参与布局并过渡（grid-template-columns 或内容列 padding-left 同步过渡）；
  (b) 保留覆盖式预览，但保证标题区在展开时仍完整可读；
  (c) 取消 hover 展开，改为常驻带文字的轨道。
  选择 (b) 或 (c) 前请在回复中说明理由。
- 禁止：用 overflow:hidden 掩盖；用 z-index 把标题抬到侧栏之上造成叠字。
- 验收：1440×900 下指针移入侧栏并保持，H1 完整可读；键盘 TAB 进入侧栏时同样成立；/dashboard /courses /papers /data /projects /settings 六页各截一次展开态截图。

S1 主按钮颜色收敛
- 把以下深藏青/深蓝主按钮统一为 var(--brand)（hover 用 var(--brand-hover)）：
  globals.css:1389（.project-empty button）、globals.css:1170（.settings-state a）、
  globals.css:897（.auth-result-page 图标底）、globals.css:900（.auth-result-page a）、
  globals.css:905（.reset-card form button）、
  courses.module.css:26（.actions button[type=submit]）、courses.module.css:48（.primaryLink 的 #253e5b）。
  说明：深藏青不止出现在两个空态，找回密码与验证结果流程也在用，属全站色彩体系问题。
- globals.css:895 是 .auth-result-page 的整体文字色，不是按钮；如需一并收敛请改用 var(--text) 并说明。
- globals.css:1259 的 .data-context-strip strong 是文字色，可保留；若改动需说明理由。
- 验收：rg '#111827|#171e2e|#253e5b' app/ 后逐条确认，只允许保留已说明理由的文字色命中。

S2 未登录态不要出现禁用主按钮
- /settings 在未登录时，页首的「保存资料」按钮会导致读起来像坏掉。改为：未登录时不渲染该按钮，表单区直接显示与 /projects 一致的登录引导空态。
- 不要改动登录后的行为。
- 验收：以访客态打开 /settings，页首无任何按钮；登录态代码路径不变。

S3 中文标题去除反字距
- 定位 app/ 下所有对中文标题施加负 letter-spacing 的规则（至少包含首页主标题与 overview 相关规则）。
- 中文标题改为 letter-spacing: 0；英文/数字为主的标题与正文可保留现有处理。
- 不要改变字号与行高。
- 验收：截图对比中文标题不再挤压；英文论文标题观感不变。

S4 移除首页的 KaTeX 加载
- 把 katex/dist/katex.min.css 从 app/layout.tsx 的全局导入移到真正渲染公式的组件/路由内。
- 验收：首页 document.fonts 不再出现 KaTeX_*；含公式的课程课时渲染不变。

S5 焦点环统一
- 统一为 2px solid var(--brand)，outline-offset 3px。
- 处理 globals.css:1535（3px）、courses.module.css:28（3px #456e9b）、globals.css:1215 的旧色 #70dfc5 残留。
- 不要删除任何焦点样式，只统一规格。
- 验收：键盘巡游全站，焦点环宽度与颜色一致。

S6 动效开关记忆
- app/components/light-curtain.tsx 的暂停状态写入 localStorage 并在初始化时读取。
- 给 .light-curtain-canvas 的 opacity 变化加 200ms 过渡（white-theme.css:27）。
- 保持 reduced-motion 优先于用户选择。
- 验收：打开动效、刷新，仍为打开；首帧不闪烁；系统 reduced-motion 下开关仍隐藏。

S7 补齐缺失的交互状态
- 为下列元素补 :hover 与 :active（现有规则见括号内行号，风格与之一致）：
  paper-reading.css:51,56,59（论文标注相关按钮）、:70（literature-search button）。
- 为 .ui-tabs button、.course-row、.project-list button 补 :disabled 样式（不改变可交互逻辑）。
- 验收：逐元素 hover / 按下 / 键盘聚焦 / 禁用各看一次。

S8 统一版心
- 恢复一个共享正文列宽度：编辑式页面 1240px，工作台式页面 1440px。
- 删除 white-theme.css:198 对 .page-body max-width 的置空，改为显式设定共享值。
- 移除 overview.module.css:14 中重复的 1240px 兜底。
- 验收：1440px 下量四个页面的内容左右边界；同组页面一致，且跨断点不产生横向滚动。

停止条件：七项完成、构建与相关用例通过后立即停止。不要顺手做第 2 批的任何内容。
```

---

## 第 2 批：排版体系（M1/M2/M3）

```
Read docs/reviews/2026-10-15-award-standard-audit.md 第 3 节 Type Scale，然后执行。

M1 修正标题层级倒挂
- /courses：operational-craft.module.css:4 的 H1 与 workspace-refresh.css:66 的课程标题 H2 已确诊倒挂（1425px 视口下 37.05px vs 38px）。正确解法不是把两者调成相邻值，而是让该页只保留一个一号：以课程名作为页面 H1，页级「课程中心」改为次级。若改动会牵动目录结构或路由，先在回复中说明方案再动手。
- /papers：reading-craft.module.css 中同屏出现 H1 22px、H2 36px（:106）、H2 30px（:115）、H3 24px（:110）。按统一字级重排：页面标题 46px，内容块标题 24px，小节标题 18px。
- /data：globals.css:220 的 .chart-toolbar h3 18px 与面板 H2 18px 同值，改为 18px(H2) 与 15px(H3)。

M2 建立单一字级令牌
- 在 app/globals.css 的现有 --fs-* 令牌段（约 :58-69）旁新增或替换为一套完整字级，取第 3 节表格的十个层级。
- 逐路由把字面 clamp() 改为消费令牌。顺序建议：/dashboard → /courses → /data → /projects → /settings → /papers → /auth → /。
- 清理确认无引用的死规则：focused-workspaces.module.css:6,15,16（.course-workbench/.course-desk/.course-intro）。
- 不要在同一次提交内改动字号以外的排版属性（行高、字重可随字级一起设定，字距见 S3 除外）。

M3 统一衬线
- 目前有两款衬线：Acaora Overview Serif（overview.module.css:2，仅 /dashboard）与 Acaora Source Serif（reading-craft.module.css:3，仅 /papers）。其余路由无衬线标题。
- 目标：一款衬线贯穿所有标题与阅读内容，无衬线只承载控件与数据。
- 先比较两款字体的中文覆盖与字重（Source Serif 为拉丁字体，中文会回退；Overview Serif 为 Noto Serif SC 子集）。选择覆盖更完整者作为统一衬线，并补齐所需字重子集。
- 不要引入外部字体请求，保持自托管。
- 验收：在 /dashboard /courses /papers 三页截图，标题应出自同一款衬线；中文不出现回退混排。

停止条件：字级令牌落地、倒挂归零、衬线统一后停止。不要改间距、圆角或投影。
```

---

## 第 3 批：尺度与材质（L1/L2）

```
Read docs/reviews/2026-10-15-award-standard-audit.md 第 2 节 L1/L2 与第 5 节风险表，然后执行。

L1 间距与圆角收敛
- 圆角唯一尺度：6 / 8 / 10 / 12 / 14 / 18 px（外加纸张层 3px 与胶囊 999px）。
  清除尺度外值：9px(36 次)、16px、15px、20px、22px、24px、19px、11px、13px、7px、5px、4px、2px。
- 间距唯一尺度：4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 px。
  优先处理高频离尺度值：20px(131)、18px(131)、10px(120)、14px(111)、28px(77)、22px(61)。
- 关键约束：按规则块替换，不要整文件正则横扫。每替换一族后跑一次构建并截一次图比对。
- 如果某个值有明确的光学理由必须保留（例如焦点环 offset），在回复中单独列出并说明，不要静默保留。

L2 投影纪律
- 决定并执行一条规则：页面结构不投影，仅浮层/菜单/焦点环/状态点可投影。
- globals.css 中约 55-60 条作用于页面结构容器的 box-shadow 需清零；workspace-refresh.css 已有的显式 none 保留。
- 不要动小元素投影（焦点环、状态点、按钮、悬浮控件、toast/menu）。
- 验收：截图中页面主体应无浮起感；浮层仍清晰可辨。

停止条件：尺度收敛完成、构建通过、前后截图各一组后停止。
```

---

## 第 4 批：动效与微交互（L4/L5 + 状态矩阵）

```
Read docs/reviews/2026-10-15-award-standard-audit.md 第 4.5 与 4.6 节，然后执行。

L4 时长与缓动收敛
- 四档时长：120 / 180 / 240 / 320ms，替换现有的 0/15/80/140/150/160/200/220/260/280/360/380/420/600/650ms。
- 两条曲线：进入 cubic-bezier(.16,1,.3,1)，退出 ease-out。删除其余自定义贝塞尔。
- 现有令牌 --dur-1/--dur-2/--dur-3 使用率极低（--dur-1 与 --dur-3 为零使用），重写为四档后统一引用。
- 例外：spinner 的 linear 保留；状态反馈类一次性动效（如任务计数 600ms）如确需更长，在回复中列出理由。

L5 消除布局属性动画
- hover-navigation.css:9 的侧栏 width 72px→232px 改为不触发布局的实现（建议 transform + 内容位移，或 grid-template-columns 过渡）。
- workspace-motion.css:51,53 的直方图 height 与散点图 left/bottom 改为 transform。
- course-shell.tsx:17-21 的 flushSync + 前后 getBoundingClientRect 测量，评估能否改为单次测量。
- use-paper-motion.ts:21-24 每次提交测量四个表面，评估能否缓存。
- 验收：用 DevTools Performance 录制侧栏展开与图表切换，确认无逐帧 Layout 开销；功能与动画外观不变。

微交互状态矩阵
- 目标矩阵：hover / active / focus-visible / disabled / selected 五态。
- 按下反馈统一为 scale(.985) 或 1px 位移，时长 80ms，仅限 (hover: hover) 设备。
- 补齐 S7 未覆盖的原语（导航项、列表行、标签页、日志行）。
- 不要引入循环动画、不要给滚动加编排。

停止条件：四档时长落地、布局动画清零、状态矩阵补齐并通过键盘巡游验证后停止。
```

---

## 第 5 批：响应式与首页内容（M4/M5）

```
Read docs/reviews/2026-10-15-award-standard-audit.md 第 2 节 M4/M5 与第 4.7 节，然后执行。

M5 窄桌面区间
- 761–1100px 区间侧栏占宽偏大。方案：该区间默认收起轨道、hover/聚焦展开（机制已存在），或在 1100px 以下降低侧栏宽度。
- 补 1100px 断点。
- 清理旧路由标题残留：globals.css:279,383 的 clamp(32px,4.7vw,58px) / clamp(34px,5vw,62px)。
- 给 app/papers/original-pdf.module.css 补 prefers-reduced-motion 块。
- 首页主视觉素材当前 639×399，在 1440 屏与高 DPI 下偏软。改为真实 DOM 截屏或提供 2x 素材。
- 验收：390 / 768 / 1024 / 1280 / 1440 / 1920 各截一次；200% 缩放下素材清晰。

M4 首页内容
- 现状：首屏（左文案 + 右产品截图 + 底部三项列表）+ 页脚，信息体量偏薄。
- 只允许使用 PRODUCT.md 已确认的事实。可用：三条机制（原文件不上传只同步派生记录；AI 是独立标注层且论文场景必须引用编号段落；一个账户一份跨设备记录）；七门课程 / 64 核心课 / 每节一个例题三道练习 / 每门一个综合案例；MIT 开源与公开仓库；支持的主邮箱类型；英文论文 + 浏览器本地翻译（不经过服务器）。
- 禁止：用户评价、客户 logo、媒体引用、使用数据、留存或性能数字、价格与计划（PRODUCT.md 明确列为不可虚构）。
- 版式要求：不新增卡片、不做三等分图标列、不给每个区块加小标签（eyebrow），每三个区块最多一个小标签。
- 装饰光带每屏至多出现一次。
- 验收：文案逐条可在 PRODUCT.md 找到出处；首页不出现任何无法溯源的数字或声称。

停止条件：断点补齐、首页文案可溯源后停止。不要扩写产品能力。
```

---

## 第 6 批（独立分支）：CSS 分层重构（L3）

```
Read docs/reviews/2026-10-15-award-standard-audit.md 第 2 节 L3，然后执行。这批改动面最大，必须独立分支、独立回滚点。

现状：6 张顶层样式表；globals.css 4270 行内含两代世界（.auth-shell 重复三处、.plab-workbench 十一处）；跨文件靠 white-theme.css → workspace-refresh.css 顺序覆盖；路由 module 用 .craft.craft :global(...) 双写类名提特异性。

目标：把「当前有效值」提升为唯一 token 块与唯一规则，删除被覆盖的旧声明。

执行顺序（每步一次提交、一次构建、一次截图批）：
1. 先产出「选择器 → 当前有效值 → 声明位置」清单（可脚本生成），作为重构对照表与回归依据。
2. 从重复次数最多的选择器族开始（.student-app、.plab-workbench、.auth-shell、.course-overview、.settings-state、.project-workbench），逐族合并为一条规则。
3. 按规则块删除旧世界声明，不要按行删。
4. 每一步后用第 1 步的清单复测：有效值应完全一致。任何差异都必须解释。

硬约束：
- 行为、文案、DOM 结构一律不变。
- 不引入 Tailwind 或任何新依赖。
- 保留 :focus-visible、reduced-motion、reduced-transparency 全部现有分支。
- 若某族无法在不变更行为的前提下合并，跳过并在回复中说明，不要强行合并。

停止条件：清单复测一致、构建与全量测试通过后停止。这批不做任何视觉调整。
```

---

## 附：每批完成后 Codex 必须回复的内容

1. 改了哪些文件，每个文件一句话。
2. 构建与测试结果（原样粘贴失败输出，不要总结成「通过」）。
3. 验收命令/步骤与观察到的结果。
4. 任何偏离本指令的地方及原因。
5. 任何未验证项，明确标注未验证。

若某项无法在不变更产品行为的前提下完成，**停下来报告**，不要自行扩大范围。
