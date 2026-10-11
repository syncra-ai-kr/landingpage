import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { LAYOUT } from './story';

/** Everything that differs between hero variants. Geometry and timing never do. */
export interface Theme {
  name: 'minimal' | 'glass';
  dprCap: number;
  exposure: number;
  toneMapping: THREE.ToneMapping;
  envIntensity: number;
  shadows: boolean;
  /** Light page: floor dots blend toward the background instead of glowing additively. */
  light?: boolean;
  shadowOpacity?: number;
  bloom?: { strength: number; radius: number; threshold: number };
  background: () => THREE.Color | THREE.Texture;
  color: {
    accent: string;
    alert: string;
    plumb: string;
    elec: string;
    dots: string;
    edge: string;
    ghost: string;
  };
  edgeOpacity: { structure: number; object: number };
  mat: {
    structure: () => THREE.Material;
    duct: () => THREE.Material;
    equipment: () => THREE.Material;
    ahu: () => THREE.Material;
    plumb: () => THREE.MeshStandardMaterial;
    elec: () => THREE.MeshStandardMaterial;
    route: () => THREE.MeshStandardMaterial;
  };
}

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** Polyline with rounded (filleted) corners, for pipes that bend like real pipes. */
function filletPath(pts: THREE.Vector3[], r: number) {
  const path = new THREE.CurvePath<THREE.Vector3>();
  let start = pts[0].clone();
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i];
    const din = p.clone().sub(pts[i - 1]);
    const dout = pts[i + 1].clone().sub(p);
    const rr = Math.min(r, din.length() / 2, dout.length() / 2);
    din.normalize();
    dout.normalize();
    const p1 = p.clone().addScaledVector(din, -rr);
    const p2 = p.clone().addScaledVector(dout, rr);
    if (start.distanceTo(p1) > 1e-4) path.add(new THREE.LineCurve3(start, p1));
    path.add(new THREE.QuadraticBezierCurve3(p1, p.clone(), p2));
    start = p2;
  }
  path.add(new THREE.LineCurve3(start, pts[pts.length - 1].clone()));
  return path;
}

