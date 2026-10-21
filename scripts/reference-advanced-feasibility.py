"""Independent references for Welch ANOVA and group/time validation; synthetic inputs only."""
import json
import runpy
from pathlib import Path
import numpy as np
import scipy
from scipy import stats
import statsmodels
from statsmodels.stats.oneway import anova_oneway


def main():
    root = Path(__file__).resolve().parent.parent
    old = json.loads((root / 'tests/fixtures/advanced-reference.json').read_text(encoding='utf-8'))
    data = old['data']
    headers = [*data['headers'], 'time']
    # Repeated timestamps and reverse input order check that time validation sorts by values, not row positions.
    rows = [[*row, str(2000 + i // 3)] for i, row in enumerate(data['rows'])][::-1]
    x = np.array([[float(r[0]), float(r[1])] for r in rows])
    y = np.array([float(r[3]) for r in rows])
    times = np.array([int(r[-1]) for r in rows])
    entities = np.array([r[7] for r in rows])
    n, k = len(rows), 5
    group_names = sorted(set(entities))
    independent_folds = runpy.run_path(str(root / 'scripts/reference-advanced.py'))['folds']
    labels = independent_folds(len(group_names), k, 42)
    mapping = dict(zip(group_names, labels))
    group_folds = np.array([mapping[g] for g in entities])
    chunks = np.array_split(sorted(set(times)), k + 1)
    time_mapping = {t: i - 1 for i, chunk in enumerate(chunks) for t in chunk}
    time_folds = np.array([time_mapping[t] for t in times])
    expected = {}
    for mode, split in [('group', group_folds), ('time', time_folds)]:
        predictions, baselines = [None] * n, [None] * n
        fold_metrics = []
        for f in range(k):
            held = split == f
            train = split < f if mode == 'time' else split != f
            if mode == 'time':
                assert max(times[train]) < min(times[held])
            else:
                assert set(entities[train]).isdisjoint(set(entities[held]))
            mx, sx = x[train].mean(axis=0), x[train].std(axis=0, ddof=1)
            beta = np.linalg.lstsq(np.column_stack([np.ones(train.sum()), (x[train] - mx) / sx]), y[train], rcond=None)[0]
            pred = np.column_stack([np.ones(held.sum()), (x[held] - mx) / sx]) @ beta
            for i, value in zip(np.flatnonzero(held), pred):
                predictions[i], baselines[i] = float(value), float(y[train].mean())
            errors = y[held] - pred
            fold_metrics.append([f+1, int(train.sum()), int(held.sum()), float(np.sqrt(np.mean(errors**2))), float(np.mean(abs(errors))), float(1-np.sum(errors**2)/np.sum((y[held]-y[held].mean())**2))])
        evaluated = np.array([i for i, v in enumerate(predictions) if v is not None])
        errors = y[evaluated] - np.array([predictions[i] for i in evaluated])
        expected[mode] = {'folds': split.tolist(), 'predictions': predictions, 'baselines': baselines, 'fold_metrics': fold_metrics,
                          'evaluated': len(evaluated), 'rmse': float(np.sqrt(np.mean(errors**2))), 'mae': float(np.mean(abs(errors))),
                          'r2': float(1-np.sum(errors**2)/np.sum((y[evaluated]-y[evaluated].mean())**2))}
    random = np.random.default_rng(4210)
    groups = [random.normal(0, .3, 11), random.normal(.5, 2, 24), random.normal(1.5, 5, 37)]
    welch_data = {'name': 'unequal-synthetic.csv', 'headers': ['value', 'group'], 'rows': [[str(v), 'ABC'[i]] for i, g in enumerate(groups) for v in g]}
    scipy_result = stats.f_oneway(*groups, equal_var=False)
    statsmodels_result = anova_oneway(groups, use_var='unequal', welch_correction=True)
    assert abs(scipy_result.statistic-statsmodels_result.statistic) < 1e-10
    expected['welchanova'] = {'f': float(scipy_result.statistic), 'p': float(scipy_result.pvalue), 'df': list(map(float, statsmodels_result.df)), 'data': welch_data}
    out = root / 'tests/fixtures/advanced-feasibility-reference.json'
    out.write_text(json.dumps({'source': 'scripts/reference-advanced-feasibility.py', 'versions': {'numpy': np.__version__, 'scipy': scipy.__version__, 'statsmodels': statsmodels.__version__}, 'data': {'name': 'validation-synthetic.csv', 'headers': headers, 'rows': rows}, 'expected': expected}, indent=2, allow_nan=False) + '\n', encoding='utf-8')
    print('Wrote group/time validation and independent two-library Welch references:', out)


if __name__ == '__main__':
    main()
