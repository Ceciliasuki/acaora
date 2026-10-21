# DataLab 进阶方法与验证

日期：2026-10-21。本地实现，未部署到 acaora.cn。

## 入口与交互

`/data` → 分析方法 → 进阶方法。原四个方法入口保留；十种新方法收在一个原生下拉框，按回归与面板、统计检验、降维与聚类、预测验证分组。随方法仅显示需要的变量、主体、K、主成分数、折数和种子设置。保留已有浅色学术工作台。

所有计算在浏览器 Worker 内运行，只发送所选字段，不上传到服务器。切换方法、换数据、离开面板会终止 Worker；显式运行和取消；修改设置后标注上次结果，导出仍对应实际计算的设置。数值列不自动编码分类变量，主体/分组字段允许文本或数字。

只根据该方法所需字段整行排除缺失/非法数值；保留原始行号，不改写数据。最多 12 个分析/解释变量，50,000 个完整观测，K-means 为 10,000；超过拒绝，不静默抽样。表格显示前 50 行，CSV 导出所有行及原始精度。页面保留六位小数，极小/极大非零数用科学计数法。

结果可固定比较、复制、导出摘要 CSV、逐表 CSV 和分析记录 JSON。JSON 是包含引擎版本、源文件名、实际设置、有效/排除数、计算口径、指标和提示的审阅记录，不含原始数据行，**不提供该记录的重新载入**。本次没有扩展旧版回归方案或基础分析方案合同。

## 十种方法

| 方法 | 计算与输出 | 适用边界 |
|---|---|---|
| 二元 Logistic | 无惩罚 MLE；缩放后加权 QR Newton/IRLS，步长回退；系数、常规信息矩阵标准误、正态 Wald p/95% CI、OR/区间、概率、LL/AIC/McFadden 伪 R² | 必须严格 0/1 且两类都有。最多 100 次迭代；不收敛、极端概率或秩亏时拒绝推断。未实现 Firth/惩罚拟合、稳健协方差或分离的完整线性规划诊断。OR 不是概率比，样本内概率不是预测验证 |
| 单向聚类稳健 OLS | 标准化设计 QR 拟合；CR1 sandwich；修正 `G/(G−1) × (N−1)/(N−p)`；t 参考 df=G−1；系数/SE/p/CI、拟合/残差 | 一个聚类字段；允许组内相关、要求组间独立。少聚类提示，未提供 wild bootstrap、多向聚类或联合 Wald |
| 单向个体固定效应 | 主体内去均值斜率；按主体聚类 CR1；残差 df=`N−G−k`（k 为斜率数）；同一 CR1 修正中计入吸收的主体参数；t df=G−1；个体内 R²、主体截距、拟合/残差 | 拒绝主体内不变变量；单次观测主体保留且明确提醒。仅个体效应，无时间效应、面板键/时间间隔校验或因果识别 |
| 配对 t | 同行第一列减第二列；均差、差值 SD、t/df/p、95% CI、dz | 配对之间独立，差值近似正态；差值无变动拒绝 |
| 单因素 ANOVA | 常规组间/组内平方和、F/df/p、η²、各组 N/均值/SD | 2–100 个有效组，各至少 2 行；独立、近似正态和同方差。无事后比较、多因素或 Welch ANOVA |
| Mann–Whitney | 双侧正态近似；并列平均秩/方差修正、0.5 连续性校正；两组 U、p、定向秩二列相关 | 恰好两个独立有效组，各至少 2 行。不是精确检验；不能无条件解释为中位数检验 |
| Wilcoxon | Wilcox 去零差规则；平均秩、并列秩方差修正和有方向连续性校正；双侧正态近似 p、W/正负秩和、配对秩二列相关 | 至少 2 个非零配对，差值对称。不是精确检验，未实现其他零差规则 |
| PCA | 完整样本按样本 SD（ddof=1）标准化做 SVD；特征值/解释率/累计解释率、单位主轴权重、PC 得分、预处理参数 | 2–12 列，N 大于列数，拒绝常量。最大绝对权重取正固定任意符号；近重特征值提示。主轴权重不是变量与 PC 的相关载荷或因果贡献 |
| K-means | 标准化空间 Lloyd；LCG 种子控制首点，后续最远点初始化；5 次取最小 inertia，每次最多 200 轮；原单位中心、成员和平方距离 | K=2–12 且小于 N；重复模式不足 K、空组/不收敛不能悄悄返回。不是 k-means++，不保证全局最优，无自动选 K/轮廓分数 |
| OLS K 折交叉验证 | 种子控制 LCG+Fisher–Yates 随机分折；每折只在训练样本拟合缩放和含截距 OLS；逐折 RMSE/MAE/R²，逐行折外预测，整体折外指标、训练均值预测基线 | K=2–10，各训练集 N 大于参数数，秩亏拒绝。仅独立同分布场景，无时间/分组拆分、嵌套调参、分类验证或最终全样本模型训练 |

