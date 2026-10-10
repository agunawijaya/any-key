/*
 * How finely to paint. On a real graphics card the canvases are painted at
 * the screen's full resolution, always. When the browser has no graphics
 * card to use and draws everything on the processor (a remote desktop, a
 * locked-down machine, a test runner), a full-resolution battlefield at
 * night runs at a dozen frames a second; painting it at a little over half
 * the resolution keeps it playable, softer but smooth.
 */

let software: boolean | null = null;

/** True when the browser draws without a graphics card, asked once of a scratch WebGL context. */
export function drawsInSoftware() {
  if (software !== null) return software;
  try {
    const gl = document.createElement("canvas").getContext("webgl");
    const info = gl?.getExtension("WEBGL_debug_renderer_info");
    const name = gl && info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : gl ? "" : "software";
    software = /swiftshader|llvmpipe|softpipe|software|basic render/i.test(name);
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    software = false;
  }
  return software;
}

/** The pixel ratio to paint at: the screen's own, or less without a graphics card. */
export const paintRatio = () => (drawsInSoftware() ? 0.6 : Math.min(2, window.devicePixelRatio || 1));
