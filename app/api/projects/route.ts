import { NextRequest, NextResponse } from "next/server";
import { authError, privateNoStore, readRequestSession, supabaseRest } from "../auth/_shared";
import {validateProjectEvidence} from '../../lib/project-evidence';
import {validateProjectAnalyses, validateResearchDossier} from '../../lib/project-research';

const projectKinds = new Set(["course", "paper", "data", "writing", "group", "career"]);
const projectStatuses = new Set(["active", "paused", "completed"]);

type ProjectPayload = {
  id?: string;
  title?: string;
  kind?: string;
  status?: string;
  metadata?: Record<string, unknown>;
  expectedUpdatedAt?: string;
  expectedOwnerId?: string;
};

function json(data: unknown, init?: ResponseInit) {
  return privateNoStore(NextResponse.json(data, init));
}

function validateProject(payload: ProjectPayload) {
  const title = payload.title?.trim();
  const kind = payload.kind ?? "course";
  const status = payload.status ?? "active";
  if (!title || title.length > 120) return { error: "项目名称需要控制在 1–120 个字符。" };
  if (!projectKinds.has(kind)) return { error: "项目类型不受支持。" };
  if (!projectStatuses.has(status)) return { error: "项目状态不受支持。" };
  const metadata = payload.metadata && typeof payload.metadata === "object" ? payload.metadata : {};
  if (metadata.evidence !== undefined && (!Array.isArray(metadata.evidence) || metadata.evidence.length > 200 || !metadata.evidence.every(validateProjectEvidence))) return {error:'论文来源记录格式不正确或超过 200 条。'};
  if (metadata.research !== undefined && !validateResearchDossier(metadata.research)) return {error:'研究设计或结论记录格式不正确。判读前请关联支撑材料，结论最多 20 条。'};
  if (metadata.analysisRecords !== undefined && !validateProjectAnalyses(metadata.analysisRecords)) return {error:'分析登记记录格式不正确，或超过 30 条。只保存摘要、设置与数据指纹。'};
  if (JSON.stringify(metadata).length > 120_000) return { error: "项目内容过长，请精简后重试。" };
  return { title, kind, status, metadata };
}

export async function GET() {
  try {
    const session = await readRequestSession();
    if (!session) return json({ error: "请先登录后使用项目工作台。" }, { status: 401 });
    const response = await supabaseRest(
      "learning_projects?select=id,user_id,title,kind,status,metadata,created_at,updated_at&order=updated_at.desc",
      session.accessToken,
    );
    if (!response.ok) return json({ error: "项目工作台暂时无法读取数据。" }, { status: 503 });
    const projects=await response.json() as Array<Record<string,unknown>>;
    const accessResponse=await supabaseRest('rpc/list_research_project_access',session.accessToken,{method:'POST',body:'{}'});
    const access=accessResponse.ok?await accessResponse.json() as Record<string,string>:{};
    return json({ projects: projects.map(project=>({...project,access_role:project.user_id===session.user.id?'owner':access[String(project.id)]??'viewer'})) });
  } catch (error) {
    return authError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await readRequestSession();
    if (!session) return json({ error: "请先登录后创建项目。" }, { status: 401 });
    const payload = await request.json() as ProjectPayload;
    if (payload.expectedOwnerId !== undefined && payload.expectedOwnerId !== session.user.id) return json({error:'账户已切换，请重新操作。'}, {status:409});
    const validated = validateProject(payload);
    if ("error" in validated) return json({ error: validated.error }, { status: 400 });
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
    if (!response.ok) return json({ error: "创建项目失败，请稍后重试。" }, { status: 503 });
    const rows = await response.json() as unknown[];
    return json({ project: rows[0] }, { status: 201 });
  } catch (error) {
    return authError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await readRequestSession();
    if (!session) return json({ error: "请先登录后更新项目。" }, { status: 401 });
    const id = request.nextUrl.searchParams.get("id");
    if (!id) return json({ error: "缺少项目编号。" }, { status: 400 });
    const payload = await request.json() as ProjectPayload;
    if (payload.expectedOwnerId !== undefined && payload.expectedOwnerId !== session.user.id) return json({error:'账户已切换，请重新操作。'}, {status:409});
    const expected = payload.expectedUpdatedAt;
    if (expected !== undefined && (typeof expected !== 'string' || expected.length > 40 || !Number.isFinite(Date.parse(expected)))) return json({error:'项目版本格式不正确。'}, {status:400});
    const validated = validateProject(payload);
    if ("error" in validated) return json({ error: validated.error }, { status: 400 });
    const versionFilter = expected === undefined ? '' : `&updated_at=eq.${encodeURIComponent(expected)}`;
    const response = await supabaseRest(`learning_projects?id=eq.${encodeURIComponent(id)}${versionFilter}`, session.accessToken, {
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
    if (!response.ok) return json({ error: "保存项目失败，请稍后重试。" }, { status: 503 });
    const rows = await response.json() as unknown[];
    if (!rows[0]) return json({ error: expected ? '项目已有其他修改或已删除，请重新读取后再保存。' : '没有找到这个项目。' }, { status: expected ? 409 : 404 });
    return json({ project: rows[0] });
  } catch (error) {
    return authError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await readRequestSession();
    if (!session) return json({ error: "请先登录后删除项目。" }, { status: 401 });
    const id = request.nextUrl.searchParams.get("id");
    if (!id) return json({ error: "缺少项目编号。" }, { status: 400 });
    const response = await supabaseRest(`learning_projects?id=eq.${encodeURIComponent(id)}`, session.accessToken, {
      method: "DELETE",
    });
    if (!response.ok) return json({ error: "删除项目失败，请稍后重试。" }, { status: 503 });
    return json({ deleted: true });
  } catch (error) {
    return authError(error);
  }
}