线性模型以 SVD 检查标准化设计矩阵，条件数 ≥1e10 拒绝；QR 的 R 因子用于协方差，不直接对原始 `X'X` 求逆。Logistic 还检查最终加权设计。概率使用已有 t/beta 计算和新 regularized upper gamma 正态尾概率；非有限结果会明确失败，不填成 0。

## 独立数值参照

`scripts/reference-advanced.py` 实际执行于已有隔离环境 `work/regression-reference`：NumPy 2.5.4、SciPy 1.18.1、statsmodels 0.15.0。合成 96 行数据、16 个主体，含并列秩和零配对差，保存在 `tests/fixtures/advanced-reference.json`。没有调用模型服务或使用真实用户数据。应用不依赖 Python，也没有新增 npm 依赖；复用 MIT 的 ml-matrix 6.15.1，许可证沿用 `public/licenses/multiple-regression.txt`。

- 聚类回归参照 statsmodels OLS `cov_type='cluster'`、`use_correction=True`、`use_t=True`。
- 固定效应参照完整主体虚拟变量设计矩阵，比较斜率/CR1/推断、主体截距及每行拟合/残差；不是使用相同去均值代码互相验证。
- Logistic 参照 statsmodels Logit 的每个系数/SE/z/p/区间/OR、每行概率与 LL/AIC/伪 R²。
- 配对 t、ANOVA、Mann–Whitney 与 Wilcoxon 直接参照 scipy.stats 的明确对应参数。
- PCA 参照 NumPy SVD，统一任意符号后比较每个特征值、权重和得分。
- K-means 以明确的相同初始中心运行 SciPy `kmeans2`，比较中心、每行成员、inertia；验证 Lloyd 计算，不声称自定义初始化优于其他策略。
- CV 以每折独立训练预处理的 NumPy `lstsq` 计算全部折外预测与基线；另改动一个验证目标，确认该验证折的预测与训练基线均不变。

`tests/advanced-analysis.test.mjs` 17 项通过；一般逐值容差 `2e-8 × (1+|参考值|)`，正态尾概率另用严格尾部容差。覆盖十种方法及共线性、分离、不变变量、无效分组、零方差、变量唯一性、行数/参数边界、缺失排除、数值主体字段和确定性。

`tests/e2e/advanced-analysis.spec.ts` 4 个生产构建场景通过：十种实际 Worker 运行、参考值 CSV 核对和完整逐行导出、记录 JSON/结果比较、设置变更提示、方法/数据更换终止 Worker、非法 Logistic 编码恢复错误。1440px/375px 截图已查看，方法分组下拉可用、表格键盘聚焦和页面无横向溢出；#analysis Axe serious/critical 违规为 0。截图 `outputs/advanced-analysis-2026-10-21/`。改动范围 ESLint、TypeScript 与 Next 优化构建通过，设计检测一次为空列表。

这证明所覆盖输入和流程的实现与参照一致，不是对所有数据、统计假设或最大规模性能的保证；没有验证公网部署、真实用户研究效率或复杂研究设计。

## 外部依据

- 本轮已读取 [statsmodels cov_cluster](https://www.statsmodels.org/stable/generated/statsmodels.stats.sandwich_covariance.cov_cluster.html)：单向聚类 covariance 与小样本修正定义。
- 本轮已读取 [scikit-learn Cross-validation](https://scikit-learn.org/stable/modules/cross_validation.html)：训练/验证分离与适用场景。本项目没有安装/移植 scikit-learn。
- SciPy 两个官方页面和 statsmodels Logit 页面本轮通过连接器读取失败；相关 API/算法参数以本地已安装精确版本实际执行的参照脚本为依据，未将失败读取称为已检索文档。
