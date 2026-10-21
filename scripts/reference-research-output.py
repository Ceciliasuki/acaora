"""Independent references for categorical regression, fold-specific encoding and Holm families."""
import json
import runpy
from pathlib import Path
import numpy as np
import scipy
from scipy import stats
import statsmodels
import statsmodels.api as sm
from statsmodels.stats.multitest import multipletests


def coefficients(fit):
    return [[float(fit.params[j]), float(fit.bse[j]), float(fit.tvalues[j]), float(fit.pvalues[j]), float(fit.conf_int()[j, 0]), float(fit.conf_int()[j, 1])] for j in range(len(fit.params))]


def main():
    root = Path(__file__).resolve().parent.parent
    random = np.random.default_rng(20261021)
    n = 150
    levels = ['对照组', '干预 & A', '干预 <B>']
    kind = np.array([levels[i % 3] for i in range(n)])
    entity = np.repeat(np.arange(10), 15)
    time = np.arange(n) // 3
    x = random.normal(size=n)
    effects = np.array([0, .6, -.4])[np.arange(n) % 3]
    y = 2 + .7*x + effects + entity*.06 + random.normal(size=n)*.4
    binary = random.binomial(1, 1/(1+np.exp(-(.1+.5*x+effects*.6))))
    rows = [[str(x[i]), str(y[i]), str(binary[i]), kind[i], f'E{entity[i]:02}', str(time[i])] for i in range(n)]
    data = {'name': 'categorical-synthetic.csv', 'headers': ['x', 'y', 'binary', 'kind', 'entity', 'time'], 'rows': rows}
    design = np.column_stack([np.ones(n), x, kind == levels[1], kind == levels[2]])
    model = sm.OLS(y, design).fit(use_t=True)
    robust = model.get_robustcov_results(cov_type='HC3', use_t=True)
    clustered = model.get_robustcov_results(cov_type='cluster', groups=entity, use_correction=True, use_t=True)
    fixed = sm.OLS(y, np.column_stack([np.eye(10)[entity], x, kind == levels[1], kind == levels[2]])).fit(cov_type='cluster', cov_kwds={'groups': entity, 'use_correction': True}, use_t=True)
    logit = sm.Logit(binary, design).fit(disp=False, tol=1e-12)
    reference_changed = sm.OLS(y, np.column_stack([np.ones(n), x, kind == levels[0], kind == levels[2]])).fit(use_t=True)
    expected = {'ols': coefficients(model), 'HC3': coefficients(robust), 'cluster': coefficients(clustered), 'fixed': coefficients(fixed)[10:], 'logistic': coefficients(logit), 'reference_changed': coefficients(reference_changed)}
    split_function = runpy.run_path(str(root/'scripts/reference-advanced.py'))['folds']
    cv = {}
    for mode in ['random', 'group', 'time']:
        if mode == 'random':
            split = split_function(n, 5, 42)
        elif mode == 'group':
            assignment = split_function(10, 5, 42)
            split = assignment[entity]
        else:
            chunks = np.array_split(sorted(set(time)), 6)
            mapping = {t: j-1 for j, chunk in enumerate(chunks) for t in chunk}
            split = np.array([mapping[t] for t in time])
        predictions = [None] * n
        for f in range(5):
            held, train = split == f, split < f if mode == 'time' else split != f
            # Learn levels solely from this fold's training rows, with an explicit fixed reference.
            learned = sorted(set(kind[train]))
            assert levels[0] in learned and set(kind[held]).issubset(learned)
            columns = [level for level in learned if level != levels[0]]
            train_x = np.column_stack([x[train], *(kind[train] == level for level in columns)])
            held_x = np.column_stack([x[held], *(kind[held] == level for level in columns)])
            mx, sx = train_x.mean(axis=0), train_x.std(axis=0, ddof=1)
            beta = np.linalg.lstsq(np.column_stack([np.ones(train.sum()), (train_x-mx)/sx]), y[train], rcond=None)[0]
            pred = np.column_stack([np.ones(held.sum()), (held_x-mx)/sx]) @ beta
            for i, value in zip(np.flatnonzero(held), pred):
                predictions[i] = float(value)
        cv[mode] = predictions
    expected['cv'] = cv
    group_names = ['A', 'B', 'C', 'D']
    samples = [random.normal(i*.8, sd, size) for i, (sd, size) in enumerate(zip([.4, 1.3, .7, 2.1], [15, 17, 21, 19]))]
    posthoc_data = {'name': 'posthoc-synthetic.csv', 'headers': ['value', 'group'], 'rows': [[str(v), group_names[i]] for i, sample in enumerate(samples) for v in sample]}
    posthoc = {}
    for family in ['all', 'reference']:
        pairs = [(i, j) for i in range(4) for j in range(i+1, 4)] if family == 'all' else [(i, 0) for i in range(1, 4)]
        comparisons = []
        for i, j in pairs:
            test = stats.ttest_ind(samples[i], samples[j], equal_var=False)
            ci = test.confidence_interval(.95)
            comparisons.append([float(samples[i].mean()-samples[j].mean()), float(np.sqrt(samples[i].var(ddof=1)/len(samples[i])+samples[j].var(ddof=1)/len(samples[j]))), float(test.statistic), float(test.df), float(test.pvalue), float(ci.low), float(ci.high)])
        adjusted = multipletests([r[4] for r in comparisons], alpha=.05, method='holm')[1]
        posthoc[family] = {'pairs': [[group_names[i], group_names[j]] for i, j in pairs], 'values': comparisons, 'adjusted': adjusted.tolist()}
    output = {'source': 'scripts/reference-research-output.py', 'versions': {'numpy': np.__version__, 'scipy': scipy.__version__, 'statsmodels': statsmodels.__version__}, 'data': data, 'levels': levels, 'expected': expected, 'posthoc_data': posthoc_data, 'posthoc': posthoc}
    target = root/'tests/fixtures/research-output-reference.json'
    target.write_text(json.dumps(output, indent=2, allow_nan=False)+'\n', encoding='utf-8')
    print('Wrote categorical model/CV and two Holm comparison-family references:', target)


if __name__ == '__main__':
    main()
