import {mkdirSync,writeFileSync,existsSync} from "node:fs";
const definitions = [
 ["STAT-201","概率论与数理统计","统计学",["微积分","线性代数基础"],["数学预备与概率建模","条件概率与独立","离散与连续分布","联合分布与变量变换","期望方差与相关","极限定理与抽样分布","点估计与估计量评价","区间估计与样本量","检验与功效","非参数与拟合检验","方差分析与回归衔接"]],
 ["ECON-204","微观经济学","经济学",["经济学原理","微积分与最优化"],["最优化预备与市场","偏好效用与消费选择","需求与显示偏好","斯勒茨基与对偶","跨期与不确定性","生产与成本","竞争与垄断","寡头博弈与要素市场","一般均衡与福利","外部性与公共品","信息经济学与综合政策"]],
 ["STAT-302","回归分析","统计学",["微积分","高等代数","概率统计"],["矩阵预备与统计模型","简单回归","多元回归与投影","区间估计与联合检验","定性变量与函数形式","残差诊断与影响点","GLS与误差结构","多项式与变量选择","岭回归与主成分回归","稳健回归","非线性与广义线性模型","预测验证与完整报告"]],
 ["ECON-301","计量经济学","经济学",["概率统计","线性代数","回归","微观与宏观基础"],["识别与反事实","OLS与设定偏误","GLS与稳健推断","似然与LR/Wald/LM","IV与联立模型","面板与聚类","DID与事件研究","实验与断点","ARMA与VAR","单位根与协整","离散选择与样本选择","GMM与动态面板","完整实证报告"]],
 ["STAT-306","多元统计分析","统计学",["概率统计","高等代数","回归"],["矩阵预备与多元数据","多元正态与Wishart","Hotelling与MANOVA","多元线性模型","SVD与主成分","双标图与对应分析","因子分析与旋转","典型相关与结构方程","距离与多维标度","聚类分析","判别分析与分类验证"]],
 ["TRADE-305","国际贸易学","经济学",["微观经济学","基础代数与微积分"],["贸易问题与比较优势","李嘉图模型","特定要素与分配","H-O与要素价格","标准贸易与贸易条件","规模经济与产业内贸易","异质企业与跨国投资","关税配额与福利","有效保护与倾销","引力模型与贸易识别","制度协定与全球价值链","贸易政策综合评估"]],
 ["FIN-308","国际金融","经济学",["微观经济学","宏观经济学","概率统计"],["宏观预备与国际收支","汇率报价与实际汇率","PPP与汇率价格","CIP与UIP","货币模型与超调","弹性吸收与货币分析","开放经济政策","汇率制度与三元悖论","国际货币体系","危机与资本流动","外汇风险管理","综合分析与证据"]]
];
const catalog=definitions.map(([code,name,track,prerequisites,titles])=>({
 code,name,track,prerequisites,description:"通过理论讲解、关键推导、完整例题与分层练习，建立"+name+"的本科核心知识体系。",
 chapters:titles.map((title,i)=>({id:"chapter-"+(i+1),title,lessons:[{id:"lesson-"+(i+1),title,level:i===0?"预备":"核心",prerequisites:i?["lesson-"+i]:[]}]}))
}));
const probability=catalog.find(c=>c.code==='STAT-201');
probability.chapters[2].lessons=[{id:'lesson-3',title:'离散分布与模型选择',level:'核心',prerequisites:['lesson-2']},{id:'lesson-3-continuous',title:'连续分布、分布函数与标准化',level:'核心',prerequisites:['lesson-3']}];
probability.chapters[3].lessons[0].prerequisites=['lesson-3-continuous'];
mkdirSync("content/courses",{recursive:true});writeFileSync("content/courses/catalog.json",JSON.stringify(catalog,null,2)+"\n");
for(const course of catalog) {
 const dir="content/courses/"+course.code;mkdirSync(dir,{recursive:true});
 const file=dir+"/coverage.json";
 if(!existsSync(file))writeFileSync(file,JSON.stringify({courseId:course.code,status:"draft",reference:"docs/superpowers/specs/2026-10-02-course-academic-benchmarks.md",targets:course.chapters.map(c=>({target:c.title,lessonIds:c.lessons.map(l=>l.id),source:"待逐项映射公开大纲与补足目标",status:"draft"}))},null,2)+"\n");
}
