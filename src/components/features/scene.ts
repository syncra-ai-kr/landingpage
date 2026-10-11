// The Features window's 3D view: a ceiling-space MEP model that moves through four stages.
//  -1  the model before Rev B is checked
//   0  fixed overview; a detection sweep finds two clashes
//   1  zoom into clash 1 (P-101 through D-201) and show what it touches, by trade
//   2  eight reroutes for P-101 appear at once; the five that fail verification are erased
//   3  the three verified options; one is selected (from the panel or the labels)
// One renderer serves every window on the page: attach() moves the canvas into whichever window is in view.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { filletPath } from '../hero/scene/build';

export interface FeatureScene {
  /** Move the canvas into this viewport and show `stage` / `option` at rest. */
  attach(viewport: HTMLElement, stage: number, option: number): void;
  setStage(n: number): void;
  setOption(k: number): void;
  onOption: ((k: number) => void) | null;
}

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const span = (t: number, a: number, b: number) => clamp((t - a) / (b - a));
const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

const COLOR = {
  bg: '#0a0b0d',
  floor: '#101317',
  grid: '#20252c',
  structure: '#40464e',
  duct: '#aab9c3',
  ahu: '#e2e5e9',
  equipment: '#6b727c',
  chw: '#3f7cf0', // chilled water (P-101, riser R-CHW)
  hw: '#e07a3c', // heating water (P-102)
  elec: '#d9a441', // cable tray T-301, conduit C-1
  accent: '#2ec4ae',
  alert: '#ff5a60',
  route: '#cfd8df',
};
const TRADE = { mech: '#9fd0e8', plumb: '#7aa5ff', elec: '#f0c060', struct: '#c9ced5' } as const;

/* ---- layout (metres, y up) ---- */
const C1 = V(-1.5, 3.3, -0.5); // clash 1: P-101 runs through supply duct D-201
const C2 = V(5.2, 2.47, -0.5); // clash 2: cable tray T-301 runs through AHU-1
const R0 = V(-1.5, 3.3, 3.0); // P-101 leaves riser R-CHW
const S = V(-1.5, 3.3, 0.75); // reroute start
const E = V(-1.5, 3.3, -1.75); // reroute end
const X = -1.5;

/** The eight generated reroutes. `opt` is the option index (A, B, C) for the three that pass. */
const ROUTES: { pts: THREE.Vector3[]; opt: number }[] = [
  { opt: 0, pts: [S, V(X, 3.3, 0.45), V(X, 3.72, 0.45), V(X, 3.72, -1.45), V(X, 3.3, -1.45), E] }, // A over D-201
  { opt: 1, pts: [S, V(X, 3.3, 0.45), V(X, 2.89, 0.45), V(X, 2.89, -1.45), V(X, 3.3, -1.45), E] }, // B under D-201
  { opt: 2, pts: [V(X, 2.89, 3.0), V(X, 2.89, -1.75), E] }, // C whole run lowered from the riser
  { opt: -1, pts: [S, V(X, 3.3, 0.45), V(-1.0, 3.3, 0.45), V(-1.0, 3.3, -1.45), V(X, 3.3, -1.45), E] }, // D still through D-201
  { opt: -1, pts: [S, V(X, 3.3, 0.45), V(X, 2.6, 0.45), V(X, 2.6, -1.6), V(X, 3.3, -1.6), E] }, // E hits conduit C-1
  { opt: -1, pts: [S, V(X, 3.3, 0.3), V(X, 2.35, 0.3), V(X, 2.35, -1.3), V(X, 3.3, -1.3), E] }, // F below headroom
  { opt: -1, pts: [S, V(X, 3.3, 0.45), V(-2.6, 3.3, 0.45), V(-2.6, 3.72, 0.45), V(-2.6, 3.72, -1.45), V(-2.6, 3.3, -1.45), V(X, 3.3, -1.45), E] }, // G too many elbows
  { opt: -1, pts: [S, V(X, 3.7, 0.75), V(X, 3.7, -1.45), V(X, 3.3, -1.45), E] }, // H too close to P-102
];

