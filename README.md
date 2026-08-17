# Acaora 学曦

面向大学生的开源智能学习与研究平台，把课程学习、论文研究、数据分析和项目管理放在同一个工作台中。

[![使用 EdgeOne Pages 部署](https://cdnstatic.tencentcs.com/edgeone/pages/deploy.svg)](https://edgeone.ai/pages/new?repository-url=https%3A%2F%2Fgithub.com%2FCeciliasuki%2Facaora&repository-name=acaora&project-name=acaora&install-command=pnpm%20install%20--frozen-lockfile&build-command=pnpm%20run%20build%3Aedgeone&output-directory=.next&env=SUPABASE_URL%2CSUPABASE_ANON_KEY%2CDEEPSEEK_API_KEY%2CDEEPSEEK_MODEL)

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
- 双构建目标：OpenAI Sites / Cloudflare Worker 与 EdgeOne Makers

## 本地运行

需要 Node.js 22 及 pnpm。

```bash
pnpm install
cp .env.example .env.local
pnpm run dev:edgeone
```

打开 `http://localhost:3000`。未配置云端环境变量时，仍可使用匿名模式和设备本地功能。

## 环境变量

复制 `.env.example`，只在本地或部署平台的安全设置中填写真实值；不要把密钥提交到 GitHub。

| 变量 | 是否必需 | 用途 |
| --- | --- | --- |
| `SUPABASE_URL` | 登录功能需要 | Supabase 项目地址 |
| `SUPABASE_ANON_KEY` | 登录功能需要 | Supabase 公共匿名密钥 |
| `DEEPSEEK_API_KEY` | 可选 | 平台统一提供 AI 能力；留空时可使用用户自带 Key |
| `DEEPSEEK_MODEL` | 可选 | DeepSeek 模型名，默认 `deepseek-v4-flash` |

## 部署到 EdgeOne Makers

1. 点击上方“使用 EdgeOne Pages 部署”。
2. 授权 GitHub 并选择 `Ceciliasuki/acaora`。
3. 确认安装命令为 `pnpm install --frozen-lockfile`。
4. 确认构建命令为 `pnpm run build:edgeone`，输出目录为 `.next`。
5. 在环境变量区域填写需要启用的 Supabase 和 DeepSeek 配置，然后开始部署。

EdgeOne 会分配一个不含 `chatgpt` 的 `*.edgeone.app` 地址。后续每次推送到主分支，都可以自动重新部署。

## 数据库

Supabase 初始化与安全策略位于 `supabase/migrations/`。请按编号顺序在 Supabase SQL Editor 中执行，或使用 Supabase CLI 应用迁移。迁移包含账户、用户数据隔离和 API 访问策略。

## 安全说明

- `.env*`、构建产物和本地缓存已被 Git 忽略。
- 服务端密钥不会写入前端代码或仓库。
- 用户自带的 DeepSeek Key 只用于当前设备会话，不写入云端数据库。
- 公开部署前应在 Supabase 中保留 RLS，并限制允许的重定向网址。

## 开源许可

本项目采用 [MIT License](LICENSE)。
