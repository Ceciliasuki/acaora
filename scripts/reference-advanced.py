"""Independent synthetic references. Run with ignored work/regression-reference on PYTHONPATH.
No Python package is shipped with the web app. No real research data is used.
"""
import json
from pathlib import Path
import numpy as np
import scipy
from scipy import stats
from scipy.cluster.vq import kmeans2
import statsmodels
import statsmodels.api as sm


def lcg(seed):
    state = seed
    while True:
        state = (1664525 * state + 1013904223) % 2**32
        yield state / 2**32


def folds(n, k, seed):
    random = lcg(seed)
    indices = list(range(n))
    for i in range(n - 1, 0, -1):
        j = int(next(random) * (i + 1))
        indices[i], indices[j] = indices[j], indices[i]
    answer = np.zeros(n, dtype=int)
    offset = 0
    for f in range(k):
        size = n // k + int(f < n % k)
        answer[indices[offset:offset + size]] = f
        offset += size
    return answer


def coef(result, indices=None, odds=False):
    indices = range(len(result.params)) if indices is None else indices
    return [[float(result.params[i]), float(result.bse[i]), float(result.tvalues[i]), float(result.pvalues[i]),
             float(result.conf_int()[i, 0]), float(result.conf_int()[i, 1])]
            + ([float(np.exp(result.params[i])), float(np.exp(result.conf_int()[i, 0])), float(np.exp(result.conf_int()[i, 1]))] if odds else [])
            for i in indices]


