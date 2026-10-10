/*
 * GLSL for the board scene. One lighting model for everything (a key light
 * that is the sun by day and a hanging lamp by night, the Memory Book's glow,
 * a sky-and-table ambient, shadows from one depth map), and one material
 * function per surface: carved wood, seeds, the table, the book.
 *
 * Everything is lit in linear colour and tone-mapped at the end of each
 * fragment shader, so no post-processing pass is needed.
 */

import { BOARD } from "./layout";

const f = (n: number) => n.toFixed(4);

export const MAX_SEED_LIGHTS = 80;

const HEADER = /* glsl */ `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2DShadow;
`;

/* ---------- Noise: a PCG-style integer hash and gradient noise built on it ---------- */

const NOISE = /* glsl */ `
// 1.0 on the light board (see DETAIL in Renderer.ts): fewer noise octaves, shadow taps and seed shadows.
uniform float uLight;

uvec3 pcg3(uvec3 v) {
  v = v * 1664525u + 1013904223u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  v ^= v >> 16u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  return v;
}

vec3 gradientAt(vec3 cell) {
  uvec3 h = pcg3(uvec3(ivec3(cell) + 32768));
  return vec3(h & 0xffffu) / 32767.5 - 1.0;
}

float hash31(vec3 p) {
  uvec3 h = pcg3(uvec3(ivec3(floor(p)) + 32768));
  return float(h.x & 0xffffu) / 65535.0;
}

/* Gradient noise, roughly -1..1. */
float gnoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  vec3 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float n000 = dot(gradientAt(i), f);
  float n100 = dot(gradientAt(i + vec3(1, 0, 0)), f - vec3(1, 0, 0));
  float n010 = dot(gradientAt(i + vec3(0, 1, 0)), f - vec3(0, 1, 0));
  float n110 = dot(gradientAt(i + vec3(1, 1, 0)), f - vec3(1, 1, 0));
  float n001 = dot(gradientAt(i + vec3(0, 0, 1)), f - vec3(0, 0, 1));
  float n101 = dot(gradientAt(i + vec3(1, 0, 1)), f - vec3(1, 0, 1));
  float n011 = dot(gradientAt(i + vec3(0, 1, 1)), f - vec3(0, 1, 1));
  float n111 = dot(gradientAt(i + vec3(1, 1, 1)), f - vec3(1, 1, 1));
  return mix(mix(mix(n000, n100, u.x), mix(n010, n110, u.x), u.y), mix(mix(n001, n101, u.x), mix(n011, n111, u.x), u.y), u.z) * 1.4;
}

float fbm(vec3 p) {
  float sum = 0.0;
  float amp = 0.5;
  int octaves = uLight > 0.5 ? 2 : 4;
  for (int i = 0; i < 4; i++) {
    if (i >= octaves) break;
    sum += amp * gnoise(p);
    p = p * 2.03 + vec3(17.1, 3.7, 9.2);
    amp *= 0.5;
  }
  return sum;
}
`;

/* ---------- Lighting shared by every lit surface ---------- */

