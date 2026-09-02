# Acaora 稳定性重构：阶段 1 审计

审计基线：`Ceciliasuki/acaora` 的 `main`，已确认最新提交为 `acca1a184d1a1952ad423e5e029bd60940bfc659`。本文件只记录现状、风险和后续改造边界，不改变产品行为。

## 1. 部署与版本来源

### 已确认

- 唯一代码源应为 GitHub 仓库 `Ceciliasuki/acaora`；默认分支是 `main`。
- `package.json:17-19` 当前把无后缀的 `dev/build/start` 指向 Vinext，而 EdgeOne 需要另行调用 `*:edgeone`。这会让默认 CI 和人工操作容易产出错误运行时。
- `.openai/hosting.json` 证明同一仓库还承载 OpenAI Sites 配置；它需要保留，但必须与生产构建命令隔离。
- README 仍把项目描述为“双构建目标”，部署按钮也显式调用 `build:edgeone`；缺少唯一生产命令和构建身份校验。
- 当前没有 `/api/version`，线上页面无法证明 commit、构建时间和环境。
- `app/lib/site-url.ts:45-47` 同时接受 `SITE_URL`、请求来源和 `NEXT_PUBLIC_SITE_URL`，并允许 EdgeOne 临时域参与邮件回调，不能保证生产邮件始终回到稳定域名。

### 尚未能从本机验证

EdgeOne 控制台当前未登录，公开 Makers 页面只显示登录页；因此下面三项不能靠猜测宣称完成，必须在发布前由有权限的控制台会话核验：

1. 生产项目绑定仓库是否确为 `Ceciliasuki/acaora`。
2. 生产分支是否为 `main`，非 `main` 是否只生成预览。
3. 旧 `acaora-edgeone` 项目是否已禁用生产发布。

发布门禁将通过 `/api/version` 和生产冒烟脚本验证最终 SHA，避免仅依赖控制台显示。

## 2. 当前认证链路

```text
浏览器
  ├─ 直连 Supabase Auth/REST
  │   ├─ body data-* 暴露 URL/key（app/layout.tsx:10-30）
  │   └─ localStorage: acaora_supabase_session（app/lib/browser-auth.ts:160-253）
  └─ Acaora /api/auth/*
      └─ HttpOnly: acaora_access + acaora_refresh

页面读取
  ├─ dashboard/projects/papers：混用 browserAuthenticatedFetch 与原生 fetch
  └─ settings/sidebar：直接访问 Supabase REST
```

这是两个会话源。浏览器 token、服务端 cookie 和各页面自己的降级逻辑会独立过期，造成“页面看似已登录但 API 返回 401”、刷新丢状态及删除失败。

### 认证风险

- `app/api/auth/_shared.ts:103-113` 仍接受浏览器 `Authorization: Bearer`，服务端 cookie 不是唯一来源。
- `app/api/auth/session` 的 POST 允许浏览器把 access/refresh token 桥接为 cookie，延续双会话。
- 只有部分响应使用 `privateNoStore`；login/register/recover/verify/status、projects 和 cloud papers 的多个成功与失败分支缺少统一 `Cache-Control: private, no-store` 和 `Vary: Cookie, Authorization`。
- Supabase 当前 SSR 指南要求 cookie 会话、Next.js 16 `proxy.ts` 刷新和 `getClaims()` 身份校验；当前代码仍用手写 token 刷新并逐次请求 `/auth/v1/user`。
- `app/auth-callback` 与 `app/auth/callback`、`app/reset` 与 `app/auth/reset` 是重复入口；邮件和客户端代码仍引用旧入口。
- 核心外部请求均无统一超时：Supabase、DeepSeek、Semantic Scholar、Crossref 都可能无限等待。

### 目标链路

```text
浏览器页面
  └─ 同源 /api/auth/*、/api/profile、/api/projects、/api/cloud/papers
      └─ Acaora 服务端
          ├─ 唯一 HttpOnly cookie 会话
          ├─ proxy.ts 刷新 cookie
          ├─ getClaims() 校验身份
          └─ Supabase Auth / PostgREST
```

浏览器不再获得 Supabase URL/key，不保存 access/refresh token，也不为核心账户流程直连 `*.supabase.co`。

## 3. 路由盘点

### 页面

- 公开：`/`、`/auth`。
- 工作台：`/dashboard`、`/courses`、`/papers`、`/data`、`/projects`、`/settings`。
- 认证结果：规范入口 `/auth/callback`、`/auth/reset`；旧入口 `/auth-callback`、`/reset` 应仅做永久重定向。
- 开发工具：需新增仅开发环境可访问的 `/dev/ui-kit`。

