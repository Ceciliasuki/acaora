import { NextRequest, NextResponse } from "next/server";
import { authError, readRequestSession, supabaseRest } from "../../auth/_shared";

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

export async function GET(request: NextRequest) {
  try {
    const session = await readRequestSession(request);
    if (!session) return NextResponse.json({ error: "请先登录。" }, { status: 401 });
    const response = await supabaseRest("paper_memories?select=id,title,file_name,extracted_content,ai_memory,updated_at&order=updated_at.desc", session.accessToken);
    if (!response.ok) return NextResponse.json({ error: "云端论文库尚未初始化。" }, { status: 503 });
    const rows = await response.json() as Array<{
      id: string;
      title: string;
      file_name?: string;
      extracted_content?: Record<string, unknown>;
      ai_memory?: Record<string, unknown>;
      updated_at?: string;
    }>;
    const papers = rows.map((row) => ({
      id: row.id,
      title: row.title,
      fileName: row.file_name ?? "cloud-paper.pdf",
      addedAt: Number(row.extracted_content?.addedAt ?? Date.now()),
      updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : Date.now(),
      activeParagraph: Number(row.extracted_content?.activeParagraph ?? 0),
      paragraphs: Array.isArray(row.extracted_content?.paragraphs) ? row.extracted_content.paragraphs : [],
      aiMemory: row.ai_memory ?? undefined,
    }));
    return NextResponse.json({ papers });
  } catch (error) {
    return authError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await readRequestSession(request);
    if (!session) return NextResponse.json({ error: "请先登录。" }, { status: 401 });
    const paper = await request.json() as CloudPaper;
    if (!paper.id || !paper.title || !Array.isArray(paper.paragraphs)) {
      return NextResponse.json({ error: "论文记忆格式不正确。" }, { status: 400 });
    }
    const serialized = JSON.stringify(paper);
    if (serialized.length > 1_500_000) return NextResponse.json({ error: "论文文本过长，暂时只保存在本机。" }, { status: 413 });
    const response = await supabaseRest("paper_memories?on_conflict=user_id,id", session.accessToken, {
      method: "POST",
      headers: { "Prefer": "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({
        id: paper.id,
        user_id: session.user.id,
        title: paper.title,
        file_name: paper.fileName ?? "",
        extracted_content: { addedAt: paper.addedAt ?? Date.now(), activeParagraph: paper.activeParagraph ?? 0, paragraphs: paper.paragraphs },
        ai_memory: paper.aiMemory ?? {},
        updated_at: new Date(paper.updatedAt ?? Date.now()).toISOString(),
      }),
    });
    if (!response.ok) return NextResponse.json({ error: "云同步失败，请稍后重试。" }, { status: 503 });
    return NextResponse.json({ synced: true });
  } catch (error) {
    return authError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await readRequestSession(request);
    if (!session) return NextResponse.json({ error: "请先登录。" }, { status: 401 });
    const id = request.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "缺少论文编号。" }, { status: 400 });
    const response = await supabaseRest(`paper_memories?id=eq.${encodeURIComponent(id)}`, session.accessToken, { method: "DELETE" });
    if (!response.ok) return NextResponse.json({ error: "云端删除失败。" }, { status: 503 });
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return authError(error);
  }
}
