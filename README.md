# Acaora 学曦

面向大学生的开源智能学习与研究平台，把课程学习、论文研究、数据分析和项目管理放在同一个工作台中。

[![使用 EdgeOne Pages 部署](https://cdnstatic.tencentcs.com/edgeone/pages/deploy.svg)](https://edgeone.ai/pages/new?repository-url=https%3A%2F%2Fgithub.com%2FCeciliasuki%2Facaora&repository-name=acaora&project-name=acaora&install-command=pnpm%20install%20--frozen-lockfile&build-command=pnpm%20run%20build&output-directory=.next&env=SITE_URL%2CSUPABASE_URL%2CSUPABASE_ANON_KEY%2CDEEPSEEK_API_KEY%2CDEEPSEEK_MODEL%2CACAORA_COMMIT_SHA%2CACAORA_ENVIRONMENT)

## 主要功能

- 学习总览：统一查看课程、研究任务和近期进度。
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

需要 Node.js 22 及 pnpm。

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
| `SUPABASE_ANON_KEY` | 登录功能需要 | Supabase 公共匿名密钥 |
| `SITE_URL` | 生产必需 | 唯一稳定生产域名，用于元数据和认证邮件回调 |
| `ACAORA_COMMIT_SHA` | 生产必需 | EdgeOne/CI 注入的完整 Git commit SHA |
| `ACAORA_BUILD_TIME` | 可选 | CI 注入的 ISO 构建时间；未设置时使用构建开始时间 |
| `ACAORA_ENVIRONMENT` | 生产必需 | `production`、`preview` 或 `development` |
| `DEEPSEEK_API_KEY` | 可选 | 平台统一提供 AI 能力；留空时可使用用户自带 Key |
| `DEEPSEEK_MODEL` | 可选 | DeepSeek 模型名，默认 `deepseek-v4-flash` |

## 部署到 EdgeOne Makers

1. 点击上方“使用 EdgeOne Pages 部署”。
2. 授权 GitHub 并选择 `Ceciliasuki/acaora`。
3. 确认安装命令为 `pnpm install --frozen-lockfile`。
4. 确认构建命令为 `pnpm run build`，输出目录为 `.next`。
5. 将生产分支设为 `main`；其他分支只生成预览。
6. 配置稳定 `SITE_URL`、Supabase、AI 与构建身份变量后开始部署。
7. 发布后访问 `/api/version`，确认 `commit` 等于本次 `main` 的完整 SHA。

EdgeOne 会分配一个不含 `chatgpt` 的 `*.edgeone.app` 地址。后续每次推送到主分支，都可以自动重新部署。

OpenAI Sites 仅用于独立预览：`pnpm run dev:sites` / `pnpm run build:sites`。这些命令不是 EdgeOne 生产入口。

## 数据库

Supabase 初始化与安全策略位于 `supabase/migrations/`。请按编号顺序在 Supabase SQL Editor 中执行，或使用 Supabase CLI 应用迁移。迁移包含账户、用户数据隔离和 API 访问策略。

## 安全说明

- `.env*`、构建产物和本地缓存已被 Git 忽略。
- 服务端密钥不会写入前端代码或仓库。
- 用户自带的 DeepSeek Key 只用于当前设备会话，不写入云端数据库。
- 公开部署前应在 Supabase 中保留 RLS，并限制允许的重定向网址。

## 开源许可

本项目采用 [MIT License](LICENSE)。
