# Acaora Production Auth Smoke Test

本清单用于正式 EdgeOne 域名和 Production Supabase 项目。旧报告中的 `INACTIVE` / paused 是历史文字，不能代表当前状态；实际状态必须重新验证。自动化 mock E2E 不能替代真实 Production smoke。

## 前置门槛

- EdgeOne Production 已确认绑定 `Ceciliasuki/acaora`、`main`、`pnpm build` 和稳定 HTTPS `SITE_URL`。
- Supabase Production 项目已恢复为 active；迁移、`public` tables、RLS、Security Advisors、Performance Advisors 已复核。
- Supabase Site URL、Redirect URL allow-list 和邮件模板均使用正式稳定域名。
- 准备一个可收信、可删除的专用测试邮箱；不要使用真实用户账户。
- 浏览器打开无痕窗口和 DevTools Network，启用 Preserve log，过滤 `supabase.co`、`/api/`、`callback`、`reset`。
- 记录测试时间、正式域名、GitHub `main` SHA 和 `/api/version` 响应。

### SSR 邮件模板

邮件确认必须由 Acaora 同源回调使用 token hash 建立服务端会话，不能只依赖 Supabase 托管的 `ConfirmationURL`。Supabase `Confirm signup` 模板中的按钮链接应为：

```html
{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=email
```

`Reset password` 的 `RedirectTo` 已包含 `next=/auth/reset`，按钮链接应为：

```html
{{ .RedirectTo }}&amp;token_hash={{ .TokenHash }}&amp;type=recovery
```

`.RedirectTo` 来自服务端 `signUp` / `resetPasswordForEmail` 调用，仍须命中 Supabase Redirect URL allow-list。

## 通过规则

核心认证、Profile、Project 和 Paper cloud sync 的浏览器请求必须发往 Acaora 同源地址。若 Browser Network 出现任何直接访问 `*.supabase.co` 的核心账户请求，本轮 smoke 直接判定 `FAIL`。服务端从 Acaora 访问 Supabase 属于预期路径。

每一步都必须填写 `PASS` 或 `FAIL`、关键 HTTP status、是否浏览器直连 Supabase、Cookie/session 异常和证据链接/截图。出现 5xx、错误 public cache、丢 session、错误 callback origin 或无限 loading 均为失败。

| # | 流程 | 预期结果 | PASS / FAIL | HTTP status | Browser 直连 `*.supabase.co` | Cookie / session 异常 | 证据 / 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 新注册测试账户 | 同源 `/api/auth/register` 接受请求并提示确认邮箱 |  |  |  |  |  |
| 2 | 收到邮箱确认邮件 | 发件内容与链接使用正式稳定域名 |  |  |  |  |  |
| 3 | 打开 `/auth/callback` | `code` 或邮件 `token_hash` exchange 成功，跳转工作台并设置安全 Cookie |  |  |  |  |  |
| 4 | 使用测试账户登录 | 同源 `/api/auth/login` 成功并进入 Dashboard |  |  |  |  |  |
| 5 | 刷新 Dashboard | 用户仍保持登录，页面无闪退/循环跳转 |  |  |  |  |  |
| 6 | Home / workspace 导航 | Home、Dashboard、Courses、Papers、Data、Projects、Settings 间 session 不丢失 |  |  |  |  |  |
| 7 | 修改密码 | 同源 `/api/auth/password` 成功，明确显示完成状态 |  |  |  |  |  |
| 8 | Logout | 同源 `/api/auth/logout` 清除会话 Cookie |  |  |  |  |  |
| 9 | 使用新密码重新登录 | 旧密码失败，新密码成功 |  |  |  |  |  |
| 10 | Forgot password | 同源 `/api/auth/recover` 成功并提示检查邮箱 |  |  |  |  |  |
| 11 | 收到 reset 邮件 | reset 链接使用正式稳定域名 |  |  |  |  |  |
| 12 | 打开 `/auth/reset` | 恢复会话有效，可提交新密码 |  |  |  |  |  |
| 13 | 重置后登录 | reset 前密码失败，reset 后密码成功 |  |  |  |  |  |
| 14 | Profile save / refresh | 保存后刷新仍能读取同一资料，只访问同源 `/api/profile` |  |  |  |  |  |
| 15 | Project create/update/delete | 三个操作和刷新持久化均成功，只访问同源 `/api/projects` |  |  |  |  |  |
| 16 | Paper cloud sync | load/save/update/delete/sync 状态正确，只访问同源 `/api/cloud/papers` |  |  |  |  |  |

## Paper 跨设备同步专项复核

仅在 `0005_paper_sync_tombstones.sql` 已受控应用、Production 版本一致且专用测试账号就绪后执行。用两个独立浏览器资料/profile 登录同一专用账号；不要使用真实用户论文。每一步记录 `VERIFIED`、`FAIL` 或 `NOT VERIFIED` 和脱敏证据。

1. Profile A 导入文本型测试 PDF，确认原始 PDF 字节未发送至 `/api/cloud/papers`，只发送提取文本与阅读记忆。Profile B 刷新后看到同一论文。
2. Profile A 断网，修改标题、译文或笔记并刷新，确认本机仍保留且状态显示等待同步。恢复网络后确认 PUT 自动补发、队列清空；Profile B 刷新看到最新内容。
3. Profile A 删除测试论文，确认文案明确写“从所有设备删除”、云端提取内容与 AI 结果清空。Profile B 刷新后论文消失；Profile A 再刷新也不复活。重复 DELETE 应保持同一 tombstone 时间。
4. 两个 Profile 的 Network 中浏览器直连 `*.supabase.co` 核心请求均为 0；同源 `/api/cloud/papers` 的私有响应为 `Cache-Control: private, no-store`。检查 session Cookie 的 HttpOnly、Secure、SameSite=Lax。

上线前在 Supabase SQL Editor 只读检查（不得把查询结果中的真实用户内容放进报告）：

```sql
select column_name, data_type from information_schema.columns
where table_schema = 'public' and table_name = 'paper_memories' and column_name = 'deleted_at';
select proname, prosecdef from pg_proc
where oid in ('public.sync_paper_memory(text,text,text,jsonb,jsonb,timestamptz)'::regprocedure,
              'public.delete_paper_memory(text)'::regprocedure);
select c.relrowsecurity from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'paper_memories';
select has_function_privilege('authenticated', 'public.sync_paper_memory(text,text,text,jsonb,jsonb,timestamptz)', 'EXECUTE') as sync_authenticated,
       has_function_privilege('anon', 'public.sync_paper_memory(text,text,text,jsonb,jsonb,timestamptz)', 'EXECUTE') as sync_anon,
       has_function_privilege('authenticated', 'public.delete_paper_memory(text)', 'EXECUTE') as delete_authenticated,
       has_function_privilege('anon', 'public.delete_paper_memory(text)', 'EXECUTE') as delete_anon;
```

迁移在仓库里只是草案。执行前必须先向所有者说明影响；受控验证只使用专用测试账号。现阶段这些 SQL 查询和真实往返均为 `NOT VERIFIED`。

## 收尾记录

- `/api/version.commit`：
- GitHub `main` HEAD：
- 两者是否完全一致：
- `/api/auth/status` Cache-Control / Vary：
- 直接 `*.supabase.co` 浏览器请求总数：
- 最终结论：`PASS` / `FAIL`
- 执行人、日期、网络环境：

完成后删除测试账户及其测试数据，并保存脱敏后的 Network HAR、关键截图和 Advisor 结果。不得把邮箱 token、Cookie、JWT 或 API key 写进报告。
