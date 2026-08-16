"use client";

import { ChangeEvent, DragEvent, useMemo, useRef, useState } from "react";
import AppSidebar from "../components/app-sidebar";
import {
  categoricalColumns,
  DataSet,
  formatNumber,
  formatP,
  histogram,
  isMissing,
  numericColumns,
  parseCsv,
  regression,
  sampleData,
  summarize,
  welchTest,
} from "../stats";

type AnalysisTab = "describe" | "relation" | "test";

export default function Home() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [data, setData] = useState<DataSet>(sampleData);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [tab, setTab] = useState<AnalysisTab>("describe");
  const [xVariable, setXVariable] = useState("睡眠时长");
  const [yVariable, setYVariable] = useState("统计学成绩");
  const [groupVariable, setGroupVariable] = useState("性别");
  const [testVariable, setTestVariable] = useState("统计学成绩");

  const numeric = useMemo(() => numericColumns(data), [data]);
  const categorical = useMemo(() => categoricalColumns(data), [data]);
  const summaries = useMemo(() => numeric.map((header) => summarize(data, header)), [data, numeric]);
  const missingCount = useMemo(() => data.rows.reduce(
    (total, row) => total + row.filter(isMissing).length,
    0,
  ), [data]);
  const completeness = Math.max(0, 100 - (missingCount / Math.max(1, data.rows.length * data.headers.length)) * 100);
  const activeX = numeric.includes(xVariable) ? xVariable : numeric[0] ?? "";
  const activeY = numeric.includes(yVariable) && yVariable !== activeX ? yVariable : numeric.find((item) => item !== activeX) ?? activeX;
  const activeGroup = categorical.includes(groupVariable) ? groupVariable : categorical[0] ?? "";
  const activeTest = numeric.includes(testVariable) ? testVariable : numeric[0] ?? "";
  const distribution = activeX ? histogram(data, activeX) : [];
  const maxBin = Math.max(1, ...distribution.map((bin) => bin.count));
  const model = activeX && activeY && activeX !== activeY ? regression(data, activeX, activeY) : null;
  const test = activeGroup && activeTest ? welchTest(data, activeGroup, activeTest) : null;

  async function loadFile(file?: File) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("请选择 CSV 格式的文件。" );
      return;
    }
    try {
      const text = await file.text();
      const parsed = parseCsv(text.replace(/^\uFEFF/, ""), file.name);
      const parsedNumeric = numericColumns(parsed);
      const parsedCategorical = categoricalColumns(parsed);
      setData(parsed);
      setXVariable(parsedNumeric[0] ?? "");
      setYVariable(parsedNumeric[1] ?? parsedNumeric[0] ?? "");
      setTestVariable(parsedNumeric[0] ?? "");
      setGroupVariable(parsedCategorical[0] ?? "");
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "文件读取失败，请检查格式。" );
    }
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    void loadFile(event.target.files?.[0]);
    event.target.value = "";
  }

  function onDrop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    setDragging(false);
    void loadFile(event.dataTransfer.files?.[0]);
  }

  function restoreSample() {
    setData(sampleData);
    setXVariable("睡眠时长");
    setYVariable("统计学成绩");
    setGroupVariable("性别");
    setTestVariable("统计学成绩");
    setError("");
  }

  return (
    <main className="student-app data-app">
      <AppSidebar active="data" profileTitle="DataLab 工作台" profileSubtitle="数据仅在当前设备处理" />

      <section className="workspace data-main" id="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">当前数据集</p>
            <h1>数据分析工作台</h1>
          </div>
          <button className="sample-button" type="button" onClick={restoreSample}>↺ 恢复示例数据</button>
        </header>

        <section className="data-context-strip" aria-label="数据处理状态">
          <div><span>数据完整度</span><strong>{completeness.toFixed(1)}%</strong><i><b style={{ width: `${completeness}%` }} /></i></div>
          <p><b>LOCAL FIRST</b> 数据在浏览器内处理，不会上传到服务器。</p>
        </section>

        <section className="hero-grid">
          <div className="upload-panel">
            <div className="panel-heading">
              <div><p className="section-kicker">01 · 导入数据</p><h2>上传你的 CSV 文件</h2></div>
              <span className="privacy-pill">● 仅本地处理</span>
            </div>
            <button
              className={`dropzone ${dragging ? "dragging" : ""}`}
              type="button"
              onClick={() => inputRef.current?.click()}
              onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
            >
              <span className="upload-icon">↑</span>
              <strong>{dragging ? "松开即可读取文件" : "拖入 CSV，或点击选择文件"}</strong>
              <small>支持带引号字段与中英文表头 · 建议小于 10 MB</small>
            </button>
            <input ref={inputRef} className="sr-only" type="file" accept=".csv,text/csv" onChange={onFileChange} />
            {error && <p className="error-message" role="alert">{error}</p>}
            <div className="file-chip">
              <span className="csv-badge">CSV</span>
              <div><strong>{data.name}</strong><small>{data.rows.length} 行 × {data.headers.length} 列</small></div>
              <span className="ready-dot">读取正常</span>
            </div>
          </div>

          <div className="overview-panel">
            <div className="panel-heading compact">
              <div><p className="section-kicker">02 · 数据速览</p><h2>样本概况</h2></div>
              <span className="updated-label">实时更新</span>
            </div>
            <div className="metric-grid">
              <article><span>观测数</span><strong>{data.rows.length}</strong><small>ROWS</small></article>
              <article><span>变量数</span><strong>{data.headers.length}</strong><small>COLUMNS</small></article>
              <article className={missingCount ? "has-warning" : ""}><span>缺失值</span><strong>{missingCount}</strong><small>{(100 - completeness).toFixed(2)}%</small></article>
            </div>
            <div className="type-breakdown">
              <div><span>数值变量</span><strong>{numeric.length}</strong></div>
              <div><span>分类变量</span><strong>{Math.max(0, data.headers.length - numeric.length)}</strong></div>
            </div>
            <p className="overview-note">已自动识别变量类型，可直接进入描述统计与推断分析。</p>
          </div>
        </section>

        <section className="quality-panel" id="quality">
          <div className="panel-heading compact">
            <div><p className="section-kicker">03 · 数据质量</p><h2>变量检查</h2></div>
            <span className="quality-score">完整度 {completeness.toFixed(1)}%</span>
          </div>
          <div className="variable-strip">
            {data.headers.slice(0, 8).map((header, column) => {
              const missing = data.rows.filter((row) => isMissing(row[column])).length;
              const isNumeric = numeric.includes(header);
              return (
                <article className="variable-card" key={`${header}-${column}`}>
                  <div><span className={isNumeric ? "type-number" : "type-text"}>{isNumeric ? "123" : "ABC"}</span><strong>{header}</strong></div>
                  <small>{isNumeric ? "数值型" : "分类型"} · 缺失 {missing}</small>
                  <i><b style={{ width: `${100 - (missing / Math.max(1, data.rows.length)) * 100}%` }} /></i>
                </article>
              );
            })}
          </div>
        </section>

        <section className="analysis-panel" id="analysis">
          <div className="analysis-header">
            <div><p className="section-kicker">04 · 分析中心</p><h2>选择方法，查看结果</h2></div>
            <div className="analysis-tabs" role="tablist" aria-label="分析方法">
              <button className={tab === "describe" ? "active" : ""} onClick={() => setTab("describe")} type="button">描述统计</button>
              <button className={tab === "relation" ? "active" : ""} onClick={() => setTab("relation")} type="button">相关与回归</button>
              <button className={tab === "test" ? "active" : ""} onClick={() => setTab("test")} type="button">独立样本 t 检验</button>
            </div>
          </div>

          {numeric.length === 0 ? (
            <div className="empty-state"><strong>没有检测到数值变量</strong><p>请确认数值列中没有混入大量文字或特殊符号。</p></div>
          ) : tab === "describe" ? (
            <div className="analysis-grid">
              <div className="chart-card">
                <div className="chart-toolbar">
                  <div><p>分布直方图</p><h3>{activeX}</h3></div>
                  <label>分析变量<select value={activeX} onChange={(event) => setXVariable(event.target.value)}>{numeric.map((item) => <option key={item}>{item}</option>)}</select></label>
                </div>
                <div className="histogram" aria-label={`${activeX}的直方图`}>
                  {distribution.map((bin, index) => (
                    <div className="histogram-column" key={index}>
                      <span>{bin.count || ""}</span>
                      <i style={{ height: `${(bin.count / maxBin) * 100}%` }} />
                    </div>
                  ))}
                </div>
                <div className="axis-labels"><span>{formatNumber(distribution[0]?.from ?? 0, 1)}</span><strong>{activeX}</strong><span>{formatNumber(distribution.at(-1)?.to ?? 0, 1)}</span></div>
              </div>
              <div className="result-card">
                <p className="result-label">统计摘要</p>
                {(() => {
                  const current = summarize(data, activeX);
                  return <>
                    <div className="big-result"><span>均值</span><strong>{formatNumber(current.mean)}</strong><small>标准差 {formatNumber(current.sd)}</small></div>
                    <dl className="stats-list">
                      <div><dt>有效样本</dt><dd>{current.n}</dd></div>
                      <div><dt>最小值</dt><dd>{formatNumber(current.min)}</dd></div>
                      <div><dt>中位数</dt><dd>{formatNumber(current.median)}</dd></div>
                      <div><dt>最大值</dt><dd>{formatNumber(current.max)}</dd></div>
                    </dl>
                  </>;
                })()}
              </div>
              <div className="summary-table-card">
                <div className="table-title"><strong>全部数值变量</strong><span>自动计算</span></div>
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>变量</th><th>N</th><th>均值</th><th>标准差</th><th>最小</th><th>中位数</th><th>最大</th></tr></thead>
                    <tbody>{summaries.map((item) => <tr key={item.name}><td><strong>{item.name}</strong></td><td>{item.n}</td><td>{formatNumber(item.mean)}</td><td>{formatNumber(item.sd)}</td><td>{formatNumber(item.min)}</td><td>{formatNumber(item.median)}</td><td>{formatNumber(item.max)}</td></tr>)}</tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : tab === "relation" ? (
            <div className="analysis-grid relation-grid">
              <div className="chart-card scatter-card">
                <div className="chart-toolbar two-selects">
                  <div><p>散点图</p><h3>{activeX} × {activeY}</h3></div>
                  <div className="select-pair">
                    <label>X<select value={activeX} onChange={(event) => setXVariable(event.target.value)}>{numeric.map((item) => <option key={item}>{item}</option>)}</select></label>
                    <label>Y<select value={activeY} onChange={(event) => setYVariable(event.target.value)}>{numeric.map((item) => <option key={item}>{item}</option>)}</select></label>
                  </div>
                </div>
                {model && <ScatterPlot pairs={model.pairs} xLabel={activeX} yLabel={activeY} />}
              </div>
              <div className="result-card correlation-result">
                <p className="result-label">Pearson 相关</p>
                {model ? <>
                  <div className="big-result"><span>相关系数 r</span><strong>{formatNumber(model.r, 3)}</strong><small>p {formatP(model.p)} · n = {model.n}</small></div>
                  <dl className="stats-list">
                    <div><dt>回归斜率</dt><dd>{formatNumber(model.slope, 3)}</dd></div>
                    <div><dt>截距</dt><dd>{formatNumber(model.intercept, 3)}</dd></div>
                    <div><dt>R²</dt><dd>{formatNumber(model.r2, 3)}</dd></div>
                    <div><dt>t 统计量</dt><dd>{formatNumber(model.t, 3)}</dd></div>
                  </dl>
                  <div className="plain-conclusion"><span>结果解释</span><p>{Math.abs(model.r) >= 0.7 ? "两变量呈较强" : Math.abs(model.r) >= 0.4 ? "两变量呈中等" : "两变量呈较弱"}{model.r >= 0 ? "正" : "负"}相关；在 α = 0.05 水平下{model.p < 0.05 ? "具有统计学意义" : "未达到统计学意义"}。</p></div>
                </> : <p>请选择两个不同的数值变量。</p>}
              </div>
            </div>
          ) : (
            <div className="analysis-grid test-grid">
              <div className="test-config-card">
                <p className="result-label">Welch 独立样本 t 检验</p>
                <h3>比较两个独立组的均值</h3>
                <label>分组变量<select value={activeGroup} onChange={(event) => setGroupVariable(event.target.value)}>{categorical.map((item) => <option key={item}>{item}</option>)}</select></label>
                <label>因变量<select value={activeTest} onChange={(event) => setTestVariable(event.target.value)}>{numeric.map((item) => <option key={item}>{item}</option>)}</select></label>
                <p className="method-note">默认使用双侧 Welch t 检验，不要求两组方差相等。</p>
              </div>
              <div className="result-card test-result-card">
                {test ? <>
                  <p className="result-label">检验结果</p>
                  <div className="group-comparison">
                    {test.groups.map((group, index) => <div key={group}><span>{activeGroup} = {group}</span><strong>{formatNumber(test.means[index])}</strong><small>n = {test.samples[index].length}</small></div>)}
                  </div>
                  <div className="test-stat-line"><span>t({formatNumber(test.degreesOfFreedom, 1)}) = {formatNumber(test.t, 3)}</span><strong>p {formatP(test.p)}</strong></div>
                  <dl className="stats-list compact-list"><div><dt>Cohen&apos;s d</dt><dd>{formatNumber(test.effect, 3)}</dd></div><div><dt>显著性水平</dt><dd>α = 0.05</dd></div></dl>
                  <div className="plain-conclusion"><span>统计结论</span><p>两组的 {activeTest} 均值差异{test.p < 0.05 ? "具有统计学意义" : "未达到统计学意义"}（p {formatP(test.p)}）。</p></div>
                </> : <div className="empty-state"><strong>暂时无法执行检验</strong><p>分组变量需要恰好包含两个有效组，每组至少有两个观测。</p></div>}
              </div>
            </div>
          )}
        </section>

        <section className="data-preview" id="preview">
          <div className="panel-heading compact">
            <div><p className="section-kicker">05 · 原始数据</p><h2>{data.name}</h2></div>
            <div className="status-copy"><span /> 显示前 {Math.min(8, data.rows.length)} 行</div>
          </div>
          <div className="table-wrap preview-table">
            <table>
              <thead><tr>{data.headers.map((header, index) => <th key={`${header}-${index}`}>{header}</th>)}</tr></thead>
              <tbody>{data.rows.slice(0, 8).map((row, rowIndex) => <tr key={rowIndex}>{data.headers.map((_, column) => <td className={isMissing(row[column] ?? "") ? "missing-cell" : ""} key={column}>{isMissing(row[column] ?? "") ? "缺失" : row[column]}</td>)}</tr>)}</tbody>
            </table>
          </div>
        </section>

        <footer><span>Acaora · DataLab</span><p>用于探索性学习与课程项目；正式研究请结合研究设计与专业判断。</p></footer>
      </section>
    </main>
  );
}

function ScatterPlot({ pairs, xLabel, yLabel }: { pairs: [number, number][]; xLabel: string; yLabel: string }) {
  const xs = pairs.map(([x]) => x);
  const ys = pairs.map(([, y]) => y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return (
    <div className="scatter-wrap">
      <span className="y-axis-title">{yLabel}</span>
      <div className="scatterplot" aria-label={`${xLabel}和${yLabel}的散点图`}>
        {pairs.map(([x, y], index) => <i key={index} style={{ left: `${8 + ((x - minX) / (maxX - minX || 1)) * 84}%`, bottom: `${8 + ((y - minY) / (maxY - minY || 1)) * 84}%` }} />)}
      </div>
      <div className="axis-labels"><span>{formatNumber(minX, 1)}</span><strong>{xLabel}</strong><span>{formatNumber(maxX, 1)}</span></div>
    </div>
  );
}
