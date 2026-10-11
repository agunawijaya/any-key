import type { Ring } from "@/lib/sol-y-sombra/rig/ring";
import { add, addScaled, flat, headingDir, headingOf, headingRight, lerp, normalize, sub, type Vec3 } from "@/lib/sol-y-sombra/rig/vec";
import type { Camera } from "../render/camera";

/*
 * Where the lab's camera stands. "Stands" is the poster's view: from the
 * seats, square to the line the bull runs along. "Barrier" is low and close,
 * from behind the boards. "High" looks down on the paths. "Orbit" is the
 * viewer's own, dragged round with the mouse.
 */

export type CameraView = "stands" | "barrier" | "high" | "bull" | "matador" | "orbit";
export const CAMERA_VIEWS: CameraView[] = ["stands", "barrier", "high", "bull", "matador", "orbit"];

export class LabCamera {
  view: CameraView = "stands";
  /** Orbit angles, set by dragging. */
  yaw = 0.9;
  pitch = 0.32;
  distance = 11;
  private focus: Vec3 | null = null;
  private axis: number | null = null;
  private back = 0;
  private portrait: Vec3 | null = null;

  /** Moves the camera towards where it wants to be; `snap` jumps straight there. */
  update(camera: Camera, ring: Ring, dt: number, snap = false) {
    const matador = flat(ring.skeleton.pelvis);
    const bull = flat(ring.bullPose.withers);
    // The view looks square to the line between the two, which turns slowly as the passes drift.
    const line = headingOf(sub(bull, matador));
    if (this.axis === null || snap) this.axis = line;
    const wrapped = Math.atan2(Math.sin(line - this.axis), Math.cos(line - this.axis));
    // Only the line's direction matters, not which end the bull is at.
    const turn = Math.abs(wrapped) > Math.PI / 2 ? wrapped - Math.sign(wrapped) * Math.PI : wrapped;
    this.axis += turn * Math.min(1, dt * 0.35);

    const centre = lerp(matador, bull, 0.4);
    const wantFocus = add(centre, { x: 0, y: 0.95, z: 0 });
    this.focus = !this.focus || snap ? wantFocus : lerp(this.focus, wantFocus, Math.min(1, dt * 1.6));
    const focus = this.focus;
    const across = headingRight(this.axis);
    const along = headingDir(this.axis);
    // Pull back just enough to keep both in frame: the closer they are, the closer the camera.
    const span = Math.hypot(bull.x - matador.x, bull.z - matador.z);
    const wantBack = Math.max(7.5, Math.min(17, span * 1.25 + 5));
    this.back = !this.back || snap ? wantBack : this.back + (wantBack - this.back) * Math.min(1, dt * 0.8);

    if (this.view === "stands") camera.look(addScaled(add(focus, { x: 0, y: this.back * 0.24, z: 0 }), across, this.back), focus, 0.56);
    else if (this.view === "barrier") {
      // Low, from behind the boards, a little behind the matador: he stays large, the bull runs in and out of depth.
      const reach = 4 + this.back * 0.14;
      const eye = add(addScaled(addScaled(matador, across, reach), along, -reach * 0.42), { x: 0, y: 1.1, z: 0 });
      camera.look(eye, add(lerp(matador, bull, 0.25), { x: 0, y: 1.0, z: 0 }), 0.9);
    } else if (this.view === "bull" || this.view === "matador") {
      // Close portraits, three-quarters on, for judging faces and hands.
      const subject = this.view === "bull" ? ring.bullPose.poll : ring.skeleton.head;
      const facingDir = this.view === "bull" ? headingDir(ring.bullPose.heading) : headingDir(ring.intent.heading);
      const side = headingRight(headingOf(facingDir));
      this.portrait = !this.portrait || snap ? subject : lerp(this.portrait, subject, Math.min(1, dt * 6));
      const look = add(this.portrait, { x: 0, y: this.view === "bull" ? -0.25 : -0.35, z: 0 });
      // The matador's camera sits high, so a bull swirling round him passes under it rather than through it.
      const high = this.view === "bull" ? 0.35 : 1.5;
      const eye = add(addScaled(addScaled(look, facingDir, 2.4), side, 1.7), { x: 0, y: high, z: 0 });
      camera.look(eye, look, 0.62);
    } else if (this.view === "high") camera.look(addScaled(add(focus, { x: 0, y: this.back * 0.75, z: 0 }), across, this.back * 0.45), focus, 0.75);
    else {
      const dir = normalize({
        x: Math.cos(this.yaw) * Math.cos(this.pitch),
        y: Math.sin(this.pitch),
        z: Math.sin(this.yaw) * Math.cos(this.pitch),
      });
      camera.look(addScaled(focus, dir, this.distance), focus, 0.7);
    }
  }
}
