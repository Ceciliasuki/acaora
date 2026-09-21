# ACAORA UI 重构改动记录 — 2026-09-16

> 本文件是这一轮 UI 重构的**自包含**改动记录：做了什么、实测数字、被回滚的部分、明确没做的部分、
> 以及所有证据在磁盘上的位置。数字全部来自当次实测日志，不是回忆。
>
> 分支 `redesign/taste-ui-overhaul` ｜ 起点 `f0f6284`
> ｜ 重构提交 `917f888`、`3b47ea0` ｜ Pre-deploy 收口提交 `2b7fa18`、`05cd64f`（详见 §13）
> ｜ **未 push**，`origin/main` 仍是旧的 `d74c96e`。

---

## 1. 一句话

六个工作区页面（总览 / 课程中心 / 项目空间 / 设置与隐私 / 数据分析 / 论文研究）统一到一套称为
**「工作带」（仪表）** 的页面语言，并修掉这一轮暴露出来的缺陷。门禁**全量 32/32 通过**，两个提交
已落地，视觉基线同步更新（另三个未动，有 sha256 证据）。

---

## 2. 范围与边界

**在范围内**：`app/dashboard`、`app/courses`、`app/projects`、`app/settings`、`app/data`、
`app/papers`（含 `ai-studio.tsx`）六个页面的 JSX 与 `app/globals.css`，以及 `DESIGN.md` 与六个视觉基线。

**不在范围内（明确没做，见 §6）**：公开落地页 `/`、登录页 `/auth` 与 `/auth/reset`、
审查报出但未修的既有交互/a11y 缺陷、`.student-app` 的字体声明。

**前情（2026-09-15 深夜，同一轮工作）**：先把 Dashboard 从 Direction A 改成「一块抬升表面 + 两栏
desk」（Phase 1E），用户审阅后判定「太朴素」，随后用三版风格示意稿（V1 台面 / V2 仪表 / V3 深底）
选定 **V2 仪表**，Phase 1E 被 Phase 1G 整体取代。1E 的实现代码只存在于
`test-results/phase-1e-reference/`（`page.tsx.phase-1e.bak`、`dashboard-section-1e.css`、
`globals.css.phase-1e.bak`），需要回退对比时可用。

---

## 3. 交付物：两个提交

### 3.1 `917f888` — refactor: rebuild workspace pages on the working-band vocabulary

`2026-09-16 09:34` ｜ 14 files changed, **+1556 / −343**

| 文件 | 变化 | 内容 |
|---|---|---|
| `app/dashboard/page.tsx` | +276 | 控制条 + 数字登记条 + 规则表/正在进行分栏 + 四区条 + 状态挡 |
| `app/courses/page.tsx` | +184 | 同上骨架；课程变规则行（真实按钮）；AI 结果区用 `--ai-subtle` 地面 |
| `app/projects/page.tsx` | +63 | 骨架 + 项目列表 `aria-current`；创建弹窗补 Escape 与初始焦点 |
| `app/settings/page.tsx` | +50 | 骨架；分区去掉编号与全大写眉标，卡片改规则分隔 |
| `app/data/page.tsx` | +55 | 骨架（登记条取代旧 context strip）；去掉编号 kicker |
| `app/papers/page.tsx` | +40 | 骨架；`--page-body--wide` 保留 1680px 工具宽度 |
| `app/globals.css` | +1168 | Phase 1G/1H/1I 三层；旧课程 CSS 删除；共享规则拆分 |
| `DESIGN.md` | +63 | 见 §7 |
| 六个视觉基线 PNG | Bin | `courses` / `dashboard-empty` / `data` / `papers` / `projects` / `settings` |

**页面语言**：满宽控制条（页名 + 该页唯一的筛选 + 唯一的主动作）→ 数字登记条（4–5 格，竖规则分隔，
只放真实值）→ 内容区（规则行 / 规则表 / 该页自己的工作台）→ 四区条 → 状态挡。
**页面结构不带任何阴影**；`PaperLab` 与 `DataLab` 的三栏工作台和密度原样保留（这是设计记录的硬要求）。

