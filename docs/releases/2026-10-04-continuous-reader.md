# 论文全文连续阅读发布记录

2026-10-05 已整合到主工作区。本文为 2026-10-04 的历史验收，原始日志和截图仍保留在 `C:\Users\Cecilia\.codex\worktrees\curated-courses\acaora\outputs`。本次新执行结果见 [真实使用验收](../acceptance/2026-10-05-real-use.md)。

2026-10-04。正式入口：https://acaora.cn/papers

## 已发布行为

整篇提取正文连续呈现，向下滚动阅读；章节按钮直接跳转。译文可显示或隐藏。已有段落 ID、笔记、收藏、手动已读和 AI 上下文继续使用原有数据。桌面正文在阅读区滚动，手机在页面中滚动。短结论段到达底部时成为当前段落；聚焦正文后，方向键与 Home/End 可选择短段落。迟到的设备端翻译仅合并译文，保留同时发生的编辑，并拒绝跨论文或账户的过期结果。

当前阅读内容为 PDF 提取文本，不重建原 PDF 图表或版式。无数据库迁移、API、依赖或域名变更。

## 版本与检查

- PR：https://github.com/Ceciliasuki/acaora/pull/10，已合并。
- 测试提交：d3a85502169ef23d8fe515b069a64cc434ac660e。
- 正式合并提交：cb2165aa8ef7bafa2978a7e56731d38e993c7f7b。合并树与测试树一致。
- CI 37172902565：类型、完整 lint、68 单元检查、构建、70 浏览器检查和跟踪文件整洁性通过；浏览器检查无重试。
- 独立复核：无遗留 Critical/Important；发现的短结论定位和登录后示例翻译问题已用先失败后通过的回归验证修复。
- 最终 Windows 视觉检查：9/9 通过。
- 早期本地并行 lint 时两项旧同步检查超时，未修改超时或断言，独立复查及最终 CI 均通过。额外整套本地复跑在 62 项附近因会话终止中断，不作为整套通过证据。
- EdgeOne dp0xkimlfwru：成功，控制台显示本次合并 SHA；构建及发布 145 秒。
- 正式 /api/version：HTTP 200，production，cb2165aa8ef7bafa2978a7e56731d38e993c7f7b。
- 真实普通临时账号：25 项同源检查通过；两份独立浏览器存储均恢复云端笔记和阅读位置，短结论定位、手动已读、刷新、手机无横向溢出通过。浏览器直连 Supabase 请求为 0。
- 清理验证：临时账号、身份、会话、测试论文均为 0；本地凭据文件已移除。未触碰真实用户数据。

## 证据与边界

CI 日志：continuous-reader-ci.log。真实站点日志：continuous-reader-live.log。最终视觉日志：continuous-reader-final-visual.log。桌面和手机实际站点截图：continuous-reader-live-desktop.png、continuous-reader-live-mobile.png。初始截图在无头浏览器首次绘制前出现空白，最终截图等待正文可见并经原生 scrollIntoViewIfNeeded 触发绘制；正常 Edge 页面另外目视确认。

设备翻译使用显式测试桩验证异步行为，不声称实际模型可用性、翻译质量或邮件投递已验证。超大论文性能未做专项压力测试。既有快速切换论文前的防抖保存和异步 AI 回调范围问题未在本次扩大修改。
