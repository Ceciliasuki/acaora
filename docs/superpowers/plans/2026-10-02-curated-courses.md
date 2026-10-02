# 七门高标准预设课程 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 七门课程都有可自学的固定讲义、分层题库、章节作业与综合自测，用户不需导入材料或配置 AI Key，并可按账号继续学习。

**Architecture:** 静态结构化内容按课程/课节存储，服务端只加载当前内容，独立客户端组件处理作答和学习记录。课程正文与即时 AI 分层；学习记录通过现有同源鉴权 API 写入 Supabase，离线队列按账号隔离。内容编写按七门顺序完成，逐门留验收记录。

**Tech Stack:** Next.js 16.3.1、React 19.2.6、TypeScript、Node.js 22.11.0、pnpm 10.26.1、现有 Supabase 客户端、Node test 与 Playwright。计划使用 KaTeX 0.19.0（本次 `pnpm view katex version` 返回），安装前核对 API 与兼容性并精确锁定版本；当前尚未安装。

**Spec:** [课程设计](../specs/2026-10-02-curated-courses-design.md)；[院校对标与质量要求](../specs/2026-10-02-course-academic-benchmarks.md)。执行时必须读两份文件。

**Status:** 实施计划待用户审阅，所有下述步骤未执行。仅文档已经保存，产品代码、数据库、题库和部署均未变更。

## Global Constraints

- 覆盖 STAT-201、ECON-204、STAT-302、ECON-301、STAT-306、TRADE-305、FIN-308 七门，不以先完成一门代替全范围。
- 对标代表性院校公开资料，不宣传“985 官方标准”、学校合作、专家认证或学分等效。旧版资料和层次不明资料如实标注。
- 每节至少两个完整例题、六道原创练习；每章至少八道额外作业；每门两套综合测试，每套至少十二题。题量是自定下限。
- 正文有定义、条件、关键推导和应用；题目有答案、步骤或评分要点。开放题只自查，不用 AI 虚构自动评分。
- 无资料、无密钥也能完成基础学习；付费 AI 不自动调用。正文与题库原创，来源只参考，不抓取商业教材全文或复制习题。
- 稳定 course/lesson/question ID 与版本；题目改版不误沿用旧正确记录；不删除论文、项目、旧站文件或浏览器数据。
- 当前已加载内容支持断网继续使用，记录持久化并重连同步；不承诺整页离线启动，不增加全站 Service Worker。
- 光色界面、长时间中文阅读、键盘可用、减少动画偏好和 WCAG AA 对比度；沿用现有侧栏与工作区，不改造无关页面。
- 执行前依 AGENTS 核对本地 Next 文档；本次已读 Server/Client Components 和 Dynamic Routes，路由 params 用 Promise 并 await。
- Supabase 使用会话用户与所有权 RLS，新增表显式 GRANT；本次已读 changelog 与 RLS，并核对 2026-04-28 Data API 默认权限变更。执行前检查实际项目可达性，不改变全库默认权限。

## Review Focus

1. 正态、矩阵秩、边界消费、无交易及汇率标价反向等条件改变时，公式不能机械套用；在每门内容复核任务里设置专门反例。
2. 主观推导题、答案修订后的旧题尝试、未作答但已看解析，不应显示客观正确或“已掌握”；由练习及进度任务覆盖。
3. 两个设备同时完成不同课节，以及旧设备在重置后上传缓存，不能覆盖完成集合或复活旧进度；由同步任务覆盖。
4. 登录退出、换账号、断网和 API 503，不能串号、丢本机队列或显示已云同步；由同步和应用 E2E 覆盖。
5. 深链接无效 ID、含不安全 HTML 的文本、错误公式、超长表格与小屏，不能造成脚本执行、白屏或不可读；由阅读组件及最终 E2E 覆盖。

## 文件与接口边界

