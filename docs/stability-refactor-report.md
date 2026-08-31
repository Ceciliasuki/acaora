# Acaora 稳定性重构交付报告

日期：2026-08-31

仓库：`Ceciliasuki/acaora`

PR：`https://github.com/Ceciliasuki/acaora/pull/1`
发布状态：代码已完成并进入 PR；EdgeOne 生产绑定尚未在控制台确认，因此尚未合并或宣称线上发布成功。

## 1. 根因清单

- 默认构建曾指向 Vinext，而 EdgeOne 正式运行时使用 Next.js，导致开发、预览、CI 与生产可能生成不同产物。
- 浏览器 `localStorage` Supabase token 与 HttpOnly cookie 同时存在，形成两套会话源，并让部分请求直连 Supabase、部分请求走同源 API。
- 首页不知道当前 session，工作台 Logo 又指向 `/`，造成用户看起来像“掉登录”。
- 登录回调和密码重置同时保留两套 URL，邮件回调来源也可能落到临时预览域名。
- 表单、密码框、按钮、Tabs、Dialog、异步状态和错误状态缺少共享约束，交互与无障碍行为不一致。
- Dashboard、Data 等页面把示例数据展示得过于像账户真实数据；Projects/Papers 的认证请求和异步状态不统一。
- 缺少覆盖真实导航、认证、视觉回归、axe、Lighthouse 和生产构建的测试防线。

## 2. 修改文件清单

- 配置与文档：`.env.example`、`.gitignore`、`README.md`、`next-env.d.ts`、`next.config.ts`、`package.json`、`pnpm-lock.yaml`
- 认证 API：`app/api/auth/_shared.ts`、`login/route.ts`、`logout/route.ts`、`password/route.ts`、`recover/route.ts`、`register/route.ts`、`session/route.ts`、`status/route.ts`
- 用户数据 API：`app/api/cloud/papers/route.ts`、`app/api/papers/ai/route.ts`、`app/api/papers/search/route.ts`、`app/api/profile/route.ts`、`app/api/projects/route.ts`
- 页面与导航：`app/auth/page.tsx`、`app/auth/reset/page.tsx`、`app/components/app-sidebar.tsx`、`app/courses/page.tsx`、`app/dashboard/page.tsx`、`app/data/page.tsx`、`app/layout.tsx`、`app/page.tsx`、`app/papers/ai-studio.tsx`、`app/papers/page.tsx`、`app/projects/page.tsx`、`app/settings/page.tsx`
- 样式与 URL：`app/globals.css`、`app/lib/site-url.ts`

## 3. 删除文件清单

- `app/api/auth/otp/route.ts`
- `app/api/auth/verify/route.ts`
- `app/auth-callback/page.tsx`
- `app/auth/callback/page.tsx`（由 canonical Route Handler 取代）
- `app/components/auth-hash-redirect.tsx`
- `app/lib/browser-auth.ts`
- `app/reset/page.tsx`
- `tests/rendered-html.test.mjs`

## 4. 新增文件清单

- 仓库约束：`AGENTS.md`、`CLAUDE.md`
- 版本与运行时：`app/api/version/route.ts`、`app/lib/version.ts`、`proxy.ts`
- SSR 认证：`app/auth/callback/route.ts`、`app/lib/auth-client.ts`、`app/lib/auth/password-policy.ts`、`app/lib/auth/server-viewer.ts`、`app/lib/http.ts`、`app/lib/supabase/config.ts`、`app/lib/supabase/proxy.ts`、`app/lib/supabase/server.ts`
- UI 系统：`app/components/ui/button.tsx`、`dialog.tsx`、`feedback.tsx`、`form.tsx`、`index.ts`、`page-header.tsx`、`surface.tsx`、`tabs.tsx`、`utils.ts`
- 开发 UI Kit：`app/dev/ui-kit/page.tsx`、`app/dev/ui-kit/ui-kit-client.tsx`
- AI 设置：`app/lib/ai-settings.ts`
- 审计与测试：`docs/stability-audit.md`、`lighthouserc.cjs`、`playwright.config.ts`、`tests/source-invariants.test.mjs`、`tests/e2e/*.spec.ts`、`tests/e2e/helpers.ts`、9 张 Windows 视觉基准图

## 5. Authentication before / after

### Before

`Browser -> localStorage access/refresh token -> Supabase` 与 `Browser -> Acaora API -> cookie session` 并存。页面之间混用 Bearer token、cookie、裸 `fetch` 和 authenticated fetch；回调/reset 各有重复路由。

### After