const LIGHTING = /* glsl */ `
uniform vec3 uCamPos;
uniform vec4 uKey;
uniform vec3 uKeyColor;
uniform vec3 uKeyAim;
uniform vec2 uKeyCone;
uniform float uKeyRange;
uniform vec3 uSky;
uniform vec3 uGround;
uniform vec3 uGlowPos;
uniform vec3 uGlowColor;
uniform mat4 uShadowMat;
uniform sampler2DShadow uShadowMap;
uniform float uShadowSoft;
uniform float uDapple;
uniform float uExposure;
uniform vec2 uResolution;
uniform float uVignette;
uniform vec4 uSeeds[${MAX_SEED_LIGHTS}];
uniform int uSeedCount;

const float PI = 3.14159265;

struct Material {
  vec3 albedo;
  float rough;
  float f0;
  float coat;
  float coatRough;
  float ao;
  float sheen;
  float metal;
  vec3 emissive;
};

Material material(vec3 albedo) {
  Material m;
  m.albedo = albedo;
  m.rough = 0.6;
  m.f0 = 0.04;
  m.coat = 0.0;
  m.coatRough = 0.3;
  m.ao = 1.0;
  m.sheen = 0.0;
  m.metal = 0.0;
  m.emissive = vec3(0.0);
  return m;
}

float ggx(float NoH, float a) {
  float a2 = a * a;
  float d = NoH * NoH * (a2 - 1.0) + 1.0;
  return a2 / (PI * d * d);
}

float smithVisibility(float NoV, float NoL, float a) {
  float k = a * 0.5;
  return 0.25 / ((NoV * (1.0 - k) + k) * (NoL * (1.0 - k) + k));
}

float fresnel(float f0, float VoH) {
  return f0 + (1.0 - f0) * pow(1.0 - VoH, 5.0);
}

// The first four balance each other, for the light board's four-tap shadows.
const vec2 DISC[12] = vec2[12](
  vec2(-0.840, -0.074), vec2(0.896, 0.412), vec2(0.185, -0.893), vec2(-0.203, 0.621),
  vec2(-0.326, -0.406), vec2(-0.696, 0.457), vec2(0.962, -0.195), vec2(0.473, -0.480),
  vec2(0.519, 0.767), vec2(0.507, 0.064), vec2(-0.322, -0.933), vec2(-0.792, -0.598)
);

float shadowAt(vec3 P, vec3 N) {
  vec4 s = uShadowMat * vec4(P + N * 0.05, 1.0);
  vec3 c = s.xyz / s.w * 0.5 + 0.5;
  if (c.x < 0.0 || c.x > 1.0 || c.y < 0.0 || c.y > 1.0 || c.z > 1.0) return 1.0;
  float sum = 0.0;
  float spin = hash31(vec3(gl_FragCoord.xy, 3.0)) * 6.2831;
  mat2 r = mat2(cos(spin), sin(spin), -sin(spin), cos(spin));
  int taps = uLight > 0.5 ? 4 : 12;
  for (int i = 0; i < 12; i++) {
    if (i >= taps) break;
    sum += texture(uShadowMap, vec3(c.xy + r * DISC[i] * uShadowSoft, c.z - 0.0004));
  }
  return sum / float(taps);
}

/* Sunlight through a canopy of leaves: soft flecks, kept off the middle of the table where the board sits. */
float dapple(vec3 P, vec3 L) {
  if (uDapple <= 0.0) return 1.0;
  vec3 q = P + L * ((180.0 - P.y) / max(L.y, 0.2));
  float leaves = fbm(vec3(q.xz * 0.03, 1.7)) + 0.5 * fbm(vec3(q.xz * 0.11, 4.1)) + 0.18 * gnoise(vec3(q.xz * 0.5, 2.0));
  float lit = smoothstep(0.02, 0.07, leaves);
  float edge = smoothstep(1.0, 1.45, length((P.xz - vec2(0.0, -3.0)) / vec2(50.0, 24.0)));
  return mix(1.0, mix(0.24, 1.0, lit), edge * uDapple);
}

vec3 keyLight(vec3 P, out vec3 L) {
  if (uKey.w < 0.5) {
    L = normalize(uKey.xyz);
    return uKeyColor * dapple(P, L);
  }
  vec3 d = uKey.xyz - P;
  float dist = length(d);
  L = d / dist;
  float falloff = 1.0 / (1.0 + (dist * dist) / (uKeyRange * uKeyRange));
  float spot = smoothstep(uKeyCone.y, uKeyCone.x, dot(-L, normalize(uKeyAim)));
  return uKeyColor * falloff * spot;
}

/* Ambient occlusion from nearby seeds (spheres), so they sit in the wood instead of floating over it. */
float seedOcclusion(vec3 P, vec3 N, int skip) {
  if (uLight > 0.5) return 1.0;
  float occ = 0.0;
  for (int i = 0; i < ${MAX_SEED_LIGHTS}; i++) {
    if (i >= uSeedCount) break;
    if (i == skip) continue;
    vec4 s = uSeeds[i];
    vec3 d = s.xyz - P;
    float l2 = dot(d, d);
    if (l2 > 9.0) continue;
    float l = sqrt(l2);
    occ += (s.w * s.w / l2) * clamp(dot(N, d / l) * 0.75 + 0.25, 0.0, 1.0);
  }
  return clamp(1.0 - occ * 0.85, 0.2, 1.0);
}

vec3 envColor(vec3 R) {
  float up = clamp(R.y * 0.5 + 0.5, 0.0, 1.0);
  return mix(uGround, uSky, smoothstep(0.35, 0.9, up));
}

vec3 shade(Material m, vec3 P, vec3 N, vec3 V, float shadow) {
  vec3 L;
  vec3 light = keyLight(P, L) * shadow;
  float NoV = max(dot(N, V), 1e-3);
  vec3 color = vec3(0.0);

  float NoL = dot(N, L);
  if (NoL > 0.0) {
    vec3 H = normalize(L + V);
    float NoH = max(dot(N, H), 0.0);
    float VoH = max(dot(V, H), 0.0);
    float a = m.rough * m.rough;
    vec3 specColor = mix(vec3(1.0), m.albedo, m.metal);
    vec3 base = ggx(NoH, a) * smithVisibility(NoV, NoL, a) * fresnel(m.f0, VoH) * specColor;
    float ca = m.coatRough * m.coatRough;
    float coatF = fresnel(0.045, VoH) * m.coat;
    float coat = ggx(NoH, ca) * smithVisibility(NoV, NoL, ca) * coatF;
    color += light * NoL * (m.albedo / PI * (1.0 - coatF) * (1.0 - m.metal) + base + coat);
  }

  // The book's glow: a small warm light near the table, no shadow.
  vec3 g = uGlowPos - P;
  float gl2 = dot(g, g);
  float gNoL = max(dot(N, g * inversesqrt(gl2)), 0.0);
  color += uGlowColor * m.albedo / PI * gNoL / (1.0 + gl2 / 90.0) * (1.0 - m.metal * 0.6);

  // Ambient: sky above, the table's bounce below, and the sky reflected in the finish.
  vec3 hemi = mix(uGround, uSky, N.y * 0.5 + 0.5);
  color += m.albedo * hemi * m.ao * (1.0 - m.metal);
  color += m.sheen * hemi * m.ao * pow(1.0 - NoV, 3.0);
  vec3 R = reflect(-V, N);
  float envF = fresnel(0.045, NoV) * m.coat * (1.0 - m.coatRough);
  color += envColor(R) * envF * m.ao;
  color += envColor(R) * m.albedo * m.metal * fresnel(m.f0, NoV) * (1.0 - m.rough) * m.ao * 1.6;
  return color + m.emissive;
}

vec3 aces(vec3 x) {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}

vec4 finish(vec3 color, float alpha) {
  vec2 uv = gl_FragCoord.xy / uResolution;
  float vignette = 1.0 - uVignette * pow(length((uv - 0.5) * vec2(1.0, 0.8)) * 1.25, 2.4);
  vec3 mapped = aces(color * uExposure * vignette);
  vec3 srgb = pow(mapped, vec3(1.0 / 2.2));
  srgb += (hash31(vec3(gl_FragCoord.xy, 7.0)) - 0.5) / 255.0;
  return vec4(srgb, alpha);
}
`;

