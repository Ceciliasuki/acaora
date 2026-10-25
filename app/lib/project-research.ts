import {paperSourceHref, validateProjectEvidence, type ProjectEvidence} from './project-evidence';
import {withResearchProject} from './research-links';

export const protocolFields = [
  ['question', '研究问题', '说明研究对象、核心关系，以及这项研究要回答的具体问题。'],
  ['hypothesis', '研究假设', '写清可检验的预期及其理论依据，也可以记录竞争性解释。'],
  ['dataSource', '数据来源', '来源、时间范围、获取方式与使用限制。不要填写密钥或上传原数据。'],
  ['strategy', '分析与识别策略', '计划采用的模型、识别假设、估计对象，以及能够支持的解释范围。'],
  ['sample', '样本与排除规则', '纳入与排除标准、缺失值处理、样本单位。'],
  ['variables', '变量与测量', '因变量、自变量、控制变量、单位、编码与构造方式。'],
  ['robustness', '稳健性与敏感性检查', '替代测量、样本变化、模型规格与检验计划。'],
  ['limitations', '已知局限', '潜在偏差、识别限制、数据缺口与尚未解决的问题。'],
] as const;
export type ProtocolField = typeof protocolFields[number][0];
export type ResearchProtocol = Record<ProtocolField, string>;
export const analysisRoles = {primary: '主分析', robustness: '稳健性检查', exploratory: '探索分析'} as const;
export type AnalysisRole = keyof typeof analysisRoles;
export const findingAssessments = {unreviewed: '待核验', supported: '倾向支持', mixed: '证据不一致', 'not-supported': '暂不支持'} as const;
export type FindingAssessment = keyof typeof findingAssessments;
export type ResearchFinding = {id: string; statement: string; assessment: FindingAssessment; limitations: string; evidenceIds: string[]; analysisIds: string[]; withdrawn: boolean};
export type ResearchDossier = {version: 1; protocol: ResearchProtocol; findings: ResearchFinding[]};
export type ProjectAnalysisRecord = {
  id: string; snapshotId: string; name: string; role: AnalysisRole; sample: boolean; method: string; context: string; settings: string;
  dataset: {name: string; rows: number; fingerprint: string; sourceFingerprint: string};
  metrics: [string, string][]; interpretation: string; evidenceIds: string[]; createdAt: string; registeredAt: string;
};
export function emptyResearchDossier(): ResearchDossier {
  return {version: 1, protocol: Object.fromEntries(protocolFields.map(([key]) => [key, ''])) as ResearchProtocol, findings: []};
}
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const exact = (value: Record<string, unknown>, keys: readonly string[]) => Object.keys(value).length === keys.length && Object.keys(value).every(key => keys.includes(key));
const text = (value: unknown, max: number, required = false): value is string => typeof value === 'string' && value.length <= max && (!required || value.trim().length > 0);
const id = (value: unknown): value is string => text(value, 200, true) && !Array.from(value).some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127);
const ids = (value: unknown) => Array.isArray(value) && value.length <= 30 && value.every(id) && new Set(value).size === value.length;
const date = (value: unknown) => text(value, 40, true) && Number.isFinite(Date.parse(value));
const fingerprint = (value: unknown) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);

export function validateResearchDossier(value: unknown, draft = false): value is ResearchDossier {
  if (!object(value) || !exact(value, ['version', 'protocol', 'findings']) || value.version !== 1 || !object(value.protocol)) return false;
  if (!exact(value.protocol, protocolFields.map(([key]) => key)) || !Object.values(value.protocol).every(entry => text(entry, 2000))) return false;
  if (!Array.isArray(value.findings) || value.findings.length > 20) return false;
  const seen = new Set<string>();
  return value.findings.every(entry => {
    if (!object(entry) || !exact(entry, ['id', 'statement', 'assessment', 'limitations', 'evidenceIds', 'analysisIds', 'withdrawn'])) return false;
    if (!id(entry.id) || seen.has(entry.id) || !text(entry.statement, 2000, !draft) || !text(entry.limitations, 2000) || typeof entry.withdrawn !== 'boolean') return false;
    seen.add(entry.id);
    if (typeof entry.assessment !== 'string' || !Object.hasOwn(findingAssessments, entry.assessment) || !ids(entry.evidenceIds) || !ids(entry.analysisIds)) return false;
    // A judgement needs at least one stated source. Existence is resolved when
    // displayed/exported so removing a source never silently deletes a finding.
    return draft || entry.withdrawn || entry.assessment === 'unreviewed' || (entry.evidenceIds as string[]).length + (entry.analysisIds as string[]).length > 0;
  });
}