**同一提交内修掉的缺陷**（其中 6 项来自 §5 的审查）：

1. 课程中心与设置页的资料选择器原先 `display:none` 藏在 `<label>` 里，**键盘完全无法触达** → 改为视觉
   隐藏但可聚焦，焦点环画在容器上。
2. `#project-notes` 是**全项目唯一没有可访问名称的控件** → 补 `aria-label`。
3. 数据分析页两个图表的 `aria-label` 挂在无 role 的 `div` 上，**从未生效** → 补 `role="img"`；
   格式条补 `role="group"`。
4. 项目页三处 12px 文字对比度实测 **2.67:1 / 2.97:1 / 3.56:1**（低于 4.5:1）→ 改 `--text-2`。
5. 论文页三个输入框的 `outline: none` 压掉了全局焦点环 → 恢复；搜索框因 `overflow:hidden` 会裁掉
   outline，改为容器 `:focus-within` 加环。
6. 课程方向筛选原是 `role="tablist"` + `aria-selected`，但它过滤列表而非切换面板 → 改为带标签的
   `aria-pressed` 按钮组；课程行与项目行补 `aria-current` + 勾选标记，选中状态不再只靠颜色。
7. 页面私有控件原用 `#d8dde5` 描边（约 1.4:1，**不满足 3:1 控件边界**）→ 改用共享
   `FormField` / `Textarea` / `Select`，自动获得 1A.1 的焦点契约。

### 3.2 `3b47ea0` — fix: raise the rail's two below-floor text sizes

`2026-09-16 09:51` ｜ 7 files changed, **+17 / −9**

- 侧栏品牌副标题 **10px → 12px**、账号副标题 **11px → 12px**，两者都低于设计记录的 12px 地板。
  品牌那条用后代选择器**限定在侧栏内**：同一个 class 也出现在公开落地页与登录页，那两页的改动归它们
  自己的阶段。
- 删除五条 `<i>` 字形规则（`AppSidebar` 渲染 0 个 `<i>`，已 grep 验证是死代码，删除不移动像素）。
- **实测证据**：在能看见 2px 文字变化的严格阈值下，六个工作区页面**各只移动 1769 px，bbox
  (77,35)-(149,847)** ——完全落在侧栏文字列内（侧栏宽 248px），且六页数字完全一致。这就是那两处字号
  变大 2px 的全部效果。

**明确没做**：`.student-app` 的 `font-family: Inter, ui-sans-serif, …` 换成已批准的系统栈。**实测它不是
惰性的**——它重渲染所有从 shell 继承字体的元素，在总览页差异 bbox 横跨整页到 x=1412，而另外五页在
1% 阈值以下；撤掉这一行后九个视觉测试立刻全绿，用实验证明了它是唯一原因。所以它是正文字体决策，
不是地板修复，留在 `DESIGN.md` 的 Typography 缺口里。

### 3.3 一个结构性根因修复（在 917f888 内）

Phase 1G/1H/1I 的覆盖块**最初被插在文件中间**（`.brand-mark` 之前，约 815–1620 行），而历史 CSS 延续到
约 2968 行。**同特异度下由源序决定，所以后面的旧规则悄悄压过了所有覆盖**。实测两处后果：
`.project-workbench` 仍是「1px 边框 + 18px 圆角 + 大阴影」的幽灵卡片（craft-floor 明令拒绝的形态），
`.translator-status.state-error` 的圆点仍是琥珀色的「进行中」色而不是危险色。

修法：把三个覆盖块**移到文件最末尾**（Phase 1A 追加块之后）。移动后重渲染差异从 219,324 px 变为
240,489 px（papers），这就是「覆盖之前一直在输」的证据。**以后任何覆盖层都必须放文件末尾。**