- `content/courses/catalog.json`：七门 metadata、版本、章/节顺序和稳定 ID；不打包全文进入导航客户端。
- `content/courses/<code>/lessons/<lessonId>.json`：目标、预备链接、正文块、例题、练习、来源、版本和核验记录。
- `content/courses/<code>/assessments.json`：章作业、阶段/期末卷；题目 ID 不与课节题重复。
- `content/courses/<code>/coverage.json`：院校/自定目标到课节与题目的映射，核心/进阶和实际检查状态。
- `content/courses/<code>/datasets/`：原创或许可明确的 CSV、数据字典和参考分析；按需要创建，非每节强行配数据。
- `app/courses/course-types.ts`：`CourseSummary`、`Lesson`、`Question`、`ContentBlock`、`Attempt`、`CourseSnapshot`、`CourseOperation`。
- `app/courses/course-content.mjs` 与 `.d.mts`：服务端白名单 loader；`listCourses(): CourseSummary[]`、`loadLesson(courseId: string, lessonId: string): Promise<Lesson | null>`、`loadAssessment(courseId: string, assessmentId: string): Promise<Question[] | null>`。保持与现有纯逻辑 MJS + 类型声明模式一致，Node 测试不需额外 TS runner。
- `app/courses/course-grading.mjs` 与 `.d.mts`：纯判分；`gradeQuestion(question: Question, answer: string): {status: 'unanswered'|'correct'|'incorrect'|'self-check'; feedback: string}`。题型 choice/numeric/open，数值必须有限；容差逐题声明，不解析或执行用户表达式。
- `app/courses/course-math.mjs` 与 `.d.mts`：`renderCourseMath(tex: string, display: boolean): string`；KaTeX trust=false，HTML+MathML，失败时输出可读原公式与问题提示；不接受用户 HTML。
- `app/courses/course-reader.tsx`、`course-practice.tsx`、`course-navigator.tsx`、`course-progress.tsx`：分离正文、作答、导航与同步状态。
- `app/courses/page.tsx`、`app/courses/[courseId]/[lessonId]/page.tsx`、`app/courses/[courseId]/assessments/[assessmentId]/page.tsx`：入口/课节/作业与自测路由；非法 ID 为 404。
- `app/courses/course-sync.mjs` 与 `.d.mts`、`course-storage.ts`：纯合并与账号命名空间的 IndexedDB 队列。
- `app/api/cloud/courses/route.ts`：GET snapshot、PUT merge、POST reset；复用 `readRequestSession`、`supabaseRest` 与 private/no-store。
- `scripts/check-course-content.mjs`：schema、目标覆盖、题型/数量、ID/链接、公式编译及实际检查记录校验；非只检查文件存在。
- `scripts/verify-course-calculations.py`、`content/courses/<code>/calculations.json`：独立参考计算与输入/预期/容差；需要的科学计算依赖先核对现有 bundled runtime，不全局安装环境。
- `docs/course-reviews/<code>.md`：逐门核验记录，真实区分 VERIFIED/FAIL/NOT VERIFIED。
- `tests/course-content.test.mjs`、`tests/course-grading.test.mjs`、`tests/course-sync.test.mjs`、`tests/e2e/courses.spec.ts`、`tests/e2e/course-sync.spec.ts`、`supabase/tests/course_progress.sql`：必要行为与隔离验证。
- `package.json`、`pnpm-lock.yaml`、`tests/e2e/helpers.ts`、`tests/e2e/ui.spec.ts`、`README.md`、`PRODUCT.md`：依赖/检查接入、改造已有旧流程测试及能力说明。

### Task 1: 固定课节清单、内容类型和可验证的读取

**Interfaces:** 产出上述三项 loader、内容类型与纯判分契约；后续任务消费相同 ID 和版本。

- [ ] 建立七门 coverage 和正式课节清单，逐项纳入对标文件的必需补足项；标记核心/进阶，先修依赖无环。目录草稿不标成内容通过。
- [ ] 在 `tests/course-content.test.mjs` 写失败用例：unknown ID 返回 null；重复 questionId、缺少目标映射、缺解析、未教授知识作为必做题被拒；draft 不可被发布 loader 返回。

```js
test('unknown IDs cannot escape the lesson whitelist', async () => {
  assert.equal(await loadLesson('STAT-201', '../../settings'), null);
  assert.equal(await loadLesson('unknown-course', 'lesson-1'), null);
});
```
- [ ] 运行 `node --test tests/course-content.test.mjs`，确认针对缺失模块/行为失败。
- [ ] 实现 `course-types.ts`、MJS loaders/声明和 `check-course-content.mjs`；正文块只支持文本、公式、表格、列表、受控原创 SVG 图示，不执行原始 HTML 或脚本。目录允许记录草稿状态，但未检查课节不得加载为正式讲义；正式发布检查不得遗漏未通过课程。单门校验不把其他待编写课作为本门通过依据。
- [ ] 接入 `pnpm run check:courses` 与现有测试脚本；验证上述用例、所有 ID/依赖和来源映射。只提交本任务文件。

### Task 2: 可读课件与确定性练习

**Interfaces:** 消费 Lesson/Question；产出 `CourseReader({lesson: Lesson})` 和 `CoursePractice({questions: Question[], onAttempt: (attempt: Attempt) => void})`，Attempt 包含随机 id、questionId、questionVersion、answer、viewedSolution、createdAt，不由阅读组件维护云端状态。

