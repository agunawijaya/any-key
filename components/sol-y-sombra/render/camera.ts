import { add, cross, dot, normalize, scale, sub, type Vec3 } from "@/lib/sol-y-sombra/rig/vec";

/*
 * A pinhole camera for drawing the 3D rig on a 2D canvas. Every style uses
 * it: the poster style projects the same skeleton the 3D style renders.
 */

export type Projected = { x: number; y: number; depth: number; scale: number };

/** Closer to the eye than this, a shape is left out: projected that near, it would fill the screen with nonsense. */
export const NEAR = 0.35;

export class Camera {
  eye: Vec3 = { x: 0, y: 4, z: 14 };
  target: Vec3 = { x: 0, y: 1, z: 0 };
  /** Vertical field of view, radians. */
  fov = 0.6;
  width = 1280;
  height = 720;
  private right: Vec3 = { x: 1, y: 0, z: 0 };
  private up: Vec3 = { x: 0, y: 1, z: 0 };
  private forward: Vec3 = { x: 0, y: 0, z: -1 };
  private focal = 1;

  look(eye: Vec3, target: Vec3, fov = this.fov) {
    this.eye = eye;
    this.target = target;
    this.fov = fov;
    this.update();
  }

  resize(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.update();
  }

  private update() {
    this.forward = normalize(sub(this.target, this.eye));
    this.right = normalize(cross(this.forward, { x: 0, y: 1, z: 0 }));
    this.up = cross(this.right, this.forward);
    this.focal = this.height / 2 / Math.tan(this.fov / 2);
  }

  /** Screen position, distance along the view and pixels per metre at that distance. */
  project(p: Vec3): Projected {
    const d = sub(p, this.eye);
    const depth = Math.max(0.05, dot(d, this.forward));
    const s = this.focal / depth;
    return {
      x: this.width / 2 + dot(d, this.right) * s,
      y: this.height / 2 - dot(d, this.up) * s,
      depth,
      scale: s,
    };
  }

  /** How far a point is from the eye along the view, for sorting. */
  depthOf(p: Vec3) {
    return dot(sub(p, this.eye), this.forward);
  }

  /** The direction from the eye towards a point. */
  viewDir(p: Vec3) {
    return normalize(sub(p, this.eye));
  }

  /** A point on the sand under a screen position, for picking and framing. */
  groundAt(x: number, y: number): Vec3 | null {
    const dir = normalize(add(add(this.forward, scale(this.right, (x - this.width / 2) / this.focal)), scale(this.up, -(y - this.height / 2) / this.focal)));
    if (dir.y >= -1e-4) return null;
    const t = -this.eye.y / dir.y;
    return add(this.eye, scale(dir, t));
  }
}