另外，课程中心的旧 CSS **与其他页（尤其是设置页）写在同一条规则里**（
`.learning-main, .settings-main {…}`、`.course-library, .course-focus, .practice-studio, .profile-card,
.privacy-card {…}`、四条 `.learning-section-title, .settings-section-head`、以及四个媒体查询）。按「整块
删除」处理时曾连带删掉 4 条 settings 规则；抓到它的方式是拿改动前的备份逐个 `grep -c` 比对选择器出现
次数（现为 4/4/6/1/3/11，与备份一致），最终由**设置页基线逐字节通过**作为证据。**共享规则只拆不删。**

---

## 4. 视觉基线：更新了哪些、哪些没动、怎么证明

**更新的六个**（经用户指示）与更新前 Playwright 报出的差异：

| 基线 | 差异（Playwright） | 页面高度变化 |
|---|---|---|
| `dashboard-empty-1440` | 25,343 px (0.02) | 1440×900 不变（纯绘制） |
| `courses-1440` | 280,283 px (0.13) | 1542 → 1150（−392px） |
| `settings-1440` | 201,069 px (0.06) | 2529 → 2448 |
| `projects-1440` | 280,292 px (0.15) | 1369 → 1254 |
| `data-1440` | 146,757 px (0.05) | 2472 → 2294 |
| `papers-1440` | 240,489 px (0.09) | 1983 → 1976（**密度几乎不变**） |

**未动的三个**：`home-1440.png`、`auth-login-1440.png`、`auth-register-1440.png`。更新前存 sha256、
更新后 `sha256sum -c` 回来三个全 `OK` ——证明**文件未被重写**。

**两条提交报告用的确认**（用户要求）：

1. 快照变动 = 恰好上述六个；`next-env.d.ts` 在两个提交里都是 0 处出现，**未改动**。
2. `tests/e2e/__screenshots__` 之外无其他快照变动。

---

## 5. Skill 审查（用户要求「查逻辑错误或交互错误」）

用 `web-design-guidelines`（质量门）与 impeccable 的 `craft-floor.md` / `operate.md` 作标准，
**用一个全新上下文的审查代理**读了七个改动文件与相关 CSS，报出 **48 条**。处理如下：

- **已修 8 条**（§3.1 的 6 项 + `.project-workbench` 幽灵卡片 + 错误色圆点）。
- **我的两个自身错误由审查抓出**：上面那条幽灵卡片；以及 `.translator-status.state-error` 被我在
  1I 层用同特异度覆盖成 warning。
- **未修 41 条**，属于既有缺陷（在我只做样式改动的页面上）：创建项目弹窗自称 `aria-modal` 却不圈禁
  焦点、三处 `role="tablist"` 缺 tabpanel/`aria-controls`/方向键、多处仅靠颜色表达状态、长操作缺
  live region、多处 Unicode 字符当图标（`＋ → ◇ Σ ⌕ ↺ ● ★`，部分进入可访问名）、
  **三处「状态词撒谎」**（设置页把网络失败显示成「未登录」；项目页拉取失败后仍渲染全零登记条 + 空态；
  课程页把请求失败后的内置默认值当作「当前模型」展示）、以及一批紫色/薄荷色遗留未进 token。**其中「状态词撒谎」三处已在 Pre-deploy Phase 修掉，见 §13。**
- **一条设计判断交回用户**：审查认为共享的「数字登记条」在六页重复出现，已接近 craft-floor 拒绝的
  hero-metric 模板——我给非数值格子开的逃生口 `.metric-register-value--text` 正是被模板挤压的证据。
  登记条是用户在示意稿里选定的 V2 核心元件，所以保留，但该判断需用户复核。

---

## 6. 被回滚的部分：Phase 1K（深色地面升级）

- **用户指令**：「别改了，还用之前那版，更新基线」。所以**这一版被整体撤回**，现在交付的是 1I 形态。
- 撤回方式：`app/globals.css` 从 `test-results/phase-1j-reference/globals.css.pre-1k.bak` 还原；
  `DESIGN.md` 里那三处描述深色地面的插入一并删除（记录不能描述已不存在的设计）。