`Browser -> Acaora same-origin /api/* -> @supabase/ssr cookie session -> Supabase`。浏览器核心账户和用户数据流程统一走同源 API；session 只以 HttpOnly cookie 为来源；Next.js Proxy 负责刷新；服务端优先验证 claims/user；认证和私有数据响应统一 `private, no-store` 并 `Vary: Cookie, Authorization`；旧 localStorage 会话键被迁移清理；callback/reset 只保留 canonical flow，旧 URL 明确重定向。

## 6. Deployment before / after

### Before

`acaora` 与 `acaora-edgeone` 可能同时触发生产；默认 `build` 为 Vinext，另有 `build:edgeone = next build`，生产产物来源不透明。

### After

仓库内默认链路统一为 `pnpm dev -> next dev`、`pnpm build -> next build`、`pnpm start -> next start`。Vinext 仅保留在显式 `*:sites` 命令中，不影响默认 EdgeOne/CI。`/api/version` 返回 CI 注入的 commit、buildTime、environment；Settings 页显示弱化 build 标识。EdgeOne 控制台仍须确认唯一仓库、`main` 与 Next.js 构建后方可合并 PR。

## 7. 测试结果

- TypeScript `tsc --noEmit`：通过
- ESLint：通过
- Source invariants：5/5 通过
- Playwright 功能 E2E：15/15 通过（AUTH-01..08、PROJECT-01..02、PAPER-01、UI-01..03）
- Playwright 视觉回归：9/9 通过
- axe：Home、Auth、Dashboard、Courses、Papers、Data、Projects、Settings 全部通过
- Next.js production build：通过，23 条路由
- 本地 production smoke：`/`、`/auth`、`/dashboard`、`/api/version`、`/api/auth/status` 全部 200；抽检 9 个静态资源全部 200；认证响应 cache headers 正确
- Lighthouse：Home `0.90/1.00/1.00/1.00`，Auth `0.95/1.00/1.00/1.00`，Dashboard guest `0.94/0.95/1.00/1.00`（Performance/Accessibility/Best Practices/SEO）

## 8. 仍未解决的风险

- 无 EdgeOne 控制台可信读取结果，无法确认 Production 当前绑定的仓库、分支、构建命令、域名与环境变量。
- 无 Supabase 控制台权限，无法确认 Site URL、Redirect URL allow-list 与邮件模板中的回调域名。
- 未取得 China Telecom、China Unicom、China Mobile 三网真实测试条件；“中国大陆完全可用”仍是 Release Blocker，不能宣称已验证。
- 真实登录、改密、邮件恢复和云同步需要生产 Supabase 环境与测试账号；当前 Playwright 通过确定性同源 API mock 验证客户端契约，服务端实现由类型检查、源约束和生产构建覆盖。
- 头像仍需后续迁移至 Supabase Storage；本轮只阻止继续依赖 Base64 作为长期模型，不变更数据库 schema。

## 9. EdgeOne / Supabase 控制台人工操作

### EdgeOne Pages

1. Production 项目只绑定 `Ceciliasuki/acaora`；禁用或删除 `acaora-edgeone` 的 Production webhook/绑定。
2. Production branch 设为 `main`；其他分支只能生成 Preview。
3. 安装命令设为 `pnpm install --frozen-lockfile`，构建命令设为 `pnpm build`，框架/运行时选择正式 Next.js；不要调用 `build:sites`。
4. 配置稳定 HTTPS 正式域名，不把临时 Preview URL 作为身份域名。
5. 注入 `ACAORA_COMMIT_SHA`（平台 Git SHA）、`ACAORA_BUILD_TIME`、`ACAORA_ENVIRONMENT=production`、`SITE_URL`、`NEXT_PUBLIC_SITE_URL` 和 Supabase 服务端环境变量。
6. 完成部署后运行生产 smoke，并要求 `/api/version.commit == GitHub main HEAD`；否则部署失败。

### Supabase Auth

1. Site URL 设为同一个稳定 HTTPS 正式域名。
2. Redirect allow-list 仅保留正式 `https://<domain>/auth/callback`、`https://<domain>/auth/reset`，另加明确的本地开发地址；移除过期 Preview URL。
3. 检查注册、恢复密码和改密邮件模板，确保 callback 指向 canonical URL。
4. 不新增数据库 migration；确认现有 RLS 与服务端身份验证继续生效。

## 10. Production commit SHA

当前最后一个代码提交为 `b8e742dc076e35a8c66c1203e153ad4cd813301b`，其 production build 与 `/api/version` 已完成本地验证；PR 可能继续包含不影响运行时的报告提交。正式 Production 必须对应“PR 合并后的 GitHub `main` HEAD”，不得使用本报告中的临时分支 SHA 冒充线上版本。合并前必须先完成第 9 节控制台确认。