/* ---------- The board ---------- */

export const BOARD_VERT = /* glsl */ `${HEADER}
layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec3 aNormal;
layout(location = 2) in vec4 aInfo;
uniform mat4 uViewProj;
out vec3 vPos;
out vec3 vNormal;
out vec4 vInfo;
void main() {
  vPos = aPosition;
  vNormal = aNormal;
  vInfo = aInfo;
  gl_Position = uViewProj * vec4(aPosition, 1.0);
}
`;

export const BOARD_FRAG = /* glsl */ `${HEADER}
${NOISE}
${LIGHTING}
in vec3 vPos;
in vec3 vNormal;
in vec4 vInfo;
out vec4 outColor;

const float HALF_WIDTH = ${f(BOARD.halfWidth)};
const float TOP = ${f(BOARD.top)};

/*
 * Solid wood: growth rings around a log axis that runs the length of the
 * board, low and a little tilted. The flat top cuts the rings into long
 * arches; every carved hollow cuts down through them into rings of its own.
 */
vec3 woodAlbedo(vec3 p, out float latewood) {
  vec2 axis = vec2(-13.0 + 0.04 * p.x, 2.5 - 0.03 * p.x);
  float warp = 2.6 * gnoise(p * vec3(0.02, 0.1, 0.1)) + 0.35 * gnoise(p * vec3(0.06, 0.35, 0.35));
  float r = length(p.yz - axis) + warp;
  float ring = fract(r * 2.0);
  // Each ring: pale earlywood that darkens slowly into a thin latewood band, then a sharp step to the next year.
  latewood = smoothstep(0.35, 0.92, ring) * (1.0 - smoothstep(0.93, 1.0, ring));
  float year = floor(r * 2.0);
  float yearTone = hash31(vec3(year, 1.0, 2.0));
  float fibre = gnoise(vec3(p.x * 0.1, p.y * 6.0, p.z * 6.0)) * 0.5 + 0.5;
  float fine = gnoise(vec3(p.x * 0.6, p.y * 40.0, p.z * 40.0));
  float pores = smoothstep(0.35, 0.85, gnoise(vec3(p.x * 0.35, p.y * 22.0, p.z * 22.0)));
  vec3 early = vec3(0.225, 0.092, 0.04);
  vec3 late = vec3(0.096, 0.032, 0.013);
  vec3 col = mix(early, late, latewood * (0.3 + 0.28 * yearTone));
  col *= 0.86 + 0.22 * fibre + 0.05 * fine;
  col *= 1.0 - pores * 0.16;
  // Broad streaks of heartwood colour, warmer and cooler.
  float streak = gnoise(p * vec3(0.01, 0.07, 0.07));
  col *= 0.86 + 0.26 * smoothstep(-0.6, 0.6, streak);
  col = mix(col, col * vec3(1.1, 0.9, 0.8), smoothstep(0.0, 0.5, streak) * 0.6);
  return col;
}

/* Diamond chip-carving along the sides: each pocket has four facets sloping to its centre. */
vec3 chipCarving(vec3 N, float u, float y, out float pocket) {
  pocket = 0.0;
  float lo = 2.15;
  float hi = 4.35;
  if (y < lo - 0.25 || y > hi + 0.25) return N;
  vec3 T = normalize(cross(vec3(0.0, 1.0, 0.0), N));
  vec3 B = vec3(0.0, 1.0, 0.0);
  // Incised lines above and below the band.
  float line = max(1.0 - smoothstep(0.0, 0.07, abs(y - (lo - 0.18))), 1.0 - smoothstep(0.0, 0.07, abs(y - (hi + 0.18))));
  if (y < lo || y > hi) {
    pocket = line * 0.6;
    return normalize(N + B * sign(y - (lo + hi) * 0.5) * line * 0.6);
  }
  float width = 2.6;
  float a = (fract(u / width) - 0.5) * 2.0;
  float b = ((y - lo) / (hi - lo) - 0.5) * 2.0;
  float inside = abs(a) + abs(b);
  if (inside > 0.94) return N;
  pocket = 1.0 - inside;
  vec2 tilt = -vec2(sign(a), sign(b)) * 0.75;
  return normalize(N + T * tilt.x + B * tilt.y);
}

void main() {
  vec3 N = normalize(vNormal);
  vec3 P = vPos;
  vec3 V = normalize(uCamPos - P);
  float region = vInfo.x;
  float rho = vInfo.y;
  float store = vInfo.z;

  float latewood;
  vec3 albedo = woodAlbedo(P, latewood);

  float inHollow = 1.0 - smoothstep(0.9, 1.02, rho);
  float depth = inHollow * clamp(1.0 - rho, 0.0, 1.0);
  float rim = smoothstep(0.78, 0.98, rho) * (1.0 - smoothstep(1.0, 1.35, rho));

  // Fine grain relief: latewood stands a hair proud of the polished surface.
  vec3 grain = vec3(gnoise(P * vec3(0.3, 9.0, 9.0)), 0.0, gnoise(P * vec3(0.3, 9.0, 9.0) + 11.0));
  N = normalize(N + grain * 0.035 + vec3(0.0, 0.0, 0.0));

  float pocket = 0.0;
  if (region > 0.5 && region < 1.5) N = chipCarving(N, vInfo.w, P.y, pocket);

  // Where hands rest: the long edges and the rims are darker with oil and shinier with use.
  float handNoise = gnoise(P * vec3(0.08, 0.3, 0.3)) * 0.5 + 0.5;
  float edgeWear = smoothstep(HALF_WIDTH - 3.4, HALF_WIDTH - 0.4, abs(P.z)) * (0.55 + 0.45 * handNoise);
  float wear = clamp(max(edgeWear, rim * 0.85) * step(region, 0.5), 0.0, 1.0);
  albedo *= mix(1.0, 0.8, wear * 0.7);
  // Old wood darkens toward its ends and outer edges, where it is handled and where dust settles.
  float ends = smoothstep(18.0, 32.0, abs(P.x)) * 0.18 + smoothstep(HALF_WIDTH - 1.6, HALF_WIDTH, abs(P.z)) * 0.12;
  albedo *= 1.0 - ends;
  // Hollows: a little grime toward the bottom, and the dull cut of the gouge instead of polish.
  albedo *= mix(1.0, 0.7, depth * 0.85);
  albedo *= 1.0 - pocket * 0.45;
  if (region > 1.5) albedo *= 0.55;

  float ao = 1.0 - depth * 0.62 - pocket * 0.35;
  if (region > 1.5) ao *= 0.35;
  ao *= seedOcclusion(P, N, -1);

  Material m = material(albedo);
  m.rough = 0.7;
  m.f0 = 0.03;
  m.coat = mix(1.0, 0.22, inHollow);
  m.coatRough = mix(0.4, 0.28, wear);
  m.coatRough = mix(m.coatRough, 0.5, inHollow);
  m.ao = ao;

  float shadow = shadowAt(P, N);
  outColor = finish(shade(m, P, N, V, shadow), 1.0);
}
`;

