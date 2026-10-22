"use client";

import {useId, useState} from "react";
import {DEFAULT_SEED, MAX_INTERVALS, sampleIntervals, type Confidence, type ConfidenceInterval} from "./interval-experiment-math";
import styles from "./courses.module.css";

function seedFromText(text: string) {
  if (!/^\d{1,10}$/.test(text)) return null;
  const seed = Number(text);
  return Number.isInteger(seed) && seed <= 0xffffffff ? seed : null;
}

export default function IntervalExperiment() {
  const id = useId();
  const [n, setN] = useState(25);
  const [confidence, setConfidence] = useState<Confidence>(0.95);
  const [seedText, setSeedText] = useState(String(DEFAULT_SEED));
  const [nextSeed, setNextSeed] = useState(DEFAULT_SEED);
  const [intervals, setIntervals] = useState<ConfidenceInterval[]>([]);
  const seed = seedFromText(seedText);
  const remaining = MAX_INTERVALS - intervals.length;
  const covered = intervals.filter(interval => interval.covered).length;
  const latest = intervals.at(-1);
  const visible = intervals.slice(-40);
  const extent = Math.max(1, ...visible.flatMap(interval => [Math.abs(interval.lower), Math.abs(interval.upper)])) * 1.1;
  const plotHeight = Math.max(116, visible.length * 13 + 50);
  const x = (value: number) => 42 + (value + extent) / (2 * extent) * 476;

  function reset(startSeed = seed) {
    setIntervals([]);
    setNextSeed(startSeed ?? DEFAULT_SEED);
  }

  function sample(count: number) {
    if (seed === null || remaining === 0) return;
    const batch = sampleIntervals({seed: nextSeed, n, confidence, count: Math.min(count, remaining)});
    setNextSeed(batch.nextSeed);
    setIntervals(previous => [...previous, ...batch.intervals]);
  }

  return <section className="interval-experiment" aria-labelledby={`${id}-title`}>
    <h2 id={`${id}-title`}>亲手观察置信区间的覆盖</h2>
    <p className={styles.muted}>教学模拟：从均值 μ = 0、已知标准差 σ = 1 的正态总体独立抽样。每次用新的 n 个观测，计算一个区间：样本均值 ± z × 1/√n。</p>
    <div className="interval-experiment-controls">
      <label className="interval-experiment-control" htmlFor={`${id}-n`}>每次样本量 n：<output>{n}</output>
        <input id={`${id}-n`} type="range" min={5} max={200} step={1} value={n} onChange={event => {setN(Number(event.target.value)); reset();}}/>
      </label>
      <label className="interval-experiment-control" htmlFor={`${id}-confidence`}>置信度
        <select id={`${id}-confidence`} aria-label="置信度" value={confidence} onChange={event => {setConfidence(Number(event.target.value) as Confidence); reset();}}>
          <option value={0.9}>90%</option><option value={0.95}>95%</option><option value={0.99}>99%</option>
        </select>
      </label>
      <label className="interval-experiment-control" htmlFor={`${id}-seed`}>随机种子
        <input id={`${id}-seed`} type="text" inputMode="numeric" value={seedText} maxLength={10} aria-invalid={seed === null} aria-describedby={`${id}-seed-help`} onChange={event => {const text = event.target.value; setSeedText(text); reset(seedFromText(text));}}/>
      </label>
    </div>
    <p id={`${id}-seed-help`} className={seed === null ? styles.incorrect : styles.muted}>{seed === null ? "请输入 0 至 4294967295 的整数种子，再开始抽样。" : "修改参数会清空本轮结果。重置后使用相同参数和种子，可复现相同的抽样序列。"}</p>
    <div className={styles.actions}>
      <button type="button" disabled={seed === null || remaining === 0} onClick={() => sample(1)}>抽样 1 次</button>
      <button type="button" disabled={seed === null || remaining === 0} onClick={() => sample(50)}>抽样 {remaining > 0 ? Math.min(50, remaining) : 50} 次</button>
      <button type="button" onClick={() => reset()}>重置本轮</button>
    </div>
    <p className="interval-experiment-status" role="status" aria-atomic="true">{intervals.length === 0 ? "尚未抽样。先抽样 1 次，再重复抽样比较。" : `已生成 ${intervals.length} 个区间；覆盖真值 ${covered} 个，未覆盖 ${intervals.length - covered} 个；本轮覆盖率 ${(covered / intervals.length * 100).toFixed(1)}%。`}{remaining === 0 && ` 已达到本轮 ${MAX_INTERVALS} 次上限，可重置后再试。`}</p>
    {visible.length > 0 && <figure className="interval-experiment-plot">
      <svg viewBox={`0 0 560 ${plotHeight}`} width="100%" role="img" aria-labelledby={`${id}-plot-title ${id}-plot-desc`}>
        <title id={`${id}-plot-title`}>最近 {visible.length} 个置信区间与总体均值零的比较</title>
        <desc id={`${id}-plot-desc`}>竖线为固定真值零。实线和圆点表示覆盖真值；虚线和叉号表示未覆盖。每行一个区间。全部 {intervals.length} 次的计数和覆盖率列在图前。</desc>
        <line x1={x(0)} x2={x(0)} y1={10} y2={plotHeight - 28} stroke="#68778a" strokeWidth={1}/>
        {visible.map((interval, index) => {
          const y = 18 + index * 13;
          const color = interval.covered ? "#315d78" : "#963f29";
          return <g key={intervals.length - visible.length + index}>
            <line x1={x(interval.lower)} x2={x(interval.upper)} y1={y} y2={y} stroke={color} strokeWidth={2} strokeDasharray={interval.covered ? undefined : "4 3"}/>
            {interval.covered ? <circle cx={x(interval.mean)} cy={y} r={2.6} fill={color}/> : <path d={`M${x(interval.mean)-3},${y-3}l6,6m-6,0l6,-6`} stroke={color} strokeWidth={1.8}/>}
          </g>;
        })}
        <text x={x(-extent)} y={plotHeight - 6} textAnchor="start" fill="#233047" fontSize={13}>{(-extent).toFixed(2)}</text>
        <text x={x(0)} y={plotHeight - 6} textAnchor="middle" fill="#233047" fontSize={13}>μ = 0</text>
        <text x={x(extent)} y={plotHeight - 6} textAnchor="end" fill="#233047" fontSize={13}>{extent.toFixed(2)}</text>
      </svg>
      <figcaption className={styles.muted}>实线、圆点：覆盖；虚线、叉号：未覆盖。显示第 {intervals.length - visible.length + 1} 至 {intervals.length} 次，横轴随结果调整；上方覆盖率使用本轮全部区间。</figcaption>
    </figure>}
    {latest && <p className="interval-experiment-latest">最新一次：样本均值 {latest.mean.toFixed(3)}，区间 [{latest.lower.toFixed(3)}, {latest.upper.toFixed(3)}]，{latest.covered ? "覆盖" : "未覆盖"}固定真值 0。</p>}
    <p className={styles.muted}>置信度描述这种区间程序在重复抽样中的长期覆盖性质。有限次模拟不必恰好达到标称比例；这不是“观察到的区间包含参数的概率”。此实验只演示正态、独立且 σ 已知的情形，不替代实际数据的抽样与模型检查。</p>
  </section>;
}