def main():
    random = np.random.default_rng(20261021)
    n = 96
    entity = np.repeat(np.arange(16), 6)
    x = random.normal(size=(n, 3))
    y = 2 + x @ np.array([.7, -.4, .2]) + entity * .15 + random.normal(size=n) * (.3 + np.abs(x[:, 0]))
    binary = random.binomial(1, 1 / (1 + np.exp(-(.1 + x[:, 0] * .8 - x[:, 1] * .5))))
    before = random.integers(2, 12, n)
    after = before + random.integers(-4, 6, n)
    group2 = np.array(['A' if i % 2 == 0 else 'B' for i in range(n)])
    group3 = np.array(['ABC'[i % 3] for i in range(n)])
    headers = ['x1', 'x2', 'x3', 'y', 'binary', 'before', 'after', 'entity', 'group2', 'group3']
    rows = [[str(v) for v in [*x[i], y[i], binary[i], before[i], after[i], f'E{entity[i]:02}', group2[i], group3[i]]] for i in range(n)]
    design = sm.add_constant(x[:, :2])
    clustered = sm.OLS(y, design).fit(cov_type='cluster', cov_kwds={'groups': entity, 'use_correction': True}, use_t=True)
    dummies = np.eye(16)[entity]
    fixed = sm.OLS(y, np.column_stack([dummies, x[:, :2]])).fit(cov_type='cluster', cov_kwds={'groups': entity, 'use_correction': True}, use_t=True)
    logit = sm.Logit(binary, design).fit(disp=False, tol=1e-12)
    expected = {
        'cluster': {'coefficients': coef(clustered), 'fitted': clustered.fittedvalues.tolist(), 'residual': clustered.resid.tolist(), 'df': float(clustered.df_resid)},
        'fixed': {'coefficients': coef(fixed, [16, 17]), 'fitted': fixed.fittedvalues.tolist(), 'residual': fixed.resid.tolist(), 'df': float(fixed.df_resid), 'intercepts': fixed.params[:16].tolist()},
        'logistic': {'coefficients': coef(logit, odds=True), 'probabilities': logit.predict().tolist(), 'll': float(logit.llf), 'aic': float(logit.aic), 'pseudo': float(logit.prsquared)},
    }
    diff = before - after
    paired = stats.ttest_rel(before, after)
    ci = paired.confidence_interval(.95)
    expected['paired'] = {'mean': float(diff.mean()), 't': float(paired.statistic), 'p': float(paired.pvalue), 'ci': [float(ci.low), float(ci.high)]}
    anova = stats.f_oneway(*(y[group3 == g] for g in 'ABC'))
    expected['anova'] = {'f': float(anova.statistic), 'p': float(anova.pvalue)}
    mw = stats.mannwhitneyu(before[group2 == 'A'], before[group2 == 'B'], alternative='two-sided', method='asymptotic', use_continuity=True)
    wilcoxon = stats.wilcoxon(before, after, alternative='two-sided', method='asymptotic', zero_method='wilcox', correction=True)
    expected['mannwhitney'] = {'u': float(mw.statistic), 'p': float(mw.pvalue)}
    expected['wilcoxon'] = {'w': float(wilcoxon.statistic), 'p': float(wilcoxon.pvalue)}
    z = (x - x.mean(axis=0)) / x.std(axis=0, ddof=1)
    u, singular, vt = np.linalg.svd(z, full_matrices=False)
    for j in range(3):
        if vt[j, np.abs(vt[j]).argmax()] < 0:
            vt[j] *= -1
    eigen = singular**2 / (n - 1)
    expected['pca'] = {'eigen': eigen.tolist(), 'weights': vt.T.tolist(), 'scores': (z @ vt.T).tolist()}
    random_init = lcg(42)
    best = None
    for _ in range(5):
        centers = [z[int(next(random_init) * n)].copy()]
        while len(centers) < 3:
            distances = np.min(np.sum((z[:, None, :] - np.array(centers)[None, :, :])**2, axis=2), axis=1)
            centers.append(z[distances.argmax()].copy())
        centers, labels = kmeans2(z, np.array(centers), iter=200, minit='matrix', missing='raise')
        inertia = float(np.sum((z - centers[labels])**2))
        if best is None or inertia < best['inertia']:
            best = {'centers': (centers * x.std(axis=0, ddof=1) + x.mean(axis=0)).tolist(), 'labels': labels.tolist(), 'inertia': inertia}
    expected['kmeans'] = best
    split = folds(n, 5, 42)
    predictions = np.zeros(n)
    baseline = np.zeros(n)
    fold_metrics = []
    for f in range(5):
        train, test = split != f, split == f
        # Fit training-only scaling, independent NumPy least squares; retain held-out rows untouched.
        train_mean = x[train, :2].mean(axis=0)
        train_sd = x[train, :2].std(axis=0, ddof=1)
        train_design = np.column_stack([np.ones(train.sum()), (x[train, :2] - train_mean) / train_sd])
        beta = np.linalg.lstsq(train_design, y[train], rcond=None)[0]
        predictions[test] = np.column_stack([np.ones(test.sum()), (x[test, :2] - train_mean) / train_sd]) @ beta
        baseline[test] = y[train].mean()
        error = y[test] - predictions[test]
        fold_metrics.append([f + 1, int(train.sum()), int(test.sum()), float(np.sqrt(np.mean(error**2))), float(np.mean(abs(error))), float(1 - np.sum(error**2) / np.sum((y[test] - y[test].mean())**2))])
    expected['cv'] = {'folds': split.tolist(), 'predictions': predictions.tolist(), 'baseline': baseline.tolist(), 'fold_metrics': fold_metrics,
                      'rmse': float(np.sqrt(np.mean((y-predictions)**2))), 'mae': float(np.mean(abs(y-predictions))), 'r2': float(1-np.sum((y-predictions)**2)/np.sum((y-y.mean())**2))}
    fixture = {'source': 'scripts/reference-advanced.py', 'versions': {'numpy': np.__version__, 'scipy': scipy.__version__, 'statsmodels': statsmodels.__version__}, 'data': {'name': 'advanced-synthetic.csv', 'headers': headers, 'rows': rows}, 'expected': expected}
    destination = Path(__file__).resolve().parent.parent / 'tests/fixtures/advanced-reference.json'
    destination.write_text(json.dumps(fixture, indent=2, allow_nan=False) + '\n', encoding='utf-8')
    print('Wrote independent references for 10 methods:', destination)


if __name__ == '__main__':
    main()
