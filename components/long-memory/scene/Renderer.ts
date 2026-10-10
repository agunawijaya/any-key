/*
 * Draws the board scene with WebGL2: a depth pass from the key light for
 * shadows, then the table, the board, the Memory Book and the seeds, lit
 * and tone-mapped in their own shaders, and last the light effects (glows,
 * remembered seeds, markers on the board). The renderer holds no game
 * state; each frame it is handed the poses of everything that moves.
 */

import { bookFootprint, bookParts, BOOK, MATERIAL, pageBlock, sheetStrip, unitBox, type BookMesh, type BookPose } from "./book";
import { buildBoard, GRID_STEP } from "./boardMesh";
import { attachInstances, createCanvasTexture, createDepthTarget, createMesh, createProgram, type DepthTarget, type Mesh, type Program } from "./gl";
import { BOARD, FRAME, outlineDistance, surfaceHeight } from "./layout";
import { cross, lerp, lerp3, lookAt, multiply, normalize, orthographic, perspective, project, sub, type Mat4, type Quat, type Vec3 } from "./math";
import { paintSpread, SPREAD, entrySlot, type PageEntry } from "./pages";
import {
  BOARD_FRAG,
  BOARD_VERT,
  BOOK_DEPTH_VERT,
  BOOK_FRAG,
  BOOK_VERT,
  DEPTH_FRAG,
  DEPTH_VERT,
  MAX_SEED_LIGHTS,
  SEED_DEPTH_VERT,
  SEED_FRAG,
  SEED_VERT,
  SPRITE_FRAG,
  SPRITE_VERT,
  TABLE_FRAG,
  TABLE_VERT,
} from "./shaders";

export type SeedPose = { pos: Vec3; rotation: Quat; shape: Vec3; color: Vec3; look: [number, number, number, number]; radius: number };

export type SpriteKind = "glow" | "ring" | "dot" | "sparkle" | "shadow";

export type Sprite = {
  kind: SpriteKind;
  pos: Vec3;
  size: number;
  color: Vec3;
  alpha: number;
  /** Markers lying on the board can be stretched along z (stores are long). */
  stretch?: number;
  /** A ring's radius, as a fraction of its size. */
  ring?: number;
};

export type SceneFrame = {
  /** Resting seeds first, then the ones in the air; only resting seeds go into the shadow map. */
  seeds: SeedPose[];
  /** How many of `seeds` rest in the holes. The rest are carried and get soft shadows of their own. */
  resting: number;
  /** Faint copies behind flying seeds; `look[3]` is their opacity. */
  trails: SeedPose[];
  /** Seeds of a remembered move, drawn as rims of light; `look[3]` fades them. */
  ghosts: SeedPose[];
  sprites: Sprite[];
  book: BookPose;
};

/** The two lightings, both designed: a sunlit courtyard and an evening lamp. */
type Lighting = {
  key: [number, number, number, number];
  keyColor: Vec3;
  keyAim: Vec3;
  keyCone: [number, number];
  keyRange: number;
  sky: Vec3;
  ground: Vec3;
  glowColor: Vec3;
  ghostColor: Vec3;
  shadowSoft: number;
  dapple: number;
  exposure: number;
  vignette: number;
  night: number;
};

const SUN_DIRECTION = normalize([-0.55, 0.7, 0.45]);
const LAMP_POSITION: Vec3 = [-8, 54, -5];

const DAY: Lighting = {
  key: [SUN_DIRECTION[0], SUN_DIRECTION[1], SUN_DIRECTION[2], 0],
  keyColor: [3.9, 3.55, 3.05],
  keyAim: [0, -1, 0],
  keyCone: [0.9, 0.6],
  keyRange: 60,
  sky: [0.15, 0.19, 0.27],
  ground: [0.13, 0.1, 0.075],
  glowColor: [0.55, 0.32, 0.1],
  ghostColor: [0.22, 0.42, 0.92],
  shadowSoft: 0.9 / 2048,
  dapple: 1,
  exposure: 1.0,
  vignette: 0.28,
  night: 0,
};