/* ---------- The table ---------- */

export const TABLE_VERT = /* glsl */ `${HEADER}
layout(location = 0) in vec3 aPosition;
uniform mat4 uViewProj;
out vec3 vPos;
void main() {
  vPos = aPosition;
  gl_Position = uViewProj * vec4(aPosition, 1.0);
}
`;

export const TABLE_FRAG = /* glsl */ `${HEADER}
${NOISE}
${LIGHTING}
in vec3 vPos;
out vec4 outColor;
uniform float uNight;
uniform vec4 uBookBox;

const float HALF_LENGTH = ${f(BOARD.halfLength)};
const float HALF_WIDTH = ${f(BOARD.halfWidth)};
const float CORNER = ${f(BOARD.cornerRadius)};

float outlineDistance(vec2 p) {
  vec2 q = abs(p) - vec2(HALF_LENGTH - CORNER, HALF_WIDTH - CORNER);
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - CORNER;
}

float boxDistance(vec2 p, vec4 box) {
  vec2 c = box.xy;
  vec2 d = p - c;
  float a = box.w;
  vec2 r = vec2(cos(a) * d.x + sin(a) * d.y, -sin(a) * d.x + cos(a) * d.y);
  vec2 q = abs(r) - vec2(box.z, 6.6);
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
}

/* By day: a lime-washed stone table top, mottled and pitted. */
vec3 stone(vec3 p, out float rough) {
  float broad = fbm(vec3(p.xz * 0.018, 2.0));
  float mid = fbm(vec3(p.xz * 0.09, 5.0));
  float specks = smoothstep(0.62, 0.85, gnoise(vec3(p.xz * 1.6, 9.0)));
  vec3 col = vec3(0.6, 0.53, 0.43);
  col *= 0.9 + 0.16 * broad + 0.08 * mid;
  col = mix(col, vec3(0.66, 0.6, 0.52), smoothstep(0.1, 0.5, broad) * 0.5);
  col *= 1.0 - specks * 0.28;
  rough = 0.82;
  return col;
}

/* By night: a woven indigo cloth. */
vec3 cloth(vec3 p, out float rough, out float sheen) {
  vec2 q = p.xz * 5.2;
  float warp = 0.5 + 0.5 * sin(q.x * 3.14159);
  float weft = 0.5 + 0.5 * sin(q.y * 3.14159);
  float over = step(0.5, fract(floor(q.x) * 0.5 + floor(q.y) * 0.5));
  float thread = mix(warp, weft, over);
  float slub = gnoise(vec3(p.x * 0.4, p.z * 7.0, 3.0)) * 0.5 + 0.5;
  vec3 col = vec3(0.011, 0.018, 0.068) * (0.75 + 0.35 * thread) * (0.85 + 0.3 * slub);
  col *= 0.9 + 0.2 * fbm(vec3(p.xz * 0.03, 1.0));
  rough = 0.95;
  sheen = 0.06;
  return col;
}

void main() {
  vec3 P = vPos;
  vec3 N = vec3(0.0, 1.0, 0.0);
  vec3 V = normalize(uCamPos - P);
  float rough = 0.85;
  float sheen = 0.0;
  vec3 albedo = uNight > 0.5 ? cloth(P, rough, sheen) : stone(P, rough);

  // Contact shadows: the board and the book press into the table's ambient light.
  float board = outlineDistance(P.xz);
  float book = boxDistance(P.xz, uBookBox);
  float ao = mix(0.25, 1.0, smoothstep(-0.6, 5.5, board));
  ao *= mix(0.35, 1.0, smoothstep(-0.3, 3.0, book));

  Material m = material(albedo);
  m.rough = rough;
  m.f0 = 0.02;
  m.coatRough = 1.0;
  m.ao = ao;
  m.sheen = sheen;
  float shadow = shadowAt(P, N);
  outColor = finish(shade(m, P, N, V, shadow), 1.0);
}
`;

