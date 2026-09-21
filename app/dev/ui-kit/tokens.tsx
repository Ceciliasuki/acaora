/**
 * Phase 1A design-token playground.
 *
 * Every swatch and sample is bound to a live token (`var(--name)`) instead of a
 * copied hex value, so this page cannot drift from globals.css. The wording in
 * each `usage` note is the design contract for later phases, in particular the
 * "use sparingly" limits on the brand and AI accents.
 *
 * Development only: app/dev/ui-kit/page.tsx returns notFound() in production.
 */

import type { CSSProperties } from "react";

type Token = { name: string; usage: string };
type TypeRow = { token: string; label: string; style: CSSProperties };

const surfaceTokens: Token[] = [
  { name: "--bg-app", usage: "页面底色。Dashboard / PaperLab / DataLab 共用。" },
  { name: "--surface", usage: "卡片、面板、输入框底。" },
  { name: "--surface-2", usage: "内嵌区、表头、次级面板。" },
  { name: "--surface-inverse", usage: "深色面板：侧栏、论文库、AI 工作台。" },
  { name: "--surface-inverse-2", usage: "深色面板内的次级块与选中态。" },
];

const borderTokens: Token[] = [
  { name: "--border", usage: "卡片与分隔线。装饰性，允许低对比。" },
  { name: "--border-strong", usage: "hover、激活边框。" },
  { name: "--border-control", usage: "输入框与次要按钮边界，3:1 以上。" },
  { name: "--border-inverse", usage: "深色面板内的描边。" },
];

const textTokens: Token[] = [
  { name: "--text", usage: "正文与标题。" },
  { name: "--text-2", usage: "次要文字、说明、元信息。" },
  { name: "--text-3", usage: "仅限 >=18px 或装饰，正文禁用。" },
  { name: "--text-inverse", usage: "深色面正文。" },
  { name: "--text-inverse-2", usage: "深色面次要文字与图标。" },
];

const brandTokens: Token[] = [
  { name: "--brand", usage: "唯一强调色。主按钮、链接、进度。禁止大面积铺底与渐变。" },
  { name: "--brand-hover", usage: "主按钮 hover / pressed。" },
  { name: "--brand-subtle", usage: "选中底、浅色标签底。" },
  { name: "--brand-on-subtle", usage: "subtle 底上的文字。" },
  { name: "--brand-on-dark", usage: "深色面上的品牌标记。brand 在深色面仅 2.98:1。" },
];

const aiTokens: Token[] = [
  { name: "--ai", usage: "AI 区域墨水色。仅用于 AI 语义区域。" },
  { name: "--ai-subtle", usage: "AI 区域浅底。" },
  { name: "--ai-vivid", usage: "AI 区域实心填充。" },
  { name: "--ai-on-dark", usage: "深色 AI 面板上的文字与标记。" },
  { name: "--ai-ink-on-vivid", usage: "ai-vivid 填充上的文字。" },
];

const semanticTokens: Token[] = [
  { name: "--success", usage: "已同步、已完成。" },
  { name: "--success-subtle", usage: "成功态底色。" },
  { name: "--warning", usage: "等待同步、示例数据。" },
  { name: "--warning-subtle", usage: "警告态底色。" },
  { name: "--danger", usage: "删除与错误。仅此二用。" },
  { name: "--danger-subtle", usage: "错误态底色。" },
];

const typeScale: TypeRow[] = [
  { token: "--fs-display", label: "display 30/36", style: { fontSize: "var(--fs-display)", lineHeight: "var(--lh-display)", fontWeight: "var(--fw-semibold)", letterSpacing: "-0.02em" } },
  { token: "--fs-page", label: "page 24/32", style: { fontSize: "var(--fs-page)", lineHeight: "var(--lh-page)", fontWeight: "var(--fw-semibold)", letterSpacing: "-0.015em" } },
  { token: "--fs-section", label: "section 18/26", style: { fontSize: "var(--fs-section)", lineHeight: "var(--lh-section)", fontWeight: "var(--fw-semibold)" } },
  { token: "--fs-card", label: "card 15/22", style: { fontSize: "var(--fs-card)", lineHeight: "var(--lh-card)", fontWeight: "var(--fw-semibold)" } },
  { token: "--fs-body", label: "body 15/24", style: { fontSize: "var(--fs-body)", lineHeight: "var(--lh-body)" } },
  { token: "--fs-sm", label: "secondary 13/20", style: { fontSize: "var(--fs-sm)", lineHeight: "var(--lh-sm)" } },
  { token: "--fs-caption", label: "caption 12/16", style: { fontSize: "var(--fs-caption)", lineHeight: "var(--lh-caption)" } },
  { token: "--fs-label", label: "label 11/14 (uppercase)", style: { fontSize: "var(--fs-label)", lineHeight: "var(--lh-label)", fontWeight: "var(--fw-bold)", letterSpacing: "0.06em", textTransform: "uppercase" as const } },
  { token: "--fs-metric", label: "metric 28/32 (tabular)", style: { fontSize: "var(--fs-metric)", lineHeight: "var(--lh-metric)", fontWeight: "var(--fw-semibold)", letterSpacing: "-0.01em" } },
];

const spacingScale = ["--s-1", "--s-2", "--s-3", "--s-4", "--s-5", "--s-6", "--s-7", "--s-8"];
const radiusScale = ["--r-xs", "--r-sm", "--r-md", "--r-lg", "--r-xl"];
const shadowScale = ["--shadow-1", "--shadow-2", "--shadow-3"];

