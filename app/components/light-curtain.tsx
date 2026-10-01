"use client";

import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";

// One persistent, procedural light surface. No image panning or React frame state.
const vertexSource = `attribute vec2 position;
void main() { gl_Position = vec4(position, 0., 1.); }`;
const fragmentSource = `precision mediump float;
uniform vec2 resolution;
uniform float time;
float bell(float x, float width) { return exp(-x*x/width); }
void main() {
  vec2 p = (gl_FragCoord.xy - resolution * .5) / resolution.y;
  vec2 q = mat2(.82, -.57, .57, .82) * p;
  float t = time * .22;
  vec3 color = vec3(.934, .951, .973);
  for (int i = 0; i < 4; i++) {
    float k = float(i);
    float bend = (.2+k*.035)*sin(q.x*(1.3+k*.24)-t*.7+k*.65)
      + .075*sin(q.x*2.8+t*.65+k);
    float d = q.y - bend - (k-1.4)*.3;
    float envelope = bell(q.x-(k-1.)*.28, 1.6);
    float body = bell(d+.036, .009);
    float shadow = bell(d-.095, .018);
    float edge = bell(d, .00009);
    color -= vec3(.085, .067, .047)*shadow*envelope;
    color += vec3(.037, .033, .025)*body*envelope;
    color = mix(color, vec3(1.), edge*.77*envelope);
    color += vec3(.008, .019, .037)*bell(d+.019, .00048)*envelope;
  }
  float light = bell(p.x+.5*sin(t*.4), .6)*bell(p.y, .3);
  color = mix(color, vec3(.985, .987, .992), light*.3);
  gl_FragColor = vec4(color, 1.);
}`;

export default function LightCurtain() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const elapsedRef = useRef(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.dataset.motion = "unavailable";
    const gl = canvas.getContext("webgl", { alpha: false, antialias: false, depth: false, powerPreference: "low-power" });
    if (!gl) return; // The static CSS material remains available without WebGL.
    const shaders: WebGLShader[] = [];
    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      shaders.push(shader);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null;
    };
    const vertex = compile(gl.VERTEX_SHADER, vertexSource);
    const fragment = compile(gl.FRAGMENT_SHADER, fragmentSource);
    const program = gl.createProgram();
    if (!vertex || !fragment || !program) {
      shaders.forEach((shader) => gl.deleteShader(shader));
      if (program) gl.deleteProgram(program);
      return;
    }
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      shaders.forEach((shader) => gl.deleteShader(shader));
      gl.deleteProgram(program);
      return;
    }
    gl.useProgram(program);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    const resolution = gl.getUniformLocation(program, "resolution");
    const time = gl.getUniformLocation(program, "time");
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let previous = 0;
    let lastDraw = 0;
    let lost = false;
    const draw = () => {
      gl.uniform2f(resolution, canvas.width, canvas.height);
      gl.uniform1f(time, elapsedRef.current / 1000);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    };
    const resize = () => {
      const scale = Math.min(window.devicePixelRatio || 1, 1.25, 1600 / window.innerWidth);
      canvas.width = Math.round(window.innerWidth * scale);
      canvas.height = Math.round(window.innerHeight * scale);
      gl.viewport(0, 0, canvas.width, canvas.height);
      draw();
    };
    const tick = (now: number) => {
      if (previous) elapsedRef.current += Math.min(now - previous, 100);
      previous = now;
      if (now - lastDraw >= 1000 / 24) {
        draw();
        lastDraw = now;
      }
      frame = requestAnimationFrame(tick);
    };
    const sync = () => {
      cancelAnimationFrame(frame);
      previous = 0;
      canvas.dataset.motion = lost ? "unavailable" : motion.matches || paused ? "paused" : document.hidden ? "hidden" : "running";
      if (!lost && !motion.matches && !paused && !document.hidden) frame = requestAnimationFrame(tick);
    };
    const contextLost = (event: Event) => {
      event.preventDefault();
      lost = true;
      canvas.style.opacity = "0";
      sync();
    };
    resize();
    canvas.style.opacity = "1";
    sync();
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", sync);
    motion.addEventListener("change", sync);
    canvas.addEventListener("webglcontextlost", contextLost);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", sync);
      motion.removeEventListener("change", sync);
      canvas.removeEventListener("webglcontextlost", contextLost);
      gl.deleteBuffer(buffer);
      shaders.forEach((shader) => gl.deleteShader(shader));
      gl.deleteProgram(program);
    };
  }, [paused]);

  return <>
    <div className="light-curtain" aria-hidden="true"><canvas ref={canvasRef} className="light-curtain-canvas" /></div>
    <button type="button" className="ambient-toggle" aria-label={paused ? "开启背景动效" : "暂停背景动效"} aria-pressed={paused} onClick={() => setPaused((value) => !value)}>
      {paused ? <Play size={14} aria-hidden="true" /> : <Pause size={14} aria-hidden="true" />}<span>{paused ? "动效已暂停" : "背景动效"}</span>
    </button>
  </>;
}