const NIGHT: Lighting = {
  key: [LAMP_POSITION[0], LAMP_POSITION[1], LAMP_POSITION[2], 1],
  keyColor: [9.6, 5.9, 2.8],
  keyAim: normalize([6, -54, 0]),
  keyCone: [0.95, 0.66],
  keyRange: 46,
  sky: [0.006, 0.008, 0.018],
  ground: [0.012, 0.008, 0.005],
  glowColor: [1.5, 0.92, 0.36],
  ghostColor: [0.45, 0.72, 1.0],
  shadowSoft: 2.6 / 2048,
  dapple: 0,
  exposure: 1.15,
  vignette: 0.62,
  night: 1,
};

function mixLighting(a: Lighting, b: Lighting, t: number): Lighting {
  const pick = <T>(x: T, y: T) => (t < 0.5 ? x : y);
  return {
    key: pick(a.key, b.key),
    keyColor: lerp3(a.keyColor, b.keyColor, t),
    keyAim: pick(a.keyAim, b.keyAim),
    keyCone: pick(a.keyCone, b.keyCone),
    keyRange: lerp(a.keyRange, b.keyRange, t),
    sky: lerp3(a.sky, b.sky, t),
    ground: lerp3(a.ground, b.ground, t),
    glowColor: lerp3(a.glowColor, b.glowColor, t),
    ghostColor: lerp3(a.ghostColor, b.ghostColor, t),
    shadowSoft: lerp(a.shadowSoft, b.shadowSoft, t),
    dapple: lerp(a.dapple, b.dapple, t),
    exposure: lerp(a.exposure, b.exposure, t),
    vignette: lerp(a.vignette, b.vignette, t),
    night: pick(a.night, b.night),
  };
}

/** The part of the canvas the board may fill, as fractions of its size (the HUD keeps the rest). */
export type SafeArea = { left: number; right: number; top: number; bottom: number };

const SEED_LAYOUT = [3, 4, 3, 3, 4];
const SPRITE_LAYOUT = [4, 4, 4];
/**
 * Two levels of detail. "full" is the carved board as designed, on any
 * graphics card. "light" is only for browsers that draw WebGL on the
 * processor (no graphics card, or one they will not use): a coarser board mesh
 * (the full one has some 270,000 triangles, drawn twice a frame), a smaller
 * shadow map, fewer pixels and cheaper shading. BoardScene also draws the
 * light board only while something on it changes. A slow card keeps the full
 * board: a sharp board at a lower frame rate beats a blurred one.
 */
export type Detail = "full" | "light";
const DETAIL: Record<Detail, { gridStep: number; shadowSize: number; pixelScale: number }> = {
  full: { gridStep: GRID_STEP, shadowSize: 2048, pixelScale: 1 },
  // 0.52 divides the board's length and width exactly, so the grid still meets the outline.
  light: { gridStep: 0.52, shadowSize: 1024, pixelScale: 0.6 },
};

/** True when WebGL is drawn on the processor rather than a graphics card. */
function drawsInSoftware(gl: WebGL2RenderingContext) {
  const info = gl.getExtension("WEBGL_debug_renderer_info");
  const name = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : "";
  return /swiftshader|llvmpipe|softpipe|software|basic render/i.test(name);
}
/** A footprint far off the table, for a scene without the book. */
const NO_BOOK = [1e4, 1e4, 0, 0];
const SPRITE_KINDS: Record<SpriteKind, number> = { glow: 0, ring: 1, dot: 2, sparkle: 3, shadow: 4 };

type Programs = { board: Program; table: Program; seed: Program; book: Program; sprite: Program; depth: Program; seedDepth: Program; bookDepth: Program };

export class BoardRenderer {
  private gl: WebGL2RenderingContext;
  private board: Mesh;
  private table: Mesh;
  private seedMesh: Mesh;
  private seedInstances: ReturnType<typeof attachInstances>;
  private spriteMesh: Mesh;
  private spriteInstances: ReturnType<typeof attachInstances>;
  private bookMeshes: Record<"box" | "pagesRight" | "pagesLeft" | "sheet", Mesh>;
  private pages: ReturnType<typeof createCanvasTexture>;
  private pageCanvas: HTMLCanvasElement;
  private glowRect: [number, number, number, number] = [0, 0, 0, 0];
  private programs: Programs;
  private shadow: DepthTarget;
  private width = 1;
  private height = 1;
  private compiled = false;
  /** The level of detail, chosen once from the WebGL renderer; see `DETAIL`. */
  readonly detail: Detail;
  private safe: SafeArea = { left: 0.08, right: 0.08, top: 0.08, bottom: 0.14 };
  private night = 0;
  private nightTarget = 0;
  /** False for the Hall's small card: the camera frames the board alone, without the book's corner of the table. */
  private withBook = true;
  private seedLights = new Float32Array(MAX_SEED_LIGHTS * 4);
  viewProjection: Mat4 = new Float32Array(16);
  eye: Vec3 = [0, 0, 0];
  private target: Vec3 = [0, 0, 0];

