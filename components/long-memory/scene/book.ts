/*
 * The Memory Book: a small leather notebook with brass corners that lies on
 * the Learner's side of the table. It is drawn from boxes (covers, page
 * blocks, brass), two page surfaces that carry the open spread, and one
 * sheet that turns. Opening rotates the front half of the book, pages and
 * all, a half turn about the middle of the page block, which lays it flat
 * beside the back half the way an open notebook lies.
 *
 * Book space: the spine runs along z at x = 0, the back half lies at x > 0,
 * y is up from the table.
 */

import { multiply, type Mat4, type Vec3 } from "./math";

export const BOOK = {
  /** Where it lies: centre of the spine on the table, and its turn. */
  position: [-25.5, 0, -21.6] as Vec3,
  yaw: 0.24,
  pageWidth: 8.2,
  height: 11.2,
  cover: 0.36,
  pages: 1.6,
  overhang: 0.55,
};

export type BookPose = {
  /** 0 closed, 1 lying open. */
  open: number;
  /** -1 for no page turning; 0 to 1 while a page turns from right to left. */
  turn: number;
  /** 0 to 1: the glow of the remembered page. */
  glow: number;
};

export const MATERIAL = { leather: 0, brass: 1, pageEdge: 2, page: 3, sheet: 4 } as const;

export type BookPart = { model: Mat4; material: number; mesh: "box" | "pagesRight" | "pagesLeft" | "sheet" };

/* ---------- Matrices ---------- */

function translation(x: number, y: number, z: number): Mat4 {
  const m = new Float32Array(16);
  m[0] = m[5] = m[10] = m[15] = 1;
  m[12] = x;
  m[13] = y;
  m[14] = z;
  return m;
}

function scaling(x: number, y: number, z: number): Mat4 {
  const m = new Float32Array(16);
  m[0] = x;
  m[5] = y;
  m[10] = z;
  m[15] = 1;
  return m;
}

function rotationY(a: number): Mat4 {
  const m = new Float32Array(16);
  m[0] = Math.cos(a);
  m[2] = -Math.sin(a);
  m[5] = 1;
  m[8] = Math.sin(a);
  m[10] = Math.cos(a);
  m[15] = 1;
  return m;
}

/** A turn about the z axis through (0, y0): how the front half opens. */
function hingeZ(angle: number, y0: number): Mat4 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const m = new Float32Array(16);
  m[0] = c;
  m[1] = s;
  m[4] = -s;
  m[5] = c;
  m[10] = 1;
  m[15] = 1;
  return multiply(translation(0, y0, 0), multiply(m, translation(0, -y0, 0)));
}

/** A unit box from (x0, y0, z0) to (x1, y1, z1). */
const box = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) => multiply(translation(x0, y0, z0), scaling(x1 - x0, y1 - y0, z1 - z0));

export const bookToWorld = () => multiply(translation(...BOOK.position), rotationY(BOOK.yaw));

