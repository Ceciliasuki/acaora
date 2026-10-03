# Acaora 学曦

面向大学生的开源智能学习与研究平台，把课程学习、论文研究、数据分析和项目管理放在同一个工作台中。

[![使用 EdgeOne Pages 部署](https://cdnstatic.tencentcs.com/edgeone/pages/deploy.svg)](https://edgeone.ai/pages/new?repository-url=https%3A%2F%2Fgithub.com%2FCeciliasuki%2Facaora&repository-name=acaora&project-name=acaora&install-command=pnpm%20install%20--frozen-lockfile&build-command=pnpm%20run%20build&output-directory=.next&env=SITE_URL%2CSUPABASE_URL%2CSUPABASE_PUBLISHABLE_KEY%2CDEEPSEEK_API_KEY%2CDEEPSEEK_MODEL%2CACAORA_ENVIRONMENT)

## 主要功能

- 学习总览：统一查看课程、研究任务和近期进度。
- 课程中心：七门安排好的课程，无需导入资料或填写模型 Key。每节默认核心讲解、一个完整例题和三道练习；扩展内容可选展开，每门一个综合案例。
- PaperLab：检索英文论文、阅读 PDF、生成中文翻译并逐段分析。
- AI 研究助手：支持摘要、方法审查、复现路线和基于原文的问答。
- DataLab：为应用统计学和经济学课程提供数据分析工作区。
- 项目空间：管理课程项目、研究计划和阶段性成果。
- 邮箱登录：基于 Supabase Auth，支持 QQ、163、Outlook、Gmail 和学校邮箱等常见邮箱。
- 隐私分层：PDF 与临时 API Key 默认保存在用户设备中，云端数据由用户账户隔离。

## 技术结构

- Next.js 16、React 19、TypeScript
- Supabase Auth 与 Postgres
- DeepSeek API（可选，支持用户自带 Key）
- Semantic Scholar 与 Crossref 公共论文索引
- 生产唯一使用标准 Next.js 构建；OpenAI Sites 预览通过显式的 `*:sites` 命令隔离

## 本地运行

需要 Node.js 22.11.0 及 pnpm 10.26.1，与 `package.json` 和 CI 完全一致。

```bash
pnpm install
cp .env.example .env.local
pnpm run dev
```

打开 `http://localhost:3000`。未配置云端环境变量时，仍可使用匿名模式和设备本地功能。

## 环境变量

复制 `.env.example`，只在本地或部署平台的安全设置中填写真实值；不要把密钥提交到 GitHub。

| 变量 | 是否必需 | 用途 |
| --- | --- | --- |
| `SUPABASE_URL` | 登录功能需要 | Supabase 项目地址 |
| `SUPABASE_PUBLISHABLE_KEY` | 登录功能需要，推荐 | Supabase 当前推荐的 publishable key；可安全用于受 RLS 保护的公开应用组件 |
| `SUPABASE_ANON_KEY` | 仅旧项目兼容 | legacy anon key fallback；新部署优先迁移到 publishable key |
| `SITE_URL` | 生产必需 | 唯一稳定生产域名，用于元数据和认证邮件回调 |
| `ACAORA_ENVIRONMENT` | 可选 | `production`、`preview`、`ci` 或 `development`；未设置时由构建环境给出安全默认值 |
| `DEEPSEEK_API_KEY` | 可选 | 平台统一提供 AI 能力；留空时可使用用户自带 Key |
| `DEEPSEEK_MODEL` | 可选 | DeepSeek 模型名，默认 `deepseek-v4-flash` |

## 部署到 EdgeOne Makers

1. 点击上方“使用 EdgeOne Pages 部署”。
2. 授权 GitHub 并选择 `Ceciliasuki/acaora`。
3. 确认安装命令为 `pnpm install --frozen-lockfile`。
4. 确认构建命令为 `pnpm run build`，输出目录为 `.next`。
5. 将生产分支设为 `main`；其他分支只生成预览。
6. 配置稳定 `SITE_URL`、Supabase publishable key 与可选 AI 变量后开始部署。
7. 发布后访问 `/api/version`，确认 `commit` 等于本次 `main` 的完整 SHA。

EdgeOne Makers 当前公开 Build Guide 未文档化一个可依赖的内建 Git SHA 变量。因此 `pnpm build` 会先运行 `scripts/generate-build-version.mjs`，直接用部署工作区的 `git rev-parse HEAD` 生成忽略于 Git 的 `app/generated/build-version.ts`。commit、build time 和 environment 会被固化进构建产物；无法得到合法 Git SHA 时构建直接失败，不会发布 `commit = unknown`。

当前生产入口为 [acaora.cn](https://acaora.cn)，由腾讯 EdgeOne 中国站控制台管理、DNSPod 解析；主分支更新自动部署。当前节点范围及国内网络可达性须按实际配置和测试判断，不能由“中国站”一词保证全国网络表现。

OpenAI Sites 仅用于独立预览：`pnpm run dev:sites` / `pnpm run build:sites`。这些命令不是 EdgeOne 生产入口。

## 质量门禁

- Tests exist：source invariants、Playwright mock E2E、axe、视觉回归和 Lighthouse 配置均已纳入仓库。
- Local tests passed：最近一次本地 typecheck、lint、unit、production build、mock E2E、视觉回归、axe 和 Lighthouse 结果记录在交付报告中。
- GitHub CI passed：[CI workflow](https://github.com/Ceciliasuki/acaora/actions/workflows/ci.yml) 已完成首次远程绿色运行；以后仍以该页面上最新 PR HEAD 的 run 为准，未运行、排队、取消或失败均不算通过。

普通 PR CI 只运行确定性 mock E2E，不需要生产 Supabase 密钥。视觉回归与 Lighthouse 是独立的手动 workflow，避免拖慢普通 PR。真实 Production Auth 验证使用 [`docs/production-auth-smoke.md`](docs/production-auth-smoke.md)，不能用 mock E2E 代替。

课程内容按公开大学大纲定位主题，讲义、练习和小数据原创；并不存在统一“985认证”。阅读/已读与作答记录按账号隔离，先写本机队列，再与云端同步；重置后旧设备队列不能恢复旧进度。客观题核答案，开放题提供参考与自查，不伪造自动评分。已有扩展题和旧作业链接保留，默认流程不要求完成。

`pnpm check:courses` 检查七门结构、题目/目标映射、公式及数值证据，生产构建先执行此门槛。独立计算使用项目 QA Python 环境运行 `scripts/verify-course-calculations.py --all`（依赖见 `scripts/course-check-requirements.txt`）。逐门主题、来源阅读深度、复算方法与验证局限见 [`docs/course-reviews/`](docs/course-reviews/)，当前发布证据见 [`release.md`](docs/course-reviews/release.md)。软件测试与本代理核查不替代学科专家审查或实际教学效果验证。

## 数据库

Supabase 初始化与安全策略位于 `supabase/migrations/`。请按编号顺序在 Supabase SQL Editor 中执行，或使用 Supabase CLI 应用迁移。迁移包含账户、用户数据隔离和 API 访问策略。

## 安全说明

- `.env*`、构建产物和本地缓存已被 Git 忽略。
- publishable key 是低权限公开应用 key，仍必须配合 RLS；legacy anon key 只用于兼容。
- Supabase secret key 和 legacy service_role 不会写入客户端、普通用户 session 或仓库。
- 用户自带的 DeepSeek Key 只用于当前设备会话，不写入云端数据库。
- 公开部署前应在 Supabase 中保留 RLS，并限制允许的重定向网址。

## 开源许可

本项目采用 [MIT License](LICENSE)。
