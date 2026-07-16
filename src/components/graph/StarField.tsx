import { useEffect, useRef } from 'react'
import * as THREE from 'three'

/**
 * Three.js starfield + nebula behind the node graph.
 *
 * Deliberately restrained: the graph is the content, this is atmosphere.
 * Two parallax layers of points over a slow-drifting fbm nebula, panned by
 * the React Flow viewport so the depth reads as real when you pan the canvas.
 *
 * Bails out entirely when the user prefers reduced motion, and pauses when
 * the tab is hidden or the canvas scrolls out of view.
 */

interface Props {
  /** React Flow viewport — drives parallax. */
  viewport: { x: number; y: number; zoom: number }
  className?: string
}

const NEBULA_FRAG = /* glsl */ `
precision highp float;
uniform float uTime;
uniform vec2 uResolution;
uniform vec2 uOffset;

// Value-noise fbm. Cheap, and at this opacity nobody can tell.
vec2 hash(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(dot(hash(i + vec2(0.0, 0.0)), f - vec2(0.0, 0.0)),
        dot(hash(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0)), u.x),
    mix(dot(hash(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0)),
        dot(hash(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0)), u.x),
    u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p *= 2.02;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y;
  vec2 p = uv * 1.7 + uOffset * 0.00018;

  float t = uTime * 0.012;
  float n = fbm(p + vec2(t, -t * 0.6));
  float n2 = fbm(p * 1.6 - vec2(t * 0.8, t * 0.4) + n);

  // Two clouds, blue and violet, biased to opposite corners.
  vec3 blue = vec3(0.13, 0.32, 0.85);
  vec3 violet = vec3(0.45, 0.20, 0.80);

  float cloudA = smoothstep(0.05, 0.62, n2 + 0.16) * smoothstep(1.25, 0.15, length(uv - vec2(0.55, 0.35)));
  float cloudB = smoothstep(0.10, 0.70, n + 0.10) * smoothstep(1.35, 0.20, length(uv + vec2(0.60, 0.42)));

  vec3 col = blue * cloudA * 0.34 + violet * cloudB * 0.26;

  // Vignette keeps the middle clean where the graph lives.
  float vig = smoothstep(0.15, 1.25, length(uv));
  col *= 0.45 + vig * 0.75;

  gl_FragColor = vec4(col, 1.0);
}
`

const NEBULA_VERT = /* glsl */ `
void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }
`

const STAR_VERT = /* glsl */ `
attribute float aSize;
attribute float aPhase;
attribute vec3 aColor;
uniform float uTime;
uniform float uZoom;
uniform vec2 uPan;
uniform float uDepth;
varying vec3 vColor;
varying float vAlpha;

void main() {
  vColor = aColor;

  vec3 pos = position;
  // Parallax: nearer layers move further per unit of pan.
  pos.xy += uPan * uDepth;

  // Wrap into a fixed box so panning never runs out of stars.
  pos.x = mod(pos.x + 1000.0, 2000.0) - 1000.0;
  pos.y = mod(pos.y + 1000.0, 2000.0) - 1000.0;

  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;

  float twinkle = 0.62 + 0.38 * sin(uTime * 1.1 + aPhase * 6.2831);
  vAlpha = twinkle * (0.35 + uDepth * 0.65);
  gl_PointSize = aSize * twinkle * (0.75 + uZoom * 0.45) * (300.0 / -mv.z);
}
`

const STAR_FRAG = /* glsl */ `
precision mediump float;
varying vec3 vColor;
varying float vAlpha;

void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  if (d > 0.5) discard;
  // Soft core + faint halo.
  float core = smoothstep(0.5, 0.0, d);
  float glow = smoothstep(0.5, 0.15, d);
  gl_FragColor = vec4(vColor, vAlpha * (core * 0.85 + glow * 0.35));
}
`

const STAR_TINTS: [number, number, number][] = [
  [1.0, 1.0, 1.0],
  [0.78, 0.87, 1.0],
  [0.62, 0.78, 1.0],
  [0.92, 0.85, 1.0],
  [1.0, 0.93, 0.82],
]

function makeStarLayer(count: number, depth: number, spread: number, sizeRange: [number, number]) {
  const geo = new THREE.BufferGeometry()
  const positions = new Float32Array(count * 3)
  const sizes = new Float32Array(count)
  const phases = new Float32Array(count)
  const colors = new Float32Array(count * 3)

  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * spread
    positions[i * 3 + 1] = (Math.random() - 0.5) * spread
    positions[i * 3 + 2] = -60 - depth * 140
    sizes[i] = sizeRange[0] + Math.random() * (sizeRange[1] - sizeRange[0])
    phases[i] = Math.random()
    const tint = STAR_TINTS[Math.floor(Math.random() * STAR_TINTS.length)]
    colors[i * 3] = tint[0]
    colors[i * 3 + 1] = tint[1]
    colors[i * 3 + 2] = tint[2]
  }

  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
  geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1))
  geo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3))
  return geo
}

