import {regression, summarize, welchTest, type DataSet} from '../stats';
import {validateRecipeConfig, type RecipeConfig} from './analysis-recipe';
import {runAdvancedAnalysis} from './advanced-analysis';
import {ADVANCED_ENGINE, type AdvancedConfig, type AdvancedTable} from './advanced-config';
import {advancedMappingErrors} from './advanced-recipe';
import {fitMultipleRegression} from './multiple-regression';
import {advancedPaperCharts, regressionPaperChart} from './paper-charts';
import type {PaperChartSpec} from './paper-chart-svg';
import {serializeProjectAnalysisSettings} from './project-analysis-settings';
import {REGRESSION_ENGINE, type RegressionConfig} from './regression-config';

export type ResearchExecution = {
  engine: string;
  metrics: Array<[string, number | null]>;
  tables: AdvancedTable[];
  charts: PaperChartSpec[];
  warnings: string[];
};
const finite = (value: number | null): number | null => value !== null && Number.isFinite(value) ? value : null;

/** Full-precision summaries from the existing engines. No observation-level
 * tables, fitted values, residuals or raw data rows leave this executor. */
export function executeResearchAnalysis(data: DataSet, analysis: {kind: string; config: unknown}): ResearchExecution {
  serializeProjectAnalysisSettings(analysis);
  if (analysis.kind === 'basic') {
    const config = analysis.config as RecipeConfig;
    const errors = validateRecipeConfig(data, config);
    if (errors.length) throw new Error(errors.join(''));
    const metrics: ResearchExecution['metrics'] = [];
    if (config.method === 'describe') {
      const summary = summarize(data, config.x);
      for (const key of ['n', 'mean', 'sd', 'min', 'median', 'max'] as const) metrics.push([key, finite(summary[key])]);
    } else if (config.method === 'relation') {
      const fit = regression(data, config.x, config.y);
      if (!fit) throw new Error('相关与回归没有返回有效结果，请检查完整样本与变量变动。');
      for (const key of ['n', 'r', 'p', 'slope', 'intercept', 'r2', 't'] as const) metrics.push([key, finite(fit[key])]);
    } else {
      const fit = welchTest(data, config.group, config.value);
      if (!fit) throw new Error('Welch 检验没有返回有效结果，请检查分组、有效样本与组内变动。');
      metrics.push(['t', finite(fit.t)], ['df', finite(fit.degreesOfFreedom)], ['p', finite(fit.p)], ['d', finite(fit.effect)]);
      fit.groups.forEach((group, index) => {
        metrics.push([`group:${group}:n`, fit.samples[index].length], [`group:${group}:mean`, finite(fit.means[index])]);
      });
    }
    return {engine: 'acaora-stats-v2', metrics, tables: [], charts: [], warnings: []};
  }
  if (analysis.kind === 'ols') {
    const fit = fitMultipleRegression(data, analysis.config as RegressionConfig);
    const metrics: ResearchExecution['metrics'] = [['n', fit.n], ['r2', finite(fit.r2)], ['adjustedR2', finite(fit.adjustedR2)], ['rmse', finite(fit.rmse)]];
    fit.coefficients.forEach(coefficient => {
      for (const key of ['estimate', 'se', 't', 'p', 'low', 'high', 'vif'] as const) metrics.push([`coef:${coefficient.name}:${key}`, finite(coefficient[key])]);
    });
    const table: AdvancedTable = {
      title: '回归系数', headers: ['变量', '系数', '标准误', 't', 'p', '95% 下限', '95% 上限', 'VIF'],
      rows: fit.coefficients.map(coefficient => [coefficient.name, ...(['estimate', 'se', 't', 'p', 'low', 'high', 'vif'] as const).map(key => finite(coefficient[key]))]),
    };
    return {engine: REGRESSION_ENGINE, metrics, tables: [table], charts: [regressionPaperChart(fit)], warnings: [...fit.warnings]};
  }
  const config = analysis.config as AdvancedConfig;
  const errors = advancedMappingErrors(data, config);
  if (errors.length) throw new Error(errors.join(''));
  const fit = runAdvancedAnalysis(data, config);
  const tables = fit.tables.filter(table => !table.observationLevel).map(table => ({...table, headers: [...table.headers], rows: table.rows.map(row => [...row])}));
  const metrics: ResearchExecution['metrics'] = [['n', fit.n], ['excluded', fit.excluded], ...fit.metrics.map(([key, value]): [string, number | null] => [key, finite(value)])];
  for (const table of tables) table.rows.forEach((row, rowIndex) => row.forEach((value, columnIndex) => {
    if (typeof value === 'number' || value === null) metrics.push([`table:${table.title}:${rowIndex}:${table.headers[columnIndex]}`, finite(value)]);
  }));
  return {engine: ADVANCED_ENGINE, metrics, tables, charts: advancedPaperCharts(fit), warnings: [...fit.warnings]};
}
