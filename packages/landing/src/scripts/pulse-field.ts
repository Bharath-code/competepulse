import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Line,
  LineBasicMaterial,
  LineLoop,
  PerspectiveCamera,
  Points,
  Scene,
  ShaderMaterial,
  Vector3,
  WebGLRenderer,
} from "three";
import {
  BEAM_TOP,
  CAMERA,
  CYCLE,
  DEALS,
  MAX_RADIUS,
  RIVAL,
  distXZ,
  gridPoints,
} from "../lib/pulse";

/** Tokens are oklch(), which three can't parse: let a 1px canvas resolve them to sRGB. */
const ctx = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
const css = (name: string) => {
  ctx.fillStyle =
    getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "#888";
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return new Color(r! / 255, g! / 255, b! / 255);
};

const vertex = /* glsl */ `
  uniform float uTime, uRadius, uScale, uBase, uBoost;
  uniform vec2 uRival;
  attribute float aLit;
  varying float vHot, vLit, vFade;
  void main() {
    float d = distance(position.xz, uRival);
    float band = exp(-pow((d - uRadius) / 0.6, 2.0));
    vec3 p = position;
    p.y += sin(position.x * 0.45 + uTime * 0.8) * 0.08 + cos(position.z * 0.5 + uTime * 0.6) * 0.08 + band * 0.55;
    vHot = band;
    vLit = aLit;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vFade = smoothstep(30.0, 9.0, -mv.z);
    gl_PointSize = (uBase + band * 4.5 + aLit * uBoost) * uScale / -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

const fragment = /* glsl */ `
  uniform vec3 uDot, uHot, uCool;
  uniform float uDeal;
  varying float vHot, vLit, vFade;
  void main() {
    float r = length(gl_PointCoord - 0.5);
    if (r > 0.5) discard;
    float core = smoothstep(0.5, 0.18, r);
    vec3 base = mix(uDot, uCool, uDeal);
    vec3 col = mix(base, uHot, max(vHot, vLit));
    float a = core * mix(0.6 + 0.4 * vHot, 1.0, uDeal) * vFade;
    gl_FragColor = vec4(col, a);
  }