type Pose = { target: THREE.Vector3; dir: THREE.Vector3; dist: number };
const POSE: Record<'overview' | 'impact' | 'routes' | 'options', Pose> = {
  overview: { target: V(0.3, 1.75, 0), dir: V(0.8, 0.7, 1), dist: 17 },
  impact: { target: V(-1.7, 3.15, -0.1), dir: V(0.95, 0.5, 1), dist: 8.2 },
  // Side-on to the reroutes (they all live in the x = -1.5 plane), so over / under reads clearly.
  routes: { target: V(-1.5, 3.1, 0.55), dir: V(1, 0.3, 0.3), dist: 7.6 },
  options: { target: V(-1.5, 3.1, 0.55), dir: V(1, 0.34, 0.38), dist: 7.4 },
};
const poseFor = (n: number) => (n <= 0 ? POSE.overview : n === 1 ? POSE.impact : n === 2 ? POSE.routes : POSE.options);
const posOf = (p: Pose) => p.target.clone().addScaledVector(p.dir.clone().normalize(), p.dist);

type TagKind = 'bad' | 'ok' | 'mech' | 'plumb' | 'elec' | 'struct' | 'opt';
const TAGS: { key: string; text: string; kind: TagKind; at: THREE.Vector3; below?: boolean; opt?: number }[] = [
  { key: 'c1', text: 'Clash 1 · P-101 ↔ D-201', kind: 'bad', at: V(X, 3.7, -0.5) },
  { key: 'c2', text: 'Clash 2 · AHU-1 ↔ T-301', kind: 'bad', at: V(5.2, 2.75, -0.5) },
  { key: 'mech', text: 'Mechanical · D-201, D-202', kind: 'mech', at: V(-4.3, 3.62, -0.5) },
  { key: 'plumb', text: 'Plumbing · R-CHW, P-102', kind: 'plumb', at: V(X, 3.95, 2.4) },
  { key: 'elec', text: 'Electrical · C-1', kind: 'elec', at: V(X, 2.5, -1.6), below: true },
  { key: 'struct', text: 'Structure · B-2', kind: 'struct', at: V(0, 4.45, -0.5) },
  { key: 'A', text: 'A · Over', kind: 'opt', at: V(X, 3.84, -0.5), opt: 0 },
  { key: 'B', text: 'B · Under', kind: 'opt', at: V(X, 2.8, -0.5), below: true, opt: 1 },
  { key: 'C', text: 'C · Lower run', kind: 'opt', at: V(X, 2.8, 2.1), below: true, opt: 2 },
];

