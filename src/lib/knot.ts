export type Curve = { points: [number, number][]; depth: number };
const TAU = Math.PI * 2;

function surface(u: number, v: number, time: number, tilt: number): [number, number, number] {
  const center = (a: number) => [(2 + Math.cos(3 * a)) * Math.cos(2 * a) * .5, (2 + Math.cos(3 * a)) * Math.sin(2 * a) * .5, Math.sin(3 * a) * .57];
  const [cx, cy, cz] = center(u);
  const next = center(u + .001);
  let tx = next[0] - cx, ty = next[1] - cy, tz = next[2] - cz;
  const len = Math.hypot(tx, ty, tz);
  tx /= len; ty /= len; tz /= len;
  const nlen = Math.hypot(tx, ty);
  const nx = ty / nlen, ny = -tx / nlen;
  const bx = -tz * ny, by = tz * nx, bz = tx * ny - ty * nx;
  const radius = .26 + Math.sin(u * 6 + time * .4) * .018;
  const x = cx + radius * (Math.cos(v) * nx + Math.sin(v) * bx);
  const y = cy + radius * (Math.cos(v) * ny + Math.sin(v) * by);
  const z = cz + radius * Math.sin(v) * bz;
  const spin = -.22 + time * .055;
  const rx = x * Math.cos(spin) - y * Math.sin(spin);
  const ry = x * Math.sin(spin) + y * Math.cos(spin);
  const angle = .7 + tilt;
  const sy = ry * Math.cos(angle) - z * Math.sin(angle);
  const sz = ry * Math.sin(angle) + z * Math.cos(angle);
  const perspective = 3.5 / (3.5 + sz * .22);
  return [240 + rx * 100 * perspective, 185 + sy * 100 * perspective, sz];
}

export function knotCurves(time = 0, tilt = 0): Curve[] {
  const curves: Curve[] = [];
  for (let row = 0; row < 24; row++) {
    const points: [number, number][] = [];
    let depth = 0;
    for (let step = 0; step <= 210; step++) {
      const [x, y, z] = surface(step / 210 * TAU, row / 24 * TAU, time, tilt);
      points.push([x, y]); depth += z;
    }
    curves.push({ points, depth: depth / 211 });
  }
  for (let row = 0; row < 110; row++) {
    const points: [number, number][] = [];
    let depth = 0;
    for (let step = 0; step <= 34; step++) {
      const [x, y, z] = surface(row / 110 * TAU, step / 34 * TAU, time, tilt);
      points.push([x, y]); depth += z;
    }
    curves.push({ points, depth: depth / 35 });
  }
  return curves.sort((a, b) => b.depth - a.depth);
}

export function curvePath(curve: Curve) {
  return curve.points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
}