- 被撤回的内容（保留在记录里，避免以后被当作新方案重提）：`.current-work` 深色仪器栏、
  四区条与状态挡改深蓝、AI 面渐变、`::selection`/caret/滚动条主题化、深色地面上的 on-dark 主按钮。
- 该轮的截图证据仍在 `test-results/phase-1k-after/` 与 `phase-1k-review/`（gitignore 内）。

---

## 7. 设计与文档（`DESIGN.md`）

`DESIGN.md` 在用户批准后做了一次修订（13 处插入，346 → 402 行）：frontmatter 只新增六个工作带组件
（`control-band`、`segmented-filter-active`、`register-cell`、`ruled-row`、`status-bezel`、`state-note`），
写完后校验**顶层键只有 schema 允许的 7 个**、且**每一处 `{colors.x}` / `{rounded.y}` 引用都能解析**
（30 个颜色、6 个圆角、19 个组件，零悬空引用）。正文新增：工作带语言、命令条 18px 标题的显式例外、
`### Migration status`（如实记录落地页的四条禁令违规）、`The Structural Elevation Rule`、
`The Rule-Only Surface Rule`、`### Working bands` 组件节、以及六条新的 Do/Don't。

另外 `--fs-label` 从 11px/14px 提到 **12px/16px**，关掉记录里那条「token 必须提上来否则 12px 地板不算
成立」的缺口。该 token **全项目无任何消费方**，所以可证零像素影响——验证方式是重跑视觉套件得到
**同样 3 个通过、同样 6 个失败**。

---

## 8. 门禁（提交树实测）

| 门禁 | 结果 |
|---|---|
| `tsc --noEmit` | clean（日志 0 字节） |
| `eslint app tests scripts` | clean（日志 0 字节） |
| unit | **27/27** |
| `next build` | 成功 |
| E2E 非视觉 | **23/23**（含 AUTH-05、375/768/1440 溢出扫描、axe 冒烟） |
| 视觉 | **9/9**（更新六个基线之后；更新前为 6 failed，属预期） |
| 全量 | **32/32** |
| `next-env.d.ts` | 两个提交均未改动 |

**9 个 PAPER 测试与 2 个 PROJECT 测试全部通过**，说明 PaperLab 的 `window.confirm` 文案、
`.library-privacy strong`、`.sr-only` 文件输入、IndexedDB `statlab-paper-memory` 队列契约，
以及项目页的 `#project-notes`／`删除这个项目？` 弹窗都没有被样式改动破坏。

---

## 9. 复现门禁（原样可用）

```bat
:: 前置：当前目录 = 仓库根目录
set "PATH=C:\Program Files\Git\cmd;C:\Program Files\nodejs;%PATH%"

node node_modules/typescript/bin/tsc --noEmit
node node_modules/eslint/bin/eslint.js app tests scripts
node --test tests/source-invariants.test.mjs tests/paper-sync.test.mjs
node node_modules/next/dist/bin/next build
set CI=1 && node node_modules/@playwright/test/cli.js test --grep-invert "@visual" --reporter=list
set CI=1 && node node_modules/@playwright/test/cli.js test --grep "@visual" --reporter=list
set CI=1 && node node_modules/@playwright/test/cli.js test --reporter=list
```

`package.json` 里的 `typecheck` / `test:unit` / `test:e2e` / `test:visual` 也做同样的事，但它们内部调裸
命令名，**必须先修好 PATH**。

更新基线时务必**用 `--grep` 把要当对照组的基线排除在这次运行之外**：

```bat
set CI=1 && node node_modules/@playwright/test/cli.js test --grep "(dashboard-empty|courses|papers|data|projects|settings) visual baseline" --update-snapshots=all --reporter=list
```

---

## 10. 证据与产物在磁盘的位置（`test-results/` 全部 gitignore，不要 `git add`）

```
phase-1e-reference/            1E 的实现备份（回退对比用）
phase-1j-reference/            pre-1K 的 globals.css 与 dashboard 页面备份
phase-1i-review/  phase-1i-final/    V2 落地前后的 EXPECTED/ACTUAL/DIFF 与基线批准清单
phase-1k-after/  phase-1k-review/    被回滚的深色地面轮的截图（保留备查）
gate-*.log                     各轮门禁原始日志（含 tight 阈值测量）
local-server-3010.log          本地生产模式服务器日志
```

