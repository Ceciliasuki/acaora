import {validRegressionConfig} from './regression-config';
import {validAdvancedConfig} from './advanced-recipe';

/** Imported snapshots are untrusted. Only recognised model settings may sync;
 * never serialize an arbitrary imported object into a project record. */
export function serializeProjectAnalysisSettings(analysis: {kind: string; config: unknown}) {
  let valid = false;
  if (analysis.kind === 'ols') valid = validRegressionConfig(analysis.config);
  else if (analysis.kind === 'advanced') valid = validAdvancedConfig(analysis.config);
  else if (analysis.kind === 'basic' && analysis.config && typeof analysis.config === 'object' && !Array.isArray(analysis.config)) {
    const config = analysis.config as Record<string, unknown>, keys = ['method', 'x', 'y', 'group', 'value'];
    valid = Object.keys(config).length === keys.length && Object.keys(config).every(key => keys.includes(key))
      && typeof config.method === 'string' && ['describe', 'relation', 'test'].includes(config.method)
      && keys.every(key => typeof config[key] === 'string' && (config[key] as string).length <= 500);
  }
  if (!valid) throw new Error('快照的模型设置包含未知字段或无效参数，未上传到项目。完整快照仍保留在本机。');
  return JSON.stringify(analysis.config, null, 2);
}

export function parseProjectAnalysisSettings(raw:string):{kind:string;config:unknown} {
 const value=JSON.parse(raw);const candidate=value&&typeof value==='object'&&typeof value.kind==='string'&&Object.hasOwn(value,'config')?value:null;
 if(candidate){serializeProjectAnalysisSettings(candidate);return candidate;}
 for(const kind of ['basic','ols','advanced'])try{serializeProjectAnalysisSettings({kind,config:value});return {kind,config:value};}catch{/* Try only recognised closed configurations. */}
 throw new Error('历史设置不支持直接执行，请在 DataLab 重新登记。');
}
