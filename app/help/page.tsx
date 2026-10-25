import Link from 'next/link';
import AppSidebar from '../components/app-sidebar';
import {PageHeader} from '../components/ui';
import styles from './page.module.css';

export default function HelpPage() {
  return <main className="student-app workspace-refresh"><AppSidebar active="settings"/><section className={`student-main ${styles.help}`} data-main-content>
    <PageHeader title="帮助与恢复" description="导入文献、保存分析与恢复任务。"/>
    <article>
      <h2>抽取内容与原 PDF</h2><p>目前支持有文本层的 PDF。表格、公式、页眉和复杂双栏可能无法可靠还原；数字、图表与引用请核对原 PDF。扫描件不支持 OCR。题名或书目信息不完整时，使用文献信息编辑入口确认，不必删除重导入。</p>
      <h2>保存与备份</h2><p>在数据分析中保存命名快照，使用复现包导出分析设置与脚本。项目空间和论文研究均提供备份导出与恢复入口。</p>
      <h2>模型设置</h2><p>配置 DeepSeek Key 后返回研究任务，选择分析范围并点击运行。模型调用费用由服务商收取。</p><Link href="/settings#ai-models">打开 AI 与模型设置</Link>
      <h2>保存失败或来源无法打开</h2><p>先检查网络和保存状态。保存失败时保留当前输入；出现版本冲突时，比较内容后再选择保留的版本。来源已删除时，仍可查看项目中的摘录。</p>
      <h2>反馈</h2><p>可前往项目公开仓库说明复现步骤、浏览器版本和错误提示。提交前自行检查内容，删除邮箱、Key、私人论文、数据和账户记录；页面不会自动附带这些内容。</p><a href="https://github.com/Ceciliasuki/acaora/issues" target="_blank" rel="noreferrer">在 GitHub 提交问题</a>
    </article>
  </section></main>;
}
