import * as THREE from 'three';
import type { Theme } from './build';

// Variant B — glassmorphic: frosted transmission glass for ducts and equipment,
// emissive services that bloom, and a faint teal/blue light behind the scene.
const glass = (color: string, o: Partial<THREE.MeshPhysicalMaterialParameters> = {}) =>
  new THREE.MeshPhysicalMaterial({
    color,
    metalness: 0,
    roughness: 0.32,
    transmission: 1,
    thickness: 0.9,
    ior: 1.45,
    clearcoat: 1,
    clearcoatRoughness: 0.25,
    specularIntensity: 1,
    ...o,
  });

const glow = (color: string, intensity: number) =>
  new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: 0.3, metalness: 0.1 });

function backdrop() {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 640;
  const g = c.getContext('2d')!;
  g.fillStyle = '#07090c';
  g.fillRect(0, 0, c.width, c.height);
  const blob = (x: number, y: number, r: number, color: string) => {
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, color);
    grad.addColorStop(1, 'rgba(7,9,12,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, c.width, c.height);
  };
  blob(700, 300, 420, 'rgba(32,120,112,0.42)');
  blob(880, 140, 300, 'rgba(40,70,160,0.30)');
  blob(560, 520, 260, 'rgba(46,196,174,0.10)');
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const theme: Theme = {
  name: 'glass',
  dprCap: 1.5,
  exposure: 1.15,
  toneMapping: THREE.AgXToneMapping,
  envIntensity: 1.1,
  shadows: false,
  bloom: { strength: 0.32, radius: 0.45, threshold: 0.8 },
  background: backdrop,
  color: {
    accent: '#3fe0c8',
    alert: '#ff5c63',
    plumb: '#5d8bff',
    elec: '#e0a565',
    dots: '#3f6f74',
    edge: '#cdfaf2',
    ghost: '#cdfaf2',
  },
  edgeOpacity: { structure: 0.1, object: 0.42 },
  mat: {
    structure: () => glass('#9fb3bd', { roughness: 0.55, transmission: 0.85, thickness: 0.4 }),
    duct: () => glass('#a9dcd4', { roughness: 0.38, attenuationColor: new THREE.Color('#2ec4ae'), attenuationDistance: 2.2 }),
    equipment: () => glass('#c9d3e6', { roughness: 0.45 }),
    ahu: () => glass('#eafffb', { roughness: 0.12, transmission: 0.92, thickness: 1.8, iridescence: 0.6, iridescenceIOR: 1.3, attenuationColor: new THREE.Color('#7fe9d8'), attenuationDistance: 3 }),
    plumb: () => glow('#5d8bff', 0.42),
    elec: () => glow('#e0a565', 0.1),
    route: () => glow('#3fe0c8', 1.1),
  },
};

export default theme;
