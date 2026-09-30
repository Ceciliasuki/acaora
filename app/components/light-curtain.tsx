import { useId } from "react";

/** Decorative only. Static SVG paths drift as a layer; no canvas or frame loop. */
export default function LightCurtain({ inset = false }: { inset?: boolean }) {
  const id = useId().replaceAll(":", "");
  return <div className={`light-curtain${inset ? " light-curtain--inset" : ""}`} aria-hidden="true">
    <svg className="light-curtain-fold" viewBox="0 0 1200 900" fill="none" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id={`${id}-silk`} x1="920" y1="80" x2="500" y2="780" gradientUnits="userSpaceOnUse">
          <stop stopColor="#90bfff" stopOpacity=".58" /><stop offset=".4" stopColor="#edf6ff" stopOpacity=".12" /><stop offset=".72" stopColor="#71aeef" stopOpacity=".42" /><stop offset="1" stopColor="#eef8ff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${id}-edge`} x1="260" y1="0" x2="1050" y2="820" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fff" stopOpacity="0" /><stop offset=".3" stopColor="#fff" /><stop offset=".66" stopColor="#77a9f2" stopOpacity=".6" /><stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d="M380 -160C650 160 1070 30 1200 270C1370 590 570 480 110 850C530 630 1360 810 1300 360C1260 80 770 250 720 -160Z" fill={`url(#${id}-silk)`} />
      <path d="M520 -100C600 150 1120 115 1150 315C1185 555 740 520 360 760C720 530 1320 670 1300 320C1280 95 720 80 840 -100Z" fill={`url(#${id}-silk)`} />
      <path d="M900 -120C820 70 1000 100 1110 270C1320 600 610 570 310 900C700 640 1340 740 1290 350C1260 100 1030 30 1130 -120Z" fill={`url(#${id}-silk)`} />
      <g stroke={`url(#${id}-edge)`} strokeWidth="1.3">
        <path d="M380 -160C650 160 1070 30 1200 270C1370 590 570 480 110 850" />
        <path d="M430 -160C620 210 1100 30 1190 300C1280 580 670 530 230 810" />
        <path d="M520 -100C600 150 1120 115 1150 315C1185 555 740 520 360 760" />
        <path d="M900 -120C820 70 1000 100 1110 270C1320 600 610 570 310 900" />
      </g>
    </svg>
    {!inset && <svg className="light-curtain-sweep" viewBox="0 0 1200 600" fill="none" preserveAspectRatio="xMidYMid slice">
      <defs><linearGradient id={`${id}-sweep`} x1="100" y1="100" x2="1050" y2="530" gradientUnits="userSpaceOnUse"><stop stopColor="#9cc6ff" stopOpacity=".08" /><stop offset=".5" stopColor="#83bafa" stopOpacity=".3" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></linearGradient></defs>
      <path d="M-100 120C170 500 750 80 1300 450L1300 620C730 200 230 590 -100 260Z" fill={`url(#${id}-sweep)`} />
      <path d="M-100 120C170 500 750 80 1300 450M-100 170C280 540 710 120 1300 530" stroke="#fff" strokeOpacity=".8" strokeWidth="1.5" />
    </svg>}
  </div>;
}
