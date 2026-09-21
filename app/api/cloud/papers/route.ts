import { NextRequest, NextResponse } from "next/server";
import { authError, privateNoStore, readRequestSession, supabaseRest } from "../../auth/_shared";

type CloudPaper = {
  id?: string;
  title?: string;
  fileName?: string;
  addedAt?: number;
  updatedAt?: number;
  activeParagraph?: number;
  paragraphs?: unknown[];
  aiMemory?: Record<string, unknown>;
};

function json(data: unknown, init?: ResponseInit) {
  return privateNoStore(NextResponse.json(data, init));
}

export async function GET() {
  try {
    const session = await readRequestSession();
    if (!session) return json({ error: "请先登录。" }, { status: 401 });
    const response = await supabaseRest("paper_memories?select=id,title,file_name,extracted_content,ai_memory,updated_at,deleted_at&order=updated_at.desc", session.accessToken);
    if (!response.ok) return json({ error: "云端论文库尚未初始化。" }, { status: 503 });
    const rows = await response.json() as Array<{
      id: string;
      title: string;
      file_name?: string;
      extracted_content?: Record<string, unknown>;
      ai_memory?: Record<string, unknown>;
      updated_at?: string;
      deleted_at?: string | null;
    }>;
    const activeRows = rows.filter((row) => !row.deleted_at);
    const papers = activeRows.map((row) => ({
      id: row.id,
      title: row.title,
      fileName: row.file_name ?? "cloud-paper.pdf",
      addedAt: Number(row.extracted_content?.addedAt ?? Date.now()),
      updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : Date.now(),
      activeParagraph: Number(row.extracted_content?.activeParagraph ?? 0),
      paragraphs: Array.isArray(row.extracted_content?.paragraphs) ? row.extracted_content.paragraphs : [],
      aiMemory: row.ai_memory ?? undefined,
    }));
    const deletions = rows
      .filter((row) => row.deleted_at)
      .map((row) => ({ id: row.id, deletedAt: new Date(row.deleted_at!).getTime() }));
    return json({ papers, deletions });
  } catch (error) {
    return authError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await readRequestSession();
    if (!session) return json({ error: "请先登录。" }, { status: 401 });
    const paper = await request.json() as CloudPaper;
    if (!paper.id || !paper.title || !Array.isArray(paper.paragraphs)) {
      return json({ error: "论文记忆格式不正确。" }, { status: 400 });
    }
    const serialized = JSON.stringify(paper);
    if (serialized.length > 1_500_000) return json({ error: "论文文本过长，暂时只保存在本机。" }, { status: 413 });
    const updatedAt = Number(paper.updatedAt ?? Date.now());
    if (!Number.isFinite(updatedAt)) return json({ error: "论文更新时间不正确。" }, { status: 400 });
    const response = await supabaseRest("rpc/sync_paper_memory", session.accessToken, {
      method: "POST",
      body: JSON.stringify({
        p_id: paper.id,
        p_title: paper.title,
        p_file_name: paper.fileName ?? "",
        p_extracted_content: { addedAt: paper.addedAt ?? Date.now(), activeParagraph: paper.activeParagraph ?? 0, paragraphs: paper.paragraphs },
        p_ai_memory: paper.aiMemory ?? {},
        p_updated_at: new Date(updatedAt).toISOString(),
      }),
    });
    if (!response.ok) return json({ error: "云同步失败，请稍后重试。" }, { status: 503 });
    const result = await response.json() as { status?: string };
    if (result.status === "stale") return json({ error: "云端已有更新版本。", code: "stale_write" }, { status: 409 });
    return json({ synced: true });
  } catch (error) {
    return authError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await readRequestSession();
    if (!session) return json({ error: "请先登录。" }, { status: 401 });
    const id = request.nextUrl.searchParams.get("id");
    if (!id) return json({ error: "缺少论文编号。" }, { status: 400 });
    const response = await supabaseRest("rpc/delete_paper_memory", session.accessToken, {
      method: "POST",
      body: JSON.stringify({ p_id: id }),
    });
    if (!response.ok) return json({ error: "云端删除失败。" }, { status: 503 });
    const result = await response.json() as { deletedAt?: number };
    return json({ deleted: true, deletedAt: Number(result.deletedAt ?? Date.now()) });
  } catch (error) {
    return authError(error);
  }
}
