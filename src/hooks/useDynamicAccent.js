import { useLayoutEffect } from 'react';

// Palette d'accents — l'ordre suit la séquence demandée : orange → bleu → vert → ...
const PALETTE = [
  { name: 'orange',  hex: '#F97316', rgb: '249,115,22' },
  { name: 'indigo',  hex: '#6366F1', rgb: '99,102,241' },
  { name: 'emerald', hex: '#10B981', rgb: '16,185,129' },
  { name: 'sky',     hex: '#0EA5E9', rgb: '14,165,233' },
  { name: 'pink',    hex: '#EC4899', rgb: '236,72,153' },
  { name: 'violet',  hex: '#8B5CF6', rgb: '139,92,246' },
  { name: 'amber',   hex: '#F59E0B', rgb: '245,158,11' },
];

// Garde anti double-invoke (StrictMode dev) — un seul cycle par session navigateur
let sessionApplied = false;

/**
 * Cycle la couleur d'accent de l'app à chaque nouvelle entrée (reload / réouverture PWA).
 * Persiste l'index en localStorage et applique les variables CSS avant le premier paint.
 */
export default function useDynamicAccent() {
  useLayoutEffect(() => {
    if (sessionApplied) return;
    sessionApplied = true;

    const stored = localStorage.getItem('accent-index');
    const next = stored === null ? 0 : (parseInt(stored, 10) + 1) % PALETTE.length;
    localStorage.setItem('accent-index', String(next));

    const c = PALETTE[next];
    const root = document.documentElement;
    root.style.setProperty('--gold', c.hex);
    root.style.setProperty('--gold-dim', `rgba(${c.rgb}, 0.15)`);
    root.style.setProperty('--gold-line', `rgba(${c.rgb}, 0.3)`);

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', c.hex);
  }, []);
}