- [ ] 写 `tests/course-grading.test.mjs` 失败用例：空答案→unanswered；正确 choice/numeric→correct；NaN/Infinity→incorrect；open→self-check；只看答案不创建正确尝试；新题版本不继承旧正确状态。

```js
test('open answers do not receive an invented score', () => {
  const question = { id: 'q-open', version: 1, type: 'open', rubric: ['指出假设'] };
  const result = gradeQuestion(question, '我的证明');
  assert.equal(result.status, 'self-check');
  assert.equal('score' in result, false);
});
```
- [ ] 运行 `node --test tests/course-grading.test.mjs` 证实失败。
- [ ] 核对 KaTeX 0.19.0 API、包导出与许可，精确安装并提交锁文件；实现两个纯 MJS helper 及声明、阅读和练习组件。CSS 沿用现有样式并在课程范围补充公式/表格横向滚动。
- [ ] `course-practice` 提供作答、提交、提示、查看解析，开放题显示评分要点；每次实际作答生成独立 attempt id。文本 React 转义，只有受控 KaTeX 输出用于 HTML 渲染，trust=false。
- [ ] 运行判分测试；用实际浏览器验证长中文、块公式/MathML、错误 TeX、表格、小屏与键盘。提交本任务。

### Task 3: 账号进度、离线队列和数据隔离

**Interfaces:** `CourseSnapshot {courseId, generation, completedLessonIds, lastLessonId, attempts}`；`CourseOperation` 包含 ownerId、operationId、courseId、generation、completedLessonIds、lastLessonId、attempts。`mergeCourseSnapshot(local, remote)` 合并同代完成集合与唯一尝试，新代次丢弃旧待同步操作；`flushCourseQueue(deps)` 实际成功后再移除队列。

- [ ] 失败测试写入 `tests/course-sync.test.mjs`：同代 union 幂等；不同设备尝试并存；旧 generation 遭 409 后不重放；401 暂停；503 保留；切账号不取另一账号 IndexedDB 数据；刷新后待同步记录仍在。

```js
test('concurrent completions are merged, not overwritten', () => {
  const base = { courseId: 'STAT-201', generation: 1, lastLessonId: null, attempts: [] };
  const result = mergeCourseSnapshot(
    { ...base, completedLessonIds: ['lesson-a'] },
    { ...base, completedLessonIds: ['lesson-b'] },
  );
  assert.deepEqual([...result.completedLessonIds].sort(), ['lesson-a', 'lesson-b']);
});
```
- [ ] 运行 `node --test tests/course-sync.test.mjs` 证实失败。
- [ ] 执行 Supabase 技能规定的 CLI/help/docs 核对，按实际 CLI 生成迁移文件名，不手编 `0006`。新增 `course_progress`（user_id/course_id 复合主键、generation、completed、last_lesson）与 `course_attempts`（user_id/attempt_id 复合主键、course_id/generation/question_id/version/answer/viewed_solution）。外键与所有权一致。
- [ ] 新增 SECURITY INVOKER RPC `sync_course_progress`、`reset_course_progress`，事务中锁定该账号课程行；匹配 generation 后合并，否则拒绝；重复 attempt id 不改写不同答案。reset 服务端递增 generation，清空当前完成/位置，旧尝试保留为历史但不影响新代进度。
- [ ] 表启用所有权 RLS，SELECT/INSERT/UPDATE 对当前 auth.uid；UPDATE 同时 USING/WITH CHECK。显式 GRANT 必要 authenticated 权限、撤销 anon；RPC 撤销 PUBLIC/anon EXECUTE，仅授权 authenticated。无需改动现有论文/项目表和全库默认权限。
- [ ] 实现 API：从会话确定 user_id，校验内容白名单、题目版本、有限长度；批次上限 50 尝试、请求上限 128 KiB；GET/PUT/POST private/no-store，未登录 401，无效输入 400，旧代次 409，未初始化 503。不接受客户端分数作为服务端判分依据。
- [ ] 实现账号隔离 IndexedDB 与同步状态，完成阅读为手动事件；最后阅读位置按服务器接受次序用于继续入口，不覆盖 completed 集合。
- [ ] 运行纯同步测试；在独立测试数据库用 `supabase/tests/course_progress.sql` 验证账号 A/B、anon、owner 转移、重复尝试、并发合并与旧代次。真实数据库不可用则记 NOT VERIFIED，不用 mock 代替；生产迁移留待最终上线审阅。
- [ ] 提交代码、CLI 生成的迁移与验证记录。

### Task 4: 七门入口与课程阅读路径

