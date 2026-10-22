'use client';

import {useEffect, useMemo, useRef, useState} from 'react';
import {Download, Upload} from 'lucide-react';
import {Button} from '../components/ui';
import type {DataSet} from '../stats';
import {categoricalColumns, numericColumns} from '../stats';
import {createAnalysisRecipe, fingerprintDataset, maxRecipeFileBytes, parseAnalysisRecipe, recipeMethodLabels, validateRecipeConfig, type AnalysisRecipe, type RecipeConfig} from './analysis-recipe';

type Props = {data: DataSet; datasetKey: string; config: RecipeConfig; onApply: (config: RecipeConfig) => void};

/** Remounting by datasetKey prevents a staged mapping or confirmation leaking into another imported file. */
export default function AnalysisRecipeTools(props: Props) {
  return <RecipeSession key={props.datasetKey} {...props}/>;
}

function RecipeSession({data, config, onApply}: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  const mounted = useRef(true);
  const readLock = useRef(false);
  const [fingerprint, setFingerprint] = useState<string | null>(null);
  const [fingerprintError, setFingerprintError] = useState('');
  const [imported, setImported] = useState<AnalysisRecipe | null>(null);
  const [draft, setDraft] = useState<RecipeConfig | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [reading, setReading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const numeric = useMemo(() => numericColumns(data), [data]);
  const categorical = useMemo(() => categoricalColumns(data), [data]);

  useEffect(() => {
    mounted.current = true;
    let current = true;
    void fingerprintDataset(data).then(value => { if (current) setFingerprint(value); }).catch(cause => {
      if (current) setFingerprintError(cause instanceof Error ? cause.message : '无法计算本地数据指纹，请重新导入数据后再试。');
    });
    return () => { current = false; mounted.current = false; };
  }, [data]);

  const changed = Boolean(imported && fingerprint && imported.dataset.fingerprint !== fingerprint);
  const legacyEngine=imported?.engine==='acaora-stats-v1';
  const validation = draft ? validateRecipeConfig(data, draft) : [];

  function exportRecipe() {
    if (!fingerprint) return;
    setMessage(''); setError('');
    const problems = validateRecipeConfig(data, config);
    if (problems.length) { setError(`暂不能保存方案：${problems.join('')}`); return; }
    try {
      const recipe = createAnalysisRecipe(data, config, fingerprint);
      const text = JSON.stringify(recipe, null, 2);
      // Ensure every exported document also fits the import contract.
      parseAnalysisRecipe(text);
      const url = URL.createObjectURL(new Blob([text], {type: 'application/json;charset=utf-8'}));
      const link = document.createElement('a');
      link.href = url; link.download = `acaora-${config.method}-recipe.json`; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage('已导出分析方案。文件包含变量名、分析设置和数据指纹，不包含原始数据行或统计结果。');
    } catch (cause) { setError(cause instanceof Error ? cause.message : '无法导出方案，请重试。'); }
  }

  async function readRecipe(file?: File) {
    if (!file || readLock.current) return;
    readLock.current = true;
    setReading(true); setMessage(''); setError('');
    setImported(null); setDraft(null); setAcknowledged(false);
    try {
      if (file.size > maxRecipeFileBytes) throw new Error('方案文件超过 256 KB，请选择 ACAORA 导出的分析方案。');
      const recipe = parseAnalysisRecipe(await file.text());
      if (!mounted.current) return;
      setImported(recipe); setDraft({...recipe.config});
      setMessage('方案已读取，尚未应用。请检查变量映射后选择“应用并重算”。');
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : '无法读取方案，请重新选择 JSON 文件。');
    } finally { readLock.current = false; if (mounted.current) setReading(false); }
  }

  function mapRole(role: 'x' | 'y' | 'group' | 'value', value: string) {
    setDraft(current => current ? {...current, [role]: value} : current);
    setMessage(''); setError('');
  }

  function mapping(role: 'x' | 'y' | 'group' | 'value', label: string, options: string[]) {
    if (!draft) return null;
    const source = draft[role];
    return <label>{label}<select value={options.includes(source) ? source : ''} onChange={event => mapRole(role, event.target.value)} aria-label={`方案${label}`}>
      <option value="">{source && !options.includes(source) ? `找不到“${source}”，请选择` : '请选择变量'}</option>
      {options.map(header => <option key={header} value={header}>{header}</option>)}
    </select></label>;
  }

  function apply() {
    if (!draft || !fingerprint || validation.length || ((changed||legacyEngine) && !acknowledged)) return;
    onApply({...draft});
    setImported(null); setDraft(null); setAcknowledged(false); setError('');
    setMessage('已将方案应用到当前数据并重算。当前结果会随变量选择更新。');
  }

  return <details className="recipe-tools">
    <summary>保存与重跑分析方案</summary>
    <div className="recipe-tools-body">
      <p>保存方法与变量设置，重新选择数据文件后可核对字段并重跑。原始数据仅在当前页面处理，刷新后需重新选择。</p>
      <div className="recipe-actions">
        <Button variant="secondary" size="sm" disabled={!fingerprint || reading} onClick={exportRecipe}><Download size={15} aria-hidden="true"/>导出当前方案</Button>
        <Button variant="ghost" size="sm" disabled={reading} onClick={() => fileInput.current?.click()}><Upload size={15} aria-hidden="true"/>{reading ? '正在读取方案…' : '导入分析方案'}</Button>
        <input ref={fileInput} type="file" accept=".json,application/json" className="sr-only" aria-label="选择分析方案文件" disabled={reading} onChange={event => {const file = event.target.files?.[0]; event.target.value = ''; void readRecipe(file);}}/>
      </div>
      <p className="recipe-policy">缺失规则：各分析只使用所需变量完整、有效的观测，不填补缺失值。直方图固定为 9 组；Welch 检验固定为双侧、α = 0.05。</p>
      {!fingerprint && !fingerprintError && <p role="status">正在当前设备计算数据指纹…</p>}
      {fingerprintError && <p role="alert">{fingerprintError}</p>}
      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}
      {imported && draft && <section className="recipe-staging" aria-label="待应用分析方案">
        <h3>{recipeMethodLabels[draft.method]}</h3>
        <p>方案数据：{imported.dataset.rows} 行、{imported.dataset.columns} 列。当前数据：{data.rows.length} 行、{data.headers.length} 列。</p>
        {fingerprint && <p className="recipe-identity">{changed ? '数据指纹不同：应用后将使用当前数据重新分析，结果可能不同。' : '数据指纹一致：当前字段与数据内容和保存时一致。'}</p>}
        {legacyEngine&&<p>这是旧版统计引擎的方案。新版会拒绝常量变量和无法估计标准误的检验，请确认后使用新版重新计算。</p>}
        <div className="recipe-mappings">
          {draft.method === 'describe' && mapping('x', '分析变量', numeric)}
          {draft.method === 'relation' && <>{mapping('x', 'X 变量', numeric)}{mapping('y', 'Y 变量', numeric)}</>}
          {draft.method === 'test' && <>{mapping('group', '分组变量', categorical)}{mapping('value', '因变量', numeric)}</>}
        </div>
        {validation.length > 0 && <ul role="alert">{validation.map(problem => <li key={problem}>{problem}</li>)}</ul>}
        {(changed||legacyEngine) && <label className="recipe-acknowledgment"><input type="checkbox" checked={acknowledged} onChange={event => setAcknowledged(event.target.checked)}/>我已确认变量映射，使用当前数据重算</label>}
        <div className="recipe-actions">
          <Button size="sm" disabled={!fingerprint || Boolean(fingerprintError) || validation.length > 0 || ((changed||legacyEngine) && !acknowledged)} onClick={apply}>应用并重算</Button>
          <Button variant="ghost" size="sm" onClick={() => {setImported(null); setDraft(null); setAcknowledged(false); setMessage(''); setError('');}}>取消导入</Button>
        </div>
      </section>}
    </div>
  </details>;
}