export function createFeatureScene(): FeatureScene | null {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canvas = document.createElement('canvas');
  canvas.className = 'fw-canvas';
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  } catch {
    return null;
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const layer = document.createElement('div');
  layer.className = 'fw-tags';

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(COLOR.bg);
  scene.fog = new THREE.Fog(COLOR.bg, 24, 42);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.45;

  const key = new THREE.DirectionalLight('#ffffff', 1.5);
  key.position.set(6, 13, 8);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -10, right: 10, top: 9, bottom: -9, near: 1, far: 40 });
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  scene.add(key, new THREE.HemisphereLight('#dfe7f0', '#0a0b0d', 0.55));

  /* ---- entities: named groups of materials that fade and highlight together ---- */
  type Ent = { mats: THREE.MeshStandardMaterial[]; lines: { m: THREE.LineBasicMaterial; base: number }[] };
  const ents: Record<string, Ent> = {};
  const ent = (name: string) => (ents[name] ??= { mats: [], lines: [] });
  const mat = (name: string, color: string, roughness = 0.6, metalness = 0.1) => {
    // Always transparent: toggling the flag would need a shader rebuild to take effect.
    const m = new THREE.MeshStandardMaterial({ color, roughness, metalness, transparent: true });
    ent(name).mats.push(m);
    return m;
  };
  const edgeLines = (name: string, geo: THREE.BufferGeometry, color: string, opacity: number) => {
    const m = new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
    ent(name).lines.push({ m, base: opacity });
    return new THREE.LineSegments(new THREE.EdgesGeometry(geo), m);
  };
  const box = (name: string, m: THREE.Material, w: number, h: number, d: number, x: number, y: number, z: number, edge?: [string, number]) => {
    const mesh = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, Math.min(0.03, w / 2, h / 2, d / 2)), m);
    mesh.position.set(x, y, z);
    mesh.castShadow = mesh.receiveShadow = true;
    if (edge) mesh.add(edgeLines(name, new THREE.BoxGeometry(w, h, d), edge[0], edge[1]));
    scene.add(mesh);
    return mesh;
  };
  const tube = (m: THREE.Material, pts: THREE.Vector3[], r: number, segs = 64) => {
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(filletPath(pts, Math.max(r * 2.5, 0.12)), segs, r, 12, false), m);
    mesh.castShadow = true;
    scene.add(mesh);
    return mesh;
  };
  const cyl = (m: THREE.Material, r: number, a: THREE.Vector3, b: THREE.Vector3) => {
    const dir = b.clone().sub(a);
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, dir.length(), 24), m);
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(V(0, 1, 0), dir.normalize());
    mesh.castShadow = true;
    scene.add(mesh);
    return mesh;
  };

  /* ---- floor ---- */
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(16, 10), new THREE.MeshStandardMaterial({ color: COLOR.floor, roughness: 1 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  const gridPts: number[] = [];
  for (let x = -8; x <= 8; x++) gridPts.push(x, 0.003, -5, x, 0.003, 5);
  for (let z = -5; z <= 5; z++) gridPts.push(-8, 0.003, z, 8, 0.003, z);
  const gridGeo = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(gridPts, 3));
  scene.add(floor, new THREE.LineSegments(gridGeo, new THREE.LineBasicMaterial({ color: COLOR.grid })));

  /* ---- structure ---- */
  const structM = mat('structure', COLOR.structure, 0.85, 0.05);
  const sEdge: [string, number] = ['#9aa1ab', 0.12];
  for (const [x, z] of [[-6, -3.6], [0, -3.6], [6, -3.6], [-6, 3.6], [0, 3.6]]) box('structure', structM, 0.45, 4.4, 0.45, x, 2.2, z, sEdge);
  box('structure', structM, 12.45, 0.45, 0.4, 0, 4.175, -3.6, sEdge);
  box('structure', structM, 0.4, 0.45, 7.2, -6, 4.175, 0, sEdge);
  box('b2', mat('b2', COLOR.structure, 0.85, 0.05), 0.4, 0.45, 7.2, 0, 4.175, 0, sEdge);

  /* ---- mechanical: supply duct D-201 (+ drop into AHU-1), branch D-202 + diffuser, AHU-1 ---- */
  const ductM = mat('duct', COLOR.duct, 0.45, 0.45);
  const dEdge: [string, number] = ['#0a0b0d', 0.35];
  box('duct', ductM, 11.2, 0.55, 1.0, -0.9, 3.3, -0.5, dEdge);
  box('duct', ductM, 0.8, 0.975, 1.0, 4.3, 3.0875, -0.5, dEdge);
  for (let x = -6; x < 4.4; x += 1.4) box('duct', ductM, 0.05, 0.62, 1.07, x, 3.3, -0.5);
  box('duct', ductM, 0.6, 0.4, 2.6, -3.5, 3.25, 1.3, dEdge);
  box('duct', ductM, 0.78, 0.1, 0.78, -3.5, 3.0, 2.3, dEdge);
  const ahuM = mat('ahu', COLOR.ahu, 0.55, 0.05);
  box('ahu', ahuM, 1.8, 2.6, 1.6, 4.8, 1.3, -0.5, ['#0a0b0d', 0.4]);
  const ahuPanel = mat('ahu', '#c3c8cf', 0.6, 0.05);
  box('ahu', ahuPanel, 0.72, 1.1, 0.03, 4.38, 1.15, 0.31);
  box('ahu', ahuPanel, 0.72, 1.1, 0.03, 5.22, 1.15, 0.31);

  /* ---- electrical: ladder tray T-301 (through AHU-1's top), conduit C-1 ---- */
  const trayM = mat('tray', COLOR.elec, 0.45, 0.5);
  box('tray', trayM, 0.04, 0.1, 7.2, 4.97, 2.47, 0);
  box('tray', trayM, 0.04, 0.1, 7.2, 5.43, 2.47, 0);
  const rungs = new THREE.InstancedMesh(new THREE.BoxGeometry(0.46, 0.025, 0.05), trayM, 24);
  for (let i = 0; i < 24; i++) rungs.setMatrixAt(i, new THREE.Matrix4().makeTranslation(5.2, 2.44, -3.45 + i * 0.3));
  rungs.castShadow = true;
  scene.add(rungs);
  tube(mat('c1', COLOR.elec, 0.5, 0.4), [V(-5.5, 2.6, -1.6), V(4.97, 2.6, -1.6)], 0.03);

  /* ---- plumbing: riser R-CHW, P-101 (split around the reroute), P-102 ---- */
  cyl(mat('riser', COLOR.chw, 0.35, 0.3), 0.1, V(X, 0, 3.1), V(X, 4.3, 3.1));
  const p101a = mat('p101a', COLOR.chw, 0.35, 0.3);
  const p101c = mat('p101c', COLOR.chw, 0.35, 0.3);
  const p101b = mat('p101b', COLOR.chw, 0.35, 0.3);
  tube(p101a, [R0, S], 0.07, 8);
  tube(p101c, [S, E], 0.07, 8);
  tube(p101b, [E, V(X, 3.3, -2.2), V(3.2, 3.3, -2.2), V(3.2, 1.5, -2.2), V(3.2, 1.5, -0.9), V(3.9, 1.5, -0.9)], 0.07, 160);
  tube(mat('p102', COLOR.hw, 0.35, 0.3), [V(-6.5, 3.85, 0.8), V(6.5, 3.85, 0.8)], 0.06);

  /* ---- context equipment: pump PU-2, panel EP-1 ---- */
  const eqM = mat('equip', COLOR.equipment, 0.6, 0.3);
  box('equip', eqM, 1.1, 0.18, 0.6, -4.2, 0.09, -2.3);
  cyl(eqM, 0.2, V(-4.65, 0.42, -2.3), V(-4.0, 0.42, -2.3));
  cyl(eqM, 0.3, V(-3.95, 0.42, -2.3), V(-3.7, 0.42, -2.3));
  box('equip', eqM, 0.8, 1.2, 0.25, -5.3, 1.5, -3.3, ['#0a0b0d', 0.3]);

  /* ---- clash markers (x-ray: drawn through the objects they sit in) ---- */
  const marker = (size: THREE.Vector3, pos: THREE.Vector3) => {
    const fill = new THREE.MeshBasicMaterial({ color: COLOR.alert, transparent: true, opacity: 0, depthWrite: false, depthTest: false });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), fill);
    mesh.position.copy(pos);
    mesh.renderOrder = 10;
    const line = new THREE.LineBasicMaterial({ color: COLOR.alert, transparent: true, opacity: 0, depthWrite: false, depthTest: false });
    const outline = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry), line);
    outline.renderOrder = 11;
    mesh.add(outline);
    const ringM = new THREE.MeshBasicMaterial({ color: COLOR.alert, transparent: true, opacity: 0, depthWrite: false, depthTest: false, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 64), ringM);
    ring.position.copy(pos);
    ring.renderOrder = 12;
    scene.add(mesh, ring);
    return { fill, line, ring, ringM };
  };
  const M1 = marker(V(0.36, 0.36, 1.18), C1);
  const M2 = marker(V(0.62, 0.28, 1.74), C2);

  /* ---- detection sweep (stage 0) and verification sweep (stage 2) ---- */
  const sweep = (w: number, h: number) => {
    const m = new THREE.MeshBasicMaterial({ color: COLOR.accent, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
    const lm = new THREE.LineBasicMaterial({ color: COLOR.accent, transparent: true, opacity: 0, depthWrite: false });
    mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry), lm));
    scene.add(mesh);
    return { mesh, m, lm };
  };
  const scan = sweep(10, 4.8);
  scan.mesh.rotation.y = Math.PI / 2;
  scan.mesh.position.set(-8, 2.4, 0);
  const vscan = sweep(4.2, 2.0);
  vscan.mesh.position.set(-1.5, 3.05, 3.2);
  vscan.mesh.rotation.y = 0;

  /* ---- impact analysis (stage 1): rings + links from clash 1 to what it touches ---- */
  const rings = [0, 1, 2].map(() => {
    const m = new THREE.MeshBasicMaterial({ color: COLOR.accent, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
    const r = new THREE.Mesh(new THREE.RingGeometry(0.97, 1, 96), m);
    r.rotation.x = -Math.PI / 2;
    r.position.copy(C1);
    scene.add(r);
    return { r, m };
  });
  const LINKS: { to: THREE.Vector3; trade: keyof typeof TRADE }[] = [
    { to: V(-4.0, 3.3, -0.5), trade: 'mech' },
    { to: V(-3.5, 3.25, 1.4), trade: 'mech' },
    { to: V(X, 3.3, 3.0), trade: 'plumb' },
    { to: V(X, 3.85, 0.8), trade: 'plumb' },
    { to: V(X, 2.6, -1.6), trade: 'elec' },
    { to: V(0, 3.95, -0.5), trade: 'struct' },
  ];
  const links = LINKS.map(({ to, trade }) => {
    const geo = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([...C1.toArray(), ...C1.toArray()], 3));
    const m = new THREE.LineDashedMaterial({ color: TRADE[trade], dashSize: 0.1, gapSize: 0.07, transparent: true, opacity: 0, depthTest: false });
    const line = new THREE.Line(geo, m);
    line.renderOrder = 13;
    const dotM = new THREE.MeshBasicMaterial({ color: TRADE[trade], transparent: true, opacity: 0, depthTest: false });
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 12), dotM);
    dot.position.copy(to);
    dot.renderOrder = 14;
    scene.add(line, dot);
    return { to, geo, m, line, dotM };
  });

  /* ---- generated reroutes ---- */
  const SEGS = 120;
  const RADIAL = 10;
  const routes = ROUTES.map((r) => {
    const m = new THREE.MeshStandardMaterial({ color: COLOR.route, roughness: 0.35, metalness: 0.2, transparent: true, opacity: 0 });
    const geo = new THREE.TubeGeometry(filletPath(r.pts, 0.14), SEGS, 0.055, RADIAL, false);
    const mesh = new THREE.Mesh(geo, m);
    scene.add(mesh);
    return { ...r, m, geo, mesh };
  });

  /* ---- labels ---- */
  const tagEls = TAGS.map((t) => {
    const el = document.createElement(t.opt === undefined ? 'span' : 'button');
    el.className = `fw-tag is-${t.kind}${t.below ? ' is-below' : ''}`;
    el.textContent = t.text;
    if (el instanceof HTMLButtonElement) {
      el.type = 'button';
      el.tabIndex = -1; // mouse shortcut; the panel buttons are the accessible control
      el.addEventListener('click', () => api.onOption?.(t.opt!));
    }
    layer.append(el);
    return el;
  });

  /* ---- state ---- */
  const cam = new THREE.PerspectiveCamera(30, 16 / 9, 0.1, 100);
  const camTgt = new THREE.Vector3();
  const fromPos = posOf(POSE.overview);
  const fromTgt = POSE.overview.target.clone();
  cam.position.copy(fromPos);
  camTgt.copy(fromTgt);
  let stage = -1;
  let stageT0 = performance.now() - 99_000;
  let option = 0;
  let snap = true; // next frame jumps straight to target values
  let last = performance.now();
  const vals: Record<string, number> = {};
  let dt = 0;
  const damp = (k: string, target: number, rate = 7) => {
    const cur = vals[k];
    const v = snap || reduce || cur === undefined ? target : cur + (target - cur) * (1 - Math.exp(-dt * rate));
    vals[k] = v;
    return v;
  };
  const fadeMat = (m: THREE.Material, o: number) => {
    m.opacity = o;
    m.depthWrite = o > 0.5;
    m.visible = o > 0.01;
  };
  const tmpC = new THREE.Color();
  const cRoute = new THREE.Color(COLOR.route);
  const cAccent = new THREE.Color(COLOR.accent);
  const cAlert = new THREE.Color(COLOR.alert);
  // Stage 1 highlight: each affected element glows in its own colour.
  const HL: Record<string, string> = { duct: TRADE.mech, b2: TRADE.struct, riser: COLOR.chw, p102: COLOR.hw, c1: COLOR.elec, p101a: COLOR.chw, p101b: COLOR.chw, p101c: COLOR.chw };

  let viewport: HTMLElement | null = null;
  let visible = false;
  const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
  const ro = new ResizeObserver(() => resize());

  function resize() {
    if (!viewport) return;
    const w = viewport.clientWidth;
    const h = viewport.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    cam.aspect = w / h;
    cam.updateProjectionMatrix();
  }

  function update(now: number) {
    dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const s = stage;
    const t = reduce ? 99 : (now - stageT0) / 1000;
    const pulse = reduce ? 1 : 0.7 + 0.3 * Math.sin(now * 0.006);

    // camera
    const goal = poseFor(s);
    const k = snap || reduce ? 1 : ease(span(t, 0, 1.5));
    cam.position.lerpVectors(fromPos, posOf(goal), k);
    camTgt.lerpVectors(fromTgt, goal.target, k);
    cam.lookAt(camTgt);

    // stage 0: detection sweep finds clash 1, then clash 2
    const sweepP = s === 0 && !reduce ? clamp(((t - 0.2) % 4.5) / 1.6) : 1;
    scan.mesh.position.x = -7.5 + 15 * sweepP;
    const scanOn = s === 0 && t > 0.2 && sweepP < 1 ? 1 : 0;
    scan.m.opacity = scanOn * 0.07;
    scan.lm.opacity = scanOn * 0.55;
    scan.mesh.visible = scanOn > 0;

    const c1 = damp('c1', s === 0 ? (t > 0.84 ? 1 : 0) : s === 1 || s === 2 ? 1 : 0, 9);
    const c2 = damp('c2', s === 0 ? (t > 1.55 ? 1 : 0) : s >= 1 ? 0.3 : 0, 9);
    for (const [M, on, at] of [
      [M1, c1, C1],
      [M2, c2, C2],
    ] as const) {
      M.fill.opacity = on * 0.32 * pulse;
      M.line.opacity = on * 0.95;
      const ph = reduce ? 0.4 : ((now / 1500) % 1);
      M.ringM.opacity = on * (1 - ph) * 0.8;
      M.ring.scale.setScalar(cam.position.distanceTo(at) * (0.018 + ph * 0.03));
      M.ring.quaternion.copy(cam.quaternion);
    }

    // entity opacity + highlight
    const affected = s === 1;
    const hl = damp('hl', affected && t > 1.2 ? 1 : 0, 6);
    const fades: Record<string, number> = {};
    for (const name in ents) {
      let o = 1;
      if (s === 1) o = name in HL ? (name === 'duct' ? 0.5 : 1) : 0.12;
      else if (s >= 2) o = name === 'duct' || name === 'p102' ? 0.45 : name === 'b2' || name === 'structure' ? 0.12 : ['ahu', 'tray', 'equip'].includes(name) ? 0.25 : 1;
      if (name === 'p101c') o = s === 2 ? 0.22 : s === 3 ? 0 : o;
      if (name === 'p101a' && s === 3 && option === 2) o = 0;
      fades[name] = damp(`o-${name}`, o, 6);
    }
    for (const [name, e] of Object.entries(ents)) {
      const o = fades[name];
      for (const m of e.mats) {
        fadeMat(m, o);
        if (HL[name]) m.emissive.set(HL[name]).multiplyScalar(hl * 0.35);
      }
      for (const l of e.lines) fadeMat(l.m, l.base * o);
    }

    // stage 1: impact rings and links
    rings.forEach(({ r, m }, i) => {
      const ph = reduce ? 0.5 : (((now / 1000 - i * 0.9) % 2.7) + 2.7) % 2.7 / 2.7;
      const on = damp(`ring${i}`, s === 1 && t > 1 ? 1 : 0, 6);
      r.scale.setScalar(0.2 + ph * 3);
      m.opacity = on * (1 - ph) * 0.6;
    });
    links.forEach((l, i) => {
      const g = damp(`link${i}`, s === 1 ? ease(span(t, 1.2 + i * 0.12, 1.7 + i * 0.12)) : 0, 10);
      const p = l.geo.attributes.position as THREE.BufferAttribute;
      const end = C1.clone().lerp(l.to, g);
      p.setXYZ(1, end.x, end.y, end.z);
      p.needsUpdate = true;
      l.line.computeLineDistances();
      l.m.opacity = g > 0.01 ? 0.9 : 0;
      l.dotM.opacity = span(g, 0.9, 1);
    });

    // stage 2/3: reroutes
    const vs = s === 2 && !reduce ? span(t, 2.2, 3.0) : 1;
    vscan.mesh.position.z = 3.2 - vs * 5.4;
    const vOn = s === 2 && t > 2.2 && vs < 1 ? 1 : 0;
    vscan.m.opacity = vOn * 0.08;
    vscan.lm.opacity = vOn * 0.6;
    vscan.mesh.visible = vOn > 0;
    routes.forEach((r, i) => {
      const pass = r.opt >= 0;
      let grow = 0;
      let o = 0;
      let verdict = 0;
      let em = 0.08;
      if (s === 2) {
        grow = ease(span(t, 0.5 + i * 0.05, 1.5 + i * 0.05));
        verdict = span(t, 2.5 + (i % 4) * 0.12, 2.8 + (i % 4) * 0.12);
        o = pass ? 1 : 0.95 * (1 - span(t, 3.4, 4.0));
      } else if (s === 3 && pass) {
        grow = 1;
        verdict = 1;
        const sel = r.opt === option;
        o = sel ? 1 : 0.3;
        em = sel ? 0.55 : 0.08;
      }
      const g = damp(`grow${i}`, grow, 12);
      r.geo.setDrawRange(0, Math.round(g * SEGS) * RADIAL * 6);
      fadeMat(r.m, damp(`ro${i}`, o, 8));
      tmpC.copy(cRoute).lerp(pass ? cAccent : cAlert, verdict);
      r.m.color.copy(tmpC);
      r.m.emissive.copy(tmpC).multiplyScalar(damp(`re${i}`, em, 8));
    });

    // labels
    const show: Record<string, number> = {
      c1: s === 0 ? +(t > 1.0) : s === 1 ? 1 : 0,
      c2: s === 0 ? +(t > 1.7) : 0,
      mech: s === 1 ? +(t > 1.6) : 0,
      plumb: s === 1 ? +(t > 1.75) : 0,
      elec: s === 1 ? +(t > 1.9) : 0,
      struct: s === 1 ? +(t > 2.05) : 0,
      A: (s === 2 && t > 3.7) || s === 3 ? 1 : 0,
      B: (s === 2 && t > 3.8) || s === 3 ? 1 : 0,
      C: (s === 2 && t > 3.9) || s === 3 ? 1 : 0,
    };
    const w = viewport?.clientWidth ?? 1;
    const h = viewport?.clientHeight ?? 1;
    const v = new THREE.Vector3();
    TAGS.forEach((tag, i) => {
      const el = tagEls[i];
      const o = damp(`tag-${tag.key}`, show[tag.key] ?? 0, 10);
      el.style.opacity = String(o);
      el.style.visibility = o < 0.02 ? 'hidden' : 'visible';
      el.classList.toggle('is-live', o > 0.5);
      if (tag.opt !== undefined) el.classList.toggle('is-selected', s === 3 && option === tag.opt);
      if (o < 0.02) return;
      v.copy(tag.at).project(cam);
      const half = el.offsetWidth / 2 + 6;
      const x = clamp(((v.x + 1) / 2) * w, half, Math.max(half, w - half));
      el.style.transform = `translate3d(${x}px, ${((1 - v.y) / 2) * h}px, 0) translate(-50%, ${tag.below ? '6px' : 'calc(-100% - 6px)'})`;
    });

    snap = false;
  }

  function frame(now: number) {
    if (viewport && visible && !document.hidden) {
      update(now);
      renderer.render(scene, cam);
    } else last = now;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  const api: FeatureScene = {
    onOption: null,
    attach(vp, s, opt) {
      if (viewport === vp) return;
      if (viewport) {
        // Leave a still of the last frame behind in the window we are leaving.
        update(performance.now());
        renderer.render(scene, cam);
        const still = viewport.querySelector<HTMLImageElement>('[data-fw-still]');
        if (still) {
          still.src = canvas.toDataURL('image/jpeg', 0.85);
          still.hidden = false;
        }
        io.unobserve(viewport);
        ro.unobserve(viewport);
      }
      viewport = vp;
      vp.querySelector<HTMLImageElement>('[data-fw-still]')?.setAttribute('hidden', '');
      vp.append(canvas, layer);
      io.observe(vp);
      ro.observe(vp);
      resize();
      stage = s;
      option = opt;
      stageT0 = performance.now() - 99_000;
      const p = poseFor(s);
      fromPos.copy(posOf(p));
      fromTgt.copy(p.target);
      snap = true;
    },
    setStage(n) {
      if (n === stage) return;
      fromPos.copy(cam.position);
      fromTgt.copy(camTgt);
      stage = n;
      stageT0 = performance.now();
    },
    setOption(k) {
      option = k;
    },
  };
  return api;
}
