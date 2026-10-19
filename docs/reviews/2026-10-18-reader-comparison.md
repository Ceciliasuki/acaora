# Zotero Reader 与 PaperLab：功能比较及本轮落地

日期：2026-10-18（Asia/Shanghai）。开发基线：`c194725`；分支：`codex/reader-navigation-2026-10-18`。

## 项目识别与证据边界

用户已确认研究对象为 [zotero/reader](https://github.com/zotero/reader)，即 Zotero 的 PDF/EPUB/HTML 阅读器。本报告的源码核查、功能比较及本轮落地均对应此仓库。

源码核查固定在 `4bfd82ee848e36e80aaff2a2c732615c89ad1e72`。结论依据 README 和实现代码，未在本机安装或运行完整 Zotero；没有据此声称其功能在所有平台完全一致，也没有进行速度、准确率或用户效率的比较实验。

| 一手证据 | 可核实内容 |
| --- | --- |
| [README](https://github.com/zotero/reader/blob/4bfd82ee848e36e80aaff2a2c732615c89ad1e72/README.md) | PDF/EPUB/HTML reader and annotator；可构建 dev/web/zotero 多种目标 |
| [工具栏](https://github.com/zotero/reader/blob/4bfd82ee848e36e80aaff2a2c732615c89ad1e72/src/common/components/toolbar.js) | 页码、缩放、返回、查找；高亮、下划线、便笺、文本、区域、手绘等工具；部分能力受平台和阅读模式条件限制 |
| [侧栏](https://github.com/zotero/reader/blob/4bfd82ee848e36e80aaff2a2c732615c89ad1e72/src/common/components/sidebar/sidebar.js) | PDF 缩略图、批注、目录视图切换；目录搜索与展开状态管理 |
| [文内查找](https://github.com/zotero/reader/blob/4bfd82ee848e36e80aaff2a2c732615c89ad1e72/src/common/components/view-popup/find-popup.js) | 查询、前后匹配导航与查找选项 |
| [批注列表](https://github.com/zotero/reader/blob/4bfd82ee848e36e80aaff2a2c732615c89ad1e72/src/common/components/sidebar/annotations-view.js) | 颜色、标签、作者等筛选以及批注定位与编辑交互 |
| [阅读器状态](https://github.com/zotero/reader/blob/4bfd82ee848e36e80aaff2a2c732615c89ad1e72/src/common/reader.js) / [历史](https://github.com/zotero/reader/blob/4bfd82ee848e36e80aaff2a2c732615c89ad1e72/src/common/lib/history.ts) | 主/副阅读视图、分屏状态、独立查找状态；前进/返回与显式导航历史 |
| [许可](https://github.com/zotero/reader/blob/4bfd82ee848e36e80aaff2a2c732615c89ad1e72/COPYING) | AGPLv3；不能把它当作 MIT 组件直接复制进当前项目 |

## 判断：借鉴阅读操作，保留研究台的用途

Reader 的强项是围绕原始文档版面进行导航和标记。PaperLab 的用途更偏向提取正文的连续阅读、翻译、笔记与可追溯 AI 分析。这两种定位不能直接用功能数量排名。

下表的 PaperLab 状态由本次实际代码核查确认，而非沿用旧发布记忆。UI 基线也已通过当前本地服务截图确认，旧视觉回归图片与当前页面存在差异，没有用旧图作为改版依据。

| 功能或交互 | Reader 的实现 | 当前 PaperLab | 本轮取舍 |
| --- | --- | --- | --- |
| 原文版式与图表 | PDF 原生阅读视图、页码和缩放 | 提取正文为主；独立原 PDF 窗口用 canvas 展示原页、保存本设备页码与缩放 | 保留现有原 PDF 能力；不把提取文本误称为完整 PDF 阅读引擎 |
| 长文导航 | 可检索目录、PDF 缩略图 | 横向章节工具带；长标题和多章节需要横向滚动 | **新增可筛选的纵向章节目录**，展示起始页和段落数；横向快捷章节保留 |
| 文内查找 | 查找栏、匹配导航及选项 | 原来只有跨论文公共索引检索，没有文内查找 | **新增当前论文原文查找**，显示匹配段落、源页、片段和原文高亮；Enter/Shift＋Enter 与前后按钮循环定位 |
| 批注回顾 | 可检索列表、颜色/标签/作者筛选 | 高亮和评论可定位、编辑、删除，原来全部顺序展示 | **新增摘录/评论/章节文字搜索、颜色筛选、有评论筛选和一键清除**；不增加无实际多人场景的作者筛选 |
| 来源定位与返回 | 前进/返回历史，主副视图定位 | 已有来源预览、准确段内偏移返回、固定笔记 | 复用现有阅读轨迹，让目录和查找也进入同一定位链 |
| 双视图对照 | 主/副阅读视图、分屏状态 | 固定笔记，不等于第二个原文视图 | 作为后续候选；本轮没有冒称已经实现分屏对照 |
| 标记类型 | 高亮、下划线、区域、便笺、手绘等 | 提取正文的文字高亮/评论、段落收藏与笔记 | 暂缓区域和手绘批注：需要原 PDF 坐标、缩放变换、文本层及新的锚点模型 |
| 格式覆盖 | PDF/EPUB/HTML | 以英文文本层 PDF 为主 | 暂不扩展格式；阅读台现有瓶颈优先于格式数量 |
| AI、翻译和公共检索 | 本次 Reader 核查没有把这些视为仓库自身已实现的完整能力 | 本地翻译、段落证据引用、AI 分析、公共元数据检索 | 保留研究工作流；不把 Zotero 生态插件能力算作 Reader 自身功能 |

## 本轮界面与实现

- 目录与查找放在原有章节工具带左侧，以紧凑的图标和文字按钮出现；手机保留有可访问名称的图标按钮。没有改动总览或其他工作台。
- 目录和查找使用非模态原生 popover。它位于浏览器顶层，避免被阅读区的 overflow 裁切；按 Escape 或点击外部关闭。关闭按钮/Escape 返回触发按钮；定位正文后保留清晰的操作焦点。
- 打开目录不改变阅读位置；明确选择章节才定位。目录仅使用现有提取段落中的章节信息，不伪造 PDF 的层级目录或漏失章节。
- 查找按原文逐字匹配，可区分大小写。计数单位是匹配的段落，不是出现次数；每段内的所有命中均高亮。结果列表展示前 100 段，前后按钮遍历全部匹配段落，并有明确说明。
- 查找输入和选项不写入云端。每篇论文和账户由既有组件 key 隔离。Ctrl/⌘＋F 仅在阅读区内接管，其他输入区保留浏览器原有快捷键行为。
- 高亮以安全 React 文本节点呈现，不使用 HTML 拼接、不改写原文或批注。源 UTF-16 偏移与既有批注锚点保持一致；清除查找可移除全部搜索高亮。
- 筛选只改变批注列表呈现，沿用已有记录和编辑、删除、定位动作。没有数据库迁移、同步协议变更、原 PDF 上传或付费 AI 调用。

核心文件：`app/papers/reader-navigator.tsx`、`reader-find.ts`、`continuous-reader.tsx`、`annotation-panel.tsx` 及两个局部 CSS Module。

## 验证与交付状态

2026-10-19 后续：已继续加入固定原文对照、批注摘录集及 PDF 页览，见 [深入学习记录](2026-10-19-reader-workflow.md)。后续诊断也确认了阅读器用整数宽度判断重排会漏掉小数宽度变化，现已修复；下文保留第一轮当时的验证过程，等待视口本身不等同于后续的根因修复。

- `node --test tests/reader-find.test.mjs`：3 项通过，覆盖正则字符的字面匹配、空查询、Unicode/UTF-16 偏移、大小写、重复命中和源数据不变。
- `pnpm exec playwright test tests/e2e/reader-navigation.spec.ts tests/e2e/paper-layout.spec.ts tests/e2e/paper-interactions.spec.ts tests/e2e/paper-annotations-search.spec.ts --reporter=list`：最终 24 项全部通过，其中新增 6 项。覆盖查找与已有批注交叠、搜索高亮下新增批注的精确偏移及刷新恢复、目录/返回、筛选、论文切换隔离、移动布局，以及既有笔记、预览、同步与公共检索。
- `pnpm build`：优化生产构建和内置 TypeScript 检查通过。构建流程要求的课程结构检查同时通过，不能把它表述为本轮新增的学科内容复核。相关文件 ESLint、独立 TypeScript 检查和 `git diff --check` 通过。
- 已打开核对 [桌面查找](../../outputs/reader-navigation-2026-10-18/find-desktop.png)、[桌面批注筛选](../../outputs/reader-navigation-2026-10-18/annotations-desktop.png)、[手机目录](../../outputs/reader-navigation-2026-10-18/outline-mobile.png)、[手机查找](../../outputs/reader-navigation-2026-10-18/find-mobile.png)。截图使用受控测试记录，不是用户真实论文。新增浮层与既有阅读布局的 axe 严重/关键问题检查通过，不代表完整无障碍认证。

回归中发现原有 `PAPER-18` 在桌面宽度过渡尚未结束时立即读取标题坐标，得到 82.56px，而阅读区上沿约为 155.98px。临时恢复基线 `c194725` 的三个原阅读组件文件进行 A/B 后，同一检查以相同坐标失败；已确认不是新增查找/目录特有的问题。最终测试先等待目标标题进入视口，再执行原有的阅读区边界断言；没有删除或放宽该边界断言。诊断中的试验性定位/滚动锚点改动全部撤回，未对原有位置算法作额外修改。

本轮交付为可运行的未提交本地修改和对比依据，未部署到正式站。预览：`http://127.0.0.1:3210/papers`（Next 开发服务）。`/api/version` 标识基线提交，不能代替本轮未提交修改的发布身份。没有声称全站完整回归或真实生产账号验收。

当前限制：查找仅覆盖已提取原文，不覆盖译文、扫描图片或尚未识别的公式；目录质量受原有 PDF 文本提取和章节识别限制。浏览器模拟移动布局不等同于真实手机软键盘或辅助技术验收。未进行真实长论文的效率实验，不能据此声称优于 Zotero。