---

## 11. 测量方法上的三条教训（本轮实测得出）

1. **「通过 1% 阈值」不等于「逐字节一致」。** 本轮一度把「9 passed / 3 passed」报成逐字节一致，
   实测发现三个公开页在严格比对下与各自基线仍差 `home` 371,051 px、`auth-login` 262,928 px、
   `auth-register` 290,149 px（Playwright 阈值下分别为 10,514 / 4,237 / 5,382 ≈ 0.3% 以下），
   只因为页面高、比例小才通过。最可能的原因：**这三个基线由 CI runner（`visual.yml`，
   windows-latest）生成，而本轮重新生成的六个是本机精确的**，本机与 runner 渲染差约 0.3%。
   正确说法只能是「通过项目容差」。
2. **`--update-snapshots` 只重写「没过阈值」的快照。** 只差 1769 px 的基线不会被它更新，必须用
   `--update-snapshots=all` 并配合 `--grep` 限定范围。
3. **证明一个页面没被本次改动影响，用 CSS 语义或同机两版渲染对比**；基线文件 sha256 只能证明
   **文件没被重写**，不能证明渲染相同。判断某页改动是否只落在某区域，用**收紧阈值让运行时本身成为
   测量**（例如 `maxDiffPixelRatio: 0.0002` 会在移动超过约 250 px 时失败并写出 actual/diff）。

---

## 12. 待决定 / 已知限制

**待用户决定**

1. 是否收紧视觉阈值：`tests/e2e/ui.spec.ts` 的 `maxDiffPixelRatio: 0.01` 对高页面太松（`home` 能藏住
   10,514 px）；收紧后本机与 CI 之间约 0.3% 的噪声会暴露，届时需决定**基线以哪台机器为准**。
   该文件属 `tests/**`，按约定未经允许不动。
2. 落地页 hero 用哪几张**真实产品截图**（1A 阶段就定过：最终要用真实截图）。这是内容决策，
   不是样式决策。
3. ~~三处「状态词撒谎」是否列为部署阻塞项~~ —— **已在 Pre-deploy Phase 修掉，见 §13**；另发现 `pnpm lint` 原本 122 errors（CI 必红），也已一并修复。

**已知限制**

- 本机服务器 `/api/auth/status` 返回 `configured: false`，**本地无法真实登录**；只能浏览访客态与
  论文工作区的匿名模式。真实登录、真实 AI 调用、EdgeOne 绑定与环境变量、`SITE_URL` 与 Supabase
  回调白名单一致性，**本地均无法验证**。
- 两个本机服务器的 `/api/version` 显示 commit `f0f6284`：那是生成元数据文件旧了——门禁用的
  `next build` 直调跳过了 `scripts/generate-build-version.mjs`，`pnpm build` 会刷新它，**不代表代码旧**。
- `zcode-handoff.md` 未跟踪但**未加入 `.gitignore`**；它内容已过时，任何 `git add -A` 都会把这份内部
  交接文档带进公开仓库。**合并前请删除或加进 `.gitignore`。**
- 自定义域名：`DEFERRED — owner intentionally does not purchase a recurring paid domain`；
  中国大陆长期访问：`NOT VERIFIED / PLATFORM DOMAIN LIMITATION`。
- 本机 3010 端口上有一个从已提交构建起的生产模式服务器在跑（用户浏览用），日志见 §10。

---

## 13. Pre-deploy Phase（2026-09-16 补充）

> 本节改动已提交为 **`2b7fa18`**（`fix: make workspace error states truthful`，三个页面）
> 与 **`05cd64f`**（`chore: exclude vendored agent bundles from lint`，`eslint.config.mjs`）。

本阶段目标是把当前版本推进到**可安全部署**状态：不做视觉重构、不改工作带语言、不加功能、不动无关快照。

