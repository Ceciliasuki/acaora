import {BarChart3, BookOpen, FileSearch, FolderKanban, LayoutDashboard, Settings, type LucideIcon} from 'lucide-react';

export type AppSection = 'dashboard' | 'courses' | 'papers' | 'data' | 'projects' | 'settings';
export const navigation: Array<{id: AppSection; href: string; icon: LucideIcon; label: string; description: string; keywords: string}> = [
  {id:'dashboard', href:'/dashboard', icon:LayoutDashboard, label:'总览', description:'最近的学习与研究记录', keywords:'home dashboard'},
  {id:'courses', href:'/courses', icon:BookOpen, label:'课程中心', description:'课程、练习与学习记录', keywords:'course study learning'},
  {id:'papers', href:'/papers', icon:FileSearch, label:'论文研究', description:'阅读原文、笔记与学术检索', keywords:'paper research notes'},
  {id:'data', href:'/data', icon:BarChart3, label:'数据分析', description:'导入数据、检查变量与统计分析', keywords:'data statistics'},
  {id:'projects', href:'/projects', icon:FolderKanban, label:'项目空间', description:'研究任务与项目笔记', keywords:'project tasks'},
  {id:'settings', href:'/settings', icon:Settings, label:'设置与隐私', description:'账户、模型与数据设置', keywords:'settings privacy'},
];