export function StarField({ viewport, className }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  // Latest viewport without re-running the WebGL setup effect.
  const vpRef = useRef(viewport)
  vpRef.current = viewport

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: 'low-power' })
    } catch {
      return // No WebGL — the CSS gradient underneath is a fine fallback.
    }

    renderer.setClearColor(0x060b18, 1)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75))
    host.appendChild(renderer.domElement)
    renderer.domElement.style.display = 'block'
    renderer.domElement.style.width = '100%'
    renderer.domElement.style.height = '100%'

    /* Nebula — fullscreen triangle, drawn first with depth off. */
    const nebulaScene = new THREE.Scene()
    const nebulaCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    const nebulaUniforms = {
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uOffset: { value: new THREE.Vector2(0, 0) },
    }
    const nebulaMat = new THREE.ShaderMaterial({
      vertexShader: NEBULA_VERT,
      fragmentShader: NEBULA_FRAG,
      uniforms: nebulaUniforms,
      depthTest: false,
      depthWrite: false,
    })
    nebulaScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), nebulaMat))

    /* Stars — three parallax layers. */
    const starScene = new THREE.Scene()
    const starCam = new THREE.PerspectiveCamera(60, 1, 1, 2000)
    starCam.position.z = 100

    const layers = [
      { geo: makeStarLayer(420, 0.15, 1800, [1.2, 2.6]), depth: 0.15 },
      { geo: makeStarLayer(260, 0.45, 1800, [1.8, 3.6]), depth: 0.45 },
      { geo: makeStarLayer(120, 0.85, 1800, [2.6, 5.2]), depth: 0.85 },
    ]

    const starMats = layers.map(({ depth }) =>
      new THREE.ShaderMaterial({
        vertexShader: STAR_VERT,
        fragmentShader: STAR_FRAG,
        uniforms: {
          uTime: { value: 0 },
          uZoom: { value: 1 },
          uPan: { value: new THREE.Vector2(0, 0) },
          uDepth: { value: depth },
        },
        transparent: true,
        depthTest: false,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    )

    layers.forEach((l, i) => starScene.add(new THREE.Points(l.geo, starMats[i])))

    /* Sizing */
    const resize = () => {
      const { clientWidth: w, clientHeight: h } = host
      if (w === 0 || h === 0) return
      renderer.setSize(w, h, false)
      nebulaUniforms.uResolution.value.set(w * renderer.getPixelRatio(), h * renderer.getPixelRatio())
      starCam.aspect = w / h
      starCam.updateProjectionMatrix()
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(host)

    /* Loop — paused when hidden or off-screen. */
    let raf = 0
    let running = true
    const clock = new THREE.Clock()

    const tick = () => {
      if (!running) return
      raf = requestAnimationFrame(tick)
      const t = clock.getElapsedTime()
      const vp = vpRef.current

      nebulaUniforms.uTime.value = t
      nebulaUniforms.uOffset.value.set(vp.x, vp.y)

      for (const m of starMats) {
        m.uniforms.uTime.value = t
        m.uniforms.uZoom.value = vp.zoom
        // Sign flip: stars drift against the pan, like looking out a window.
        m.uniforms.uPan.value.set(-vp.x * 0.06, vp.y * 0.06)
      }

      renderer.autoClear = true
      renderer.render(nebulaScene, nebulaCam)
      renderer.autoClear = false
      renderer.render(starScene, starCam)
      renderer.autoClear = true
    }
    tick()

    const onVisibility = () => {
      const visible = !document.hidden
      if (visible && !running) {
        running = true
        clock.start()
        tick()
      } else if (!visible && running) {
        running = false
        cancelAnimationFrame(raf)
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !running) {
          running = true
          tick()
        } else if (!entry.isIntersecting && running) {
          running = false
          cancelAnimationFrame(raf)
        }
      },
      { threshold: 0 },
    )
    io.observe(host)

    return () => {
      running = false
      cancelAnimationFrame(raf)
      document.removeEventListener('visibilitychange', onVisibility)
      ro.disconnect()
      io.disconnect()
      layers.forEach((l) => l.geo.dispose())
      starMats.forEach((m) => m.dispose())
      nebulaMat.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [])

  return (
    <div
      ref={hostRef}
      aria-hidden
      className={className}
      style={{
        position: 'absolute',
        inset: 0,
        // Shown before/instead of WebGL — same palette, so the swap is invisible.
        background:
          'radial-gradient(1100px 700px at 70% 25%, rgb(29 78 216 / 0.20), transparent 60%),' +
          'radial-gradient(900px 600px at 20% 80%, rgb(109 40 217 / 0.16), transparent 62%), #060B18',
      }}
    />
  )
}
