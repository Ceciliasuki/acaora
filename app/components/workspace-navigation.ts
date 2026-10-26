import {BarChart3, BookOpen, FileSearch, FolderKanban, LayoutDashboard, Settings, type LucideIcon} from 'lucide-react';

export type AppSection = 'dashboard' | 'courses' | 'papers' | 'data' | 'projects' | 'settings';
export const navigation: Array<{id: AppSection; href: string; icon: LucideIcon; label: string; description: string; keywords: string; group: 'research'|'learning'|'account'}> = [
  {id:'dashboard', href:'/dashboard', icon:LayoutDashboard, label:'总览', description:'最近的学习与研究记录', group:'research', keywords:'home dashboard'},
  {id:'papers', href:'/papers', icon:FileSearch, label:'论文阅读', description:'双语阅读、批注与原文定位', group:'research', keywords:'paper research notes'},
  {id:'data', href:'/data', icon:BarChart3, label:'数据分析', description:'模型、诊断与分析记录', group:'research', keywords:'data statistics'},
  {id:'projects', href:'/projects', icon:FolderKanban, label:'研究项目', description:'关联资料、任务与研究笔记', group:'research', keywords:'project tasks'},
  {id:'courses', href:'/courses', icon:BookOpen, label:'课程学习', description:'概念、例题与随堂练习', group:'learning', keywords:'course study learning'},
  {id:'settings', href:'/settings', icon:Settings, label:'设置与隐私', description:'账户、模型与数据设置', group:'account', keywords:'settings privacy'},
];
