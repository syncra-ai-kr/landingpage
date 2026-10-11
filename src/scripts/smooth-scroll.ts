import Lenis from 'lenis';
import 'lenis/dist/lenis.css';

// Smooth scrolling (oddity1-style). Skipped entirely for reduced-motion users.
if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const lenis = new Lenis({
    autoRaf: true,
    lerp: 0.12,
    anchors: { offset: -88, duration: 1.1 },
  });
  (window as unknown as { lenis: Lenis }).lenis = lenis;
}
