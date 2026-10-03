# 原创教学数据

这些数值专为讲解构造，不含现实个体记录、真实调查或政策效果证据。全部观测已嵌入第十一节页面，无需导入。CSV 是仓库内的可审计复算材料。

`anova-teaching.csv`：observation_id 唯一教学观测标识；group 为 A/B/C 教学组标签；outcome 为同单位教学分数，没有缺失。题设假定组间及组内观测独立、正态等方差，仅用于说明推断条件，不声称九条构造值证明这些假设。复算目标 SSB=24、SSW=6、SST=30、F=12。

`regression-teaching.csv`：observation_id 唯一标识；x 为无单位解释变量，y 为教学响应分数；同一行必须保持配对，没有缺失。复算目标截距 0.7、斜率 1.2、SSE=1.8、残差均方 0.9。拟合不具有因果含义。

数据由 ACAORA 编写，可随本站教学内容使用；没有转载第三方教材数据。独立验证入口为 `scripts/verify-course-calculations.py --course STAT-201`。
