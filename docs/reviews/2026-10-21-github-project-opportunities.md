# GitHub 外部项目搜寻：ACAORA 下一阶段可借鉴与复现的能力

日期：2026-10-21。ACAORA 适配基线：主分支 `89c1ec9fce3ca27d7945fb68acfec4d5a9388179`。本轮仅做选型与建议，不修改应用、不安装依赖、不部署。

后续实施记录：[第一批、第二批研究工作流](./2026-10-21-research-workflows-implementation.md)。下文保留选型阶段的范围与判断。

## 研究方式与边界

通过 GitHub 连接器搜索文献管理、PDF 批注、浏览器数据分析、统计可视化、双向链接笔记等方向，再读取候选的 README、仓库许可元数据及关键 package/types/manifest/教学页面。宽泛多关键词搜索出现较多低相关结果，随后使用领域关键词、项目名和 stars 门槛缩小候选；星数仅用于初筛，不作质量评分。

下面的功能是文档或源码已声明的能力；优先级、适配方式和成本是针对 ACAORA 的判断。没有安装运行这些外部项目，未测包体积、内存、真实文件表现或用户效率。当前能力不等于其所有第三方 API 仍可用，浏览器扩展的权限也不等于普通网站具备的权限。

## 入选项目及可复现的最小范围

