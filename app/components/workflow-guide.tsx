'use client';

import {useState} from 'react';
import styles from './workflow-guide.module.css';

const guides = {
  data: {title: '分析步骤', steps: [
    ['检查变量', '先核对变量类型、缺失值与样本范围，确认哪些记录进入分析。'],
    ['查看分布', '查看描述统计与分布图，检查异常值、偏态和组间差异。'],
    ['选择方法', '按研究问题选择估计方法，核对假设、样本量与结果的不确定性。'],
  ]},
  course: {title: '学习步骤', steps: [
    ['读讲解', '先理解本节概念和适用条件，遇到不熟悉的内容可返回课时目录。'],
    ['看例题', '沿着例题核对条件、计算和解释，注意每一步为什么成立。'],
    ['做练习', '尝试独立作答，再对照反馈或参考答案；完成阅读后主动标记已读。'],
  ]},
};
export default function WorkflowGuide({kind}: {kind: keyof typeof guides}) {
  const [step, setStep] = useState(0);
  const guide = guides[kind];
  return <details className={styles.guide}><summary>{guide.title}</summary>
    <div className={styles.steps} role="group" aria-label={guide.title}>{guide.steps.map(([label], index) => <button type="button" key={label} aria-pressed={step === index} onClick={() => setStep(index)}><span>{index + 1}</span>{label}</button>)}</div>
    <p role="status">{guide.steps[step][1]}</p>
  </details>;
}