**Interfaces:** 消费 loader、CourseReader/Practice、CourseSnapshot；路由 Promise params await，客户端只接当前节与导航 metadata。

- [ ] 更新 `tests/e2e/courses.spec.ts` 失败场景：无 key 进入课节能读正文、答题与看解析；没有导入前置步骤；无默认 `/api/papers/ai` 调用；非法路径 404；继续入口指向最后节。

```ts
test('a course can be studied without imported material or an AI key', async ({ page }) => {
  const state = await installApiMocks(page, { signedIn: true });
  await page.goto('/courses');
  await page.getByRole('link', { name: /开始学习概率论与数理统计/ }).click();
  await expect(page.getByRole('heading', { name: /学习目标/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /查看解析/ }).first()).toBeVisible();
  expect(state.requests.some((item) => item.includes('/api/papers/ai'))).toBe(false);
});
```
- [ ] 扩展 `helpers.ts` 的 course snapshot/queue mocks；运行 `pnpm exec playwright test tests/e2e/courses.spec.ts` 证实新行为尚未实现。
- [ ] 实现入口、深链接、自测路由与目录，按相同阅读流接入记录；保留原侧栏和方向筛选。同步编写并核对 STAT-201 第一节真实讲义用于该任务的阅读验证（两个例题、六题，不用占位文案）；Task 5 继续完成其余概率课。已加载课节断网不清空内容或输入；未加载下一节明确显示需要联网。
- [ ] 若保留可选追问，使用折叠入口、主动点击才调用现有 AI 接口，只传当前课节上下文；原资料上传/必填 Key 界面退出课程主流程。
- [ ] 修订旧 UI ready 条件：不能依赖页面默认显示模型名；用真实目录/课节就绪状态。验证阅读、练习、导航和当前页断网作答，提交本任务。

### Task 5: 概率论与数理统计内容与逐门核验

**Files:** `content/courses/STAT-201/`、`docs/course-reviews/STAT-201.md`、共享独立计算脚本。

- [ ] 按 Task 1 固定清单编写全部预备/核心/进阶课节、作业与两套综合卷，纳入估计量评价、功效、非参数/秩检验、ANOVA 与回归衔接。
- [ ] 建立独立参考计算：密度归一与变量变换、MLE、方差/区间、检验统计量与功效；使用固定输入并声明解析方法/数值方法与容差，正文值不是唯一参考来源。
- [ ] 检查反例：密度可大于 1 而概率不可；相关为零但非独立；不同抽样设计；n 小时渐近近似；零方差数据不强算统计量。
- [ ] 运行 `pnpm run check:courses -- --course STAT-201` 和 `python scripts/verify-course-calculations.py --course STAT-201`（使用核实后的项目/捆绑 Python）。查看实际阅读与作业；修复后才标通过并提交。

### Task 6: 微观经济学内容与逐门核验

**Files:** `content/courses/ECON-204/`、`docs/course-reviews/ECON-204.md`。

- [ ] 编写本科中级课程全部内容和练习，补齐显示偏好、对偶/消费者剩余、要素市场、不确定性；按清单交付完整作业与两套卷。
- [ ] 独立求解 Cobb—Douglas、完全替代/互补、成本最小化、垄断/古诺/税收福利模型；同时核对图形与代数结论。
- [ ] 边界检查：角点、预算不足/零收入、无交易、税收后交易量、短长期退出、效率与分配不混用。
- [ ] 运行该门 `check:courses` 和计算复核命令，浏览器检查图形/推导与练习，记录实际状态，通过后提交。

### Task 7: 回归分析内容与逐门核验

**Files:** `content/courses/STAT-302/`、`docs/course-reviews/STAT-302.md`。

- [ ] 编写包括矩阵 OLS、推断、GLS、诊断、多项式、变量选择、定性变量、岭/PCR、稳健回归与 GLM 的全清单课节、作业和两套卷；提供原创小数据 CSV/字典/参考分析。
- [ ] 用独立线性代数与统计软件复算系数、标准误、区间、影响值和固定测试集预测；训练集拟合不冒称测试表现。
- [ ] 检查秩不足、n≤p、完美共线性、截距有无、异常值、稳健回归/稳健标准误区别、logit 分离及预测/因果边界。
- [ ] 运行该门内容/计算检查，实际打开案例和题目，标通过后提交。

### Task 8: 计量经济学内容与逐门核验

**Files:** `content/courses/ECON-301/`、`docs/course-reviews/ECON-301.md`。

