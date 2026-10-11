import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildScene, type Theme } from './build';
import { FINAL_T, LAYOUT, T, TAGS, clamp, easeInOut, span } from './story';

export type Variant = 'minimal' | 'glass';

export async function mountHero(root: HTMLElement, variant: Variant) {
  const theme: Theme = (variant === 'glass' ? await import('./theme-glass') : await import('./theme-minimal')).default;

  // The stage is the box the scene renders into (a block under the copy on phones, the whole hero on desktop).
  const stage = root.querySelector<HTMLElement>('[data-hero-stage]') ?? root;
  const copyEl = root.querySelector<HTMLElement>('[data-hero-copy]');
  const canvas = root.querySelector<HTMLCanvasElement>('[data-hero-canvas]')!;
  const tagsEl = root.querySelector<HTMLElement>('[data-hero-tags]')!;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  } catch {
    root.dataset.scene = 'fallback';
    return;
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, theme.dprCap));
  renderer.toneMapping = theme.toneMapping;
  renderer.toneMappingExposure = theme.exposure;
  if (theme.shadows) {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
  }

  const b = buildScene(theme);
  const { scene } = b;
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = theme.envIntensity;

  const key = new THREE.DirectionalLight('#ffffff', theme.shadows ? 1.7 : 0.9);
  key.position.set(5, 14, 9);
  key.target.position.set(-1, 0, 1.5);
  if (theme.shadows) {
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { left: -16, right: 14, top: 13, bottom: -13, near: 1, far: 45 });
    key.shadow.radius = 5;
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.02;
  }
  scene.add(key, key.target, new THREE.HemisphereLight('#e3e9f0', '#0a0b0d', 0.4));

  const cam = new THREE.OrthographicCamera(-10, 10, 6, -6, 0.1, 200);
  const target = new THREE.Vector3();

  let composer: { render: () => void; setSize: (w: number, h: number) => void; setPixelRatio: (r: number) => void } | null = null;
  if (theme.bloom) {
    const [{ EffectComposer }, { RenderPass }, { UnrealBloomPass }, { OutputPass }] = await Promise.all([
      import('three/addons/postprocessing/EffectComposer.js'),
      import('three/addons/postprocessing/RenderPass.js'),
      import('three/addons/postprocessing/UnrealBloomPass.js'),
      import('three/addons/postprocessing/OutputPass.js'),
    ]);
    const c = new EffectComposer(renderer);
    c.addPass(new RenderPass(scene, cam));
    c.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), theme.bloom.strength, theme.bloom.radius, theme.bloom.threshold));
    c.addPass(new OutputPass());
    composer = c;
  }

  /* ---- projected HTML labels ---- */
  const { ahuFrom: X0, ahuTo: X1, ahuZ: Z, pipeY: PY, pipeZ: PZ, trayX: TX, trayY: TY0, trayRise } = LAYOUT;
  const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const anchors: Record<string, () => THREE.Vector3> = {
    ahu: () => V(b.ahu.position.x, 2.45, Z),
    p101: () => V(5.5, PY + 0.35, PZ),
    t301: () => V(TX, b.tray.position.y + 0.3, 6.2),
    duct: () => V(3.6, 3.55, 0),
    gap: () => V(X0, 2.55, Z),
    clash: () => V(TX + 0.2, 2.65, Z + 0.4),
    route: () => V(0.3, 3.45, Z),
    ok: () => V(X1, 2.9, Z + 0.9),
  };
  const tags: Record<string, HTMLElement> = {};
  for (const [k, d] of Object.entries(TAGS)) {
    const el = document.createElement('div');
    el.className = `scene-tag is-${d.kind}`;
    el.textContent = d.text;
    tagsEl.append(el);
    tags[k] = el;
  }
  const v3 = new THREE.Vector3();
  function placeTags(vis: Record<string, number>) {
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    for (const k in tags) {
      const el = tags[k];
      const o = clamp(vis[k] ?? 0);
      el.style.opacity = String(o);
      el.style.visibility = o < 0.02 ? 'hidden' : 'visible';
      if (o < 0.02) continue;
      v3.copy(anchors[k]()).project(cam);
      // keep every label fully inside the stage
      const half = el.offsetWidth / 2 + 8;
      const x = clamp(((v3.x + 1) / 2) * w, half, Math.max(half, w - half));
      el.style.transform = `translate3d(${x}px, ${((1 - v3.y) / 2) * h}px, 0) translate(-50%, -100%)`;
    }
  }

  /* ---- timeline ---- */
  const alert = new THREE.Color(theme.color.alert);
  const plumbC = new THREE.Color(theme.color.plumb);
  const elecC = new THREE.Color(theme.color.elec);
  const plumbE = b.branchMat.emissive.clone();
  const elecE = b.trayMats[0].emissive.clone();
  const accent = new THREE.Color(theme.color.accent);
  const edgeC = new THREE.Color(theme.color.edge);
  const ahuEdgeOpacity = b.ahuEdges.opacity;

  function apply(t: number) {
    const mv = easeInOut(span(t, T[1] + 0.3, T[1] + 2));
    b.ahu.position.x = X0 + (X1 - X0) * mv;
    b.ghost.material.opacity = mv > 0 ? 0.85 * (1 - span(t, T[5], T[5] + 1)) : 0;

    const pr = span(t, T[2], T[2] + 2.2);
    b.rings.forEach((r, i) => {
      const q = clamp(pr * 1.3 - i * 0.3);
      r.scale.setScalar(0.3 + q * 6.5);
      (r.material as THREE.MeshBasicMaterial).opacity = q > 0 && q < 1 ? (1 - q) * 0.7 : 0;
    });

    const bad = span(t, T[2] + 0.6, T[2] + 1.2) * (1 - span(t, T[4] + 0.4, T[4] + 1.4));
    const pulse = 0.6 + 0.4 * Math.sin(t * 6);
    b.branchMat.color.copy(plumbC).lerp(alert, bad);
    b.branchMat.emissive.copy(plumbE).lerp(alert, bad * 0.5);
    b.branchMat.opacity = 1 - span(t, T[4] + 0.2, T[4] + 1.2);
    b.gap.material.opacity = bad * pulse;
    for (const m of b.trayMats) {
      m.color.copy(elecC).lerp(alert, bad * 0.85);
      m.emissive.copy(elecE).lerp(alert, bad * 0.4);
    }
    b.clash.material.opacity = bad * 0.28 * pulse;
    b.clashEdges.material.opacity = bad * 0.9;

    for (const l of b.cands) {
      const a = T[3] + 0.2 + l.userData.delay * 2.2;
      l.material.opacity = span(t, a, a + 0.25) * (1 - span(t, T[4] - 0.2, T[4] + 0.6)) * (l.userData.pass ? 0.9 : 0.45);
    }
    b.routeMat.opacity = easeInOut(span(t, T[4] + 0.2, T[4] + 1.4));
    b.tray.position.y = TY0 + trayRise * easeInOut(span(t, T[4] + 0.8, T[4] + 2));

    const verified = span(t, T[5], T[5] + 0.8);
    b.ahuEdges.color.copy(edgeC).lerp(accent, verified);
    b.ahuEdges.opacity = ahuEdgeOpacity + (0.9 - ahuEdgeOpacity) * verified;

    const base = 1 - span(t, T[2] + 0.5, T[2] + 0.9) + span(t, T[5], T[5] + 0.5);
    placeTags({
      ahu: 1,
      p101: base,
      t301: base,
      duct: base,
      gap: bad,
      clash: bad,
      route: span(t, T[4] + 0.6, T[4] + 1.2) * (1 - span(t, T[5] + 0.2, T[5] + 0.6)),
      ok: span(t, T[5] + 0.6, T[5] + 1.2),
    });
  }

  /* ---- framing ---- */
  let narrow = false;
  function resize() {
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    renderer.setSize(w, h, false);
    composer?.setPixelRatio(renderer.getPixelRatio());
    composer?.setSize(w, h);
    const a = w / h;
    narrow = w < 1024;
    let H = 11;
    let sx = 0;
    const sy = narrow ? -H * 0.06 : 13.5 * 0.02;
    if (!narrow) {
      // Fit the story into the space right of the copy: centre it there and zoom out when that space is tight.
      const copyRight = copyEl ? copyEl.getBoundingClientRect().right - stage.getBoundingClientRect().left : w * 0.52;
      const avail = clamp((w - copyRight) / w, 0.3, 0.7);
      H = 13.5 * clamp(0.5 / avail, 1, 1.4);
      const f = copyRight / w + avail * 0.42; // story centre as a fraction of the stage width
      sx = (f - 0.5) * H * a;
    }
    const W = H * a;
    Object.assign(cam, { left: -W / 2 - sx, right: W / 2 - sx, top: H / 2 + sy, bottom: -H / 2 + sy });
    cam.updateProjectionMatrix();
    target.set(0.2, 2, 2.2);
  }

  let tNow = reduce ? FINAL_T : 0;
  const offset = tNow;
  let t0 = performance.now();
  let visible = true;
  let started = false;
  let staticMode = reduce;

  function draw() {
    const ang = 0.78 + (reduce ? 0 : Math.sin((tNow / T[6]) * Math.PI * 2) * 0.05);
    const R = 34;
    cam.position.set(target.x + Math.sin(ang) * R, target.y + R * 0.6, target.z + Math.cos(ang) * R);
    cam.lookAt(target);
    apply(tNow);
    if (composer) composer.render();
    else renderer.render(scene, cam);
    if (!started) {
      started = true;
      root.dataset.scene = 'ready';
    }
  }

  new ResizeObserver(() => {
    resize();
    if (staticMode) draw();
  }).observe(stage);
  resize();

  new IntersectionObserver(
    ([e]) => {
      const was = visible;
      visible = e.isIntersecting;
      if (visible && !was) t0 = performance.now() - (tNow - offset) * 1000;
    },
    { threshold: 0.02 },
  ).observe(stage);

  // Test hook: ?t=12.5 freezes the timeline at that second (used for screenshots).
  const frozen = new URLSearchParams(location.search).get('t');
  if (frozen !== null) {
    staticMode = true;
    tNow = parseFloat(frozen);
    draw();
    return;
  }

  if (reduce) {
    draw();
    return;
  }
  const frame = () => {
    if (visible && !document.hidden) {
      tNow = (offset + (performance.now() - t0) / 1000) % T[6];
      draw();
    }
    requestAnimationFrame(frame);
  };
  frame();
}
