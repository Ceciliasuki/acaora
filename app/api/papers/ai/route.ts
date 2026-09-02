import { NextRequest, NextResponse } from "next/server";

type AiAction = "paragraph" | "summary" | "audit" | "replication" | "translate" | "chat" | "search" | "practice";

type AiRequest = {
  action?: AiAction;
  title?: string;
  section?: string;
  text?: string;
  question?: string;
  context?: string;
  style?: string;
};

const actionPrompts: Record<AiAction, string> = {
  paragraph: `分析给出的英文学术论文段落。输出 JSON：
{"role":"本段作用","plain_explanation":"本科生能理解的解释","methods":["统计方法"],"variables":["变量"],"assumptions":["隐含假设"],"findings":["结论"],"risks":[{"level":"low|medium|high","issue":"问题","reason":"理由"}],"terms":[{"term":"英文术语","translation":"中文","explanation":"解释"}],"questions":["值得追问的问题"]}。只根据原文分析，不确定时明确说明。`,
  summary: `生成结构化论文阅读报告。输出 JSON：
{"research_question":"研究问题","three_minute_summary":"三分钟摘要","hypotheses":["假设"],"data_and_sample":"数据与样本","variables":{"outcomes":[],"exposures":[],"controls":[]},"methods":["方法"],"findings":["发现"],"robustness":["稳健性检验"],"contributions":["贡献"],"limitations":["局限"],"future_work":["后续方向"],"evidence":[{"claim":"关键判断","paragraphs":["P1"]}]}。不得补造原文没有的信息。`,
  audit: `以严谨的应用统计学审稿人身份审查论文。输出 JSON：
{"overall":"总体评价","strengths":["优点"],"issues":[{"severity":"info|warning|critical","topic":"主题","finding":"发现","evidence":["P1"],"recommendation":"改进建议"}],"assumption_checks":[{"assumption":"假设","status":"supported|unclear|violated","evidence":["P1"]}],"causal_claim":"因果解释评价","reporting_checklist":[{"item":"检查项","status":"yes|no|unclear"}]}。覆盖模型匹配、样本量、效应量、置信区间、多重检验、缺失值、共线性、内生性、过拟合与外部验证；没有证据时写 unclear。`,
  replication: `为应用统计学学生生成可执行的复现路线。输出 JSON：
{"goal":"复现目标","required_data":["所需数据和字段"],"workflow":[{"step":1,"task":"步骤","check":"验证标准"}],"r_code":"最小 R 代码框架","python_code":"最小 Python 代码框架","unknowns":["论文未提供的信息"],"validation":["应进行的诊断或稳健性检验"]}。代码只能是框架，禁止虚构变量名或声称已经复现。`,
  translate: `把英文论文段落翻译为简体中文。输出 JSON：{"translation":"译文","glossary":[{"term":"英文","translation":"中文"}],"notes":["歧义或表达说明"]}。保持统计术语准确、公式和数值不变。`,
  chat: `回答用户关于论文的问题。输出 JSON：{"answer":"中文回答","citations":[{"paragraph":"P1","quote":"不超过20个英文单词的依据摘录"}],"uncertainty":"不确定性说明","followups":["后续可问的问题"]}。只能使用所给论文片段，每个实质结论都引用段落编号；证据不足时直接说明。`,
  search: `把研究主题设计成学术检索策略。输出 JSON：{"english_query":"最推荐的英文检索式","alternative_queries":["替代检索式"],"keywords":{"population":[],"exposure":[],"outcome":[],"method":[]},"inclusion_criteria":["纳入标准"],"exclusion_criteria":["排除标准"],"suggested_databases":["数据库"]}。检索式适合 Semantic Scholar 和 Crossref，不要杜撰论文。`,
  practice: `根据给出的课程名称、学习目标和资料内容生成本科阶段练习。输出 JSON：{"knowledge_map":["本次覆盖知识点"],"questions":[{"type":"单选题|计算题|简答题|案例题","difficulty":"基础|进阶|挑战","question":"题目","options":["仅单选题提供选项"],"answer":"答案","explanation":"分步解析","common_mistake":"常见误区"}],"next_review":["建议复习内容"]}。题目必须以资料为依据；资料不足时减少题量并明确说明，不得虚构定理、数据或课程要求。`,
};

export async function GET() {
  return NextResponse.json({
    available: true,
    ownerKeyConfigured: Boolean(process.env.DEEPSEEK_API_KEY),
    mode: "byok",
    model: process.env.DEEPSEEK_MODEL || "deepseek-v4-flash",
  });
}

export async function POST(request: NextRequest) {
  let body: AiRequest;
  try {
    body = await request.json() as AiRequest;
  } catch {
    return NextResponse.json({ error: "请求格式不正确。" }, { status: 400 });
  }

  const action = body.action;
  if (!action || !(action in actionPrompts)) {
    return NextResponse.json({ error: "未知的 AI 任务。" }, { status: 400 });
  }

  const providedKey = request.headers.get("x-deepseek-key")?.trim();
  const apiKey = providedKey || process.env.DEEPSEEK_API_KEY;
  if (!apiKey || !apiKey.startsWith("sk-")) {
    return NextResponse.json({ error: "请先在 AI 研究工作台中输入有效的 DeepSeek API Key。" }, { status: 401 });
  }

  const text = (body.text ?? "").slice(0, 90000);
  const context = (body.context ?? "").slice(0, 90000);
  if (!text && !context) {
    return NextResponse.json({ error: "没有可分析的内容。" }, { status: 400 });
  }

  const userContent = [
    `任务：${action}`,
    body.title ? `论文标题：${body.title}` : "",
    body.section ? `当前章节：${body.section}` : "",
    body.style ? `翻译风格：${body.style}` : "",
    body.question ? `用户问题：${body.question}` : "",
    text ? `当前文本：\n${text}` : "",
    context ? `带编号的论文上下文：\n${context}` : "",
  ].filter(Boolean).join("\n\n");

  const model = process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";
  try {
    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: `你是 Acaora 的大学学习与研究助理。${actionPrompts[action]} 输出必须是 JSON，不要使用 Markdown 代码块。` },
          { role: "user", content: userContent },
        ],
        response_format: { type: "json_object" },
        stream: false,
        max_tokens: action === "translate" ? 2500 : 6000,
      }),
      signal: AbortSignal.timeout(120000),
    });

    const payload = await response.json() as {
      error?: { message?: string };
      choices?: Array<{ message?: { content?: string } }>;
      usage?: Record<string, number>;
    };
    if (!response.ok) {
      const detail = payload.error?.message || `DeepSeek 返回 ${response.status}`;
      return NextResponse.json({ error: detail }, { status: response.status === 401 ? 401 : 502 });
    }

    const content = payload.choices?.[0]?.message?.content?.trim();
    if (!content) return NextResponse.json({ error: "DeepSeek 没有返回内容，请重试。" }, { status: 502 });
    let result: Record<string, unknown>;
    try {
      result = JSON.parse(content) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "AI 返回内容无法解析，请重试。" }, { status: 502 });
    }
    return NextResponse.json({ result, model, usage: payload.usage ?? null });
  } catch (error) {
    const message = error instanceof Error && error.name === "TimeoutError"
      ? "AI 分析超时，请缩小分析范围后重试。"
      : "暂时无法连接 DeepSeek，请稍后重试。";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
