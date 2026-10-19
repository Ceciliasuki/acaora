# Zotero Reader 深入学习：从功能入口到研究工作流

日期：2026-10-19（Asia/Shanghai）。接续 [第一轮对比](2026-10-18-reader-comparison.md)，研究对象已经由用户确认。本轮在同一分支 `codex/reader-navigation-2026-10-18` 继续开发；仍为本地未提交修改，未部署。

## 这次重新检查了什么

第一轮补充了目录、文内查找与批注筛选。这次进一步阅读同一固定版本 `4bfd82ee848e36e80aaff2a2c732615c89ad1e72` 的主副视图状态、分隔条、批注管理、宿主接口、页览与历史代码，研究它们如何连接成完整操作。下列是源码事实；本轮没有安装完整 Zotero，也没有用合成测试宣称真实论文任务效率提升。

| 学习点 | 源码证据与实际机制 | 对研究台的判断 |
| --- | --- | --- |
| 两处原文同时阅读 | [reader.js](https://github.com/zotero/reader/blob/4bfd82ee848e36e80aaff2a2c732615c89ad1e72/src/common/reader.js) 分别保存主/副视图位置、查找和浮层状态；[分隔条](https://github.com/zotero/reader/blob/4bfd82ee848e36e80aaff2a2c732615c89ad1e72/src/common/components/split-view-resizer.js) 支持横/纵分屏及宽度限制 | 应让方法段落固定、结果部分继续阅读。固定笔记不能代替第二处原文；本轮增加独立原文对照窗 |
| 预览发展为持续对照 | Reader 将选区、批注浮层、视图和定位视为不同状态 | 沿用已存在的原文预览，增加“固定为对照”，明确选择后才改变布局，预览本身仍不移动主位置 |
| 批注变成可用的笔记材料 | [context-menu.js](https://github.com/zotero/reader/blob/4bfd82ee848e36e80aaff2a2c732615c89ad1e72/src/common/context-menu.js) 允许多条批注调用 `_onAddToNote`；[reader.js](https://github.com/zotero/reader/blob/4bfd82ee848e36e80aaff2a2c732615c89ad1e72/src/common/reader.js) 从宿主选项接收 `onAddToNote` | 这是 Reader 与 Zotero 宿主的协作能力，不能当作独立阅读库自带完整笔记系统。本轮用现有批注生成可下载/复制的来源摘录，避免增加另一份笔记数据库 |
| 原文顺序是数据约束 | [annotation-manager.js](https://github.com/zotero/reader/blob/4bfd82ee848e36e80aaff2a2c732615c89ad1e72/src/common/annotation-manager.js) 按 `sortIndex` 排序，文字、评论、页标签及位置分别存放 | 摘录导出应按原文位置排序，保留原句、章节、P 编号和页码，个人评论单独列出；最近添加仅是回顾视图的另一种排序 |
| 用页面形状找图表 | [thumbnails-view.js](https://github.com/zotero/reader/blob/4bfd82ee848e36e80aaff2a2c732615c89ad1e72/src/common/components/sidebar/thumbnails-view.js) 用 IntersectionObserver 通知可见页渲染，并提供键盘定位 | 本轮增加原 PDF 页缩略图导航，限于可见和邻近页创建画布，避免导入长文后一次性渲染全部页 |
| 翻页与返回是阅读状态 | [history.ts](https://github.com/zotero/reader/blob/4bfd82ee848e36e80aaff2a2c732615c89ad1e72/src/common/lib/history.ts) 将普通位置变化与显式导航区分，维护前后历史 | 继续复用已实现的主阅读返回轨迹。副窗换段不应自动写入主历史或把主笔记换到另一段；只有“定位/交换”才发生主导航 |
| 撤销不能只回填旧快照 | [annotation-manager.js](https://github.com/zotero/reader/blob/4bfd82ee848e36e80aaff2a2c732615c89ad1e72/src/common/annotation-manager.js) 的 undo/redo 对恢复删除重新分配 ID，并对外部变化调用 `_clearInterferingHistory` | 全面批注撤销涉及同步冲突，不应直接用旧整篇论文覆盖新记录。本轮未实现跨云端的全量撤销/重做，也未修改既有同步协议 |
| 文档编辑与阅读显示不同 | [context-menu.js](https://github.com/zotero/reader/blob/4bfd82ee848e36e80aaff2a2c732615c89ad1e72/src/common/context-menu.js) 的旋转/删除页部分依赖宿主文档操作 | 本轮只增加查看方向旋转并记忆设备偏好，不改写原 PDF，也不删除页面，从而不破坏既有页码和原文锚点 |
| 状态可读、操作可用 | 工具栏、目录、页览具有键盘交互；部分内部控件依赖 Zotero 的统一焦点管理 | 学习操作目的，不复制 `role=application` 或 `tabIndex=-1`。研究台用原生按钮/复选框，分隔条提供带值的 separator 和方向键/Home/End 控制 |
| 保持产品边界 | Reader 还有 EPUB/HTML、手绘、区域批注、外观、朗读等能力；部分与平台和宿主能力有关 | 这些不是一次添加图标即可得到。当前文字批注使用 UTF-16 源偏移，图片/手绘需要 PDF 坐标和文本层。先完成本轮可持续的阅读链，维持既有浅色学术界面 |

## 已加入的具体工作流

### 固定原文对照

桌面“原文对照”从当前段落打开；批注或笔记汇总的原文预览也可以选择“固定为对照”。右侧原文保留自己的段落选择和滚动，主阅读区可继续去另一章，已有笔记仍属于主阅读段落。

对照窗支持上一/下一段、完整段落选择、替换为当前段落、已有译文开关、明确定位主阅读区和交换两处位置。宽度可拖动，也可用左右方向键、Home/End 调节，双击恢复默认比例。拖动开始时固定主阅读锚点，在宽度提交后恢复该锚点，避免正文重排把笔记上下文移到相邻段落。关闭回到触发按钮。

它是**已提取文字的固定对照窗**，不等同于完整第二 PDF 视图或两个文件对读。与笔记面板共用右侧空间；不会同时挤出三个常驻侧栏。手机保持单栏阅读和现有笔记标签；桌面对照窗在窄屏隐藏。

### 批注摘录集

在批注列表逐条选择，也可选择当前筛选结果。更换筛选不清空已选条目，会明确提示仍包含其他筛选中的批注。选择键同时包含段落 ID 和批注 ID，避免跨段重号导致误选。列表支持原文顺序和最近添加排序。

导出的 Markdown 或复制内容保留论文标题、原文件名、章节、P 编号、PDF 页码、精确摘录与单独标注的个人评论。导出始终使用原文顺序；不会把个人评论当作论文原句，不生成缺少元数据依据的作者/年份引文。剪贴板拒绝时保留选择并提示改用下载。选择、筛选和复制反馈只属于当前 UI；不会修改已有批注或段落笔记。

### 原 PDF 页览与方向

在“查看原 PDF”中打开“页面缩略图”，点击或用方向键/Home/End 跳页。页览、页码输入和主画布保持一致。缩略图只在可见和邻近范围创建画布，离开范围会移除画布并取消未完成渲染；缩略图失败仍可使用页码按钮。

增加顺时针 90° 查看旋转，并与原有页码/缩放一起记忆到当前账户、论文的设备偏好。原始字节仍只在设备端，画布继续保持内存上限；没有将 PDF 发往服务器。旋转不改变原文件页码、提取文字、批注位置或云数据结构。

## 依据、成本和未做的部分

这是对公开功能和交互机制的独立实现，未复制 AGPLv3 源码到 MIT 项目。无新运行时依赖，无数据库迁移，无新增付费 API。新增复杂度主要集中在独立对照状态、拖动位置保护、选择导出和页览生命周期。

未做：原 PDF 文本层批注、区域/手绘锚点、OCR、跨文件对照、完整第二 PDF 引擎、朗读、全量批注撤销/重做。下一步应先明确 PDF 文本层与坐标锚点如何同现有段落记录对应，再决定这些能力；不能把当前文字高亮改个外观就称为 PDF 原生批注。

## 验证与交付

- 新增的 7 个 E2E 场景均取得通过证据，覆盖独立对照位置、指针/键盘调宽、位置交换与译文、预览转对照、论文隔离、跨筛选选择与摘录导出、剪贴板失败恢复、页览键盘导航、旋转刷新恢复、80 页受控 PDF 的可见范围渲染，以及桌面/手机界面和 axe 严重/关键问题检查。
- 本轮相关回归覆盖 35 个不重复场景。首次整批 34 项通过，原有 `PAPER-18` 断点续读失败；修复精确宽度观察后，最终 16 项受影响的定位、笔记和布局场景全部通过。对与该修复无关、已有有效通过证据的导出和 PDF 场景复用证据，没有再跑完整全站回归。见 [35 项诊断记录](../../outputs/reader-workflow-2026-10-19/related-e2e.log) 和 [最终 16 项记录](../../outputs/reader-workflow-2026-10-19/final-position-proof.log)。
- 断点问题的原因是 `clientWidth` 取整数，而小于 1px 的宽度变化仍可能触发段落换行，使两处已读文本高度发生变化。现在使用 ResizeObserver 的 `contentRect.width` 捕获精确变化；原有段落 ID、视口和边界断言保留。对照窗拖动另外在布局提交前后保护已捕获的主阅读锚点。
- `node --test tests/annotation-collection.test.mjs`：新增 2 项单测通过，验证来源顺序、精确多行摘录、个人评论分离、不改源记录及跨段选择键隔离。上一轮单测证据在对应源文件未变时复用。
- 最终 `pnpm build`、内置 TypeScript 检查、相关文件 ESLint 和 `git diff --check` 通过，见 [最终构建日志](../../outputs/reader-workflow-2026-10-19/final-build.log)。上一轮诊断备份的 `.tsx` 已保留并改为 `.tsx.txt`，避免误入源码编译。
- 已打开检查 [桌面对照](../../outputs/reader-workflow-2026-10-19/comparison-desktop.png)、[桌面摘录集](../../outputs/reader-workflow-2026-10-19/collection-desktop.png)、[手机摘录](../../outputs/reader-workflow-2026-10-19/collection-mobile.png)、[桌面 PDF 页览](../../outputs/reader-workflow-2026-10-19/pdf-pages-desktop.png)、[手机 PDF 页览](../../outputs/reader-workflow-2026-10-19/pdf-pages-mobile.png)。最终截图检查显式等待对照窗存在并确认两处段落位置，避免截图生成过程中的开发热刷新把关闭的界面当作对照效果。截图来自受控记录，未修改用户真实论文。

边界：80 页是合成文本层 PDF，不是任意复杂论文性能承诺；真实手机软键盘、真实辅助技术、扫描 PDF 和超长图表文档尚未实测。axe 检查不代表完整无障碍认证。未调用付费模型，未上传原 PDF，未修改账户或同步协议，未部署。

本地预览仍为 `http://127.0.0.1:3210/papers`。工作区未提交，构建元数据仍标识基线 `c1947251201e529c92fd6e3bb64fc445a38244d9`，不能以该 SHA 声称本轮已上线。上一轮 24 项记录保留为第一轮历史证据。
