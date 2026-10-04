import AppSidebar from '../components/app-sidebar';
import focused from '../focused-workspaces.module.css';
export default function CourseShell({title,children,toolbar}:{title:string;children:React.ReactNode;toolbar?:React.ReactNode}) {
 return <main className="student-app learning-app"><AppSidebar active="courses" profileTitle="课程学习中心" profileSubtitle="统计学 × 国际经贸"/><section className={`workspace learning-main courses-shell ${focused.focused}`}><div className="page-bar"><div className="page-bar-inner"><h1>{title}</h1>{toolbar}</div></div><div className="page-body">{children}</div></section></main>;
}
