// Drives the Features product windows (FeatureWindow.astro) and the shared 3D view (components/features/scene.ts).
// Stage -1 is the model before Rev B is checked; 0–3 are detect, impact, alternatives, options.
// Every element with data-on="…" is active (data-active) when its list contains the current stage.
import type { FeatureScene } from '../components/features/scene';

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fmt = (n: number) => n.toLocaleString('en-US');

let scene: FeatureScene | null = null;
let loading: Promise<FeatureScene | null> | null = null;
let holder: HTMLElement | null = null; // the window currently showing the 3D canvas

function loadScene() {
  loading ??= import('../components/features/scene')
    .then((m) => m.createFeatureScene())
    .catch(() => null)
    .then((s) => {
      scene = s;
      if (s) s.onOption = (k) => holder && setOption(holder, k);
      return s;
    });
  return loading;
}

/** Give the 3D canvas to this window (the previous one keeps a still of its last frame). */
function claim(fw: HTMLElement) {
  if (!scene || holder === fw) return;
  holder = fw;
  scene.attach(fw.querySelector<HTMLElement>('[data-fw-viewport]')!, Number(fw.dataset.stage), Number(fw.dataset.option));
}

function countUp(el: HTMLElement) {
  const to = Number(el.dataset.count);
  if (reduce) {
    el.textContent = fmt(to);
    return;
  }
  const t0 = performance.now();
  const tick = (now: number) => {
    const p = Math.min(1, (now - t0) / 900);
    el.textContent = fmt(Math.round(to * (1 - Math.pow(1 - p, 3))));
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

export function setStage(fw: HTMLElement, n: number) {
  if (fw.dataset.stage === String(n)) return;
  fw.dataset.stage = String(n);
  if (holder === fw) scene?.setStage(n);
  for (const el of fw.querySelectorAll<HTMLElement>('[data-on]')) {
    const on = el.dataset.on!.split(' ').includes(String(n));
    if (on === el.hasAttribute('data-active')) continue;
    el.toggleAttribute('data-active', on);
    const counters = [...el.querySelectorAll<HTMLElement>('[data-count]')];
    if (on) counters.forEach(countUp);
    else if (!reduce) counters.forEach((c) => (c.textContent = '0'));
  }
}

export function setOption(fw: HTMLElement, k: number) {
  fw.dataset.option = String(k);
  fw.querySelectorAll<HTMLElement>('[data-option]').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.option) === k)));
  fw.querySelectorAll<HTMLElement>('[data-pane]').forEach((p) => (p.hidden = Number(p.dataset.pane) !== k));
  if (holder === fw) scene?.setOption(k);
}

/**
 * Wire up one window. "scroll" windows (desktop) get their stage from the Features steps;
 * "inview" windows (phones, one per step) play from the previous stage into their own when scrolled into view.
 */
export function initWindow(fw: HTMLElement) {
  fw.querySelectorAll<HTMLElement>('[data-option]').forEach((b) => b.addEventListener('click', () => setOption(fw, Number(b.dataset.option))));

  const inview = fw.dataset.mode === 'inview';
  const target = Number(fw.dataset.target);
  if (inview && !reduce) setStage(fw, target - 1);

  // Start loading three.js well before the window arrives.
  const near = new IntersectionObserver(
    ([e]) => {
      if (!e.isIntersecting) return;
      loadScene();
      near.disconnect();
    },
    { rootMargin: '800px 0px' },
  );
  near.observe(fw);

  let played = !inview || reduce;
  new IntersectionObserver(
    ([e]) => {
      if (e.intersectionRatio < 0.45) return;
      loadScene().then(() => {
        claim(fw);
        if (!played) {
          played = true;
          setStage(fw, target);
        }
      });
    },
    { threshold: [0, 0.45, 0.8] },
  ).observe(fw);
}