export function buildScene(theme: Theme) {
  const { ahuFrom: X0, ahuTo: X1, ahuZ: Z, pipeY: PY, pipeZ: PZ, trayX: TX, trayY: TY0 } = LAYOUT;
  const scene = new THREE.Scene();
  scene.background = theme.background();

  const edgeMat = (opacity: number, color = theme.color.edge) =>
    new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false });

  const shadowy = <T extends THREE.Object3D>(o: T) => {
    o.castShadow = theme.shadows;
    return o;
  };

  function box(w: number, h: number, d: number, material: THREE.Material, edgeOpacity: number, radius = 0.06) {
    const mesh = shadowy(new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, Math.min(radius, w / 2, h / 2, d / 2)), material));
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, d)), edgeMat(edgeOpacity));
    edges.scale.setScalar(1.002);
    mesh.add(edges);
    return { mesh, edges };
  }

  function rod(a: THREE.Vector3, b: THREE.Vector3, r: number, material: THREE.Material) {
    const dir = b.clone().sub(a);
    const mesh = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(r, r, dir.length(), 24), material));
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(V(0, 1, 0), dir.normalize());
    return mesh;
  }

  function pipe(pts: THREE.Vector3[], r: number, material: THREE.Material, bend = 0.32) {
    const path = filletPath(pts, bend);
    return shadowy(new THREE.Mesh(new THREE.TubeGeometry(path, 160, r, 20, false), material));
  }

  /* ---- floor: fading dot grid + contact shadows ---- */
  {
    const pos: number[] = [];
    const col: number[] = [];
    const c = new THREE.Color(theme.color.dots);
    const bg = theme.light && scene.background instanceof THREE.Color ? scene.background : null;
    const mixed = new THREE.Color();
    for (let x = -14; x <= 10; x += 0.5) {
      for (let z = -6; z <= 9.5; z += 0.5) {
        const d = Math.hypot((x + 1) / 13, (z - 1.5) / 8.5);
        const f = Math.max(0, 1 - d) ** 1.4;
        if (f <= 0.01) continue;
        pos.push(x, 0.002, z);
        if (bg) {
          mixed.copy(bg).lerp(c, f);
          col.push(mixed.r, mixed.g, mixed.b);
        } else col.push(c.r * f, c.g * f, c.b * f);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const dots = new THREE.Points(
      g,
      new THREE.PointsMaterial({
        size: 2.2,
        sizeAttenuation: false,
        vertexColors: true,
        blending: bg ? THREE.NormalBlending : THREE.AdditiveBlending,
        depthWrite: false,
        transparent: !bg,
      }),
    );
    scene.add(dots);

    if (theme.shadows) {
      const catcher = new THREE.Mesh(new THREE.PlaneGeometry(40, 30), new THREE.ShadowMaterial({ opacity: theme.shadowOpacity ?? 0.45 }));
      catcher.rotation.x = -Math.PI / 2;
      catcher.position.set(-1, 0, 1.5);
      catcher.receiveShadow = true;
      scene.add(catcher);
    }
  }

  /* ---- structure: columns, beams, wall outlines ---- */
  const structure = theme.mat.structure();
  for (let x = -11; x <= 9; x += 4) {
    const col = box(0.45, 4.6, 0.45, structure, theme.edgeOpacity.structure, 0.04).mesh;
    col.position.set(x, 2.3, -5.1);
    scene.add(col);
  }
  {
    // one back beam only — the front and cross beams cluttered the iso view
    const beam = box(22, 0.45, 0.35, structure, theme.edgeOpacity.structure, 0.04).mesh;
    beam.position.set(-1, 4.35, -1.2);
    scene.add(beam);
    // walls read as quiet outlines rather than solid slabs
    const wallB = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(24, 4.6, 0.2)), edgeMat(theme.edgeOpacity.structure * 0.8));
    wallB.position.set(-1, 2.3, -5.4);
    const wallL = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(0.2, 4.6, 14)), edgeMat(theme.edgeOpacity.structure * 0.8));
    wallL.position.set(-13, 2.3, 1.5);
    scene.add(wallB, wallL);
  }

  /* ---- context equipment + services ---- */
  const equipment = theme.mat.equipment();
  for (const [x, z] of [
    [-10, 3.6],
    [-10, 0.4],
    [-7.5, -3.2],
  ]) {
    const e = box(1.6, 1.4, 1.6, equipment, theme.edgeOpacity.object, 0.1).mesh;
    e.position.set(x, 0.7, z);
    scene.add(e);
  }

  const plumbStatic = theme.mat.plumb();
  scene.add(rod(V(-7, 0, 0.2), V(-7, 4.2, 0.2), 0.16, plumbStatic));
  scene.add(pipe([V(-12, 3.4, 4.2), V(-7, 3.4, 4.2), V(-7, 3.4, 0.2)], 0.12, plumbStatic, 0.4));

  const duct = theme.mat.duct();
  {
    const d1 = box(10, 1, 1.4, duct, theme.edgeOpacity.object, 0.12).mesh;
    d1.position.set(-1, 2.9, 0);
    const d2 = box(1, 0.7, 8, duct, theme.edgeOpacity.object, 0.1).mesh;
    d2.position.set(-3, 3.6, 4.1);
    const d3 = box(7, 0.8, 1, duct, theme.edgeOpacity.object, 0.1).mesh;
    d3.position.set(-9.5, 3.2, -2.5);
    scene.add(d1, d2, d3);
  }

  const elecStatic = theme.mat.elec();
  scene.add(rod(V(-12, 4.0, -0.9), V(8, 4.0, -0.9), 0.05, elecStatic));
  scene.add(rod(V(-12, 4.1, -1.05), V(8, 4.1, -1.05), 0.05, elecStatic));

  /* ---- the story objects ---- */
  const ahuBox = box(1.8, 2, 1.8, theme.mat.ahu(), theme.edgeOpacity.object * 1.6, 0.12);
  const ahu = ahuBox.mesh;
  const ahuEdges = ahuBox.edges.material as THREE.LineBasicMaterial;
  ahu.position.set(X0, 1, Z);
  scene.add(ahu);

  const ghost = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(1.8, 2, 1.8)),
    new THREE.LineDashedMaterial({ color: theme.color.ghost, dashSize: 0.16, gapSize: 0.12, transparent: true, opacity: 0 }),
  );
  ghost.computeLineDistances();
  ghost.position.set(X0, 1, Z);
  scene.add(ghost);

  const clash = new THREE.Mesh(
    new THREE.BoxGeometry(0.62, 0.5, 1.84),
    new THREE.MeshBasicMaterial({ color: theme.color.alert, transparent: true, opacity: 0, depthWrite: false }),
  );
  clash.position.set(2.6, 1.9, Z);
  const clashEdges = new THREE.LineSegments(new THREE.EdgesGeometry(clash.geometry), new THREE.LineBasicMaterial({ color: theme.color.alert, transparent: true, opacity: 0 }));
  clash.add(clashEdges);
  scene.add(clash);

  // P-101 main run + the branch that still points at AHU-1's old position
  scene.add(rod(V(-12, PY, PZ), V(8, PY, PZ), 0.11, plumbStatic));
  const branchMat = theme.mat.plumb();
  branchMat.transparent = true;
  const branch = pipe([V(X0, PY, PZ), V(X0, PY, Z), V(X0, 2, Z)], 0.09, branchMat, 0.28);
  scene.add(branch);

  const gap = new THREE.Mesh(
    new THREE.TorusGeometry(0.28, 0.03, 12, 64),
    new THREE.MeshBasicMaterial({ color: theme.color.alert, transparent: true, opacity: 0 }),
  );
  gap.rotation.x = Math.PI / 2;
  gap.position.set(X0, 2.02, Z);
  scene.add(gap);

  // T-301 cable tray
  const tray = new THREE.Group();
  const trayMats: THREE.MeshStandardMaterial[] = [];
  for (const [w, h, x, y] of [
    [0.6, 0.06, 0, 0],
    [0.04, 0.14, -0.3, 0.07],
    [0.04, 0.14, 0.3, 0.07],
  ]) {
    const m = theme.mat.elec();
    trayMats.push(m);
    tray.add(box(w, h, 11, m, theme.edgeOpacity.object * 0.6, 0.015).mesh.translateX(x).translateY(y));
  }
  tray.position.set(TX, TY0, 1.5);
  scene.add(tray);

  // impact ripple
  const rings = [0, 1].map(() => {
    const r = new THREE.Mesh(
      new THREE.RingGeometry(0.97, 1, 128),
      new THREE.MeshBasicMaterial({ color: theme.color.accent, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }),
    );
    r.rotation.x = -Math.PI / 2;
    r.position.set(X1, 0.03, Z);
    scene.add(r);
    return r;
  });

  // 34 candidate routes (pass = accent, fail = alert)
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const end = V(X1, 2, Z);
  const cands: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>[] = [];
  for (let i = 0; i < 34; i++) {
    const xs = -3 + rnd() * 4.2;
    const ym = 2.25 + rnd() * 1.3;
    const zm = PZ + 0.4 + rnd() * 1.9;
    const xo = rnd() < 0.35 ? 2.3 + rnd() * 1.2 : X1;
    const pass = xo === X1 && rnd() < 0.62;
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([V(xs, PY, PZ), V(xs, ym, PZ), V(xs, ym, zm), V(xo, ym, zm), V(xo, ym, Z), V(X1, ym, Z), end]),
      new THREE.LineBasicMaterial({ color: pass ? theme.color.accent : theme.color.alert, transparent: true, opacity: 0, depthWrite: false }),
    );
    line.userData = { pass, delay: i / 34 };
    scene.add(line);
    cands.push(line);
  }

  const routeMat = theme.mat.route();
  routeMat.transparent = true;
  routeMat.opacity = 0;
  const chosen = pipe([V(0.3, PY, PZ), V(0.3, 3.05, PZ), V(0.3, 3.05, Z), V(X1, 3.05, Z), V(X1, 2, Z)], 0.1, routeMat, 0.3);
  scene.add(chosen);

  return { scene, ahu, ahuEdges, ghost, clash, clashEdges, branchMat, gap, tray, trayMats, rings, cands, routeMat };
}

export type Built = ReturnType<typeof buildScene>;
