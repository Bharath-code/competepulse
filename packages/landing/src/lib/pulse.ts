/**
 * Shared geometry for the hero "pulse field". The server renders a static SVG
 * poster from these numbers and the WebGL scene draws the same world, so the
 * poster → live swap never jumps.
 */

export type Vec3 = readonly [number, number, number];

export const FIELD = { halfX: 10, halfZ: 7 } as const;
export const RIVAL: Vec3 = [-5, 0, -2.5];
export const BEAM_TOP: Vec3 = [3.2, 3.4, -3.5];
export const CAMERA = { eye: [0, 8.5, 15] as Vec3, target: [0, -0.6, 0] as Vec3, fov: 38 };
export const VIEW = { w: 600, h: 560 } as const;
/** Seconds for one ring to cross the field. */
export const CYCLE = 6.5;
export const MAX_RADIUS = 17;

export interface Deal {
  pos: Vec3;
  target: boolean;
  label?: string;
}

export const DEALS: readonly Deal[] = [
  { pos: [2.5, 0, 1.5], target: true, label: "northwind" },
  { pos: [5.5, 0, -2], target: true, label: "kestrel" },
  { pos: [-2, 0, 4], target: false },
  { pos: [1, 0, -4.5], target: false },
  { pos: [7, 0, 4.5], target: false },
  { pos: [-7.5, 0, 3.5], target: false },
  { pos: [-1, 0, -0.5], target: false },
  { pos: [-3.5, 0, -5.8], target: false },
];

export const distXZ = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[2] - b[2]);

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const norm = (a: Vec3): Vec3 => {
  const l = Math.hypot(...a);
  return [a[0] / l, a[1] / l, a[2] / l];
};

/** Pinhole projection matching three's PerspectiveCamera.lookAt (vertical fov). */
export function project(p: Vec3, w: number = VIEW.w, h: number = VIEW.h): [number, number] {
  const f = norm(sub(CAMERA.target, CAMERA.eye));
  const r = norm(cross(f, [0, 1, 0]));
  const u = cross(r, f);
  const d = sub(p, CAMERA.eye);
  const t = Math.tan((CAMERA.fov * Math.PI) / 360);
  const z = dot(d, f);
  const x = dot(d, r) / (z * t * (w / h));
  const y = dot(d, u) / (z * t);
  return [((x + 1) / 2) * w, ((1 - y) / 2) * h];
}

export function gridPoints(step: number): Vec3[] {
  const pts: Vec3[] = [];
  for (let x = -FIELD.halfX; x <= FIELD.halfX + 1e-6; x += step)
    for (let z = -FIELD.halfZ; z <= FIELD.halfZ + 1e-6; z += step) pts.push([x, 0, z]);
  return pts;
}
