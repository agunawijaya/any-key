/*
 * A small perspective camera for looking into the pit. World units are pit
 * units: x to the east, y to the north (away from the viewer), z up, the pit
 * floor at z = 0 and its centre at the origin. Styles pick the pitch and the
 * distance; `fit` scales the picture so the given points fill a box.
 */

export type Point3 = { x: number; y: number; z: number };
export type ScreenPoint = { x: number; y: number; scale: number };

export type CameraSpec = {
  /** Radians below the horizon, looking at the target. */
  pitch: number;
  /** World units from the camera to the target. */
  distance: number;
  target?: Point3;
};

export class PitCamera {
  private readonly cos: number;
  private readonly sin: number;
  /** Where the camera stands, in world units. */
  readonly eye: Point3;
  private focal = 1;
  private cx = 0;
  private cy = 0;

  constructor(readonly spec: CameraSpec) {
    this.cos = Math.cos(spec.pitch);
    this.sin = Math.sin(spec.pitch);
    const t = spec.target ?? { x: 0, y: 0, z: 0 };
    this.eye = { x: t.x, y: t.y - spec.distance * this.cos, z: t.z + spec.distance * this.sin };
  }

  project(x: number, y: number, z = 0): ScreenPoint {
    const rx = x - this.eye.x;
    const ry = y - this.eye.y;
    const rz = z - this.eye.z;
    const depth = ry * this.cos - rz * this.sin;
    const up = ry * this.sin + rz * this.cos;
    const scale = this.focal / depth;
    return { x: this.cx + rx * scale, y: this.cy - up * scale, scale };
  }

  /** Scales and centres the picture so `points` fill the box, keeping proportions. */
  fit(points: Point3[], box: { left: number; top: number; width: number; height: number }) {
    this.focal = 1;
    this.cx = 0;
    this.cy = 0;
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const p of points) {
      const s = this.project(p.x, p.y, p.z);
      minX = Math.min(minX, s.x);
      maxX = Math.max(maxX, s.x);
      minY = Math.min(minY, s.y);
      maxY = Math.max(maxY, s.y);
    }
    this.focal = Math.min(box.width / (maxX - minX), box.height / (maxY - minY));
    this.cx = box.left + box.width / 2 - ((minX + maxX) / 2) * this.focal;
    this.cy = box.top + box.height / 2 - ((minY + maxY) / 2) * this.focal;
  }

  /** The camera's lens and where its centre falls on screen, for matching one picture to another. */
  get lens() {
    return { focal: this.focal, cx: this.cx, cy: this.cy };
  }

  /** Slides the whole picture by a number of pixels. */
  shift(dx: number, dy: number) {
    this.cx += dx;
    this.cy += dy;
  }

  /** The point at height z under a screen point: the pit floor by default, for picking cells with the mouse. */
  toPlane(sx: number, sy: number, z = 0): { x: number; y: number } {
    const dx = (sx - this.cx) / this.focal;
    const dy = -(sy - this.cy) / this.focal;
    // The ray leaves the eye along forward + dx·right + dy·up; follow it down to the plane.
    const dir = { x: dx, y: this.cos + dy * this.sin, z: -this.sin + dy * this.cos };
    const t = (z - this.eye.z) / dir.z;
    return { x: this.eye.x + dir.x * t, y: this.eye.y + dir.y * t };
  }

  /** Is the point on the side of the camera it can see? */
  inFront(x: number, y: number, z = 0): boolean {
    return (y - this.eye.y) * this.cos - (z - this.eye.z) * this.sin > 0.5;
  }
}
