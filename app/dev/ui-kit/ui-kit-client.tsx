"use client";

import { Bell, Save } from "lucide-react";
import { useState } from "react";
import {
  Badge,
  Button,
  Card,
  Dialog,
  EmptyState,
  ErrorState,
  FormField,
  IconButton,
  Input,
  PageHeader,
  PasswordField,
  Select,
  StatusMessage,
  Tabs,
  Textarea,
  Toast,
} from "../../components/ui";

export default function UiKitClient() {
  const [tab, setTab] = useState("default");
  const [dialog, setDialog] = useState(false);
  const [toast, setToast] = useState(false);
  return <main className="ui-kit-page">
    <PageHeader eyebrow="DEVELOPMENT ONLY" title="Acaora UI Kit" description="共享组件、状态与可访问交互的开发验收页。" actions={<Button onClick={() => setToast(true)}><Save size={17} />显示 Toast</Button>} />
    <section className="ui-kit-section"><h2>Buttons & badges</h2><div className="ui-kit-row"><Button>主要操作</Button><Button variant="secondary">次要操作</Button><Button variant="ghost">文字操作</Button><Button variant="danger" onClick={() => setDialog(true)}>危险操作</Button><Button loading>处理中</Button><Button disabled>已禁用</Button><IconButton variant="secondary" label="通知"><Bell size={18} /></IconButton></div><div className="ui-kit-row"><Badge>默认</Badge><Badge tone="info">信息</Badge><Badge tone="success">已同步</Badge><Badge tone="warning">离线</Badge><Badge tone="danger">失败</Badge></div></section>
    <section className="ui-kit-section"><h2>Form fields</h2><Card className="ui-kit-form"><FormField label="名称" id="kit-name" required hint="最多 40 个字符"><Input name="name" autoComplete="name" placeholder="研究项目名称" /></FormField><FormField label="密码" id="kit-password" error="示例：密码不符合策略"><PasswordField name="password" autoComplete="new-password" showPolicy /></FormField><FormField label="类型" id="kit-type"><Select name="type" defaultValue="paper"><option value="paper">论文</option><option value="data">数据</option></Select></FormField><FormField label="说明" id="kit-description"><Textarea name="description" placeholder="记录目标和下一步" /></FormField></Card></section>
    <section className="ui-kit-section"><h2>Tabs & feedback</h2><Tabs label="组件状态" items={[{ value: "default", label: "默认" }, { value: "loading", label: "加载" }, { value: "disabled", label: "禁用", disabled: true }]} value={tab} onValueChange={setTab} /><div className="ui-kit-stack"><StatusMessage>这是一条普通状态消息。</StatusMessage><StatusMessage tone="success">云端同步完成。</StatusMessage><StatusMessage tone="warning">网络暂时离线，修改保存在当前设备。</StatusMessage><StatusMessage tone="error">保存失败，请重试。</StatusMessage></div></section>
    <section className="ui-kit-section ui-kit-states"><EmptyState title="暂无内容" description="创建第一条记录后，它会显示在这里。" action={<Button>新建记录</Button>} /><ErrorState description="请求超时或服务暂不可用。" action={<Button variant="secondary">重试</Button>} /></section>
    <Dialog open={dialog} title="删除这条记录？" description="删除后无法从 Acaora 恢复。" confirmLabel="确认删除" destructive onConfirm={() => setDialog(false)} onClose={() => setDialog(false)} />
    {toast && <Toast tone="success">设置已保存。<Button variant="ghost" size="sm" onClick={() => setToast(false)}>关闭</Button></Toast>}
  </main>;
}
