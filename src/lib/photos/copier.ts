// The copier (#37): runs a photo through a xerox look in the browser, once,
// when it's added. Ported from the Xerox Lab shader: grayscale, crushed
// contrast, a dithered threshold, toner speckle, copier streaks, and an
// optional misregistered ink plate. One WebGL context for the whole page.
//
// Browser only. Nothing here leaves the device until it's uploaded.

import type { CopierSettings, Plate } from "./settings";

/** The kept original: big enough to re-copy later, no EXIF. */
export const ORIGINAL_MAX = 1600;
/** The copy we show. Grain is one pixel, so this sets how coarse it looks. */
export const COPY_MAX = 800;

const PLATE_RGB: Record<Plate, [number, number, number]> = {
  none: [1, 1, 1],
  cyan: [0, 0.706, 0.902], // --plate-cyan #00b4e6
  magenta: [1, 0.251, 0.651], // --plate-magenta #ff40a6
  yellow: [1, 0.898, 0], // --plate-yellow #ffe500
};

const VERTEX = "attribute vec2 p;varying vec2 uv;void main(){uv=p*.5+.5;gl_Position=vec4(p,0.,1.);}";

const FRAGMENT = `
precision mediump float;
varying vec2 uv;
uniform sampler2D t;
uniform vec2 res;
uniform float exposure, contrast, toner, mis, seed, plateOn;
uniform vec3 plate;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7))+seed*13.7)*43758.5453);}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
float ink(vec2 q){
  vec3 c=texture2D(t,q).rgb;
  float l=dot(c,vec3(.299,.587,.114));
  l=(l+exposure-.5)*contrast+.5;                          // lighter/darker, then contrast
  l+=(vn(vec2(q.y*res.y*.035,seed))-.5)*.22;              // copier streaks
  l-=smoothstep(.62,.95,length((q-.5)*vec2(1.,.9)))*.35;  // dark copier edges
  vec2 px=floor(q*res);
  float g=h(px);
  float th=.5+(g-.5)*.38;
  float k=smoothstep(th+.05,th-.05,l);
  float sp=step(1.-toner*.025,h(floor(q*res*.5)+7.));     // toner speckle
  float blot=step(.86,vn(q*res*.04+seed))*step(1.-toner*.6,h(px+3.));
  k=max(k,max(sp,blot*.9));
  k*=1.-step(1.-toner*.03,h(px+11.));                     // dropout
  return clamp(k,0.,1.);
}
void main(){
  vec3 paper=vec3(.984,.980,.961), inkc=vec3(.078);       // --paper-photo, --ink-900
  float k=ink(uv);
  float p=ink(uv+vec2(mis/res.x,-mis*.55/res.y));
  vec3 col=mix(paper,paper*plate,p*plateOn*.92);
  col=mix(col,inkc,k);
  gl_FragColor=vec4(col,1.);
}`;

type Gl = {
  gl: WebGLRenderingContext;
  canvas: HTMLCanvasElement;
  tex: WebGLTexture;
  u: Record<string, WebGLUniformLocation | null>;
};

let shared: Gl | null | undefined;

function setup(): Gl | null {
  if (shared !== undefined) return shared;
  shared = null;
  const canvas = document.createElement("canvas");
  const gl = canvas.getContext("webgl", { preserveDrawingBuffer: true, premultipliedAlpha: false });
  if (!gl) return null;
  const compile = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? "shader");
    return s;
  };
  try {
    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERTEX));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAGMENT));
    gl.linkProgram(prog);
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const u: Gl["u"] = {};
    for (const n of ["t", "res", "exposure", "contrast", "toner", "mis", "seed", "plateOn", "plate"]) u[n] = gl.getUniformLocation(prog, n);
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    shared = { gl, canvas, tex, u };
  } catch {
    shared = null;
  }
  return shared;
}

export function hasWebGL() {
  return setup() !== null;
}

/** Copies `source` (already at copy size) onto `target` with the settings. */
export function copy(source: HTMLCanvasElement, target: HTMLCanvasElement, s: CopierSettings) {
  target.width = source.width;
  target.height = source.height;
  const out = target.getContext("2d")!;
  const g = setup();
  if (!g) {
    // No WebGL: a plain high-contrast grayscale, so a photo can still be added.
    out.filter = `grayscale(1) brightness(${(1 + s.exposure).toFixed(2)}) contrast(${(s.contrast * 1.4).toFixed(2)})`;
    out.drawImage(source, 0, 0);
    out.filter = "none";
    return;
  }
  const { gl, canvas, tex, u } = g;
  canvas.width = source.width;
  canvas.height = source.height;
  gl.viewport(0, 0, source.width, source.height);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
  gl.uniform1i(u.t, 0);
  gl.uniform2f(u.res, source.width, source.height);
  gl.uniform1f(u.exposure, s.exposure);
  gl.uniform1f(u.contrast, s.contrast);
  gl.uniform1f(u.toner, s.grit);
  // Offset is set on a 600px-wide copy; keep it in proportion.
  gl.uniform1f(u.mis, Math.round((s.offset * Math.max(source.width, source.height)) / 600));
  gl.uniform1f(u.seed, s.seed % 1000);
  gl.uniform1f(u.plateOn, s.plate === "none" ? 0 : 1);
  gl.uniform3fv(u.plate, PLATE_RGB[s.plate]);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  out.drawImage(canvas, 0, 0);
}

/**
 * Draws an image into a canvas no bigger than `max` on its longest side.
 * Drawing to a canvas drops EXIF (location, camera) by itself; orientation
 * is applied first so phone photos come out upright.
 */
export async function loadImage(file: Blob, max: number): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas;
}

export function resize(source: HTMLCanvasElement, max: number) {
  const scale = Math.min(1, max / Math.max(source.width, source.height));
  if (scale === 1) return source;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(source.width * scale);
  canvas.height = Math.round(source.height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/** WebP where the browser can write it, otherwise JPEG. */
export async function encode(canvas: HTMLCanvasElement, quality: number): Promise<{ blob: Blob; ext: "webp" | "jpg" }> {
  const toBlob = (type: string) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
  const webp = await toBlob("image/webp");
  if (webp && webp.type === "image/webp") return { blob: webp, ext: "webp" };
  const jpeg = await toBlob("image/jpeg");
  if (!jpeg) throw new Error("Couldn't encode the photo.");
  return { blob: jpeg, ext: "jpg" };
}
