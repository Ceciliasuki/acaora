"""Regenerate synthetic OLS reference values with independent statsmodels/SciPy.

Run explicitly with a Python environment containing numpy, scipy and statsmodels.
The application and normal JS tests use the committed JSON; Python is not a runtime dependency.
"""
import json
from pathlib import Path
import numpy as np
import scipy
import statsmodels
import statsmodels.api as sm
from statsmodels.stats.outliers_influence import variance_inflation_factor


def reference(name, rows):
    valid = [(i + 1, row) for i, row in enumerate(rows) if all(v not in ("", "NA", "bad") for v in row)]
    values = np.array([row for _, row in valid], dtype=float)
    design = sm.add_constant(values[:, :-1])
    model = sm.OLS(values[:, -1], design).fit(use_t=True)
    influence = model.get_influence()
    variants = {"classical": model, "HC3": model.get_robustcov_results(cov_type="HC3", use_t=True)}
    methods = {}
    for method, result in variants.items():
        methods[method] = [dict(estimate=float(result.params[j]), se=float(result.bse[j]),
                                t=float(result.tvalues[j]), p=float(result.pvalues[j]),
                                low=float(result.conf_int()[j, 0]), high=float(result.conf_int()[j, 1]),
                                vif=None if j == 0 else float(variance_inflation_factor(design, j)))
                           for j in range(design.shape[1])]
    return {"name": name, "data": {"name": name + ".csv", "headers": [f"x{i+1}" for i in range(values.shape[1]-1)] + ["y"],
                                   "rows": [[str(v) for v in row] for row in rows]},
            "expected": {"n": int(model.nobs), "excluded": len(rows)-int(model.nobs),
                         "dfResidual": int(model.df_resid), "r2": float(model.rsquared),
                         "adjustedR2": float(model.rsquared_adj), "rmse": float(np.sqrt(model.mse_resid)),
                         "methods": methods,
                         "observations": [dict(row=original, fitted=float(model.fittedvalues[i]), residual=float(model.resid[i]),
                                               standardizedResidual=float(influence.resid_studentized_internal[i]),
                                               leverage=float(influence.hat_matrix_diag[i]), cook=float(influence.cooks_distance[0][i]))
                                          for i, (original, _) in enumerate(valid)]}}


def main():
    rows = [[i / 3, np.sin(i * .7), 2.1 + .6 * i / 3 - .8 * np.sin(i * .7) + .5 * np.cos(i * 1.1)] for i in range(24)]
    rng = np.random.default_rng(20261021)
    x = rng.normal(size=(60, 3))
    y = 1.2 + x @ np.array([1.5, -.7, .3]) + rng.normal(size=60) * (.2 + np.abs(x[:, 0]))
    heterogeneous = [list(row) + [outcome] for row, outcome in zip(x, y)]
    missing = [list(row) for row in rows]
    missing[1][0] = ""
    missing[3][1] = "NA"
    missing[7][-1] = "bad"
    fixture = {"source": "scripts/reference-regression.py", "versions": {"numpy": np.__version__, "scipy": scipy.__version__, "statsmodels": statsmodels.__version__},
               "inference": "two-sided t, residual df, alpha 0.05; HC3 use_t=True",
               "cases": [reference("ordinary", rows), reference("heteroskedastic", heterogeneous), reference("listwise-missing", missing)]}
    destination = Path(__file__).resolve().parent.parent / "tests/fixtures/multiple-regression-reference.json"
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(fixture, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    print(f"Wrote {len(fixture['cases'])} independent cases to {destination}")


if __name__ == "__main__":
    main()
