import { useEffect, useRef } from 'react';
import type { MirrorMode, BodyEffect } from '@/types/mirror';

interface MirrorCanvasProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  mirrorMode: MirrorMode;
  bodyEffect: BodyEffect;
  brightness: number;
  zoom: number;
}

/**
 * WebGL-based live mirror renderer.
 *
 * Reads frames from the hidden <video> element (the live camera stream) and
 * draws them to a full-screen canvas with:
 *  - horizontal flip (Real Mirror) or pass-through (True View)
 *  - subtle barrel distortion for Slim / Bulky / Wide body effects
 *  - brightness uniform
 *  - zoom (crop)
 *
 * The face region is preserved by damping distortion toward the vertical
 * center band (top ~25% of the frame), so body effects mostly affect the torso.
 */
const VERT_SRC = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

const FRAG_SRC = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D uTex;
uniform float uFlip;        // 1.0 = mirror, 0.0 = true view
uniform float uDistortion;  // signed horizontal squash/stretch factor
uniform float uBrightness;
uniform float uZoom;        // 1.0 = no zoom, >1 = zoomed in

void main() {
  // Apply zoom by sampling a sub-rect centered on the frame.
  vec2 uv = vUv;
  vec2 centered = uv - 0.5;
  uv = centered / uZoom + 0.5;

  // Correct the source orientation: the camera texture arrives upside down,
  // so flip the vertical axis. This makes the head appear at the top and
  // feet at the bottom. Applied to the video layer only — the UI is untouched.
  uv.y = 1.0 - uv.y;

  // Horizontal flip for mirror mode (applied once, on top of the upright base).
  uv.x = mix(uv.x, 1.0 - uv.x, uFlip);

  // Discard out-of-bounds pixels from zoom (show dark border).
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }

  // Body distortion: horizontal squash/stretch, dampened near the top of the
  // frame (face area) so the face stays natural. Only the torso is affected.
  // The offset is computed from the displayed (post-zoom, post-flip) position
  // so the effect stays symmetric and consistent in both mirror modes.
  float d = uDistortion;
  if (d != 0.0) {
    // vUv.y = 0 at top, 1 at bottom. Face ~ top 25%. Weight ramps 0..1 below it.
    float faceZone = smoothstep(0.18, 0.42, vUv.y);
    float k = d * faceZone;
    float dispCenteredX = uv.x - 0.5;
    uv.x = clamp(uv.x + dispCenteredX * k, 0.0, 1.0);
  }

  vec4 col = texture2D(uTex, uv);
  col.rgb *= uBrightness;
  gl_FragColor = col;
}
`;

function createShader(gl: WebGLRenderingContext, type: number, src: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createProgram(gl: WebGLRenderingContext): WebGLProgram | null {
  const vs = createShader(gl, gl.VERTEX_SHADER, VERT_SRC);
  const fs = createShader(gl, gl.FRAGMENT_SHADER, FRAG_SRC);
  if (!vs || !fs) return null;
  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(program));
    return null;
  }
  return program;
}

// Map body effects to distortion strength.
//
// Sampling math: uv.x = uv.x + dispCenteredX * k  =>  effective sample slope
// across the output is (1 + d). A slope > 1 compresses the source (samples a
// wider region into the same output width) => body looks NARROWER. A slope < 1
// stretches the source => body looks WIDER. So:
//   slim   => d > 0 (compress)    bulky/wide => d < 0 (stretch)
function distortionFor(effect: BodyEffect): number {
  switch (effect) {
    case 'slim':
      return 0.12;
    case 'bulky':
      return -0.12;
    case 'wide':
      return -0.06;
    case 'original':
    default:
      return 0.0;
  }
}

export function MirrorCanvas({
  videoRef,
  mirrorMode,
  bodyEffect,
  brightness,
  zoom,
}: MirrorCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<WebGLRenderingContext | null>(null);
  const programRef = useRef<WebGLProgram | null>(null);
  const textureRef = useRef<WebGLTexture | null>(null);
  const uniformsRef = useRef<Record<string, WebGLUniformLocation | null>>({});
  const rafRef = useRef<number>(0);

  // Keep latest props in a ref so the render loop reads fresh values without re-subscribing.
  const stateRef = useRef({ mirrorMode, bodyEffect, brightness, zoom });
  stateRef.current = { mirrorMode, bodyEffect, brightness, zoom };

  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const gl = canvas.getContext('webgl', {
      antialias: true,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
    }) as WebGLRenderingContext | null;
    if (!gl) return;

    glRef.current = gl;
    const program = createProgram(gl);
    if (!program) return;
    programRef.current = program;
    gl.useProgram(program);

    // Fullscreen quad
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    const posLoc = gl.getAttribLocation(program, 'aPos');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    // Texture from video
    const texture = gl.createTexture();
    textureRef.current = texture;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    // placeholder so the texture is complete before the video has data
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    uniformsRef.current = {
      uFlip: gl.getUniformLocation(program, 'uFlip'),
      uDistortion: gl.getUniformLocation(program, 'uDistortion'),
      uBrightness: gl.getUniformLocation(program, 'uBrightness'),
      uZoom: gl.getUniformLocation(program, 'uZoom'),
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.floor(window.innerWidth * dpr);
      const h = Math.floor(window.innerHeight * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
    };
    resize();
    window.addEventListener('resize', resize);

    const render = () => {
      rafRef.current = requestAnimationFrame(render);
      if (video.readyState >= video.HAVE_CURRENT_DATA) {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        try {
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
        } catch {
          // video not ready yet this frame
        }
      }
      const u = uniformsRef.current;
      const s = stateRef.current;
      gl.uniform1f(u.uFlip, s.mirrorMode === 'mirror' ? 1.0 : 0.0);
      gl.uniform1f(u.uDistortion, distortionFor(s.bodyEffect));
      gl.uniform1f(u.uBrightness, s.brightness);
      gl.uniform1f(u.uZoom, s.zoom);
      gl.clearColor(0.02, 0.02, 0.02, 1.0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    };
    render();

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
      gl.deleteTexture(texture);
      gl.deleteBuffer(buffer);
      if (program) gl.deleteProgram(program);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoRef]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 h-full w-full"
      style={{ display: 'block' }}
    />
  );
}
