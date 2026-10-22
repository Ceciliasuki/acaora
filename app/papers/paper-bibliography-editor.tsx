"use client";

import {useEffect, useId, useRef, useState} from "react";
import {Dialog} from "../components/ui/dialog";
import {citationText, normalizeBibliography, normalizeDoi} from "./paper-bibliography";
import type {PaperBibliography, PaperRecord} from "./paper-types";

type Fields = {authors: string; year: string; venue: string; doi: string; url: string; tags: string};
type Candidate = {title: string; metadata: PaperBibliography};
const empty: PaperBibliography = {authors: [], year: null, venue: "", doi: "", url: "", tags: [], source: "manual", confirmed: false};
function fieldsFor(metadata: PaperBibliography): Fields {
  return {authors: metadata.authors.join("\n"), year: metadata.year === null ? "" : String(metadata.year), venue: metadata.venue, doi: metadata.doi, url: metadata.url, tags: metadata.tags.join(", ")};
}
function metadataFor(fields: Fields, source: PaperBibliography["source"], confirmed: boolean) {
  if (fields.year && !/^\d{4}$/.test(fields.year)) return undefined;
  return normalizeBibliography({authors: fields.authors.split(/\r?\n/).map(author => author.trim()).filter(Boolean), year: fields.year ? Number(fields.year) : null,
    venue: fields.venue, doi: fields.doi, url: fields.url, tags: fields.tags.split(/[,，]/).map(tag => tag.trim()).filter(Boolean), source, confirmed});
}