/** Every part of the book, posed, in world space. */
export function bookParts(pose: BookPose): BookPart[] {
  const { pageWidth: W, height: H, cover: C, pages: B, overhang: O } = BOOK;
  const world = bookToWorld();
  const half = B / 2;
  const hinge = C + half;
  const front = multiply(world, hingeZ(-Math.PI * pose.open, hinge));
  const parts: BookPart[] = [];
  const add = (frame: Mat4, model: Mat4, material: number, mesh: BookPart["mesh"] = "box") => parts.push({ model: multiply(frame, model), material, mesh });

  // The back half: cover, half the pages, its brass corners.
  add(world, box(0, 0, -H / 2 - O, W + O, C, H / 2 + O), MATERIAL.leather);
  add(world, translation(0, hinge, 0), MATERIAL.page, "pagesRight");
  // The front half, mirrored: its pages sit between the hinge and its cover.
  add(front, box(0, hinge + half + 0.0, -H / 2 - O, W + O, hinge + half + C, H / 2 + O), MATERIAL.leather);
  add(front, translation(0, hinge, 0), MATERIAL.page, "pagesLeft");

  for (const [frame, y0, y1] of [
    [world, -0.06, C + 0.06],
    [front, hinge + half - 0.06, hinge + half + C + 0.06],
  ] as const) {
    for (const z of [-1, 1]) {
      const z0 = z < 0 ? -H / 2 - O - 0.07 : H / 2 + O - 1.6;
      add(frame, box(W + O - 1.6, y0, z0, W + O + 0.07, y1, z0 + 1.67), MATERIAL.brass);
    }
    // A brass band near the spine on each cover.
    add(frame, box(0.55, y0 + 0.03, -H / 2 - O - 0.03, 0.85, y1 - 0.03, H / 2 + O + 0.03), MATERIAL.brass);
  }
  // The spine: stands up when closed, lies under the gutter when open.
  const spineHeight = C * 2 + B;
  const lying = pose.open;
  add(world, box(-0.36 - 0.3 * lying, 0, -H / 2 - O, 0.02, spineHeight * (1 - lying) + C * lying, H / 2 + O), MATERIAL.leather);

  if (pose.turn >= 0 && pose.open > 0.95) add(world, translation(0, hinge + 0.02, 0), MATERIAL.sheet, "sheet");
  return parts;
}

/** The book's footprint on the table for its contact shadow: centre x, z, half-size, yaw. */
export function bookFootprint(pose: BookPose): [number, number, number, number] {
  const reach = (BOOK.pageWidth + BOOK.overhang) * (0.5 + 0.5 * pose.open);
  const centreX = (BOOK.pageWidth + BOOK.overhang) * 0.5 * (1 - pose.open);
  const c = Math.cos(BOOK.yaw);
  const s = Math.sin(BOOK.yaw);
  // rotationY maps local x to (cos, -sin) in world x, z.
  return [BOOK.position[0] + centreX * c, BOOK.position[2] - centreX * s, reach, -BOOK.yaw];
}

/** Where the glow sits in world space: just above the open spread. */
export function glowPoint(pose: BookPose): Vec3 {
  const lift = BOOK.cover + BOOK.pages + 2.5;
  const x = BOOK.pageWidth * 0.25 * (1 - pose.open);
  return [BOOK.position[0] + x * Math.cos(BOOK.yaw), lift, BOOK.position[2] - x * Math.sin(BOOK.yaw)];
}

/* ---------- Meshes ---------- */

export type BookMesh = { positions: Float32Array; normals: Float32Array; uvs: Float32Array; indices: Uint32Array };

/** A unit cube with flat faces; uv.x carries the face (0..5) so edges of the page block can be striped. */
export function unitBox(): BookMesh {
  const faces: [Vec3, Vec3, Vec3][] = [
    [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
    [[-1, 0, 0], [0, 1, 0], [0, 0, -1]],
    [[0, 1, 0], [0, 0, 1], [1, 0, 0]],
    [[0, -1, 0], [1, 0, 0], [0, 0, 1]],
    [[0, 0, 1], [1, 0, 0], [0, 1, 0]],
    [[0, 0, -1], [0, 1, 0], [1, 0, 0]],
  ];
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  faces.forEach(([n, a, b], face) => {
    const base = positions.length / 3;
    const centre = n.map((v) => 0.5 + v * 0.5);
    for (const [i, j] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ]) {
      positions.push(centre[0] + (a[0] * i + b[0] * j) * 0.5, centre[1] + (a[1] * i + b[1] * j) * 0.5, centre[2] + (a[2] * i + b[2] * j) * 0.5);
      normals.push(...n);
      uvs.push(face, (j + 1) / 2);
    }
    indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
  });
  return { positions: new Float32Array(positions), normals: new Float32Array(normals), uvs: new Float32Array(uvs), indices: new Uint32Array(indices) };
}

/** How far the pages bow down into the gutter at distance x from the spine (negative is down). */
export const gutterDip = (x: number) => 0.42 * (1 - Math.exp(-x / 1.1)) - 0.42;

