import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {choice,numeric,open} from './lib.mjs';
const save=(p,v)=>writeFileSync(p,JSON.stringify(v,null,2)+'\n');
const catalog=JSON.parse(readFileSync('content/courses/catalog.json','utf8'));
for(const course of catalog){course.format='guided';course.description=`按顺序学习${course.name}的核心知识，每节配一个例题和三道练习；拓展材料可按需要展开。`;}
save('content/courses/catalog.json',catalog);
const optional={
 'STAT-201':{'lesson-4':['二维变换与雅可比'],'lesson-5':['概率界和生成函数的适用范围'],'lesson-7':['支持与删失改变似然','进阶：截断样本需要条件密度','信息、效率与渐近正态的边界'],'lesson-9':['似然比和多重比较的连接'],'lesson-10':['Wilcoxon 符号秩与 Mann–Whitney'],'lesson-11':['双因素设计：主效应与交互']},
 'ECON-204':{'lesson-4':['包络导数：Shephard 与 Roy'],'lesson-6':['成本对偶与包络'],'lesson-8':['动态承诺与子博弈完美'],'lesson-9':['第二福利定理与再分配的可实施性'],'lesson-11':['信号：类型不同的代价支持分离']}
};
for(const code of ['STAT-201','ECON-204']){
 for(const file of readdirSync(`content/courses/${code}/lessons`)){
  const p=`content/courses/${code}/lessons/${file}`,l=JSON.parse(readFileSync(p,'utf8'));
  l.format='guided';l.coreQuestionIds=[l.questions[0].id,l.questions[2].id,l.questions[5].id];
  l.sections.forEach(s=>s.optional=optional[code][l.id]?.includes(s.heading)??false);
  if(code==='STAT-201'&&l.id==='lesson-7'){
   const q=open('STAT-201-guided-7-interpret',l.objectives[1],'一个估计量有偏，是否意味着它一定比无偏估计差？请说明应比较什么。','不能。给定模型、参数与损失函数，平方损失下比较MSE=方差+偏差²。','较小的方差可能抵消偏差带来的损失；还要检查一致性和适用条件。','把无偏与均方误差分开。');
   if(!l.questions.some(x=>x.id===q.id))l.questions.push(q);
   l.coreQuestionIds=[l.questions[0].id,l.questions[3].id,q.id];
   const first=l.examples.findIndex(e=>e.title==='无偏与更低均方误差并非同义');if(first>0)l.examples.unshift(l.examples.splice(first,1)[0]);
  }
  if(code==='STAT-201'&&l.id==='lesson-10')l.coreQuestionIds=[l.questions[1].id,l.questions[2].id,l.questions[5].id];
  if(code==='ECON-204'&&l.id==='lesson-8')l.sections.find(s=>s.heading==='动态承诺与子博弈完美').optional=false; // The core transfer question needs credible commitment.
  save(p,l);
 }
}
function addCase(code,context,questions){
 const p=`content/courses/${code}/assessments.json`,all=JSON.parse(readFileSync(p,'utf8'));
 const item={id:'case-study',title:code==='STAT-201'?'综合案例：从样本到有边界的结论':'综合案例：税收如何改变市场',status:'checked',version:1,objectives:[...new Set(questions.map(q=>q.objective))],context,questions};
 save(p,[...all.filter(a=>a.id!=='case-study'),item]);
}
addCase('STAT-201',[{heading:'一组教学观测',paragraphs:['某教学样本的数值为1、2、3、4。这是人为构造的数据，没有真实政策效果含义。假定四个观测是独立同分布抽样，先计算均值和标准误，再说明能作什么推断。','使用样本方差的n−1分母。精确的均值t区间还要求总体正态；仅有四个观测，不能靠“大样本”跳过分布和抽样条件。']}],[
 choice('STAT-201-case-concept','辨认推断条件','只有这四个观测，什么条件有助于构造精确的均值t区间？',['独立正态抽样且总体方差未知。','只要数据均值不为零。','任何自愿填写的四条记录。'],'a','t枢轴的精确分布依赖独立正态抽样；样本小不能用CLT替代它。','先明确抽样机制。'),
 numeric('STAT-201-case-se','计算抽样误差','对1、2、3、4，计算样本均值的估计标准误。',Math.sqrt(5/12),'均值2.5，离差平方和5，s²=5/3；se=s/√4=√(5/12)。','先算方差，再除以样本量。'),
 open('STAT-201-case-report','解释结论边界','如果这四条记录来自同一班级的自愿回答，能否直接推断全国学生平均水平？写出理由和改进办法。','不能。班级群组相关和自愿选择可能破坏独立性及代表性。应定义目标总体，设计覆盖多群组的抽样、记录响应机制，采用与设计相符的推断。','样本标准误不能纠正覆盖与选择偏差；应报告目标、抽样、效应或区间及限制。','计算不替代抽样设计。')]);
addCase('ECON-204',[{heading:'一个明确条件的税收模型',paragraphs:['教学竞争市场的逆需求为P=100−Q、逆供给为P=20+Q，Q≥0。征收每单位20的税，买方价格减卖方净价等于税额。假设没有外部性、市场势力或其他交易成本。','税前令两条曲线相等；税后令需求价格等于供给价格加税。分别计算成交量和两端价格，再比较消费者、生产者及政府收入。模型参数是教学构造。']}],[
 choice('ECON-204-case-concept','理解税负归宿','由卖方负责缴纳税款，就能判断卖方承担全部经济税负吗？',['能，缴纳人与经济承担者相同。','不能，价格调整与供需反应共同决定经济归宿。','消费者永远承担全部。'],'b','法定缴纳责任与均衡价格变化是两件事。','比较买方价和卖方净价。'),
 numeric('ECON-204-case-quantity','求解税后均衡','上述市场征收每单位20的税后，可行均衡交易量是多少？',30,'100−Q=20+Q+20，得Q=30；买方价70、卖方净价50。税前Q=40、P=60。','把价格楔写入均衡方程。',0),
 open('ECON-204-case-policy','解释福利边界','市场中存在未定价的污染损害时，为什么不能仅凭税减少交易就判定政策降低总福利？','无外部性的交易剩余损失没有计入污染减少的收益。需同时估计边际损害、税前与税后污染、税收用途及分配影响，并说明识别和执行条件。','应区分资源损失、政府转移、外部收益和分配；不能将本例的无外部性假设带入不同市场。','检查模型未计入的成本。')]);
