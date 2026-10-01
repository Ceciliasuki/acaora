"use client";

import Link from "next/link";
import { ChangeEvent, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { BookOpen, Check, FlaskConical, Upload } from "lucide-react";
import AppSidebar from "../components/app-sidebar";
import { Button, FormField, Select, StatusMessage, Textarea } from "../components/ui";
import { getServerAiKeySnapshot, readAiKey, subscribeAiKey } from "../lib/ai-settings";

type Course = { code: string; name: string; track: "统计学" | "经济学"; stage: string; topics: string[] };
type PracticeResult = {
  knowledge_map?: string[];
  questions?: Array<{ type?: string; difficulty?: string; question?: string; options?: string[]; answer?: string; explanation?: string; common_mistake?: string }>;
  next_review?: string[];
};

const courses: Course[] = [
  { code: "STAT-201", name: "概率论与数理统计", track: "统计学", stage: "基础", topics: ["随机变量", "参数估计", "假设检验"] },
  { code: "STAT-302", name: "回归分析", track: "统计学", stage: "核心", topics: ["线性模型", "模型诊断", "变量选择"] },
  { code: "STAT-306", name: "多元统计分析", track: "统计学", stage: "进阶", topics: ["主成分", "聚类", "判别分析"] },
  { code: "ECON-301", name: "计量经济学", track: "经济学", stage: "核心", topics: ["OLS", "内生性", "面板数据"] },
  { code: "ECON-204", name: "微观经济学", track: "经济学", stage: "基础", topics: ["消费者理论", "厂商理论", "市场结构"] },
  { code: "TRADE-305", name: "国际贸易学", track: "经济学", stage: "核心", topics: ["贸易理论", "关税政策", "全球价值链"] },
  { code: "FIN-308", name: "国际金融", track: "经济学", stage: "进阶", topics: ["汇率决定", "国际收支", "开放经济"] },
];

const tracks = ["全部", "统计学", "经济学"] as const;

export default function CoursesPage() {
  const [track, setTrack] = useState<"全部" | Course["track"]>("全部");
  const [selected, setSelected] = useState(courses[0]);
  const [material, setMaterial] = useState("");
  const [materialName, setMaterialName] = useState("尚未添加资料");
  const apiKey = useSyncExternalStore(subscribeAiKey, readAiKey, getServerAiKeySnapshot);
  /* Three outcomes, kept apart: a declared model, a server that declared nothing
     (so we fall back), and a request that failed. Only the first is a confirmed
     configuration. */
  const [model, setModel] = useState("");
  const [modelState, setModelState] = useState<"loading" | "ready" | "fallback" | "error">("loading");
  const [count, setCount] = useState(5);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<PracticeResult | null>(null);
  const visibleCourses = useMemo(() => track === "全部" ? courses : courses.filter((course) => course.track === track), [track]);

  useEffect(() => {
    void fetch("/api/papers/ai", { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error("MODEL_CONFIG_UNREACHABLE");
        return response.json() as Promise<{ model?: string }>;
      })
      .then((payload) => {
        const declared = (payload.model ?? "").trim();
        setModel(declared);
        setModelState(declared ? "ready" : "fallback");
      })
      .catch(() => {
        setModel("");
        setModelState("error");
      });
  }, []);

  async function readMaterial(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!/\.(txt|md|csv)$/i.test(file.name)) {
      setMaterialName(file.name);
      setError("目前支持 TXT、Markdown 和 CSV。请将 PDF 或 Word 的内容粘贴到资料框。" );
      return;
    }
    setMaterial((await file.text()).slice(0, 60000));
    setMaterialName(file.name);
    setError("");
  }

  async function generatePractice() {
    if (material.trim().length < 80) {
      setError("请先粘贴或导入一段课程资料，至少约 80 个字符。" );
      return;
    }
    if (!apiKey.trim()) {
      setError("请先前往“设置 → AI 与模型”配置 DeepSeek API Key。" );
      return;
    }
    setWorking(true);
    setError("");
    try {
      const response = await fetch("/api/papers/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-deepseek-key": apiKey.trim() },
        body: JSON.stringify({
          action: "practice",
          title: selected.name,
          question: `生成 ${count} 道题，覆盖 ${selected.topics.join("、")}`,
          context: `课程：${selected.name}\n方向：${selected.track}\n资料：\n${material}`,
        }),
      });
      const payload = await response.json() as { result?: PracticeResult; error?: string };
      if (!response.ok || !payload.result) throw new Error(payload.error || "练习生成失败。" );
      setResult(payload.result);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "练习生成失败。" );
    } finally {
      setWorking(false);
    }
  }

  return (
    <main className="student-app learning-app">
      <AppSidebar active="courses" profileTitle="课程学习中心" profileSubtitle="统计学 × 国际经贸" />
      <section className="workspace learning-main courses-shell">
        {/* Control band: the page name, the one real filter, and the counts. */}
        <div className="page-bar">
          <div className="page-bar-inner">
            <h1>课程中心</h1>
            <div className="page-bar-seg" role="group" aria-label="课程方向">
              {tracks.map((item) => <button type="button" aria-pressed={track === item} key={item} onClick={() => setTrack(item)}>{item}</button>)}
            </div>
            <span className="page-bar-spacer" />
            <span className="page-bar-date">显示 {visibleCourses.length} / {courses.length} 门</span>
          </div>
        </div>

        <div className="page-body">

          <div className="ruled-split">
            <div className="ruled-main">
              <h2 className="ruled-heading">课程</h2>
              <ul className="course-list">
                {visibleCourses.map((course) => {
                  const current = selected.code === course.code;
                  return <li className="course-list-item" key={course.code}>
                    <button
                      type="button"
                      className="course-row"
                      aria-current={current ? "true" : undefined}
                      onClick={() => { setSelected(course); setResult(null); }}
                    >
                      <span className="course-row-code">{course.code}</span>
                      <span className="course-row-track">{course.track} · {course.stage}</span>
                      <span className="course-row-name">{course.name}</span>
                      <span className="course-row-topics">{course.topics.join(" · ")}</span>
                      {/* The selection carries a shape as well as a wash, so it never
                          depends on colour alone; aria-current states it to assistive
                          technology as well. */}
                      <span className="course-row-mark" aria-hidden="true">{current ? <Check size={16} strokeWidth={2} /> : null}</span>
                    </button>
                  </li>;
                })}
              </ul>
            </div>

            <aside className="current-work">
              <h2 className="ruled-heading">当前课程</h2>
              <div className="current-work-head">
                <span className="current-work-mark"><BookOpen size={18} strokeWidth={1.9} aria-hidden="true" /></span>
                <span className="current-work-title">{selected.name}</span>
              </div>
              <div className="current-work-meta">
                <span>{selected.code}</span>
                <span>{selected.track} · {selected.stage}</span>
              </div>
              <dl className="course-kv">
                <div><dt>知识点</dt><dd>{selected.topics.join(" · ")}</dd></div>
                <div><dt>当前资料</dt><dd>{materialName}</dd></div>
              </dl>
              {/* Visually hidden but still focusable: a `display:none` input would
                  take the file picker away from the keyboard. */}
              <label className="course-upload">
                <Upload size={16} strokeWidth={1.9} aria-hidden="true" />添加本地资料
                <input type="file" accept=".txt,.md,.csv,text/plain,text/markdown,text/csv" onChange={(event) => void readMaterial(event)} />
              </label>
              <p className="ruled-note">原始文件留在设备中；练习生成时只发送你当前粘贴的文本。</p>
            </aside>
          </div>

          <h2 className="ruled-heading ruled-heading--section">练习</h2>
          <p className="practice-model"><span>{modelState === "ready" ? model : modelState === "fallback" ? "模型未声明，使用服务端默认配置" : modelState === "error" ? "暂时无法读取模型配置" : "正在读取模型配置…"}</span> · {apiKey ? "已配置密钥" : "尚未配置密钥"} <Link href="/settings#ai-models">设置</Link></p>
          <div className="ruled-split ruled-split--practice">
            <div className="ruled-main practice-config">
              <FormField label="课程资料" hint="至少约 80 个字符；PDF 与 Word 暂不支持。">
                <Textarea
                  className="practice-material"
                  value={material}
                  onChange={(event) => setMaterial(event.target.value)}
                  placeholder="粘贴讲义、教材摘录或课堂笔记。"
                />
              </FormField>
              <div className="practice-controls">
                <FormField label="题目数量">
                  <Select value={count} onChange={(event) => setCount(Number(event.target.value))}>
                    <option value={3}>3 题</option>
                    <option value={5}>5 题</option>
                    <option value={8}>8 题</option>
                  </Select>
                </FormField>
                <p className="practice-note">生成的是 {selected.name} 的练习，覆盖 {selected.topics.join("、")}。</p>
              </div>
              <Button className="practice-run" variant="primary" loading={working} onClick={() => void generatePractice()}>
                {working ? "正在生成练习…" : "生成本节练习"}
              </Button>
              {error && <StatusMessage tone="error" className="practice-error">{error}</StatusMessage>}
            </div>

            {/* The AI result panel: the teal ground is the system's own way of
                marking a surface as AI output rather than source material, and the
                label says so in words as well. */}
            <aside className="practice-result">
              <p className="ai-label"><FlaskConical size={16} strokeWidth={1.9} aria-hidden="true" />由 AI 生成 · 不是课程原文</p>
              {!result ? <div className="practice-empty">
                <strong>练习将在这里生成</strong>
                <p>每题包含答案、分步解析和常见误区。</p>
              </div> : <>
                {result.knowledge_map?.length ? <ul className="knowledge-tags">
                  {result.knowledge_map.map((item) => <li key={item}>{item}</li>)}
                </ul> : null}
                {result.questions?.map((question, index) => <details key={index} open={index === 0}>
                  <summary>
                    <span>{question.type} · {question.difficulty}</span>
                    <strong>{index + 1}. {question.question}</strong>
                  </summary>
                  {question.options?.map((option) => <p className="question-option" key={option}>{option}</p>)}
                  <div className="question-answer">
                    <b>答案</b><p>{question.answer}</p>
                    <b>解析</b><p>{question.explanation}</p>
                    {question.common_mistake && <><b>常见误区</b><p>{question.common_mistake}</p></>}
                  </div>
                </details>)}
              </>}
            </aside>
          </div>
        </div>

      </section>
    </main>
  );
}
