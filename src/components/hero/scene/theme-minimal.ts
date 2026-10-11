import * as THREE from 'three';
import type { Theme } from './build';

// Modern minimal on a white page: off-white clay objects, soft contact shadows, hairline edges,
// muted trade tints, teal only where the story needs it.
const std = (color: string, roughness = 0.7, metalness = 0.05) => new THREE.MeshStandardMaterial({ color, roughness, metalness });

const theme: Theme = {
  name: 'minimal',
  dprCap: 2,
  exposure: 1,
  toneMapping: THREE.AgXToneMapping,
  envIntensity: 0.9,
  shadows: true,
  light: true,
  shadowOpacity: 0.18,
  background: () => new THREE.Color('#ffffff'),
  color: {
    accent: '#0e9c88',
    alert: '#e5484d',
    plumb: '#5b7fc7',
    elec: '#c28e55',
    dots: '#c3c8d0',
    edge: '#0a0b0d',
    ghost: '#5c616b',
  },
  edgeOpacity: { structure: 0.1, object: 0.16 },
  mat: {
    structure: () => std('#e4e7eb', 0.9, 0),
    duct: () => std('#b9cbc6', 0.7, 0.04),
    equipment: () => std('#d5d9df', 0.85, 0.02),
    ahu: () => std('#fbfbfc', 0.55, 0.02),
    plumb: () => std('#5b7fc7', 0.45, 0.15),
    elec: () => std('#c28e55', 0.55, 0.1),
    route: () => new THREE.MeshStandardMaterial({ color: '#0e9c88', emissive: '#0e9c88', emissiveIntensity: 0.25, roughness: 0.35, metalness: 0.1 }),
  },
};

export default theme;
