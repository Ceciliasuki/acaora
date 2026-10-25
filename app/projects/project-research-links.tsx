import Link from 'next/link';
import {ArrowRight} from 'lucide-react';
import {paperSourceHref, validateProjectEvidence, type ProjectEvidence} from '../lib/project-evidence';
import {projectAnalysisLinks, withResearchProject} from '../lib/research-links';
import styles from './project-research-links.module.css';

export default function ProjectResearchLinks({projectId, notes, evidence, analyses: records}: {projectId: string; notes: string; evidence: ProjectEvidence[]; analyses?: unknown}) {
  const papers = [...new Map(evidence.filter(validateProjectEvidence).map(entry => [entry.paperId, entry])).values()];
  const analyses = projectAnalysisLinks(notes, records);
  return <section className={styles.resources} aria-labelledby="project-research-title">
    <header><h3 id="project-research-title">研究资料</h3><p>从项目继续阅读和分析，带回摘录、结果解释与下一步。</p></header>
    <div className={styles.row}><div><h4>论文材料</h4>{papers.length ? <ul>{papers.map(entry => <li key={entry.paperId}><Link href={withResearchProject(paperSourceHref(entry), projectId)}>{entry.paperTitle}<ArrowRight size={14} aria-hidden="true"/></Link></li>)}</ul> : <p>尚未加入摘录。在论文笔记或批注中选择“加入项目”。</p>}</div><Link href={withResearchProject('/papers', projectId)}>查阅论文<ArrowRight size={15} aria-hidden="true"/></Link></div>
    <div className={styles.row}><div><h4>分析记录</h4>{analyses.length ? <ul>{analyses.map(entry => <li key={entry.id}><Link href={withResearchProject(entry.href, projectId)}>{entry.name}<ArrowRight size={14} aria-hidden="true"/></Link></li>)}</ul> : <p>尚未关联快照。分析后保存命名快照，再将解释加入项目。</p>}</div><Link href={withResearchProject('/data', projectId)}>分析数据<ArrowRight size={15} aria-hidden="true"/></Link></div>
  </section>;
}