- [ ] 编写全部课节，补齐 GLS、LR/Wald/LM、ARMA/VAR、单位根/协整；GMM/动态面板标进阶；现代 DID、事件研究另核对原始文献。准备固定模拟数据及完整参考报告、作业和两套卷。
- [ ] 独立复算 OLS/IV/FE 的固定数据结果、标准误、简单 DID 与 AR 例子；模拟生成器固定种子，不筛掉不显著结果。
- [ ] 检查弱/无效 IV、聚类层级、FE 不可识别常量、错位 DID、趋势伪回归、识别假设不足；开放报告题采用评分要点。
- [ ] 运行内容/计算检查，核对报告中的解释与假设，通过后提交。

### Task 9: 多元统计分析内容与逐门核验

**Files:** `content/courses/STAT-306/`、`docs/course-reviews/STAT-306.md`。

- [ ] 完整编写分布/推断/模型与方法，补齐 Wishart、SVD、多元线性模型、双标图、对应分析；较难图模型/SEM 标进阶，附数据、作业和两套卷。
- [ ] 独立复算协方差、T²、SVD/PCA、典型相关、因子与分类/聚类案例；比较结果允许特征向量符号和标签置换，检验实际不变量。
- [ ] 检查零方差标准化、奇异协方差、n/p 条件、训练测试泄漏、协方差/相关矩阵选择与因子旋转解释。
- [ ] 运行内容/计算检查，在浏览器检查矩阵、表格和解释，通过后提交。涉及库给出的特征向量/因子旋转不逐元素死比符号，验证重建、正交性与解释方差。

### Task 10: 国际贸易学内容与逐门核验

**Files:** `content/courses/TRADE-305/`、`docs/course-reviews/TRADE-305.md`。

- [ ] 全清单讲义、作业和两套卷，补齐标准贸易、偏向增长、有效保护、倾销条件与要素跨国流动；深化异质企业/引力/GVC 时记录额外依据。
- [ ] 独立复算机会成本、相对价格/工资范围、收益、要素价格、关税/配额福利和有效保护率；构造数据注明模拟性质。
- [ ] 检查小国/大国、内点/专业化边界、无进口情形、贸易总额/增加值及历史政策的日期口径。
- [ ] 运行内容/计算检查，检查贸易图形和政策论证，通过后提交。

### Task 11: 国际金融内容与逐门核验

**Files:** `content/courses/FIN-308/`、`docs/course-reviews/FIN-308.md`。

- [ ] 全清单讲义、作业和两套卷，补齐弹性/吸收/货币分析、马歇尔—勒纳与 J 曲线、国际货币体系；配统一报价的数值案例与历史资料。
- [ ] 独立复算交叉汇率、CIP 远期、实际汇率、简单开放经济政策模型和风险敞口；任何数字都先标明报价方向和单位。
- [ ] 检查反向标价、交易成本、CIP/UIP 区别、收支记账约定、固定/浮动模型条件与事实时效；不写收益承诺。
- [ ] 运行内容/计算检查和阅读练习检查，通过后提交。

### Task 12: 完整验证与交付审阅

**Interfaces:** 消费全部课程与 cloud API；只提供实测报告，不扩大为未验证教学认证。

- [ ] `tests/e2e/course-sync.spec.ts` 验证多设备/不同课节、断网再刷新恢复记录、503、换账号、重置后旧队列、题目改版；mock 与真实服务测试分别记。
- [ ] 全部七门 `pnpm run check:courses` 与独立计算脚本通过，coverage 不能有缺失核心目标或待检查例题。抽查每门推导和开放题过程，修复共享错误后复查受影响课程。
- [ ] 更新 README/PRODUCT 的课程行为、编写来源和核验范围，去掉被当前域名部署事实取代的旧能力描述时以实际证据为准。
- [ ] 运行 typecheck、lint、unit、相关/全量 E2E 与 production build；针对实际页面变更更新视觉基线并执行课程 a11y/小屏/长内容检查，不盲目接受整站截图变更。
- [ ] 形成 `docs/course-reviews/release.md`：逐门状态、具体内容清单、计算验证、账户隔离与同步证据、未验证事项、修改范围和回退点。真实云端不可验证或课程未完，不声称全范围完成。
- [ ] 展示本地/预览中的课程学习与配套练习供用户审阅；生产迁移、合并和发布作为最后上线步骤再按实际授权执行。发布后核对 `acaora.cn/api/version`、无 key 学习路径和真实账号学习记录，保留原数据。

## 执行与验收边界

用户已要求由本代理逐门把关，计划默认本会话原生顺序执行，不擅自创建新聊天或并行内容代理。实施计划须先由用户审阅；审阅后使用 executing-plans 按任务推进。实际教学效果与学科专家审阅不由软件测试或本代理自评替代。