/* ---------- Seeds ---------- */

export const SEED_VERT = /* glsl */ `${HEADER}
layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec3 iCentre;
layout(location = 2) in vec4 iRotation;
layout(location = 3) in vec3 iShape;
layout(location = 4) in vec3 iColor;
layout(location = 5) in vec4 iLook;
uniform mat4 uViewProj;
out vec3 vPos;
out vec3 vNormal;
out vec3 vLocal;
out vec3 vColor;
out vec4 vLook;
flat out int vIndex;

vec3 rotate(vec4 q, vec3 v) {
  vec3 t = 2.0 * cross(q.xyz, v);
  return v + q.w * t + cross(q.xyz, t);
}

void main() {
  // A slightly egg-shaped ellipsoid: one end a touch fuller than the other.
  vec3 local = aPosition;
  local.x *= 1.0 + iLook.z * local.x;
  vec3 scaled = local * iShape;
  vec3 normal = normalize(aPosition / iShape);
  vPos = iCentre + rotate(iRotation, scaled);
  vNormal = rotate(iRotation, normal);
  vLocal = aPosition;
  vColor = iColor;
  vLook = iLook;
  vIndex = gl_InstanceID;
  gl_Position = uViewProj * vec4(vPos, 1.0);
}
`;

export const SEED_FRAG = /* glsl */ `${HEADER}
${NOISE}
${LIGHTING}
in vec3 vPos;
in vec3 vNormal;
in vec3 vLocal;
in vec3 vColor;
in vec4 vLook;
flat in int vIndex;
out vec4 outColor;
uniform int uSeedOffset;
uniform float uGhost;
uniform vec3 uGhostColor;
uniform float uGhostCover;

void main() {
  vec3 N = normalize(vNormal);
  vec3 V = normalize(uCamPos - vPos);
  if (uGhost > 0.5) {
    // A remembered seed: no body, only a rim of light, drawn with a screen blend.
    float rim = pow(1.0 - max(dot(N, V), 0.0), 1.8);
    float a = (0.5 + 0.5 * rim) * (1.0 - vLook.w) * mix(0.55, 1.0, uGhostCover);
    vec3 c = mix(uGhostColor, vec3(1.0), mix(0.12, 0.35, uGhostCover) * (1.0 - rim));
    // By day the ghost covers what is behind it like coloured glass; at night it only adds light.
    outColor = vec4(c * a, a * uGhostCover * 0.8);
    return;
  }
  float variety = vLook.x;
  // Mottling and faint growth bands, different on every seed.
  vec3 q = vLocal * 2.6 + variety * 37.0;
  float mottle = fbm(q);
  float bands = 0.5 + 0.5 * sin(vLocal.y * 22.0 + gnoise(q * 1.7) * 3.0);
  vec3 albedo = vColor * (0.82 + 0.34 * mottle);
  albedo *= 0.94 + 0.08 * bands;
  float freckle = smoothstep(0.5, 0.75, gnoise(vLocal * 9.0 + variety * 13.0));
  albedo = mix(albedo, albedo * 0.55, freckle * vLook.y);
  // The hilum, the scar where the seed hung in its pod: a small dark mark at one end.
  float hilum = smoothstep(0.24, 0.12, length(vLocal - vec3(0.97, 0.0, 0.0)));
  albedo = mix(albedo, vec3(0.03, 0.02, 0.015), hilum * 0.85);

  Material m = material(albedo);
  m.rough = 0.5;
  m.coat = 1.0;
  m.coatRough = 0.2 + 0.08 * mottle;
  m.ao = seedOcclusion(vPos, N, vIndex + uSeedOffset) * mix(0.7, 1.0, N.y * 0.5 + 0.5);
  float shadow = shadowAt(vPos, N);
  outColor = finish(shade(m, vPos, N, V, shadow), 1.0 - vLook.w);
}
`;

