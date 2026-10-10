/*
 * Builds the carved board as one triangle mesh: a fine grid for the top
 * face (hollows, rims, tool marks and the rounded-over edge come from
 * `surfaceHeight`), and a band swept around the outline for the sides,
 * the chamfer and the shadowed plinth underneath. Grid points that fall
 * outside the rounded corners are pulled onto the outline, so the top and
 * the sides share their edge vertices exactly.
 *
 * Per vertex: position, normal, and `info` = (region, ρ, store, u):
 * region 0 top, 1 side, 2 plinth; ρ the normalised distance to the nearest
 * hollow (9 when none is near); store 1 inside a store; u the distance
 * along the outline, for the carved band on the sides.
 */

import { BOARD, hollowAt, outlineDistance, outlinePoint, rhoOf, surfaceHeight } from "./layout";

export type BoardGeometry = { positions: Float32Array; normals: Float32Array; info: Float32Array; indices: Uint32Array };

/** The spacing of the board's height grid: fine enough for the pits' rims to read as carved. */
export const GRID_STEP = 0.1;

function topNormal(x: number, z: number): [number, number, number] {
  const inset = -outlineDistance(x, z);
  const r = BOARD.roundover;
  if (inset < r) {
    // On the roundover the surface is a quarter circle: its normal turns from up to outward.
    const edge = outlinePoint(x, z);
    const c = (r - Math.max(0, inset)) / r;
    const s = Math.sqrt(Math.max(0, 1 - c * c));
    return [edge.nx * c, s, edge.nz * c];
  }
  const e = 0.035;
  const dx = surfaceHeight(x + e, z) - surfaceHeight(x - e, z);
  const dz = surfaceHeight(x, z + e) - surfaceHeight(x, z - e);
  const l = Math.hypot(dx, 2 * e, dz);
  return [-dx / l, (2 * e) / l, -dz / l];
}

export function buildBoard(step = GRID_STEP): BoardGeometry {
  const nx = Math.round((2 * BOARD.halfLength) / step) + 1;
  const nz = Math.round((2 * BOARD.halfWidth) / step) + 1;
  const gridCount = nx * nz;

  // The outline loop: the grid's own border, walked once around.
  const loop: number[] = [];
  for (let i = 0; i < nx; i++) loop.push(i);
  for (let j = 1; j < nz; j++) loop.push(j * nx + nx - 1);
  for (let i = nx - 2; i >= 0; i--) loop.push((nz - 1) * nx + i);
  for (let j = nz - 2; j > 0; j--) loop.push(j * nx);

  // Side profile, from the edge of the roundover down to the table: (height, inset, normal out, normal up, region).
  const sideProfile = [
    [BOARD.top - BOARD.roundover, 0, 1, 0, 1],
    [BOARD.plinth + 0.5, 0, 1, 0, 1],
    [BOARD.plinth, 0.42, 0.62, -0.78, 2],
    [0, 0.42, 1, 0, 2],
  ];
  const sideCount = (loop.length + 1) * sideProfile.length;
  const total = gridCount + sideCount;
  const positions = new Float32Array(total * 3);
  const normals = new Float32Array(total * 3);
  const info = new Float32Array(total * 4);

  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      let x = -BOARD.halfLength + i * step;
      let z = -BOARD.halfWidth + j * step;
      const onBorder = i === 0 || j === 0 || i === nx - 1 || j === nz - 1;
      if (onBorder || outlineDistance(x, z) > 0) {
        const edge = outlinePoint(x, z);
        x = edge.x;
        z = edge.z;
      }
      const v = j * nx + i;
      const y = onBorder ? BOARD.top - BOARD.roundover : surfaceHeight(x, z);
      positions.set([x, y, z], v * 3);
      normals.set(topNormal(x, z), v * 3);
      const hollow = hollowAt(x, z);
      info.set([0, hollow ? rhoOf(hollow, x, z) : 9, hollow?.store ? 1 : 0, 0], v * 4);
    }
  }

  // Sides: one ring of vertices per profile step, following the loop; the loop is closed by repeating its start.
  let u = 0;
  for (let k = 0; k <= loop.length; k++) {
    const v = loop[k % loop.length];
    const x = positions[v * 3];
    const z = positions[v * 3 + 2];
    if (k > 0) {
      const prev = loop[(k - 1) % loop.length];
      u += Math.hypot(x - positions[prev * 3], z - positions[prev * 3 + 2]);
    }
    const edge = outlinePoint(x, z);
    sideProfile.forEach(([y, inset, out, up, region], p) => {
      const at = gridCount + k * sideProfile.length + p;
      positions.set([x - edge.nx * inset, y, z - edge.nz * inset], at * 3);
      const l = Math.hypot(out, up);
      normals.set([(edge.nx * out) / l, up / l, (edge.nz * out) / l], at * 3);
      info.set([region, 9, 0, u], at * 4);
    });
  }

  const quads = (nx - 1) * (nz - 1) + loop.length * (sideProfile.length - 1);
  const indices = new Uint32Array(quads * 6);
  let n = 0;
  const quad = (a: number, b: number, c: number, d: number) => {
    indices[n++] = a;
    indices[n++] = c;
    indices[n++] = b;
    indices[n++] = b;
    indices[n++] = c;
    indices[n++] = d;
  };
  for (let j = 0; j < nz - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const v = j * nx + i;
      quad(v, v + 1, v + nx, v + nx + 1);
    }
  }
  const rows = sideProfile.length;
  for (let k = 0; k < loop.length; k++) {
    for (let p = 0; p < rows - 1; p++) {
      const a = gridCount + k * rows + p;
      const b = gridCount + (k + 1) * rows + p;
      quad(a, a + 1, b, b + 1);
    }
  }
  return { positions, normals, info, indices };
}