| 项目 | 已核查的能力 | ACAORA 可复现的部分 | 方式与相对成本 |
| --- | --- | --- | --- |
| [Paperlib](https://github.com/Future-Scholars/paperlib) | 元数据抓取、全文/高级搜索、标签/文件夹、笔记；桌面 Electron/Vue 应用 | 文献详情中分开显示作者、年份、期刊、DOI、来源及待确认状态；按研究主题组织论文库 | 独立复现流程，成本中。GPL-3.0，不直接复制到当前 MIT 项目；默认分支为 `chore/official-sync` |
| [PaperMemory](https://github.com/vict0rsch/PaperMemory) | 浏览器扩展；自动记录论文、预印本/发表版匹配、标签、BibTeX 和 JSON 导入导出 | DOI/原链接与版本关系、复制书目引用、研究记录备份；先以用户主动导入为入口 | MIT。借鉴数据模型与流程，成本中；不承诺普通网页自动读取其他标签页。其 PapersWithCode 等外部服务只见文档声明，未验证在线可用性 |
| [Citation.js](https://github.com/citation-js/citation-js) | 模块化 BibTeX、RIS、CSL 等格式转换；含 DOI 输入插件 | 将已确认书目信息导出 BibTeX/RIS；原文摘录与个人评论继续分开，不自动补写缺失作者/年份 | MIT，可考虑按需引入兼容模块，成本小至中。当前 `plugin-bibtex` 0.9.0 声明 Node >=22.12.0，而 ACAORA 固定 22.11.0，不能直接无条件安装最新版 |
| [Seeing Theory](https://github.com/seeingtheory/Seeing-Theory) | D3 交互教学；已读页面确认中心极限定理、置信区间反复抽样、bootstrap 等交互 | 在已有课程内容旁放一个可调整样本量/置信水平的实验，再让学生解释图中变化；先做一个实验 | 独立复现数学与交互，成本中。README 明确停止维护；LICENSE 是 Apache-2.0，README 又提出教育/非商业使用要求，复制代码或素材前须厘清范围。本轮建议不移植其老前端依赖 |
| [sqliteviz](https://github.com/lana-k/sqliteviz) | 浏览器端离线 CSV/JSON/SQLite 分析与可视化；查询方案可保存、重用于另一数据库并导入导出 JSON | DataLab 保存一份“分析方案”：方法、变量映射、缺失值规则、图形设置和数据标识；换数据后检查字段，再显式重跑 | Apache-2.0。复现方案管理，不整站移植 Vue/SQL 引擎；复用 ACAORA 的现有统计计算，成本中 |
| [SilverBullet](https://github.com/silverbulletmd/silverbullet) | Markdown 页面、双向链接、任务、对象/查询；当前架构含 Preact 前端、Rust 服务和 Lua 环境 | 从论文摘录加入项目研究笔记；保留 paperId、paragraphId、页码、原句及评论，支持从项目回跳来源 | MIT。独立实现来源链接，成本中；不接入完整服务器、脚本运行时或通用知识库平台 |
| [Graphic Walker](https://github.com/Kanaries/graphic-walker) | 可嵌入 React 的字段拖拽可视化、维度/度量、聚合、分面；支持 worker 计算及保存探索结果 | 在 DataLab 中增加按需打开的“探索图表”：先做散点/分组柱状/分面，显示聚合与缺失值口径 | Apache-2.0，可做组件隔离原型，成本中至高。依赖面较大，需实测加载与内存；先使用普通本地探索能力，独立评估其可选语言/聊天功能 |
| [react-pdf-highlighter](https://github.com/agentcooper/react-pdf-highlighter) | PDF.js 文本/图像选区批注、批注浮层和定位；位置包含页码与缩放坐标 | 在原 PDF 视图选择图表或文字并回访，建立“坐标锚点”到现有段落证据的映射 | MIT，成本高。其 package 使用 PDF.js 4.4.168，ACAORA 使用 ^6.2.108；当前批注是 UTF-16 源文本偏移，不能简单换组件。先做不影响现有阅读与同步的原型 |

## 建议实施顺序

### 1. 文献资料与引用闭环

结合 Paperlib、PaperMemory、Citation.js，先实现“确认论文书目信息 → 加标签 → 保存带来源摘录 → 导出书目和研究记录”。已有 DOI 检索和 Markdown 笔记导出应复用。第一步只做单篇书目信息确认及 BibTeX 导出，继而再做整库可恢复备份；不是一次同时改库结构、自动抓取、跨站扩展及全量云同步。

建议验收：缺元数据明确显示缺失；人工确认不会被后续抓取覆盖；导出不把个人评论算作原文；重复 DOI 提示核对；备份可在隔离空间恢复，且不包含凭据/API Key。原 PDF 仍按设备端约束处理。

### 2. 在现有课程中增加一个可操作实验

参考 Seeing Theory，从“置信区间的重复抽样覆盖”或“样本量与均值分布”选一个。保留现有讲解和课程身份；用采样、暂停、重置和参数调节让学生看到变化，并给出解释问题。可固定随机种子重现一次演示，避免随机动画与文字结论不一致。

建议验收：计算与图形相符；小样本、偏态等条件不被隐去；键盘可调参；减少动态效果时可显示静态结果。不把画面更丰富直接等同于学习效果更好。

### 3. DataLab 的分析方案保存与重跑

参考 sqliteviz 的 inquiry 复用。保存计算配置和数据匹配依据，重新载入文件后先验证字段及类型，再显式执行。图表探索适合作为下一层；Graphic Walker 先做加载隔离原型，通过性能与数据流检查后再决定集成。

建议验收：更换数据不会显示旧结果为新结果；数据缺列、类型变化给出明确提示；同数据与同参数可复现；分析方案不等同于完整原始数据备份。

后续再做 SilverBullet 式项目证据链接。原 PDF 坐标批注属于独立技术阶段；不要和文献元数据、课程交互、可视化引擎同时推进。

## 关键源码证据

- [Paperlib package.json](https://github.com/Future-Scholars/paperlib/blob/chore/official-sync/package.json)：Electron/Vue 构建方式及 GPL-3.0；[README](https://github.com/Future-Scholars/paperlib/blob/chore/official-sync/README.md)：整理、元数据与检索能力。
- [PaperMemory Readme](https://github.com/vict0rsch/PaperMemory/blob/master/Readme.md)：文献记录、版本匹配、JSON/BibTeX；[manifest](https://github.com/vict0rsch/PaperMemory/blob/master/manifest.json)：扩展及跨站权限。
- [Citation.js README](https://github.com/citation-js/citation-js/blob/main/README.md)、[BibTeX 包](https://github.com/citation-js/citation-js/blob/main/packages/plugin-bibtex/package.json)：模块格式与 Node engine。
- [Seeing Theory README](https://github.com/seeingtheory/Seeing-Theory/blob/master/README.md)、[LICENSE](https://github.com/seeingtheory/Seeing-Theory/blob/master/LICENSE)、[频率推断页面](https://github.com/seeingtheory/Seeing-Theory/blob/master/frequentist-inference/index.html)、[分布页面](https://github.com/seeingtheory/Seeing-Theory/blob/master/probability-distributions/index.html)：维护与许可说明、实验交互。
- [sqliteviz README](https://github.com/lana-k/sqliteviz/blob/master/README.md)：客户端处理及 inquiry 导入导出。
- [SilverBullet README](https://github.com/silverbulletmd/silverbullet/blob/main/README.md)：双向链接和当前运行架构。
- [Graphic Walker README](https://github.com/Kanaries/graphic-walker/blob/main/README.md)、[package](https://github.com/Kanaries/graphic-walker/blob/main/packages/graphic-walker/package.json)：React 嵌入、探索交互、依赖。
- [PDF highlighter 类型](https://github.com/agentcooper/react-pdf-highlighter/blob/main/src/types.ts)、[package](https://github.com/agentcooper/react-pdf-highlighter/blob/main/package.json)：坐标锚点与 PDF.js 版本。
- [ACAORA package](https://github.com/Ceciliasuki/acaora/blob/89c1ec9fce3ca27d7945fb68acfec4d5a9388179/package.json)、[数据类型](https://github.com/Ceciliasuki/acaora/blob/89c1ec9fce3ca27d7945fb68acfec4d5a9388179/app/papers/paper-types.ts)：当前运行时、PDF.js 与段落偏移约束。

仓库未归档不代表持续维护，README 承诺不代表本轮已验证；真正集成时还需固定具体版本和逐项检查第三方许可与资源。本轮未运行网站回归，因为没有应用改动。
