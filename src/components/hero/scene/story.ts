// The design-change story shared by every hero variant: layout, timeline and 3D labels.
// Ported from the original index.html scene (CR-014: AHU-1 relocation).

export const LAYOUT = {
  ahuFrom: -1.5, // X0: AHU-1 before the change
  ahuTo: 1.9, // X1: AHU-1 after the 3.4 m move
  ahuZ: 3.0,
  pipeY: 3.75, // P-101 main run
  pipeZ: 1.6,
  trayX: 2.6, // T-301 cable tray
  trayY: 1.9,
  trayRise: 0.2, // the fix: tray raised 200 mm
};

// Phase start times (s). Phase i runs from T[i] to T[i + 1]; T[6] is the loop length.
export const T = [0, 2.2, 4.8, 8, 11.2, 14.4, 19] as const;
export const FINAL_T = T[5] + 2.5;

export type TagKind = 'neutral' | 'mech' | 'elec' | 'plumb' | 'alert' | 'accent';

export const TAGS: Record<string, { text: string; kind: TagKind }> = {
  ahu: { text: 'AHU-1', kind: 'neutral' },
  p101: { text: 'P-101 · Chilled water supply', kind: 'plumb' },
  t301: { text: 'T-301 · Cable tray', kind: 'elec' },
  duct: { text: 'D-201 · Supply duct', kind: 'mech' },
  gap: { text: 'Disconnected · P-101', kind: 'alert' },
  clash: { text: 'Clash · AHU-1 ↔ T-301', kind: 'alert' },
  route: { text: 'Option A · 10.05 m · 4 bends', kind: 'accent' },
  ok: { text: 'Resolved · cause: design fix', kind: 'accent' },
};

export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
/** 0→1 progress of t between a and b. */
export const span = (t: number, a: number, b: number) => clamp((t - a) / (b - a));
