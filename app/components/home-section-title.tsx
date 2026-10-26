import styles from '../home-details.module.css';

export default function HomeSectionTitle({id,children}:{id:string;children:string}) {
  return <h2 id={id} className={styles.sectionTitle} aria-label={children}>
    <span className={styles.titleGlyphs} aria-hidden="true">
      {Array.from(children).map((character,index)=><span key={index}>{character}</span>)}
    </span>
  </h2>;
}
