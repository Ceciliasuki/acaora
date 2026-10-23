import Link from 'next/link';
import AppSidebar from '../components/app-sidebar';
import {PageHeader} from '../components/ui';
import styles from './page.module.css';

export default function HelpPage() {
  return <main className="student-app workspace-refresh"><AppSidebar active="settings"/><section className={`student-main ${styles.help}`} data-main-content>
    <PageHeader title="帮助与恢复" description="文件、同步和任务恢复的实际边界。"/>
    <article>
      <h2>原文件与账户同步</h2><p>原 PDF 和数据文件留在当前设备。登录后，提取后的论文文本、译文、笔记和阅读位置按账户同步；项目和课程进度也属于当前账户。匿名论文保留在此浏览器，不会自动合入账户。</p><p>换设备看原 PDF 时，需要重新选择同一份文件。请使用阅读区的“原 PDF”入口附加文件；这不会重新分段或改变既有批注。清理浏览器数据也会清理本机文件副本。</p>
      <h2>抽取内容与原 PDF</h2><p>目前支持有文本层的 PDF。表格、公式、页眉和复杂双栏可能无法可靠还原；数字、图表与引用请核对原 PDF。扫描件不支持 OCR。题名或书目信息不完整时，使用文献信息编辑入口确认，不必删除重导入。</p>
      <h2>草稿、数据与快照</h2><p>项目笔记的本机草稿与账户保存分别提示。出现版本冲突时先比较，再选择保留内容。存储不可用时不要强制关闭页面，先复制文字或重试保存。</p><p>数据分析原文件和当前处理表仅存在本次页面会话，刷新后需重选文件。命名分析快照只保存设置、摘要与处理记录：登录时按账户保存在当前浏览器，匿名时仅保留在当前标签页。快照不含原始数据行，也不跨设备同步；重要内容请导出快照或复现包备份。</p>
      <h2>AI 设置与费用</h2><p>在设置中配置自己的 DeepSeek Key，仅保存在当前浏览器会话。点击运行后，界面标明的文本经本站转发给 DeepSeek；配置完成返回任务后仍需手动执行。不要把 Key 放进笔记、截图或反馈。</p><Link href="/settings#ai-models">打开 AI 与模型设置</Link>
      <h2>遇到同步或来源问题</h2><p>先确认当前账户、网络和保存状态。保存失败先保留草稿；来源已删除时，项目中保留的摘录仍可查看。分析快照的链接仅在保存它的浏览器和账户内可用，换设备请导入备份并重新选择相同原始数据。</p>
      <h2>反馈</h2><p>可前往项目公开仓库说明复现步骤、浏览器版本和错误提示。提交前自行检查内容，删除邮箱、Key、私人论文、数据和账户记录；页面不会自动附带这些内容。</p><a href="https://github.com/Ceciliasuki/acaora/issues" target="_blank" rel="noreferrer">在 GitHub 提交问题</a>
    </article>
  </section></main>;
}