/* ---------- Depth only, for the shadow map ---------- */

export const DEPTH_VERT = /* glsl */ `${HEADER}
layout(location = 0) in vec3 aPosition;
uniform mat4 uLightViewProj;
void main() {
  gl_Position = uLightViewProj * vec4(aPosition, 1.0);
}
`;

export const SEED_DEPTH_VERT = /* glsl */ `${HEADER}
layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec3 iCentre;
layout(location = 2) in vec4 iRotation;
layout(location = 3) in vec3 iShape;
layout(location = 5) in vec4 iLook;
uniform mat4 uLightViewProj;
vec3 rotate(vec4 q, vec3 v) {
  vec3 t = 2.0 * cross(q.xyz, v);
  return v + q.w * t + cross(q.xyz, t);
}
void main() {
  vec3 local = aPosition;
  local.x *= 1.0 + iLook.z * local.x;
  gl_Position = uLightViewProj * vec4(iCentre + rotate(iRotation, local * iShape), 1.0);
}
`;

export const DEPTH_FRAG = /* glsl */ `${HEADER}
void main() {}
`;

/* ---------- The Memory Book ---------- */

const SHEET_SHAPE = /* glsl */ `
/* A turning page: it leaves the right stack at the gutter and bends as it lifts, its edge trailing. */
vec3 sheetShape(vec2 uv, float turn, vec2 size, out vec3 normal) {
  float s = uv.x * size.x;
  float a0 = 3.14159265 * turn;
  float k = -sin(3.14159265 * turn) * 0.21;
  float a = a0 + k * s;
  vec2 xy = abs(k) < 1e-3 ? s * vec2(cos(a0), sin(a0)) : vec2(sin(a) - sin(a0), cos(a0) - cos(a)) / k;
  normal = vec3(-sin(a), cos(a), 0.0);
  return vec3(xy, (uv.y - 0.5) * size.y);
}
`;

