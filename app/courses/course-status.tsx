"use client";
import styles from './courses.module.css';
import type {useCourseProgress} from './use-course-progress';
export default function CourseStatus({progress}:{progress:ReturnType<typeof useCourseProgress>}) {
 const labels={loading:'正在读取账号记录…',anonymous:'登录后可保存学习记录。',local:'已读取本机记录，正在核对云端。',pending:'本机记录已保留，等待云端同步。',synced:'学习记录已同步',reset:'已采用重置后的新进度。','signed-out':'登录已失效，请重新登录后同步。','storage-error':'浏览器未能保存记录，请检查存储权限后重试。'};
 return <div className={styles.status} role="status"><span>{labels[progress.status]}</span>{['pending','local','storage-error'].includes(progress.status)&&<button type="button" onClick={()=>void progress.retry()}>重试同步</button>}</div>;
}
