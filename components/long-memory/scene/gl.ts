/*
 * Thin WebGL2 helpers: programs with cached uniform locations, vertex
 * arrays from typed arrays, and the depth target the shadows are drawn into.
 * Nothing here knows about boards or seeds.
 */

export type Program = {
  handle: WebGLProgram;
  use(): void;
  /** Uniform location by name, looked up once. Missing uniforms (optimised away) give null, which WebGL ignores. */
  u(name: string): WebGLUniformLocation | null;
  /**
   * True once the driver has compiled and linked the program. Where the
   * browser compiles in the background (KHR_parallel_shader_compile) the page
   * stays responsive meanwhile; elsewhere this waits. Throws if it failed.
   */
  ready(): boolean;
};

function compile(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  return shader;
}

/** The compiler's complaint with the source numbered, so the line it means can be found. */
function compileError(gl: WebGL2RenderingContext, shader: WebGLShader, source: string, label: string) {
  const numbered = source
    .split("\n")
    .map((line, i) => `${String(i + 1).padStart(4)} ${line}`)
    .join("\n");
  return new Error(`Shader "${label}" failed to compile:\n${gl.getShaderInfoLog(shader)}\n${numbered}`);
}

export function createProgram(gl: WebGL2RenderingContext, vertex: string, fragment: string, label: string): Program {
  const handle = gl.createProgram()!;
  const shaders = [
    { shader: compile(gl, gl.VERTEX_SHADER, vertex), source: vertex, label: `${label}.vert` },
    { shader: compile(gl, gl.FRAGMENT_SHADER, fragment), source: fragment, label: `${label}.frag` },
  ];
  for (const s of shaders) gl.attachShader(handle, s.shader);
  gl.linkProgram(handle);
  const background = gl.getExtension("KHR_parallel_shader_compile");
  let linked = false;
  const locations = new Map<string, WebGLUniformLocation | null>();
  return {
    handle,
    use: () => gl.useProgram(handle),
    u(name) {
      if (!locations.has(name)) locations.set(name, gl.getUniformLocation(handle, name));
      return locations.get(name)!;
    },
    ready() {
      if (linked) return true;
      if (background && !gl.getProgramParameter(handle, background.COMPLETION_STATUS_KHR)) return false;
      for (const s of shaders) if (!gl.getShaderParameter(s.shader, gl.COMPILE_STATUS)) throw compileError(gl, s.shader, s.source, s.label);
      if (!gl.getProgramParameter(handle, gl.LINK_STATUS)) throw new Error(`Program "${label}" failed to link: ${gl.getProgramInfoLog(handle)}`);
      linked = true;
      return true;
    },
  };
}

export type Attribute = { location: number; size: number; data: Float32Array; divisor?: number; usage?: number };

export type Mesh = {
  vao: WebGLVertexArrayObject;
  count: number;
  indexType: number;
  buffers: WebGLBuffer[];
};

/** A vertex array with one buffer per attribute and a 32-bit index buffer. */
export function createMesh(gl: WebGL2RenderingContext, attributes: Attribute[], indices: Uint32Array): Mesh {
  const vao = gl.createVertexArray()!;
  gl.bindVertexArray(vao);
  const buffers: WebGLBuffer[] = [];
  for (const attribute of attributes) {
    const buffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, attribute.data, attribute.usage ?? gl.STATIC_DRAW);
    gl.enableVertexAttribArray(attribute.location);
    gl.vertexAttribPointer(attribute.location, attribute.size, gl.FLOAT, false, 0, 0);
    if (attribute.divisor) gl.vertexAttribDivisor(attribute.location, attribute.divisor);
    buffers.push(buffer);
  }
  const indexBuffer = gl.createBuffer()!;
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
  buffers.push(indexBuffer);
  gl.bindVertexArray(null);
  return { vao, count: indices.length, indexType: gl.UNSIGNED_INT, buffers };
}

/** An interleaved per-instance buffer bound to consecutive attribute slots of an existing vertex array. */
export function attachInstances(gl: WebGL2RenderingContext, mesh: Mesh, firstLocation: number, layout: number[], initialCapacity: number) {
  const stride = layout.reduce((a, b) => a + b, 0);
  let capacity = initialCapacity;
  let data = new Float32Array(stride * capacity);
  const buffer = gl.createBuffer()!;
  gl.bindVertexArray(mesh.vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, data.byteLength, gl.DYNAMIC_DRAW);
  /** Points the attributes at instance `first`, so a draw can start partway into the buffer. */
  const bindFrom = (first: number) => {
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    let offset = 0;
    layout.forEach((size, i) => {
      const location = firstLocation + i;
      gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(location, size, gl.FLOAT, false, stride * 4, (first * stride + offset) * 4);
      gl.vertexAttribDivisor(location, 1);
      offset += size;
    });
  };
  bindFrom(0);
  gl.bindVertexArray(null);
  return {
    get data() {
      return data;
    },
    stride,
    bindFrom,
    /** Makes room for `count` instances: a big sweep can put more seeds and sparks in the air than usual. */
    reserve(count: number) {
      if (count <= capacity) return;
      while (capacity < count) capacity *= 2;
      const grown = new Float32Array(stride * capacity);
      grown.set(data);
      data = grown;
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, data.byteLength, gl.DYNAMIC_DRAW);
    },
    upload(count: number) {
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, data, 0, count * stride);
    },
  };
}

export type DepthTarget = { framebuffer: WebGLFramebuffer; texture: WebGLTexture; size: number };

/** A square depth texture set up for hardware shadow comparison (sampler2DShadow). */
export function createDepthTarget(gl: WebGL2RenderingContext, size: number): DepthTarget {
  const texture = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT32F, size, size);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
  const framebuffer = gl.createFramebuffer()!;
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, texture, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { framebuffer, texture, size };
}

/** A texture painted with Canvas 2D at run time (the Memory Book's pages), refreshed with `update`. */
export function createCanvasTexture(gl: WebGL2RenderingContext, canvas: HTMLCanvasElement | OffscreenCanvas) {
  const texture = gl.createTexture()!;
  const update = () => {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas as TexImageSource);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  };
  update();
  return { texture, update };
}