function Swatches({ tokens }: { tokens: Token[] }) {
  return <div className="ui-kit-swatches">
    {tokens.map((token) => <div className="ui-kit-swatch" key={token.name}>
      <i style={{ background: `var(${token.name})` }} />
      <code>{token.name}</code>
      <small>{token.usage}</small>
    </div>)}
  </div>;
}

export default function UiKitTokens() {
  return <>
    <section className="ui-kit-section"><h2>Color tokens</h2>
      <div className="ui-kit-group"><h3>Surfaces</h3><Swatches tokens={surfaceTokens} /></div>
      <div className="ui-kit-group"><h3>Borders</h3><Swatches tokens={borderTokens} /></div>
      <div className="ui-kit-group"><h3>Text</h3><Swatches tokens={textTokens} /></div>
      <div className="ui-kit-group"><h3>Brand (use sparingly)</h3><Swatches tokens={brandTokens} /></div>
      <div className="ui-kit-group"><h3>AI accent (AI regions only)</h3><Swatches tokens={aiTokens} /></div>
      <div className="ui-kit-group"><h3>Semantic</h3><Swatches tokens={semanticTokens} /></div>
    </section>

    <section className="ui-kit-section"><h2>Dark-surface pairings</h2>
      <p className="ui-kit-group">Phase 1A 最容易出错的是深色面上的对比度：brand 蓝在深色面上只有 2.98:1，因此深色面必须使用 --brand-on-dark 与 --ai-on-dark。以下两组是真实渲染，可直接目测。</p>
      <div className="ui-kit-panels">
        <div className="ui-kit-panel-dark">
          <h4>Sidebar / paper library (--surface-inverse)</h4>
          <p style={{ color: "var(--text-inverse)" }}>--text-inverse · 15.63:1 正文</p>
          <p style={{ color: "var(--text-inverse-2)" }}>--text-inverse-2 · 6.72:1 次要与图标</p>
          <p style={{ color: "var(--brand-on-dark)" }}>--brand-on-dark · 8.36:1 当前导航项</p>
          <p style={{ color: "var(--ai-on-dark)" }}>--ai-on-dark · 11.25:1 仅 AI 语义</p>
          <p style={{ color: "var(--brand)" }}>--brand on dark · 2.98:1 反例，不要这样用</p>
        </div>
        <div className="ui-kit-panel-dark">
          <h4>AI studio (--surface-inverse)</h4>
          <p style={{ color: "var(--ai-on-dark)" }}>--ai-on-dark · 11.25:1 面板标题与标记</p>
          <p style={{ color: "var(--text-inverse-2)" }}>--text-inverse-2 · 6.72:1 说明文字</p>
          <p><span style={{ display: "inline-block", padding: "6px 12px", borderRadius: "var(--r-sm)", background: "var(--ai-vivid)", color: "var(--ai-ink-on-vivid)", fontWeight: 700 }}>--ai-ink-on-vivid on --ai-vivid · 5.79:1 运行按钮</span></p>
        </div>
      </div>
    </section>

    <section className="ui-kit-section"><h2>Type scale</h2>
      <p className="ui-kit-group">产品 UI 统一使用系统无衬线栈（--font-sans）。Georgia 已从页面标题移除；页面内部的 section 标题会在各自阶段跟进。</p>
      <div className="ui-kit-type-scale">
        {typeScale.map((row) => <div key={row.token}>
          <code>{row.label}</code>
          <span style={row.style}>学曦 Acaora 阅读进度 68%</span>
        </div>)}
      </div>
    </section>

    <section className="ui-kit-section"><h2>Spacing, radius, shadow</h2>
      <div className="ui-kit-group"><h3>Spacing scale</h3>
        <div className="ui-kit-scales ui-kit-radius">
          {spacingScale.map((token) => <div key={token}>
            <code>{token}</code>
            <i style={{ width: `var(${token})`, borderRadius: "3px" }} />
          </div>)}
        </div>
      </div>
      <div className="ui-kit-group"><h3>Radius scale</h3>
        <div className="ui-kit-scales">
          {radiusScale.map((token) => <div key={token}>
            <code>{token}</code>
            <i style={{ borderRadius: `var(${token})` }} />
          </div>)}
        </div>
        <div className="ui-kit-scales">
          <div><code>--r-full</code><i style={{ borderRadius: "var(--r-full)", width: "96px" }} /></div>
        </div>
        <small>控件 8-10px，卡片 14px，工作台与对话框 18px。pill 仅限头像、状态点与进度条，主按钮不做 pill。</small>
      </div>
      <div className="ui-kit-group"><h3>Elevation</h3>
        <div className="ui-kit-shadow-grid">
          {shadowScale.map((token) => <div key={token} style={{ boxShadow: `var(${token})` }}>
            <code>{token}</code>
          </div>)}
        </div>
        <small>默认形态是 1px 描边加最轻阴影；--shadow-3 只给模态层。</small>
      </div>
    </section>

    <section className="ui-kit-section"><h2>Numerals</h2>
      <p className="ui-kit-group">所有指标数字使用 tabular 数字，避免数值变化时列宽跳动。</p>
      <div className="ui-kit-row">
        <span className="ui-kit-numbers" style={{ fontSize: "var(--fs-metric)", fontWeight: "var(--fw-semibold)" }}>47.2% · 128 项 · 6 篇</span>
        <span style={{ fontSize: "var(--fs-metric)", fontWeight: "var(--fw-semibold)" }}>47.2% · 128 项 · 6 篇</span>
      </div>
      <small>左为 tabular-nums，右为比例数字。</small>
    </section>
  </>;
}