export default function PaperBibliographyEditor({paper, library, onSave, onClose}: {
  paper: PaperRecord;
  library: PaperRecord[];
  onSave: (metadata: PaperBibliography) => void;
  onClose: () => void;
}) {
  const initial = normalizeBibliography(paper.bibliography) ?? empty;
  const [fields, setFields] = useState(() => fieldsFor(initial));
  const [source, setSource] = useState(initial.source);
  const [confirmed, setConfirmed] = useState(initial.confirmed);
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);
  const serial = useRef(0);
  const id = useId();
  useEffect(() => () => {serial.current += 1; request.current?.abort();}, []);
  const metadata = metadataFor(fields, source, confirmed);
  const doi = normalizeDoi(fields.doi);
  const duplicates = doi ? library.filter(item => item.id !== paper.id && normalizeDoi(item.bibliography?.doi) === doi) : [];

  function stopLookup() {
    serial.current += 1;
    request.current?.abort();
    setBusy(false);
  }
  function edit(field: keyof Fields, value: string) {
    stopLookup(); setFields(previous => ({...previous, [field]: value})); setSource("manual"); setConfirmed(false); setCandidate(null); setStatus(""); setError("");
  }
  function close() {stopLookup(); onClose();}
  async function lookup() {
    if (!doi) {setError("请填写完整 DOI，例如 10.1000/example，再查找书目信息。"); return;}
    stopLookup();
    const token = serial.current;
    const controller = new AbortController(); request.current = controller;
    setBusy(true); setCandidate(null); setError(""); setStatus("正在查询 Crossref…");
    try {
      const response = await fetch(`/api/papers/search?${new URLSearchParams({field: "doi", q: doi})}`, {signal: controller.signal});
      const payload = await response.json() as {papers?: unknown[]; error?: string};
      if (serial.current !== token || controller.signal.aborted) return;
      if (!response.ok) throw new Error(typeof payload.error === "string" ? payload.error : "Crossref 暂时不可用，请稍后重试或手动填写。");
      const record = Array.isArray(payload.papers) ? payload.papers.find(item => item && typeof item === "object" && normalizeDoi((item as Record<string, unknown>).doi) === doi) as Record<string, unknown> | undefined : undefined;
      if (!record) {setStatus("Crossref 未找到该 DOI，已保留你的表单，可手动填写。"); return;}
      const candidateMetadata = normalizeBibliography({authors: record.authors, year: record.year, venue: record.venue, doi: record.doi, url: record.url, tags: [], source: "Crossref", confirmed: false});
      if (!candidateMetadata || typeof record.title !== "string" || record.title.length > 5000) throw new Error("返回的书目信息不完整或格式异常，请手动核对填写。");
      setCandidate({title: record.title, metadata: candidateMetadata}); setStatus("已找到候选资料。核对标题后，可明确采用填入表单。");
    } catch (failure) {
      if (!controller.signal.aborted && serial.current === token) {setError(failure instanceof Error ? failure.message : "查询失败，请稍后重试。"); setStatus("");}
    } finally {if (serial.current === token) setBusy(false);}
  }
  function adopt() {
    if (!candidate) return;
    setFields(previous => ({...fieldsFor(candidate.metadata), tags: previous.tags})); setSource("Crossref"); setConfirmed(false); setCandidate(null); setError(""); setStatus("候选资料已填入。论文标题保持不变，请复核所有字段并确认。");
  }
  function save() {
    if (!metadata) {setError("书目信息格式有误：年份须为 1000 至 2100，DOI 须完整，网址须为 HTTP(S)；作者最多 100 位、每位 200 字，标签最多 30 个、每个 60 字。"); return;}
    onSave(metadata); close();
  }
  function download(format: "bib" | "ris") {
    if (!metadata?.confirmed) {setError("请先核对并确认当前表单，再导出引用。"); return;}
    try {
      const text = citationText({...paper, bibliography: metadata}, format);
      const url = URL.createObjectURL(new Blob([text], {type: format === "bib" ? "application/x-bibtex;charset=utf-8" : "application/x-research-info-systems;charset=utf-8"}));
      const anchor = document.createElement("a"); anchor.href = url;
      anchor.download = `${paper.title.replace(/[<>:"/\\|?*\p{Cc}]/gu, "_").slice(0, 90) || "paper"}.${format}`;
      anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); setError(""); setStatus(`已导出当前表单的 ${format === "bib" ? "BibTeX" : "RIS"}。未保存的修改仍需点击保存。`);
    } catch (failure) {setError(failure instanceof Error ? failure.message : "导出失败，请检查书目信息。");}
  }

  return <Dialog open title="书目信息与引用" description="确认作者、年份与出处，再导出用于论文写作的引用。" onClose={close}>
    <div className="plab-reference-editor">
      <p className="plab-reference-title">{paper.title}</p>
      <p className="plab-reference-source">来源：{source === "manual" ? "手动填写" : "Crossref"} · {confirmed ? "已确认" : "待核对"}</p>
      <form onSubmit={event => {event.preventDefault(); save();}}>
        <label htmlFor={`${id}-authors`}>作者（每行一位）<textarea id={`${id}-authors`} rows={3} maxLength={20100} value={fields.authors} onChange={event => edit("authors", event.target.value)}/></label>
        <div className="plab-reference-fields">
          <label htmlFor={`${id}-year`}>发表年份<input id={`${id}-year`} type="text" inputMode="numeric" maxLength={4} placeholder="可留空" value={fields.year} onChange={event => edit("year", event.target.value)}/></label>
          <label htmlFor={`${id}-venue`}>期刊、会议或其他出处<input id={`${id}-venue`} maxLength={500} value={fields.venue} onChange={event => edit("venue", event.target.value)}/></label>
        </div>
        <label htmlFor={`${id}-doi`}>DOI<input id={`${id}-doi`} maxLength={300} placeholder="10.xxxx/… 或 https://doi.org/…" value={fields.doi} onChange={event => edit("doi", event.target.value)}/></label>
        <div className="plab-reference-actions"><button type="button" disabled={busy || !doi} onClick={() => void lookup()}>{busy ? "查询中…" : "用 DOI 查询 Crossref"}</button></div>
        {candidate && <section className="plab-reference-candidate" aria-labelledby={`${id}-candidate`}>
          <h3 id={`${id}-candidate`}>Crossref 候选资料</h3>
          <p><strong>{candidate.title}</strong></p>
          {candidate.title.trim().toLocaleLowerCase() !== paper.title.trim().toLocaleLowerCase() && <p className="plab-reference-warning">候选标题与当前论文标题不同。请核对是否为同一篇论文；采用资料不会修改论文标题。</p>}
          <p>{candidate.metadata.authors.join("；") || "未提供作者"} · {candidate.metadata.year ?? "年份未知"}</p><p>{candidate.metadata.venue || "出处未知"}</p><p>DOI：{candidate.metadata.doi}</p>
          <button type="button" onClick={adopt}>采用资料填入表单</button>
        </section>}
        <label htmlFor={`${id}-url`}>文献网址<input id={`${id}-url`} type="url" maxLength={2048} value={fields.url} onChange={event => edit("url", event.target.value)}/></label>
        <label htmlFor={`${id}-tags`}>主题标签（逗号分隔）<input id={`${id}-tags`} maxLength={2000} placeholder="如：因果推断，研究方法" value={fields.tags} onChange={event => edit("tags", event.target.value)}/></label>
        {duplicates.length > 0 && <p className="plab-reference-warning" role="status">论文库另有 {duplicates.length} 篇记录使用相同 DOI：{duplicates.map(item => item.title).join("；")}。请确认是否重复导入。</p>}
        <label className="plab-reference-confirm"><input type="checkbox" checked={confirmed} onChange={event => {setConfirmed(event.target.checked); setError("");}}/>我已核对当前标题、作者、年份与出处，确认这些引用资料</label>
        <p className="plab-reference-help">可先保存待核对资料。只有确认后的表单可导出；未填写的字段将省略，导出使用当前论文标题和通用文献类型。</p>
        {error && <p className="plab-reference-error" role="alert">{error}</p>}
        <p className="plab-reference-status" role="status" aria-live="polite">{status}</p>
        <div className="plab-reference-actions"><button type="submit">保存书目信息</button><button type="button" disabled={!metadata?.confirmed} onClick={() => download("bib")}>导出 BibTeX</button><button type="button" disabled={!metadata?.confirmed} onClick={() => download("ris")}>导出 RIS</button><button type="button" onClick={close}>取消</button></div>
      </form>
    </div>
  </Dialog>;
}