export const BOOK_VERT = /* glsl */ `${HEADER}
layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec3 aNormal;
layout(location = 2) in vec2 aUv;
uniform mat4 uViewProj;
uniform mat4 uModel;
uniform int uSheet;
uniform float uTurn;
uniform vec2 uPageSize;
out vec3 vPos;
out vec3 vNormal;
out vec2 vUv;
out vec3 vLocal;
${SHEET_SHAPE}
void main() {
  vec3 p = aPosition;
  vec3 n = aNormal;
  if (uSheet == 1) p = sheetShape(aUv, uTurn, uPageSize, n);
  vec4 world = uModel * vec4(p, 1.0);
  vPos = world.xyz;
  vNormal = mat3(uModel) * n;
  vUv = aUv;
  vLocal = p;
  gl_Position = uViewProj * world;
}
`;

export const BOOK_FRAG = /* glsl */ `${HEADER}
${NOISE}
${LIGHTING}
in vec3 vPos;
in vec3 vNormal;
in vec2 vUv;
in vec3 vLocal;
out vec4 outColor;
uniform int uMaterial;
uniform sampler2D uPages;
uniform float uBookGlow;
uniform vec4 uGlowRect;
uniform vec3 uGlowTint;

/* Leather: a pebbled grain and a tooled line just inside the edge of each cover. */
Material leather(inout vec3 N) {
  float pebble = gnoise(vPos * 3.2) * 0.6 + gnoise(vPos * 9.0) * 0.4;
  N = normalize(N + vec3(gnoise(vPos * 6.0 + 3.0), 0.0, gnoise(vPos * 6.0 + 7.0)) * 0.12);
  vec3 col = vec3(0.016, 0.05, 0.04) * (0.85 + 0.3 * pebble);
  vec2 face = vLocal.xz;
  float inset = min(min(face.x, 1.0 - face.x) * 10.0, min(face.y, 1.0 - face.y) * 13.6);
  float tooled = 1.0 - smoothstep(0.0, 0.05, abs(inset - 0.62));
  float onFace = step(0.5, abs(N.y));
  col *= 1.0 - tooled * 0.55 * onFace;
  Material m = material(col);
  m.rough = 0.55;
  m.coat = 0.5;
  m.coatRough = 0.42 + 0.1 * pebble;
  m.sheen = 0.02;
  return m;
}

Material brass() {
  float tarnish = smoothstep(-0.2, 0.7, gnoise(vPos * 2.4));
  vec3 col = mix(vec3(0.78, 0.55, 0.22), vec3(0.42, 0.33, 0.16), tarnish * 0.6);
  Material m = material(col);
  m.metal = 1.0;
  m.f0 = 0.85;
  m.rough = 0.3 + tarnish * 0.18;
  return m;
}

Material paper(vec2 uv, bool printed) {
  vec3 col = vec3(0.6, 0.52, 0.37);
  float fibre = gnoise(vec3(uv * vec2(160.0, 220.0), 1.0)) * 0.5 + 0.5;
  col *= 0.95 + 0.06 * fibre;
  // Older at the edges: the paper browns where thumbs turn it.
  float edge = min(min(uv.x, 1.0 - uv.x) * 2.0, min(uv.y, 1.0 - uv.y));
  col *= mix(0.86, 1.0, smoothstep(0.0, 0.12, edge));
  float ink = 0.0;
  if (printed) {
    vec4 t = texture(uPages, uv);
    ink = t.a;
    col = mix(col, pow(t.rgb, vec3(2.2)), t.a);
  }
  Material m = material(col);
  m.rough = 0.85;
  // The remembered entry glows from inside the page.
  vec2 c = (uGlowRect.xy + uGlowRect.zw) * 0.5;
  vec2 r = (uGlowRect.zw - uGlowRect.xy) * 0.5;
  float inRect = 1.0 - smoothstep(0.75, 1.15, length((uv - c) / max(r, vec2(1e-3))));
  m.emissive = uGlowTint * uBookGlow * (0.06 + 0.7 * inRect) * mix(1.0, 0.5, ink);
  return m;
}

void main() {
  vec3 N = normalize(vNormal);
  if (!gl_FrontFacing) N = -N;
  vec3 V = normalize(uCamPos - vPos);
  Material m;
  if (uMaterial == 0) m = leather(N);
  else if (uMaterial == 1) m = brass();
  else if (uMaterial == 3 && vUv.x < -0.5) {
    // The page block's edges: hundreds of sheets as fine stripes.
    float sheets = 0.5 + 0.5 * sin(vUv.y * 220.0 + gnoise(vPos * 4.0) * 2.0);
    m = material(vec3(0.62, 0.53, 0.37) * (0.82 + 0.18 * sheets));
    m.rough = 0.9;
  } else if (uMaterial == 3) m = paper(vUv, true);
  else m = paper(vec2(1.0 - vUv.x * 0.5, vUv.y), false);
  float shadow = shadowAt(vPos, N);
  outColor = finish(shade(m, vPos, N, V, shadow), 1.0);
}
`;