`;

function points(pos: number[], lit: number[], u: Record<string, { value: unknown }>) {
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(pos, 3));
  g.setAttribute("aLit", new Float32BufferAttribute(lit, 1));
  const m = new ShaderMaterial({
    uniforms: u,
    vertexShader: vertex,
    fragmentShader: fragment,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });
  return new Points(g, m);
}

export function mount(figure: HTMLElement): () => void {
  const canvas = figure.querySelector<HTMLCanvasElement>(".field__canvas")!;
  const stage = canvas.parentElement!;
  const tags = new Map(
    [...figure.querySelectorAll<HTMLElement>("[data-anchor]")].map((el) => [
      el.dataset.anchor!,
      el,
    ]),
  );

  const renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: "low-power",
  });
  const dpr = Math.min(window.devicePixelRatio, 2);
  renderer.setPixelRatio(dpr);

  const scene = new Scene();
  const camera = new PerspectiveCamera(CAMERA.fov, 600 / 560, 0.1, 100);
  const target = new Vector3(...CAMERA.target);

  const hot = css("--console-high");
  const shared = {
    uTime: { value: 0 },
    uRadius: { value: 0 },
    uRival: { value: [RIVAL[0], RIVAL[2]] },
    uScale: { value: 0 },
    uDot: { value: css("--console-muted") },
    uHot: { value: hot },
    uCool: { value: css("--console-link") },
  };

  const grid = gridPoints(0.5);
  scene.add(
    points(
      grid.flat(),
      grid.map(() => 0),
      { ...shared, uBase: { value: 2.6 }, uBoost: { value: 0 }, uDeal: { value: 0 } },
    ),
  );

  const dealLit = DEALS.map(() => 0);
  const deals = points(
    DEALS.flatMap((d) => [...d.pos]),
    dealLit,
    { ...shared, uBase: { value: 9 }, uBoost: { value: 7 }, uDeal: { value: 1 } },
  );
  scene.add(deals);

  const rival = points([...RIVAL], [1], {
    ...shared,
    uBase: { value: 16 },
    uBoost: { value: 0 },
    uDeal: { value: 1 },
  });
  scene.add(rival);
  const top = points([...BEAM_TOP], [0], {
    ...shared,
    uBase: { value: 10 },
    uBoost: { value: 6 },
    uDeal: { value: 1 },
  });
  scene.add(top);

  const circle = new BufferGeometry().setFromPoints(
    Array.from({ length: 128 }, (_, i) => {
      const a = (i / 128) * Math.PI * 2;
      return new Vector3(Math.cos(a), 0, Math.sin(a));
    }),
  );
  const ringMat = new LineBasicMaterial({ color: hot, transparent: true, opacity: 0.7 });
  const ring = new LineLoop(circle, ringMat);
  ring.position.set(...RIVAL);
  scene.add(ring);

  const beams = DEALS.flatMap((d, i) => {
    if (!d.target) return [];
    const mat = new LineBasicMaterial({ color: hot, transparent: true, opacity: 0 });
    const line = new Line(
      new BufferGeometry().setFromPoints([new Vector3(...d.pos), new Vector3(...BEAM_TOP)]),
      mat,
    );
    scene.add(line);
    return [{ i, mat }];
  });

  const anchors: Record<string, Vector3> = {
    rival: new Vector3(RIVAL[0], 0.3, RIVAL[2]),
    dm: new Vector3(...BEAM_TOP),
  };
  DEALS.forEach((d) => d.label && (anchors[d.label] = new Vector3(d.pos[0], 0.3, d.pos[2])));

  let w = 0;
  let h = 0;
  const resize = () => {
    w = stage.clientWidth;
    h = stage.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    shared.uScale.value = h * dpr * 0.07;
  };
  const ro = new ResizeObserver(resize);
  ro.observe(stage);
  resize();

  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  const onMove = (e: PointerEvent) => {
    const r = stage.getBoundingClientRect();
    pointer.tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
    pointer.ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
  };
  window.addEventListener("pointermove", onMove, { passive: true });

  let visible = true;
  const io = new IntersectionObserver(([entry]) => (visible = entry!.isIntersecting));
  io.observe(stage);

  const v = new Vector3();
  const place = () => {
    for (const [key, el] of tags) {
      v.copy(anchors[key]!).project(camera);
      const x = Math.min(Math.max(((v.x + 1) / 2) * 100, 22), 78);
      el.style.left = `${x}%`;
      el.style.top = `${Math.max(((1 - v.y) / 2) * 100, 12)}%`;
    }
  };

  const start = performance.now();
  let raf = 0;
  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    if (!visible || document.hidden) return;
    const t = (now - start) / 1000;
    const phase = (t % CYCLE) / CYCLE;
    const radius = phase * MAX_RADIUS;
    const fadeOut = phase > 0.85 ? 1 - (phase - 0.85) / 0.15 : 1;

    shared.uTime.value = t;
    shared.uRadius.value = radius;
    ring.scale.setScalar(Math.max(radius, 0.001));
    ringMat.opacity = 0.75 * (1 - phase);

    const lit = deals.geometry.getAttribute("aLit");
    DEALS.forEach((d, i) => {
      dealLit[i] = d.target && radius > distXZ(d.pos, RIVAL) ? fadeOut : 0;
      lit.setX(i, dealLit[i]!);
    });
    lit.needsUpdate = true;
    const anyLit = Math.max(...dealLit);
    top.geometry.getAttribute("aLit").setX(0, anyLit);
    top.geometry.getAttribute("aLit").needsUpdate = true;
    for (const b of beams) b.mat.opacity = dealLit[b.i]! * 0.8;

    for (const [key, el] of tags) {
      const i = DEALS.findIndex((d) => d.label === key);
      el.style.opacity =
        key === "rival" ? "1" : key === "dm" ? String(anyLit) : String(dealLit[i] ?? 0);
    }

    pointer.x += (pointer.tx - pointer.x) * 0.04;
    pointer.y += (pointer.ty - pointer.y) * 0.04;
    camera.position.set(
      CAMERA.eye[0] + pointer.x * 1.4,
      CAMERA.eye[1] - pointer.y * 0.8,
      CAMERA.eye[2],
    );
    camera.lookAt(target);
    place();
    renderer.render(scene, camera);
  };
  raf = requestAnimationFrame(frame);
  figure.classList.add("is-live");

  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    io.disconnect();
    window.removeEventListener("pointermove", onMove);
    renderer.dispose();
  };
}
