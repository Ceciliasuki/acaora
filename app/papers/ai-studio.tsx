"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { getServerAiKeySnapshot, readAiKey, subscribeAiKey } from "../lib/ai-settings";
import type { AiMemory, AiSavedResult, PaperRecord, Paragraph } from "./paper-types";

type AiAction = "paragraph" | "summary" | "audit" | "replication" | "translate" | "chat" | "search";

type Props = {
  paper: PaperRecord;
  activeParagraph?: Paragraph;
  activeIndex: number;
  mobileVisible: boolean;
  onSave: (memory: AiMemory) => void;
  onTranslation: (translation: string) => void;
  onSearchQuery: (query: string) => void;
};

const actionMeta: Record<AiAction, { label: string; kicker: string; description: string; button: string }> = {
  paragraph: { label: "段落拆解", kicker: "PARAGRAPH", description: "识别段落作用、统计方法、变量、假设、结论与风险。", button: "分析当前段落" },
  summary: { label: "全文报告", kicker: "PAPER REPORT", description: "生成三分钟摘要、研究设计、核心发现、贡献与局限。", button: "生成阅读报告" },
  audit: { label: "统计审查", kicker: "STAT AUDIT", description: "检查模型、假设、效应量、缺失值、因果解释和报告规范。", button: "开始统计审查" },
  replication: { label: "复现方案", kicker: "REPLICATION", description: "整理数据需求、分析步骤、R/Python 框架与验证清单。", button: "生成复现路线" },
  translate: { label: "增强翻译", kicker: "TRANSLATION", description: "获得更自然的学术译文、术语表和歧义提示。", button: "翻译当前段落" },
  chat: { label: "论文问答", kicker: "ASK THE PAPER", description: "基于相关段落回答，并给出段落编号和短引用。", button: "向论文提问" },
  search: { label: "检索策略", kicker: "SEARCH STRATEGY", description: "把研究主题拆成英文检索式、关键词和纳排标准。", button: "生成检索方案" },
};