  constructor(private canvas: HTMLCanvasElement) {
    const gl = canvas.getContext("webgl2", { antialias: true, alpha: false, powerPreference: "high-performance", preserveDrawingBuffer: false });
    if (!gl) throw new Error("WebGL2 is not available");
    this.gl = gl;
    this.detail = drawsInSoftware(gl) ? "light" : "full";
    this.board = this.createBoard();

    const t = 400;
    this.table = createMesh(gl, [{ location: 0, size: 3, data: new Float32Array([-t, 0, -t, t, 0, -t, -t, 0, t, t, 0, t]) }], new Uint32Array([0, 2, 1, 1, 2, 3]));

    const sphere = buildSphere(22, 14);
    this.seedMesh = createMesh(gl, [{ location: 0, size: 3, data: sphere.positions }], sphere.indices);
    this.seedInstances = attachInstances(gl, this.seedMesh, 1, SEED_LAYOUT, 240);

    this.spriteMesh = createMesh(gl, [{ location: 0, size: 2, data: new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]) }], new Uint32Array([0, 1, 2, 1, 3, 2]));
    this.spriteInstances = attachInstances(gl, this.spriteMesh, 1, SPRITE_LAYOUT, 256);

    const bookMesh = (m: BookMesh) =>
      createMesh(
        gl,
        [
          { location: 0, size: 3, data: m.positions },
          { location: 1, size: 3, data: m.normals },
          { location: 2, size: 2, data: m.uvs },
        ],
        m.indices,
      );
    this.bookMeshes = { box: bookMesh(unitBox()), pagesRight: bookMesh(pageBlock(1)), pagesLeft: bookMesh(pageBlock(-1)), sheet: bookMesh(sheetStrip()) };
    this.pageCanvas = document.createElement("canvas");
    this.pageCanvas.width = SPREAD.width;
    this.pageCanvas.height = SPREAD.height;
    this.pages = createCanvasTexture(gl, this.pageCanvas);

    this.programs = {
      board: createProgram(gl, BOARD_VERT, BOARD_FRAG, "board"),
      table: createProgram(gl, TABLE_VERT, TABLE_FRAG, "table"),
      seed: createProgram(gl, SEED_VERT, SEED_FRAG, "seed"),
      book: createProgram(gl, BOOK_VERT, BOOK_FRAG, "book"),
      sprite: createProgram(gl, SPRITE_VERT, SPRITE_FRAG, "sprite"),
      depth: createProgram(gl, DEPTH_VERT, DEPTH_FRAG, "depth"),
      seedDepth: createProgram(gl, SEED_DEPTH_VERT, DEPTH_FRAG, "seed-depth"),
      bookDepth: createProgram(gl, BOOK_DEPTH_VERT, DEPTH_FRAG, "book-depth"),
    };
    this.shadow = createDepthTarget(gl, DETAIL[this.detail].shadowSize);
  }

  private createBoard() {
    const board = buildBoard(DETAIL[this.detail].gridStep);
    return createMesh(
      this.gl,
      [
        { location: 0, size: 3, data: board.positions },
        { location: 1, size: 3, data: board.normals },
        { location: 2, size: 4, data: board.info },
      ],
      board.indices,
    );
  }

  private deleteMesh(mesh: Mesh) {
    this.gl.deleteVertexArray(mesh.vao);
    for (const buffer of mesh.buffers) this.gl.deleteBuffer(buffer);
  }

  setAppearance(dark: boolean, immediately = false) {
    this.nightTarget = dark ? 1 : 0;
    if (immediately) this.night = this.nightTarget;
  }

  /** Whether every program is compiled and linked, so frames can be drawn; throws if one failed. */
  get ready() {
    if (!this.compiled) this.compiled = Object.values(this.programs).every((program) => program.ready());
    return this.compiled;
  }

  /** False while the light is still turning from day to night or back. */
  get settled() {
    return this.night === this.nightTarget;
  }

  setSafeArea(safe: SafeArea) {
    this.safe = safe;
    this.fitCamera();
  }

  frameBoardOnly() {
    this.withBook = false;
    this.fitCamera();
  }

  /** Writes the remembered games onto the open spread; `glowing` is the entry that lights up. */
  setPages(entries: PageEntry[], glowing: number | null) {
    paintSpread(this.pageCanvas, entries, glowing);
    this.pages.update();
    if (glowing === null) this.glowRect = [0, 0, 0, 0];
    else {
      const slot = entrySlot(glowing);
      this.glowRect = [slot.u0, slot.v0, slot.u1, slot.v1];
    }
  }

  resize(width: number, height: number, pixelRatio: number) {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    const scale = pixelRatio * DETAIL[this.detail].pixelScale;
    this.canvas.width = Math.round(this.width * scale);
    this.canvas.height = Math.round(this.height * scale);
    this.fitCamera();
  }

  /** Screen position (CSS pixels) of a point in the scene. */
  toScreen(p: Vec3) {
    return project(this.viewProjection, p, this.width, this.height);
  }

  /**
   * A fixed camera a little in front of the board and well above it, then a
   * lens shift and zoom so the board and the book's corner fill the safe area.
   */
  private fitCamera() {
    const aspect = this.width / this.height;
    const elevation = (58 * Math.PI) / 180;
    const distance = 120;
    this.target = [(FRAME.minX + FRAME.maxX) / 2, BOARD.top * 0.5, (FRAME.minZ + FRAME.maxZ) / 2];
    const target = this.target;
    this.eye = [target[0], target[1] + distance * Math.sin(elevation), target[2] + distance * Math.cos(elevation)];
    const view = lookAt(this.eye, target);
    const lens = perspective((30 * Math.PI) / 180, aspect, 10, 900);
    const raw = multiply(lens, view);

    let x0 = Infinity;
    let x1 = -Infinity;
    let y0 = Infinity;
    let y1 = -Infinity;
    const minZ = this.withBook ? FRAME.minZ : -BOARD.halfWidth - 1;
    for (const x of [FRAME.minX, FRAME.maxX]) {
      for (const z of [minZ, FRAME.maxZ]) {
        for (const y of [0, BOARD.top]) {
          const s = project(raw, [x, y, z], 2, 2);
          const nx = s.x - 1;
          const ny = 1 - s.y;
          x0 = Math.min(x0, nx);
          x1 = Math.max(x1, nx);
          y0 = Math.min(y0, ny);
          y1 = Math.max(y1, ny);
        }
      }
    }
    const { left, right, top, bottom } = this.safe;
    const sx0 = -1 + 2 * left;
    const sx1 = 1 - 2 * right;
    const sy0 = -1 + 2 * bottom;
    const sy1 = 1 - 2 * top;
    const zoom = Math.min((sx1 - sx0) / (x1 - x0), (sy1 - sy0) / (y1 - y0));
    const shiftX = (sx0 + sx1) / 2 - ((x0 + x1) / 2) * zoom;
    const shiftY = (sy0 + sy1) / 2 - ((y0 + y1) / 2) * zoom;
    // Zoom and shift in clip space: x' = zoom·x + shift·w.
    const fit = new Float32Array([zoom, 0, 0, 0, 0, zoom, 0, 0, 0, 0, 1, 0, shiftX, shiftY, 0, 1]);
    this.viewProjection = multiply(fit, raw);
  }

  private lightViewProjection(lighting: Lighting): Mat4 {
    if (lighting.key[3] < 0.5) {
      const L: Vec3 = [lighting.key[0], lighting.key[1], lighting.key[2]];
      const centre: Vec3 = [-4, 0, -8];
      const view = lookAt([centre[0] + L[0] * 150, centre[1] + L[1] * 150, centre[2] + L[2] * 150], centre, [0, 1, 0]);
      return multiply(orthographic(-52, 52, -44, 44, 20, 320), view);
    }
    const view = lookAt([lighting.key[0], lighting.key[1], lighting.key[2]], [-4, 0, -6], [0, 0, -1]);
    return multiply(perspective((96 * Math.PI) / 180, 1, 15, 200), view);
  }

  /** Writes seed poses into the instance buffer, starting at `first`. */
  private writeSeeds(seeds: SeedPose[], first: number) {
    const data = this.seedInstances.data;
    const stride = this.seedInstances.stride;
    seeds.forEach((s, i) => {
      const o = (first + i) * stride;
      data.set(s.pos, o);
      data.set(s.rotation, o + 3);
      data.set(s.shape, o + 7);
      data.set(s.color, o + 10);
      data.set(s.look, o + 13);
    });
  }

  private uploadSeeds(frame: SceneFrame) {
    this.seedInstances.reserve(frame.seeds.length + frame.trails.length + frame.ghosts.length);
    this.writeSeeds(frame.seeds, 0);
    this.writeSeeds(frame.trails, frame.seeds.length);
    this.writeSeeds(frame.ghosts, frame.seeds.length + frame.trails.length);
    this.seedInstances.upload(frame.seeds.length + frame.trails.length + frame.ghosts.length);
    this.seedLights.fill(0);
    frame.seeds.slice(0, MAX_SEED_LIGHTS).forEach((s, i) => this.seedLights.set([s.pos[0], s.pos[1], s.pos[2], s.radius], i * 4));
  }

  private uploadSprites(sprites: Sprite[]) {
    this.spriteInstances.reserve(sprites.length);
    const data = this.spriteInstances.data;
    const stride = this.spriteInstances.stride;
    sprites.forEach((s, i) => {
      const o = i * stride;
      data.set([s.pos[0], s.pos[1], s.pos[2], s.size], o);
      data.set([s.color[0], s.color[1], s.color[2], s.alpha], o + 4);
      const marker = s.kind === "ring" || s.kind === "dot" || s.kind === "shadow";
      data.set([SPRITE_KINDS[s.kind], s.stretch ?? 1, s.ring ?? 0.85, marker ? 1 : 0], o + 8);
    });
    this.spriteInstances.upload(sprites.length);
  }

  render(frame: SceneFrame, dt: number) {
    const gl = this.gl;
    this.night += (this.nightTarget - this.night) * Math.min(1, dt * 4);
    if (Math.abs(this.night - this.nightTarget) < 0.002) this.night = this.nightTarget;
    const lighting = mixLighting(DAY, NIGHT, this.night);
    const lightVP = this.lightViewProjection(lighting);
    // Framed on the board alone (the Hall's card), the book would only show as a stray corner: it is left out.
    const parts = this.withBook ? bookParts(frame.book) : [];
    this.uploadSeeds(frame);

    // Shadows: the board, the book and the seeds, seen from the light.
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadow.framebuffer);
    gl.viewport(0, 0, this.shadow.size, this.shadow.size);
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.POLYGON_OFFSET_FILL);
    gl.polygonOffset(2.5, 6);
    gl.disable(gl.CULL_FACE);
    this.programs.depth.use();
    gl.uniformMatrix4fv(this.programs.depth.u("uLightViewProj"), false, lightVP);
    this.drawMesh(this.board);
    this.programs.bookDepth.use();
    gl.uniformMatrix4fv(this.programs.bookDepth.u("uLightViewProj"), false, lightVP);
    gl.uniform2f(this.programs.bookDepth.u("uPageSize"), BOOK.pageWidth, BOOK.height);
    gl.uniform1f(this.programs.bookDepth.u("uTurn"), Math.max(0, frame.book.turn));
    for (const part of parts) {
      gl.uniformMatrix4fv(this.programs.bookDepth.u("uModel"), false, part.model);
      gl.uniform1i(this.programs.bookDepth.u("uSheet"), part.mesh === "sheet" ? 1 : 0);
      this.drawMesh(this.bookMeshes[part.mesh]);
    }
    if (frame.resting) {
      this.programs.seedDepth.use();
      gl.uniformMatrix4fv(this.programs.seedDepth.u("uLightViewProj"), false, lightVP);
      this.drawMesh(this.seedMesh, frame.resting);
    }
    gl.disable(gl.POLYGON_OFFSET_FILL);

    // The picture.
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);

    const lit = [this.programs.table, this.programs.board, this.programs.seed, this.programs.book];
    for (const program of lit) this.setLighting(program, lighting, lightVP, frame);

    this.programs.table.use();
    gl.uniform1f(this.programs.table.u("uNight"), lighting.night);
    gl.uniform4fv(this.programs.table.u("uBookBox"), this.withBook ? bookFootprint(frame.book) : NO_BOOK);
    this.drawMesh(this.table);

    this.programs.board.use();
    this.drawMesh(this.board);

    this.drawBook(parts, frame.book, lighting);

    if (frame.seeds.length) {
      this.programs.seed.use();
      gl.uniform1f(this.programs.seed.u("uGhost"), 0);
      gl.uniform1i(this.programs.seed.u("uSeedOffset"), 0);
      this.drawMesh(this.seedMesh, frame.seeds.length);
    }

    gl.enable(gl.BLEND);
    gl.depthMask(false);
    if (frame.trails.length) {
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      this.programs.seed.use();
      gl.uniform1i(this.programs.seed.u("uSeedOffset"), frame.seeds.length);
      this.drawMesh(this.seedMesh, frame.trails.length, frame.seeds.length);
    }
    if (frame.ghosts.length) {
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      this.programs.seed.use();
      gl.uniform1f(this.programs.seed.u("uGhost"), 1);
      gl.uniform1f(this.programs.seed.u("uGhostCover"), 1 - lighting.night);
      gl.uniform3fv(this.programs.seed.u("uGhostColor"), lighting.ghostColor);
      this.drawMesh(this.seedMesh, frame.ghosts.length, frame.seeds.length + frame.trails.length);
      gl.uniform1f(this.programs.seed.u("uGhost"), 0);
    }
    const sprites = [...this.airShadows(frame, lighting), ...frame.sprites];
    if (sprites.length) {
      this.uploadSprites(sprites);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.disable(gl.CULL_FACE);
      const sprite = this.programs.sprite;
      sprite.use();
      const forward = normalize(sub(this.target, this.eye));
      const right = normalize(cross(forward, [0, 1, 0]));
      const up = cross(right, forward);
      gl.uniformMatrix4fv(sprite.u("uViewProj"), false, this.viewProjection);
      gl.uniform3fv(sprite.u("uCamRight"), right);
      gl.uniform3fv(sprite.u("uCamUp"), up);
      this.drawMesh(this.spriteMesh, sprites.length);
    }
    gl.depthMask(true);
    gl.disable(gl.BLEND);
  }

  /**
   * Seeds in the air cast soft shadows of their own, cast along the light onto
   * the board: wider and fainter the higher they fly, as a real one would.
   */
  private airShadows(frame: SceneFrame, lighting: Lighting): Sprite[] {
    const shadows: Sprite[] = [];
    for (const seed of frame.seeds.slice(frame.resting)) {
      const p = seed.pos;
      const floor = surfaceHeight(p[0], p[2], false);
      const height = Math.max(0, p[1] - floor);
      const toLight: Vec3 = lighting.key[3] < 0.5 ? [lighting.key[0], lighting.key[1], lighting.key[2]] : normalize(sub([lighting.key[0], lighting.key[1], lighting.key[2]], p));
      const reach = height / Math.max(0.25, toLight[1]);
      const x = p[0] - toLight[0] * reach;
      const z = p[2] - toLight[2] * reach;
      const ground = outlineDistance(x, z) < 0 ? surfaceHeight(x, z, false) : 0;
      const spread = 1 + height * 0.16;
      shadows.push({ kind: "shadow", pos: [x, ground + 0.04, z], size: seed.radius * 1.9 * spread, color: [0, 0, 0], alpha: (lighting.night ? 0.5 : 0.42) / spread });
    }
    return shadows;
  }

  private drawBook(parts: ReturnType<typeof bookParts>, pose: BookPose, lighting: Lighting) {
    const gl = this.gl;
    const book = this.programs.book;
    book.use();
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.pages.texture);
    gl.uniform1i(book.u("uPages"), 1);
    gl.uniform2f(book.u("uPageSize"), BOOK.pageWidth, BOOK.height);
    gl.uniform1f(book.u("uTurn"), Math.max(0, pose.turn));
    gl.uniform1f(book.u("uBookGlow"), pose.glow);
    gl.uniform4fv(book.u("uGlowRect"), this.glowRect);
    gl.uniform3fv(book.u("uGlowTint"), lighting.glowColor);
    gl.disable(gl.CULL_FACE);
    for (const part of parts) {
      gl.uniformMatrix4fv(book.u("uModel"), false, part.model);
      gl.uniform1i(book.u("uMaterial"), part.mesh === "sheet" ? MATERIAL.sheet : part.material);
      gl.uniform1i(book.u("uSheet"), part.mesh === "sheet" ? 1 : 0);
      this.drawMesh(this.bookMeshes[part.mesh]);
    }
    gl.enable(gl.CULL_FACE);
  }

  private setLighting(program: Program, l: Lighting, lightVP: Mat4, frame: SceneFrame) {
    const gl = this.gl;
    program.use();
    gl.uniformMatrix4fv(program.u("uViewProj"), false, this.viewProjection);
    gl.uniform3fv(program.u("uCamPos"), this.eye);
    gl.uniform4fv(program.u("uKey"), l.key);
    gl.uniform3fv(program.u("uKeyColor"), l.keyColor);
    gl.uniform3fv(program.u("uKeyAim"), l.keyAim);
    gl.uniform2fv(program.u("uKeyCone"), l.keyCone);
    gl.uniform1f(program.u("uKeyRange"), l.keyRange);
    gl.uniform3fv(program.u("uSky"), l.sky);
    gl.uniform3fv(program.u("uGround"), l.ground);
    gl.uniform1f(program.u("uLight"), this.detail === "light" ? 1 : 0);
    const glowAt: Vec3 = [BOOK.position[0], BOOK.cover + BOOK.pages + 3, BOOK.position[2]];
    gl.uniform3fv(program.u("uGlowPos"), glowAt);
    const g = frame.book.glow * frame.book.open;
    gl.uniform3fv(program.u("uGlowColor"), [l.glowColor[0] * g, l.glowColor[1] * g, l.glowColor[2] * g]);
    gl.uniformMatrix4fv(program.u("uShadowMat"), false, lightVP);
    gl.uniform1f(program.u("uShadowSoft"), l.shadowSoft);
    // The leaves' dapple costs nine noise lookups a pixel: the light board does without it.
    gl.uniform1f(program.u("uDapple"), this.detail === "light" ? 0 : l.dapple);
    gl.uniform1f(program.u("uExposure"), l.exposure);
    gl.uniform1f(program.u("uVignette"), l.vignette);
    gl.uniform2f(program.u("uResolution"), this.canvas.width, this.canvas.height);
    gl.uniform4fv(program.u("uSeeds"), this.seedLights);
    gl.uniform1i(program.u("uSeedCount"), Math.min(MAX_SEED_LIGHTS, frame.seeds.length));
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.shadow.texture);
    gl.uniform1i(program.u("uShadowMap"), 0);
  }

  private drawMesh(mesh: Mesh, instances = 0, firstInstance = 0) {
    const gl = this.gl;
    gl.bindVertexArray(mesh.vao);
    const instanced = mesh === this.seedMesh ? this.seedInstances : mesh === this.spriteMesh ? this.spriteInstances : null;
    if (firstInstance && instanced) instanced.bindFrom(firstInstance);
    if (instances) gl.drawElementsInstanced(gl.TRIANGLES, mesh.count, mesh.indexType, 0, instances);
    else gl.drawElements(gl.TRIANGLES, mesh.count, mesh.indexType, 0);
    if (firstInstance && instanced) instanced.bindFrom(0);
    gl.bindVertexArray(null);
  }

  /** Frees the GPU objects; the context itself stays with the canvas, which React may mount again (Strict Mode does). */
  dispose() {
    const gl = this.gl;
    for (const mesh of [this.board, this.table, this.seedMesh, this.spriteMesh, ...Object.values(this.bookMeshes)]) this.deleteMesh(mesh);
    for (const program of Object.values(this.programs)) gl.deleteProgram(program.handle);
    gl.deleteTexture(this.pages.texture);
    gl.deleteFramebuffer(this.shadow.framebuffer);
    gl.deleteTexture(this.shadow.texture);
  }
}

/** A unit sphere: the seed before it is squashed into shape. */
function buildSphere(segments: number, rings: number) {
  const positions: number[] = [];
  const indices: number[] = [];
  for (let r = 0; r <= rings; r++) {
    const theta = (r / rings) * Math.PI;
    for (let s = 0; s <= segments; s++) {
      const phi = (s / segments) * Math.PI * 2;
      positions.push(Math.sin(theta) * Math.cos(phi), Math.cos(theta), Math.sin(theta) * Math.sin(phi));
    }
  }
  const row = segments + 1;
  for (let r = 0; r < rings; r++) {
    for (let s = 0; s < segments; s++) {
      const a = r * row + s;
      const b = a + row;
      indices.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  return { positions: new Float32Array(positions), indices: new Uint32Array(indices) };
}
