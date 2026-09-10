import { useMemo } from 'react';
import { Bell } from 'lucide-react';

// Parse "08h30" -> minutes depuis minuit
function parseHeure(h) {
  if (!h) return null;
  const match = h.match(/(\d+)h(\d*)/);
  if (!match) return null;
  return parseInt(match[1]) * 60 + (parseInt(match[2]) || 0);
}

export default function CoachAnticipateur({ tachesAujourd }) {
  const alerte = useMemo(() => {
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();

    // Tâches pas encore faites, triées par heure
    const prochaines = tachesAujourd
      .filter(t => !t.faite && t.heure)
      .map(t => ({ ...t, min: parseHeure(t.heure) }))
      .filter(t => t.min !== null && t.min > nowMin)
      .sort((a, b) => a.min - b.min);

    if (prochaines.length === 0) return null;

    const prochaine = prochaines[0];
    const diff = prochaine.min - nowMin; // minutes restantes

    if (diff <= 17 && diff >= 1) {
      return { tache: prochaine, diff, urgence: diff <= 5 ? 'haute' : diff <= 10 ? 'moyenne' : 'basse' };
    }
    return null;
  }, [tachesAujourd]);

  if (!alerte) return null;

  const { tache, diff, urgence } = alerte;

  const colors = {
    haute: { bg: 'rgba(231,76,60,0.12)', border: 'rgba(231,76,60,0.4)', text: '#E74C3C', emoji: '🚨' },
    moyenne: { bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.4)', text: 'var(--gold)', emoji: '⚡' },
    basse: { bg: 'rgba(249,115,22,0.08)', border: 'rgba(249,115,22,0.25)', text: 'var(--gold)', emoji: '🔔' },
  };
  const c = colors[urgence];

  return (
    <div
      className="rounded-2xl p-4 mb-6 flex items-start gap-3 animate-fade-in"
      style={{ background: c.bg, border: `1px solid ${c.border}` }}
    >
      <div className="text-xl mt-0.5">{c.emoji}</div>
      <div className="flex-1">
        <p className="text-sm font-black" style={{ color: c.text }}>
          {diff === 1 ? "Dans 1 minute" : `Dans ${diff} minutes`} — {tache.titre}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {diff <= 5
            ? "Arrête ce que tu fais, prépare-toi maintenant !"
            : diff <= 10
            ? "Commence à préparer tes affaires."
            : "Prépare-toi pour être à l'heure."}
          {' '}<span className="font-semibold">Prévu à {tache.heure}.</span>
        </p>
      </div>
      <Bell size={16} style={{ color: c.text }} className="shrink-0 mt-0.5" />
    </div>
  );
}