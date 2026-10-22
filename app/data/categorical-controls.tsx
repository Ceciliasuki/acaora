'use client';
import {useMemo} from 'react';
import {categoryLevels,type CategorySpec} from './categorical-design';
import type {DataSet} from '../stats';
import styles from './multiple-regression.module.css';
export default function CategoricalControls({data,value,exclude,disabled,onChange}:{data:DataSet;value:CategorySpec[];exclude:string[];disabled:boolean;onChange:(v:CategorySpec[])=>void}){
  const available=data.headers.filter(h=>!exclude.includes(h));
  const levelsByName=useMemo(()=>new Map(data.headers.map(h=>[h,categoryLevels(data,h)])),[data]);
  return <fieldset className={styles.predictors} disabled={disabled}><legend>分类解释变量与参考组 · 已选 {value.length} / 6</legend><p className={styles.help}>显式选择分类字段；每列 2–12 类，参考组不单独生成解释列，编码后与数值变量合计最多 12 列。数字编码的类别也可在这里选择，需先取消其数值变量选择。</p><div className={styles.choices}>{available.map(h=>{const levels=levelsByName.get(h)??[],selected=value.some(v=>v.name===h);return <label className={styles.check} key={h}><input type="checkbox" aria-label={`分类变量 ${h}`} checked={selected} disabled={!selected&&(value.length>=6||levels.length<2||levels.length>12)} onChange={e=>onChange(e.target.checked?[...value,{name:h,reference:levels[0]}]:value.filter(v=>v.name!==h))}/>{h}（{levels.length} 类）</label>;})}</div>{value.length>0&&<div className={styles.controls}>{value.map(c=><label key={c.name} className={styles.control}>{c.name}的参考组<select aria-label={`${c.name}参考组`} value={c.reference} onChange={e=>onChange(value.map(v=>v.name===c.name?{...v,reference:e.target.value}:v))}><option value="" disabled>请选择参考组</option>{(levelsByName.get(c.name)??[]).map(level=><option key={level}>{level}</option>)}</select></label>)}</div>}</fieldset>;
}