### 13.1 三处「状态词撒谎」已修（状态真实性，不是 redesign）

| 页面 | 修复前 | 修复后 |
|---|---|---|
| 设置页 | `getCurrentUser()` / `getProfile()` 抛错时只写入 `error`，随后仍渲染 `!signedIn` 分支 → **网络失败被显示成「未登录」** | 新增独立的 `sessionError`；**null 用户 = 真未登录，抛错 = 请求失败**（`readJson` 在 `!response.ok` 与非 JSON 响应上抛错，所以两者本来就可区分，无需新接口）。渲染顺序 `loading → error → guest → ready`；错误态带 `role="alert"` 与「重新加载」。登记条与状态挡同步区分（`未获取` / `账户状态未知`） |
| 项目页 | `/api/projects` 拉取失败只设 `message`，`loaded` 仍为 true → **继续渲染全零登记条 + 「创建你的第一个项目」空态**，把「取不到数据」解释成「数据为零」 | 新增 `loadError`，catch 不再走 `message`；渲染顺序 `loading → error → 登录墙 → ready`。错误态复用共享 `ErrorState`（`role="alert"` + 重新加载）。失败时**登记条与空态都不渲染**；会话请求失败同样进错误态，不再落进登录墙 |
| 课程页 | 模型名的 `useState` 初始值就是内置默认串，请求失败后照旧显示 → **把内置默认值表述为「当前模型」** | 模型拆成 `loading / ready / fallback / error`。成功且服务端声明模型 → 真值；成功但未声明 → 「未声明」+ 说明按服务端默认运行；请求失败（含显式 `!response.ok` 检查）→ 「未获取」+ 说明未能确认。**ready 分支连 note 文案都逐字未动**，所以已批准的基线不动 |

顺带在同页修了另两处同类实例（同一缺陷类别，不是新需求）：设置页**兴趣标签**在加载中/失败时不再显示「尚未添加」（改为「读取中」/「未获取」）；**构建版本**请求失败不再永远停在「读取中」（改为「未获取」+ 失败说明）。

**验证方式**（8 个临时用例，跑完即删）：用真实失败请求驱动——会话 503、资料 503、项目 503、模型 503、以及「成功但未声明模型」——断言错误态出现，且**旧错误文案不出现**（`登录后管理个人资料` / `创建你的第一个项目` / `DeepSeek（服务器默认）` 计数均为 0）。健康路径同时断言未变：设置页 `#settings-name`、课程页模型值与 note、项目页 5 格登记条。

### 13.2 另一处生产阻塞项：`pnpm lint` 原本是红的（CI 必然失败）

`ci.yml` 跑 `pnpm lint`（= `eslint . --ignore-pattern dist --ignore-pattern .next`），实测 **exit 1 / 122 errors**。逐条统计后确认：**全部 122 条都在 `.agents/skills/impeccable/scripts/` 的三个第三方打包文件里**（`modern-screenshot.umd.js` 87 条、`live-browser.js` 34 条、`live-browser-dom.js` 1 条），`app/` `tests/` `scripts/` 为 **0** 条。

修法沿用该配置文件自己的先例（`public/pdf.worker.min.js` 本来就在忽略列表里）：把 `.agents/skills/**/scripts/**` 加入 `globalIgnores`。改后 `pnpm lint` exit 0，作用域 lint（`app tests scripts`）仍 clean。

### 13.3 其它

- 删除未跟踪的 `zcode-handoff.md`（内部过期交接文档，从未进入仓库，不会、也不应被提交）。
- 使用**正式构建命令** `pnpm.cmd build`：`app/generated/build-version.ts` 的 `BUILD_COMMIT` 由 `f0f6284…` 刷新为 **`3b47ea0…` = 当前 HEAD**，`/api/version` 实测返回同一 SHA（该文件被 `.gitignore` 第 18 行忽略，不会污染 `git diff --exit-code`）。
- **未改动任何视觉基线**：完整视觉套件 **9/9** 通过，说明这三处修复只影响未被基线覆盖的错误态。
