import { expect, type Page, type Route } from "@playwright/test";

export type MockProject = {
  id: string;
  title: string;
  kind: string;
  status: "active" | "paused" | "completed";
  metadata: { goal?: string; deadline?: string; notes?: string; tasks?: Array<{ id: string; text: string; done: boolean }> };
  created_at: string;
  updated_at: string;
};

export type MockState = {
  signedIn: boolean;
  password: string;
  failNextLogin: boolean;
  projects: MockProject[];
  cloudPapers: unknown[];
  requests: string[];
};

const user = { id: "user-e2e", email: "student@example.com" };
const profile = {
  display_name: "测试同学",
  university: "Acaora University",
  major: "应用统计学",
  graduation_year: 2028,
  preferences: { avatar: "", bio: "", interests: ["计量经济学"], language: "zh-CN" },
};

export async function installApiMocks(page: Page, initial: Partial<MockState> = {}) {
  const state: MockState = {
    signedIn: initial.signedIn ?? false,
    password: initial.password ?? "ValidPass1",
    failNextLogin: initial.failNextLogin ?? false,
    projects: initial.projects ? structuredClone(initial.projects) : [],
    cloudPapers: initial.cloudPapers ? structuredClone(initial.cloudPapers) : [],
    requests: [],
  };

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const key = `${request.method()} ${url.pathname}`;
    state.requests.push(key);

    if (url.pathname === "/api/version") return json(route, { commit: "e2e-fixed-commit", buildTime: "2026-08-16T08:00:00.000Z", environment: "test" });
    if (url.pathname === "/api/auth/status") return json(route, { configured: true });
    if (url.pathname === "/api/auth/session") return privateJson(route, { configured: true, user: state.signedIn ? user : null });
    if (url.pathname === "/api/auth/login") {
      const body = request.postDataJSON() as { password?: string };
      if (state.failNextLogin) {
        state.failNextLogin = false;
        return privateJson(route, { error: "邮箱或密码错误，请检查后重试。" }, 401);
      }
      if (body.password !== state.password) return privateJson(route, { error: "邮箱或密码错误，请检查后重试。" }, 401);
      state.signedIn = true;
      return privateJson(route, { signedIn: true });
    }
    if (url.pathname === "/api/auth/register") return privateJson(route, { confirmationRequired: true });
    if (url.pathname === "/api/auth/recover") return privateJson(route, { sent: true });
    if (url.pathname === "/api/auth/password") {
      const body = request.postDataJSON() as { password?: string };
      state.password = body.password || state.password;
      return privateJson(route, { updated: true });
    }
    if (url.pathname === "/api/auth/logout") {
      state.signedIn = false;
      return privateJson(route, { signedOut: true });
    }
    if (url.pathname === "/api/profile") {
      if (!state.signedIn) return privateJson(route, { error: "请先登录。" }, 401);
      return privateJson(route, request.method() === "PUT" ? { profile: request.postDataJSON() } : { user, profile });
    }
    if (url.pathname === "/api/projects") {
      if (!state.signedIn) return privateJson(route, { error: "请先登录。" }, 401);
      if (request.method() === "GET") return privateJson(route, { projects: state.projects });
      if (request.method() === "POST") {
        const body = request.postDataJSON() as Partial<MockProject>;
        const now = "2026-08-16T08:00:00.000Z";
        const project: MockProject = { id: `project-${state.projects.length + 1}`, title: body.title || "未命名项目", kind: body.kind || "paper", status: body.status || "active", metadata: body.metadata || {}, created_at: now, updated_at: now };
        state.projects.unshift(project);
        return privateJson(route, { project }, 201);
      }
      const id = url.searchParams.get("id");
      if (request.method() === "PATCH") {
        const body = request.postDataJSON() as MockProject;
        const index = state.projects.findIndex((project) => project.id === id);
        state.projects[index] = { ...body, updated_at: "2026-08-16T09:00:00.000Z" };
        return privateJson(route, { project: state.projects[index] });
      }
      if (request.method() === "DELETE") {
        state.projects = state.projects.filter((project) => project.id !== id);
        return privateJson(route, { deleted: true });
      }
    }
    if (url.pathname === "/api/cloud/papers") {
      if (!state.signedIn) return privateJson(route, { error: "请先登录。" }, 401);
      if (request.method() === "GET") return privateJson(route, { papers: state.cloudPapers });
      if (request.method() === "DELETE") {
        const id = url.searchParams.get("id");
        state.cloudPapers = state.cloudPapers.filter((paper) => (paper as { id?: string }).id !== id);
        return privateJson(route, { deleted: true });
      }
      return privateJson(route, { saved: true });
    }
    if (url.pathname === "/api/papers/ai" && request.method() === "GET") return json(route, { available: true, mode: "byok", model: "deepseek-v4-flash" });
    if (url.pathname === "/api/papers/search") return json(route, { papers: [] });
    return json(route, { error: `Unhandled E2E route: ${key}` }, 501);
  });

  return state;
}

export async function freezeDynamicUi(page: Page) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    const NativeDate = Date;
    const fixed = "2026-08-16T08:00:00.000Z";
    const FixedDate = new Proxy(NativeDate, {
      construct(target, args) {
        return Reflect.construct(target, args.length ? args : [fixed]);
      },
    });
    FixedDate.now = () => new NativeDate(fixed).valueOf();
    window.Date = FixedDate as DateConstructor;
  });
}

export async function login(page: Page, password = "ValidPass1") {
  await page.goto("/auth");
  await page.getByLabel("邮箱地址").fill("student@example.com");
  await page.locator("#account-password").fill(password);
  await page.getByRole("button", { name: "登录账户" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole("heading", { name: /你好/ })).toBeVisible();
}

export function makeTextPdf() {
  const text = "This reproducible study evaluates student sleep duration and academic performance using a transparent regression model with uncertainty estimates and sensitivity checks.";
  const stream = `BT\n/F1 12 Tf\n72 720 Td\n(${text}) Tj\nET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let body = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(body));
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(body);
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  body += offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(body);
}

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: "application/json; charset=utf-8", body: JSON.stringify(body) });
}

async function privateJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: "application/json; charset=utf-8", headers: { "Cache-Control": "private, no-store", Vary: "Cookie, Authorization" }, body: JSON.stringify(body) });
}
