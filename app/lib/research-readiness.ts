import {researchHash, currentLedger, type LedgerEvent} from './research-ledger';
import {parseProjectAnalysisSettings} from '../data/project-analysis-settings';
import type {ProjectAnalysisRecord} from './project-research';

/** A matching record describes a numerical comparison, never scientific validity.
 * The latest attempt for a snapshot supersedes earlier passes. */
export async function assessAnalysisVerification(analyses: ProjectAnalysisRecord[], events: LedgerEvent[]) {
  const records = currentLedger(events).filter(event => event.collection === 'verification' && !event.archived);
  return Promise.all(analyses.map(async analysis => {
    const latest = records.filter(event => event.payload.snapshotId === analysis.snapshotId).sort((a,b) => b.sequence-a.sequence)[0];
    let matches = false;
    try {
      const settingsHash = await researchHash(parseProjectAnalysisSettings(analysis.settings));
      matches = Boolean(latest && latest.payload.sourceFingerprint === analysis.dataset.sourceFingerprint
        && latest.payload.dataFingerprint === analysis.dataset.fingerprint && latest.payload.settingsHash === settingsHash);
    } catch {/* Unsupported legacy settings stay unverified. */}
    return {id:analysis.id, name:analysis.name, verified:matches && latest.payload.status === 'pass',
      reason:!latest?'没有核验记录':!matches?'数据或模型设置未匹配':latest.payload.status==='pass'?'已有一致的数值核验记录':latest.payload.status==='fail'?'最近核验不一致':'最近记录无法核验'};
  }));
}