export default function AiStudio({ paper, activeParagraph, activeIndex, mobileVisible, onSave, onTranslation, onSearchQuery }: Props) {
  const [action, setAction] = useState<AiAction>("paragraph");
  const apiKey = useSyncExternalStore(subscribeAiKey, readAiKey, getServerAiKeySnapshot);
  const [question, setQuestion] = useState("这篇论文的统计方法是否足以支持其主要结论？");
  const [researchTopic, setResearchTopic] = useState(paper.title);
  const [translationStyle, setTranslationStyle] = useState("统计术语优先，表达自然");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [usage, setUsage] = useState("");
  const [sessionResult, setSessionResult] = useState<AiSavedResult | null>(null);

  const savedResult = useMemo(() => {
    const memory = paper.aiMemory;
    if (!memory) return null;
    if (action === "paragraph" && activeParagraph) return memory.paragraph?.[activeParagraph.id] ?? null;
    if (action === "summary") return memory.summary ?? null;
    if (action === "audit") return memory.audit ?? null;
    if (action === "replication") return memory.replication ?? null;
    if (action === "search") return memory.search ?? null;
    if (action === "chat") return memory.chats?.[0] ?? null;
    return null;
  }, [action, activeParagraph, paper.aiMemory]);

  const result = sessionResult?.action === action ? sessionResult : savedResult;

  async function runAction() {
    if (!activeParagraph && (action === "paragraph" || action === "translate")) return;
    if (!apiKey.trim()) {
      setError("请先前往“设置 → AI 与模型”配置 DeepSeek API Key。" );
      return;
    }
    setWorking(true);
    setError("");
    setUsage("");
    try {
      const context = action === "chat"
        ? buildRelevantContext(paper, question)
        : buildPaperContext(paper);
      const response = await fetch("/api/papers/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-deepseek-key": apiKey.trim() },
        body: JSON.stringify({
          action,
          title: paper.title,
          section: activeParagraph?.section,
          text: action === "paragraph" || action === "translate" ? activeParagraph?.original : action === "search" ? researchTopic : "",
          question: action === "chat" ? question : "",
          style: action === "translate" ? translationStyle : "",
          context: ["summary", "audit", "replication", "chat"].includes(action) ? context : "",
        }),
      });
      const payload = await response.json() as { error?: string; result?: Record<string, unknown>; model?: string; usage?: Record<string, number> };
      if (!response.ok || !payload.result) throw new Error(payload.error ?? "AI 分析失败。" );
      const saved: AiSavedResult = { action, title: actionMeta[action].label, data: payload.result, createdAt: Date.now() };
      setSessionResult(saved);
      const total = payload.usage?.total_tokens;
      setUsage(`${payload.model ?? "DeepSeek"}${total ? ` · ${total.toLocaleString()} tokens` : ""}`);

      if (action === "translate" && typeof payload.result.translation === "string") {
        onTranslation(payload.result.translation);
      } else {
        const current: AiMemory = paper.aiMemory ?? { paragraph: {}, chats: [] };
        const next = saveResult(current, saved, activeParagraph?.id);
        onSave(next);
      }
      if (action === "search" && typeof payload.result.english_query === "string") {
        onSearchQuery(payload.result.english_query);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "AI 分析失败。" );
    } finally {
      setWorking(false);
    }
  }

  return (
    <section className={`ai-studio ${mobileVisible ? "mobile-visible" : ""}`}>
      <div className="ai-studio-head">
        <div>
          <p>DEEPSEEK RESEARCH COPILOT</p>
          <h2>AI 研究工作台</h2>
          <span>证据优先 · 段落可追溯 · 结果保存在当前设备</span>
        </div>
        <div className="ai-key-box"><strong>{apiKey ? "当前会话已配置 DeepSeek Key" : "当前会话未配置 AI Key"}</strong><small>Key 只保存在当前浏览器会话；发起分析时会发送到 Acaora 服务端并转发给 DeepSeek，不写入账户数据库。</small><Link href="/settings#ai-models">管理 AI 与模型 →</Link></div>
      </div>

      <div className="ai-action-tabs" role="tablist" aria-label="AI 研究功能">
        {(Object.keys(actionMeta) as AiAction[]).map((item) => <button key={item} className={action === item ? "active" : ""} type="button" onClick={() => { setAction(item); setSessionResult(null); setError(""); }}>{actionMeta[item].label}</button>)}
      </div>

      <div className="ai-studio-body">
        <aside className="ai-task-card">
          <p>{actionMeta[action].kicker}</p>
          <h3>{actionMeta[action].label}</h3>
          <span>{actionMeta[action].description}</span>
          {action === "chat" && <textarea value={question} onChange={(event) => setQuestion(event.target.value)} aria-label="向论文提问" placeholder="例如：作者的因果结论成立吗？" />}
          {action === "search" && <textarea value={researchTopic} onChange={(event) => setResearchTopic(event.target.value)} aria-label="研究主题" placeholder="用中文描述研究主题……" />}
          {action === "translate" && <select aria-label="翻译风格" value={translationStyle} onChange={(event) => setTranslationStyle(event.target.value)}><option>统计术语优先，表达自然</option><option>忠实直译，保留句法</option><option>本科生易懂，并解释术语</option></select>}
          <button className="ai-run" type="button" disabled={working || !activeParagraph} onClick={() => void runAction()}>{working ? "DeepSeek 正在分析…" : actionMeta[action].button}</button>
          <small>{action === "paragraph" || action === "translate" ? `当前分析第 ${activeIndex + 1} 段` : `将使用最多 ${Math.min(paper.paragraphs.length, 80)} 个带编号段落`}</small>
          {error && <div className="ai-error" role="alert">{error}</div>}
        </aside>

        <div className="ai-result-panel">
          <div className="ai-result-top"><div><span>STRUCTURED RESULT</span><strong>{result ? result.title : "等待运行"}</strong></div>{usage && <small>{usage}</small>}</div>
          {result ? <><ResultView data={result.data} /><div className="ai-result-foot">生成于 {new Date(result.createdAt).toLocaleString("zh-CN")} · AI 内容可能出错，请回到引用段落核对。</div></> : <div className="ai-empty-result"><b>DS</b><strong>从一个可核查的问题开始</strong><p>AI 不会替你做学术判断。它会把结论、证据和不确定性分开呈现。</p></div>}
        </div>
      </div>
    </section>
  );
}

function saveResult(memory: AiMemory, result: AiSavedResult, paragraphId?: string): AiMemory {
  if (result.action === "paragraph" && paragraphId) return { ...memory, paragraph: { ...memory.paragraph, [paragraphId]: result } };
  if (result.action === "summary") return { ...memory, summary: result };
  if (result.action === "audit") return { ...memory, audit: result };
  if (result.action === "replication") return { ...memory, replication: result };
  if (result.action === "search") return { ...memory, search: result };
  if (result.action === "chat") return { ...memory, chats: [result, ...(memory.chats ?? [])].slice(0, 20) };
  return memory;
}