export const BOOK_DEPTH_VERT = /* glsl */ `${HEADER}
layout(location = 0) in vec3 aPosition;
layout(location = 2) in vec2 aUv;
uniform mat4 uLightViewProj;
uniform mat4 uModel;
uniform int uSheet;
uniform float uTurn;
uniform vec2 uPageSize;
${SHEET_SHAPE}
void main() {
  vec3 p = aPosition;
  vec3 n;
  if (uSheet == 1) p = sheetShape(aUv, uTurn, uPageSize, n);
  gl_Position = uLightViewProj * uModel * vec4(p, 1.0);
}
`;

/* ---------- Light effects: glows, motes, markers on the board ---------- */

export const SPRITE_VERT = /* glsl */ `${HEADER}
layout(location = 0) in vec2 aCorner;
layout(location = 1) in vec4 iCentre;
layout(location = 2) in vec4 iColor;
layout(location = 3) in vec4 iShape;
uniform mat4 uViewProj;
uniform vec3 uCamRight;
uniform vec3 uCamUp;
out vec2 vCorner;
out vec4 vColor;
out vec4 vShape;
void main() {
  // iShape.x: 0 glow facing the camera, 1 ring lying on the board, 2 dot lying on the board, 3 sparkle,
  // 4 a soft shadow lying on the board.
  // iShape.y stretches a flat marker along z (stores are long); iShape.z is a ring radius.
  vec2 c = aCorner;
  bool facing = iShape.x < 0.5 || (iShape.x > 2.5 && iShape.x < 3.5);
  vec3 p = facing
    ? iCentre.xyz + (uCamRight * c.x + uCamUp * c.y) * iCentre.w
    : iCentre.xyz + vec3(c.x, 0.0, c.y * iShape.y) * iCentre.w;
  vCorner = c;
  vColor = iColor;
  vShape = iShape;
  gl_Position = uViewProj * vec4(p, 1.0);
}
`;

export const SPRITE_FRAG = /* glsl */ `${HEADER}
in vec2 vCorner;
in vec4 vColor;
in vec4 vShape;
out vec4 outColor;
void main() {
  float r = length(vCorner);
  float a;
  if (vShape.x < 0.5) a = exp(-r * r * 3.2) * (1.0 - smoothstep(0.85, 1.0, r));
  else if (vShape.x < 1.5) a = smoothstep(vShape.z - 0.14, vShape.z, r) * (1.0 - smoothstep(vShape.z + 0.02, vShape.z + 0.16, r)) + 0.12 * (1.0 - smoothstep(0.0, vShape.z, r));
  else if (vShape.x < 2.5) a = 1.0 - smoothstep(0.55, 0.95, r);
  else if (vShape.x > 3.5) a = exp(-r * r * 4.5) * (1.0 - smoothstep(0.8, 1.0, r));
  else {
    float star = max(1.0 - abs(vCorner.x) * 9.0, 0.0) * (1.0 - abs(vCorner.y)) + max(1.0 - abs(vCorner.y) * 9.0, 0.0) * (1.0 - abs(vCorner.x));
    a = clamp(star + exp(-r * r * 18.0), 0.0, 1.0);
  }
  if (a < 0.002) discard;
  // Premultiplied colour; alpha is zero for glows (they add light) and the coverage for markers.
  outColor = vec4(vColor.rgb * a * vColor.a, a * vColor.a * vShape.w);
}
`;
