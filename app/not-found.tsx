import Link from 'next/link';
export default function NotFound() {
  return <main className="not-found-page"><p className="not-found-code">Acaora · 404</p><h1>没有找到这个页面</h1><p>链接可能已变更。可以返回研究工作台，或在帮助中查找需要的功能。</p><div><Link className="ui-button ui-button--primary" href="/">返回工作台</Link><Link href="/projects">项目空间</Link><Link href="/help">使用帮助</Link></div></main>;
}
