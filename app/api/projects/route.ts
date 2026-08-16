import { NextRequest, NextResponse } from "next/server";
import { accessCookie, authError, readUser, supabaseRest } from "../auth/_shared";

const projectKinds = new Set(["course", "paper", "data", "writing", "group", "career"]);
const projectStatuses = new Set(["active", "paused", "completed"]);

type ProjectPayload = {
  id?: string;
  title?: string;
  kind?: string;
  status?: string;
  metadata?: Record<string, unknown>;
};

async function authenticate(request: NextRequest) {
  const accessToken = request.cookies.get(accessCookie)?.value;
  if (!accessToken) return null;
  const user = await readUser(accessToken);
  return user ? { accessToken, user } : null;
}

function validateProject(payload: ProjectPayload) {
  const title = payload.title?.trim();
  const kind = payload.kind ?? "course";
  const status = payload.status ?? "active";
  if (!title || title.length > 120) return { error: "项目名称需要控制在 1–120 个字符。" };
  if (!projectKinds.has(kind)) return { error: "项目类型不受支持。" };
  if (!projectStatuses.has(status)) return { error: "项目状态不受支持。" };
  const metadata = payload.metadata && typeof payload.metadata === "object" ? payload.metadata : {};
  if (JSON.stringify(metadata).length > 120_000) return { error: "项目内容过长，请精简后重试。" };
  return { title, kind, status, metadata };
}

export async function GET(request: NextRequest) {
  try {
    const session = await authenticate(request);
    if (!session) return NextResponse.json({ error: "请先登录后使用项目工作台。" }, { status: 401 });
    const response = await supabaseRest(
      "learning_projects?select=id,title,kind,status,metadata,created_at,updated_at&order=updated_at.desc",
      session.accessToken,
    );
    if (!response.ok) return NextResponse.json({ error: "项目工作台暂时无法读取数据。" }, { status: 503 });
    return NextResponse.json({ projects: await response.json() });
  } catch (error) {
    return authError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await authenticate(request);
    if (!session) return NextResponse.json({ error: "请先登录后创建项目。" }, { status: 401 });
    const validated = validateProject(await request.json() as ProjectPayload);
    if ("error" in validated) return NextResponse.json({ error: validated.error }, { status: 400 });
    const response = await supabaseRest("learning_projects", session.accessToken, {
      method: "POST",
      headers: { "Prefer": "return=representation" },
      body: JSON.stringify({
        user_id: session.user.id,
        title: validated.title,
        kind: validated.kind,
        status: validated.status,
        metadata: validated.metadata,
      }),
    });
    if (!response.ok) return NextResponse.json({ error: "创建项目失败，请稍后重试。" }, { status: 503 });
    const rows = await response.json() as unknown[];
    return NextResponse.json({ project: rows[0] }, { status: 201 });
  } catch (error) {
    return authError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await authenticate(request);
    if (!session) return NextResponse.json({ error: "请先登录后更新项目。" }, { status: 401 });
    const id = request.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "缺少项目编号。" }, { status: 400 });
    const validated = validateProject(await request.json() as ProjectPayload);
    if ("error" in validated) return NextResponse.json({ error: validated.error }, { status: 400 });
    const response = await supabaseRest(`learning_projects?id=eq.${encodeURIComponent(id)}`, session.accessToken, {
      method: "PATCH",
      headers: { "Prefer": "return=representation" },
      body: JSON.stringify({
        title: validated.title,
        kind: validated.kind,
        status: validated.status,
        metadata: validated.metadata,
        updated_at: new Date().toISOString(),
      }),
    });
    if (!response.ok) return NextResponse.json({ error: "保存项目失败，请稍后重试。" }, { status: 503 });
    const rows = await response.json() as unknown[];
    if (!rows[0]) return NextResponse.json({ error: "没有找到这个项目。" }, { status: 404 });
    return NextResponse.json({ project: rows[0] });
  } catch (error) {
    return authError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await authenticate(request);
    if (!session) return NextResponse.json({ error: "请先登录后删除项目。" }, { status: 401 });
    const id = request.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "缺少项目编号。" }, { status: 400 });
    const response = await supabaseRest(`learning_projects?id=eq.${encodeURIComponent(id)}`, session.accessToken, {
      method: "DELETE",
    });
    if (!response.ok) return NextResponse.json({ error: "删除项目失败，请稍后重试。" }, { status: 503 });
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return authError(error);
  }
}