function buildPaperContext(paper: PaperRecord) {
  return paper.paragraphs.slice(0, 80).map((paragraph, index) => `[P${index + 1} | ${paragraph.section} | page ${paragraph.page}] ${paragraph.original}`).join("\n\n").slice(0, 85000);
}

function buildRelevantContext(paper: PaperRecord, question: string) {
  const terms = new Set(question.toLowerCase().split(/[^a-z0-9\u4e00-\u9fff]+/).filter((term) => term.length > 1));
  const ranked = paper.paragraphs.map((paragraph, index) => {
    const haystack = `${paragraph.section} ${paragraph.original} ${paragraph.translation}`.toLowerCase();
    let score = paragraph.bookmarked ? 2 : 0;
    terms.forEach((term) => { if (haystack.includes(term)) score += 3; });
    if (/method|result|model|regression|sample|confidence|方法|结果|模型|样本/.test(haystack)) score += 1;
    return { paragraph, index, score };
  }).sort((a, b) => b.score - a.score || a.index - b.index).slice(0, 12);
  return ranked.map(({ paragraph, index }) => `[P${index + 1} | ${paragraph.section} | page ${paragraph.page}] ${paragraph.original}`).join("\n\n");
}

function ResultView({ data }: { data: Record<string, unknown> }) {
  return <div className="structured-result">{Object.entries(data).map(([key, value]) => <ResultField key={key} label={prettyLabel(key)} value={value} />)}</div>;
}

function ResultField({ label, value }: { label: string; value: unknown }) {
  if (value === null || value === undefined || value === "") return null;
  if (Array.isArray(value)) {
    return <section className="result-field"><h4>{label}</h4><div className="result-list">{value.map((item, index) => typeof item === "object" && item !== null ? <div className="result-object" key={index}>{Object.entries(item as Record<string, unknown>).map(([childKey, childValue]) => <ResultField key={childKey} label={prettyLabel(childKey)} value={childValue} />)}</div> : <p key={index}><i />{String(item)}</p>)}</div></section>;
  }
  if (typeof value === "object") {
    return <section className="result-field"><h4>{label}</h4><div className="result-object">{Object.entries(value as Record<string, unknown>).map(([childKey, childValue]) => <ResultField key={childKey} label={prettyLabel(childKey)} value={childValue} />)}</div></section>;
  }
  const long = String(value).length > 100;
  return <section className={`result-field ${long ? "wide" : ""}`}><h4>{label}</h4><p>{String(value)}</p></section>;
}

function prettyLabel(key: string) {
  const labels: Record<string, string> = {
    role: "段落作用", plain_explanation: "通俗解释", methods: "统计方法", variables: "变量", assumptions: "模型假设", findings: "主要发现", risks: "潜在问题", terms: "术语", questions: "延伸问题",
    research_question: "研究问题", three_minute_summary: "三分钟摘要", hypotheses: "研究假设", data_and_sample: "数据与样本", robustness: "稳健性检验", contributions: "贡献", limitations: "局限", future_work: "未来研究", evidence: "证据索引",
    overall: "总体评价", strengths: "优点", issues: "审查发现", assumption_checks: "假设检查", causal_claim: "因果解释", reporting_checklist: "报告规范",
    goal: "复现目标", required_data: "所需数据", workflow: "复现步骤", r_code: "R 代码框架", python_code: "Python 代码框架", unknowns: "缺失信息", validation: "验证清单",
    translation: "中文译文", glossary: "术语表", notes: "翻译说明", answer: "回答", citations: "原文依据", uncertainty: "不确定性", followups: "继续追问",
    english_query: "推荐检索式", alternative_queries: "替代检索式", keywords: "关键词矩阵", inclusion_criteria: "纳入标准", exclusion_criteria: "排除标准", suggested_databases: "推荐数据库",
    severity: "等级", topic: "主题", finding: "发现", recommendation: "建议", status: "状态", item: "检查项", paragraph: "段落", quote: "短引用", term: "术语", explanation: "解释", step: "步骤", task: "任务", check: "检查标准", claim: "判断", paragraphs: "依据段落",
  };
  return labels[key] ?? key.replaceAll("_", " ");
}