export function validateProjectAnalysis(value: unknown): value is ProjectAnalysisRecord {
  if (!object(value) || !exact(value, ['id', 'snapshotId', 'name', 'role', 'sample', 'method', 'context', 'settings', 'dataset', 'metrics', 'interpretation', 'evidenceIds', 'createdAt', 'registeredAt'])) return false;
  if (!id(value.id) || !id(value.snapshotId) || !text(value.name, 100, true) || typeof value.role !== 'string' || !Object.hasOwn(analysisRoles, value.role)) return false;
  if (typeof value.sample !== 'boolean') return false;
  if (!text(value.method, 500, true) || !text(value.context, 4000) || !text(value.settings, 16000) || !text(value.interpretation, 4000, true) || !ids(value.evidenceIds) || !date(value.createdAt) || !date(value.registeredAt)) return false;
  if (!object(value.dataset) || !exact(value.dataset, ['name', 'rows', 'fingerprint', 'sourceFingerprint']) || !text(value.dataset.name, 500, true) || !Number.isSafeInteger(value.dataset.rows) || (value.dataset.rows as number) < 0 || !fingerprint(value.dataset.fingerprint) || !fingerprint(value.dataset.sourceFingerprint)) return false;
  return Array.isArray(value.metrics) && value.metrics.length <= 80 && value.metrics.every(metric => Array.isArray(metric) && metric.length === 2 && metric.every(entry => text(entry, 1000)));
}
export function validateProjectAnalyses(value: unknown): value is ProjectAnalysisRecord[] {
  return Array.isArray(value) && value.length <= 30 && value.every(validateProjectAnalysis) && new Set(value.map(entry => entry.id)).size === value.length && new Set(value.map(entry => entry.snapshotId)).size === value.length;
}
export function missingFindingSources(finding: ResearchFinding, evidence: ProjectEvidence[], analyses: ProjectAnalysisRecord[]) {
  return [...finding.evidenceIds.filter(key => !evidence.some(entry => entry.id === key)), ...finding.analysisIds.filter(key => !analyses.some(entry => entry.id === key))];
}
export function analysisSnapshotHref(record: Pick<ProjectAnalysisRecord, 'snapshotId'>, projectId: string) {
  return withResearchProject(`/data?${new URLSearchParams({snapshot: record.snapshotId})}#history`, projectId);
}
export type ResearchExportProject = {id: string; title: string; updated_at: string; metadata: {goal?: string; notes?: string; tasks?: {text: string; done: boolean}[]; evidence?: ProjectEvidence[]; research?: ResearchDossier; analysisRecords?: ProjectAnalysisRecord[]}};
export function buildResearchExport(project: ResearchExportProject) {
  if (project.metadata.research !== undefined && !validateResearchDossier(project.metadata.research) || project.metadata.analysisRecords !== undefined && !validateProjectAnalyses(project.metadata.analysisRecords)) throw new Error('研究记录格式不受支持，未导出不完整档案。');
  const research = validateResearchDossier(project.metadata.research) ? project.metadata.research : emptyResearchDossier();
  const evidence = (project.metadata.evidence ?? []).filter(validateProjectEvidence);
  const analyses = (project.metadata.analysisRecords ?? []).filter(validateProjectAnalysis);
  const clean = (value: string) => value.replace(/[<>]/g, character => character === '<' ? '&lt;' : '&gt;');
  const line = (value: string) => clean(value).replace(/[\r\n|]/g, ' ');
  const lines = [`# ${line(project.title)}`, '', `项目记录更新时间：${project.updated_at}`, '', '> 本档案由研究者记录，未经平台验证。研究方案是工作记录，不构成预注册。判读状态不等同于学术结论得到证明。', '', '> 包含方案、摘要、摘录及来源标识；不含原始 PDF、数据行或完整本机快照。完整复现仍需原数据、配置及对应软件环境。', '', '## 研究设计', ''];
  for (const [key, label] of protocolFields) lines.push(`### ${label}`, '', clean(research.protocol[key]) || '尚未记录。', '');
  lines.push('## 分析台账', '');
  if (!analyses.length) lines.push('尚未登记结构化分析记录。旧快照链接仍保留在原项目笔记中。', '');
  for (const record of analyses) {
    lines.push(`### ${line(record.name)}`, '', `用途：${analysisRoles[record.role]}；方法：${line(record.method)}`, `数据：${line(record.dataset.name)}；登记行数：${record.dataset.rows}`, `数据类别：${record.sample ? '示例数据（仅用于演示）' : '用户导入数据（来源未由平台验证）'}`, `处理表 SHA-256：${record.dataset.fingerprint}`, `源表 SHA-256：${record.dataset.sourceFingerprint}`, `快照时间：${record.createdAt}；登记时间：${record.registeredAt}`, `快照标识：${line(record.snapshotId)}（完整快照仅在原设备和账户可用）`, '', clean(record.context), '', '设置（登记时的配置文本）：', '', ...record.settings.split('\n').map(value => `    ${clean(value)}`), '', '| 指标 | 保存值 |', '| --- | --- |', ...record.metrics.map(([name, value]) => `| ${line(name)} | ${line(value)} |`), '', `研究者解释：${clean(record.interpretation)}`, '');
    for (const key of record.evidenceIds) lines.push(`关联论文摘录：${line(key)}${evidence.some(entry => entry.id === key) ? '' : '（关联已失效）'}`);
    lines.push('');
  }
  lines.push('## 结论与证据', '');
  if (!research.findings.length) lines.push('尚未记录研究结论。', '');
  research.findings.forEach((finding, index) => {
    lines.push(`### ${index + 1}. ${line(finding.statement)}`, '', `研究者判读：${findingAssessments[finding.assessment]}${finding.withdrawn ? '；已撤下，保留记录' : ''}`, '', `局限与替代解释：${clean(finding.limitations) || '尚未记录。'}`, '');
    if (!finding.evidenceIds.length && !finding.analysisIds.length) lines.push('尚未关联支撑材料；需要补充证据。', '');
    for (const key of finding.evidenceIds) {
      const entry = evidence.find(item => item.id === key);
      lines.push(entry ? `论文摘录：${line(entry.paperTitle)} · 第 ${entry.page} 页 · ${line(entry.section)}（${line(key)}）` : `论文摘录关联已失效：${line(key)}`, '');
      if (entry) lines.push(...entry.quote.split('\n').map(value => `> ${clean(value)}`), '', `来源定位：${withResearchProject(paperSourceHref(entry), project.id)}`, '');
    }
    for (const key of finding.analysisIds) {const entry = analyses.find(item => item.id === key); lines.push(entry ? `分析记录：${line(entry.name)}（${line(key)}）；处理表指纹 ${entry.dataset.fingerprint}` : `分析记录关联已失效：${line(key)}`, '');}
  });
  lines.push('## 全部论文摘录', '');
  for (const entry of evidence) lines.push(`### ${line(entry.paperTitle)} · 第 ${entry.page} 页`, '', `摘录标识：${line(entry.id)}`, '', ...entry.quote.split('\n').map(value => `> ${clean(value)}`), '', `个人评论：${clean(entry.comment) || '未记录。'}`, '', `来源定位：${withResearchProject(paperSourceHref(entry), project.id)}`, '');
  lines.push('## 下一步任务', '', ...(project.metadata.tasks ?? []).map(task => `- [${task.done ? 'x' : ' '}] ${line(task.text)}`), '', '## 原项目笔记', '', clean(project.metadata.notes ?? ''), '');
  return {markdown: lines.join('\n'), json: JSON.stringify({format: 'acaora-research-dossier', version: 1, project: {id: project.id, title: project.title, updatedAt: project.updated_at, goal: project.metadata.goal ?? '', research, analyses, evidence, tasks: project.metadata.tasks ?? [], notes: project.metadata.notes ?? ''}, boundaries: {originalFilesIncluded: false, sourceRowsIncluded: false, fullLocalSnapshotsIncluded: false, preregistered: false, platformVerified: false}}, null, 2)};
}
