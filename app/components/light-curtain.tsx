/** Decorative material; CSS composites its movement without a render loop. */
export default function LightCurtain({ inset = false }: { inset?: boolean }) {
  return <div className={`light-curtain${inset ? " light-curtain--inset" : ""}`} aria-hidden="true">
    <div className="light-curtain-fold" />
    <div className="light-curtain-sweep" />
  </div>;
}
