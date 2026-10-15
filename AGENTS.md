# 项目永久工作约束

## 检验范围与停止条件

- 不要做无关、无用或重复的检验。
- 只执行与本次改动直接相关、能解决实际疑点或满足必要发布门槛的最小检验集合。
- 已有有效的通过证据且相关代码、配置、环境未变化时，复用该证据，不重复运行测试、构建、页面巡检或版本核对。
- 只有新增改动、失败、明确的未决风险或必要发布要求，才追加对应检验；不得为凑流程扩大范围。
- 必要检验通过、目标已达成后立即收尾，不再循环自检或添加无关优化。

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
