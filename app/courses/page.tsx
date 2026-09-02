"use client";

import Link from "next/link";
import { ChangeEvent, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import AppSidebar from "../components/app-sidebar";
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

export default function CoursesPage() {
  const [track, setTrack] = useState<"全部" | Course["track"]>("全部");
  const [selected, setSelected] = useState(courses[0]);
  const [material, setMaterial] = useState("");
  const [materialName, setMaterialName] = useState("尚未添加资料");
  const apiKey = useSyncExternalStore(subscribeAiKey, readAiKey, getServerAiKeySnapshot);
  const [model, setModel] = useState("DeepSeek（服务器默认）");
  const [count, setCount] = useState(5);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<PracticeResult | null>(null);
  const visibleCourses = useMemo(() => track === "全部" ? courses : courses.filter((course) => course.track === track), [track]);

  useEffect(() => {
    void fetch("/api/papers/ai", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload: { model?: string }) => setModel(payload.model || "DeepSeek（服务器默认）"))
      .catch(() => undefined);
  }, []);

  async function readMaterial(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!/\.(txt|md|csv)$/i.test(file.name)) {
      setMaterialName(file.name);
      setError("第一版可直接读取 TXT、Markdown 与 CSV；PDF、Word 和课件请稍后随课程资料一起接入。" );
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
      <section className="workspace learning-main">
        <header className="topbar learning-topbar">
          <div><p className="eyebrow">LEARNING CENTER</p><h1>课程学习中心</h1><p>组织知识、导入资料，并按课程生成可追溯的练习。</p></div>
          <div className="track-tabs" role="tablist" aria-label="课程方向">
            {(["全部", "统计学", "经济学"] as const).map((item) => <button type="button" role="tab" aria-selected={track === item} key={item} className={track === item ? "active" : ""} onClick={() => setTrack(item)}>{item}</button>)}
          </div>
        </header>

        <section className="learning-layout">
          <div className="course-library">
            <div className="learning-section-title"><span>01</span><div><p>课程地图</p><h2>双学位知识体系</h2></div></div>
            <div className="course-grid">
              {visibleCourses.map((course) => <button type="button" key={course.code} className={selected.code === course.code ? "active" : ""} onClick={() => { setSelected(course); setResult(null); }}>
                <span>{course.code}</span><small>{course.track} · {course.stage}</small><strong>{course.name}</strong><p>{course.topics.join(" · ")}</p><i>进入课程 →</i>
              </button>)}
            </div>
          </div>

          <aside className="course-focus">
            <span>{selected.code}</span><h2>{selected.name}</h2><p>{selected.topics.join(" · ")}</p>
            <dl><div><dt>课程方向</dt><dd>{selected.track}</dd></div><div><dt>当前资料</dt><dd>{materialName}</dd></div></dl>
            <label className="material-upload">添加本地资料<input type="file" accept=".txt,.md,.csv,text/plain,text/markdown,text/csv" onChange={(event) => void readMaterial(event)} /></label>
            <small>原始文件留在设备中；练习生成时只发送你当前粘贴的文本。</small>
          </aside>
        </section>

        <section className="practice-studio">
          <div className="learning-section-title"><span>02</span><div><p>AI PRACTICE</p><h2>基于资料生成练习</h2></div></div>
          <div className="practice-grid">
            <div className="practice-config">
              <label>课程资料<textarea value={material} onChange={(event) => setMaterial(event.target.value)} placeholder="粘贴讲义、教材摘录或课堂笔记。之后你上传核心课程资料时，这里会升级为课程知识库。" /></label>
              <div className="practice-controls"><label>题目数量<select value={count} onChange={(event) => setCount(Number(event.target.value))}><option value={3}>3 题</option><option value={5}>5 题</option><option value={8}>8 题</option></select></label><div className="course-model-status"><span>当前模型</span><strong>{model}</strong><small>{apiKey ? "当前会话已配置 Key" : "尚未配置 Key"}</small><Link href="/settings#ai-models">管理 AI 设置</Link></div></div>
              <button type="button" onClick={() => void generatePractice()} disabled={working}>{working ? "正在生成练习…" : "生成本节练习"}</button>
              {error && <p className="course-error" role="alert">{error}</p>}
            </div>
            <div className="practice-result">
              {!result ? <div className="practice-empty"><b>Q</b><strong>练习将在这里生成</strong><p>每题包含答案、分步解析和常见误区。</p></div> : <>
                <div className="knowledge-tags">{result.knowledge_map?.map((item) => <span key={item}>{item}</span>)}</div>
                {result.questions?.map((question, index) => <details key={index} open={index === 0}><summary><span>{question.type} · {question.difficulty}</span><strong>{index + 1}. {question.question}</strong></summary>{question.options?.map((option) => <p className="question-option" key={option}>{option}</p>)}<div className="question-answer"><b>答案</b><p>{question.answer}</p><b>解析</b><p>{question.explanation}</p>{question.common_mistake && <><b>常见误区</b><p>{question.common_mistake}</p></>}</div></details>)}
              </>}
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
