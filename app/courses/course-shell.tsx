import AppSidebar from '../components/app-sidebar';
import focused from '../focused-workspaces.module.css';
import {PageHeader} from '../components/ui';
export default function CourseShell({title,children,toolbar}:{title:string;children:React.ReactNode;toolbar?:React.ReactNode}) {
 return <main className="student-app learning-app workspace-refresh"><AppSidebar active="courses" profileTitle="课程学习中心" profileSubtitle="统计学 × 国际经贸"/><section className={`workspace learning-main courses-shell ${focused.focused}`}><PageHeader className="workspace-header" title={title} description="阅读讲解、完成练习，继续上次的学习。" actions={toolbar}/><div className="page-body">{children}</div></section></main>;
}