/**
 * Half the page block as one mesh: the curved page on top (uv.x runs across
 * the whole spread, 0 at the left edge to 1 at the right, uv.y down the
 * page) and the striped paper edges round three sides (uv.x = -1, uv.y the
 * height in the block). `side` 1 builds the back half's pages, facing up;
 * -1 the front half's, which face down until the book opens.
 */
export function pageBlock(side: 1 | -1, columns = 28): BookMesh {
  const W = BOOK.pageWidth;
  const H = BOOK.height;
  const depth = BOOK.pages / 2 - 0.02;
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const vertex = (p: Vec3, n: Vec3, uv: [number, number]) => {
    positions.push(p[0], p[1] * side, p[2]);
    normals.push(n[0], n[1] * side, n[2]);
    uvs.push(uv[0], uv[1]);
    return positions.length / 3 - 1;
  };
  const tri = (a: number, b: number, c: number) => (side === 1 ? indices.push(a, b, c) : indices.push(a, c, b));
  const xs = Array.from({ length: columns + 1 }, (_, c) => 0.05 + (c / columns) * (W - 0.05));

  // The page.
  const top = xs.map((x) => {
    const slope = (0.42 / 1.1) * Math.exp(-x / 1.1);
    const l = Math.hypot(slope, 1);
    const u = side === 1 ? 0.5 + (x / W) * 0.5 : 0.5 - (x / W) * 0.5;
    return [vertex([x, gutterDip(x), -H / 2], [-slope / l, 1 / l, 0], [u, 0]), vertex([x, gutterDip(x), H / 2], [-slope / l, 1 / l, 0], [u, 1])];
  });
  for (let c = 0; c < columns; c++) {
    tri(top[c][0], top[c][1], top[c + 1][0]);
    tri(top[c][1], top[c + 1][1], top[c + 1][0]);
  }
  // Head and tail edges follow the page's curve down to the cover.
  for (const [z, nz] of [
    [-H / 2, -1],
    [H / 2, 1],
  ] as const) {
    const ring = xs.map((x) => [vertex([x, gutterDip(x), z], [0, 0, nz], [-1, 1]), vertex([x, -depth, z], [0, 0, nz], [-1, 0])]);
    for (let c = 0; c < columns; c++) {
      if (nz > 0) {
        tri(ring[c][0], ring[c][1], ring[c + 1][0]);
        tri(ring[c][1], ring[c + 1][1], ring[c + 1][0]);
      } else {
        tri(ring[c][0], ring[c + 1][0], ring[c][1]);
        tri(ring[c][1], ring[c + 1][0], ring[c + 1][1]);
      }
    }
  }
  // The fore-edge, opposite the spine.
  const x = W;
  const y = gutterDip(x);
  const a = vertex([x, y, -H / 2], [1, 0, 0], [-1, 1]);
  const b = vertex([x, y, H / 2], [1, 0, 0], [-1, 1]);
  const c = vertex([x, -depth, -H / 2], [1, 0, 0], [-1, 0]);
  const d = vertex([x, -depth, H / 2], [1, 0, 0], [-1, 0]);
  tri(a, b, c);
  tri(b, d, c);
  return { positions: new Float32Array(positions), normals: new Float32Array(normals), uvs: new Float32Array(uvs), indices: new Uint32Array(indices) };
}

/** The turning sheet as a strip; its shape is bent in the vertex shader from (s, v) in uv. */
export function sheetStrip(columns = 32): BookMesh {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let c = 0; c <= columns; c++) {
    for (const r of [0, 1]) {
      positions.push(0, 0, 0);
      normals.push(0, 1, 0);
      uvs.push(c / columns, r);
    }
  }
  for (let c = 0; c < columns; c++) {
    const a = c * 2;
    indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  return { positions: new Float32Array(positions), normals: new Float32Array(normals), uvs: new Float32Array(uvs), indices: new Uint32Array(indices) };
}