### API

- 认证：status、login、logout、register、recover、password、session；现有 otp/verify 是否保留取决于页面实际使用，未使用则移除。
- 用户数据：profile、projects、cloud/papers。
- 论文能力：papers/search、papers/ai。
- 运维：需新增 version。

## 4. 页面状态与真实性

- 首页始终显示“登录 / 免费开始”，不识别 cookie 会话；产品预览中的 84%、论文标题、CSV 行数等没有“示例”标识。
- Dashboard 在 `app/dashboard/page.tsx:58-67` 硬编码日期、6.4h、+18%、论文、课程与完成度，没有 signed-in-empty 状态，且含没有行为的“快速开始”“更换今日重点”。
- Courses 实际只接受 TXT/Markdown/CSV，但页面同时维护 DeepSeek Key；Key 管理与 Papers、Settings 重复。
- Papers 的 GET/PUT 使用认证封装，DELETE 在 `app/papers/page.tsx:231` 使用原生 fetch；云状态只有 checking/guest/ready/error，缺少 syncing/offline。
- Data 默认装载 sampleData，但数据表本身没有持续可见的样例标识；上传后状态也没有明确切换。需要覆盖空文件、无数值列、超大文件、长列名与横向溢出。
- Projects 的筛选按钮在 `app/projects/page.tsx:197` 没有行为；PATCH/DELETE 绕开认证封装；笔记在 `:214` 通过 `document.getElementById` 读取非受控值；`:217` 暴露“下一版将……”生产文案。
- Settings 信息架构未拆分；密码表单重复；“English（预留）”是假选项；头像 base64 存入 preferences，缺少显式尺寸/迁移说明；AI Key 文案声称只在浏览器，但请求发送后服务端和上游仍会看到它。

## 5. 导航与可访问性

按最新 Vercel Web Interface Guidelines 审计：

- AppSidebar 品牌链接仍指向 `/`（`app/components/app-sidebar.tsx:67`），不是 `/dashboard`。
- 多数内部导航仍是原生 `<a>`，没有使用 Next `Link`；部分按钮其实承担导航。
- Sidebar 使用字符图标而非统一图标组件；无窄屏抽屉和明确的展开/收起控制。
- 多个按钮和控件高度为 34–43px（例如 `app/globals.css:678-681, 1182, 1281, 1561, 1642`），低于移动触控 44px。
- CSS 中多处 `outline: none`，缺少全局 `:focus-visible` 回补；没有 `prefers-reduced-motion`。
- 多处 7–11px 文字影响可读性；页面缺少统一 FormField、inline error、StatusMessage、Dialog 和 Empty/Error State。
- 首页产品样机里的按钮看似可交互但无行为，需要从可访问树中移除或明确为示例。
- 破坏性删除虽有浏览器 confirm，但应统一为可访问 Dialog；图标按钮需 aria-label/tooltip。

## 6. 重复与失效代码

- `app/lib/browser-auth.ts` 是双会话与直连 Supabase 的核心，应在迁移完成后删除。
- `AuthHashRedirect`、旧 callback/reset 页面在 PKCE 规范回调落地后只保留必要重定向。
- dashboard 的死按钮、Projects 假筛选、“下一版”说明应删除或实现。
- 页面级密码字段、按钮、状态消息和空状态重复，应收敛到 `app/components/ui`。
- CSS 只做与组件迁移直接相关的去重，不重写 Papers/Data 既有视觉结构。

## 7. 测试缺口

- 当前测试只验证构建产物和环境泄露，没有浏览器 E2E。
- 缺少 AUTH-01..08、PROJECT-01..02、PAPER-01。
- 缺少 375/768/1440 视觉基线、键盘/焦点/ARIA 冒烟和 Lighthouse CI。
- 动态账户与云数据必须通过 Playwright route/mock 或测试适配层固定，不能依赖真实生产账号和网络。

## 8. 数据库边界

现有迁移已为 profiles、paper_memories、learning_projects 启用按 `auth.uid()` 隔离的 RLS，并撤销 anon 数据权限。本轮不需要 schema 变更。头像继续兼容现有 preferences 字段，同时增加前端压缩、体积门禁和后续迁移说明；不会擅自增加 Storage bucket 或数据库列。

## 9. 阶段结论

阻断生产稳定性的主因不是单一页面 bug，而是构建入口不唯一、双认证会话、页面级网络/状态逻辑分叉，以及缺少可证明版本的发布门禁。后续改造顺序必须保持：部署来源 → 认证 → 导航/首页 → UI primitives → 页面状态 → 自动化测试 → 生产验证。
