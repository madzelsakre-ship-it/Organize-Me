import { Check, Lock } from 'lucide-react';

export default function Badges({ streak = 0, totalFaites = 0, score = 100, habitudes = 0, stats = [] }) {
  const badges = [
    { id: 'etincelle', emoji: '🔥', label: 'Première étincelle', desc: '1 jour de streak', atteint: streak >= 1, color: '#F39C12' },
    { id: 'semaine', emoji: '⚡', label: 'Semaine parfaite', desc: '7 jours de streak', atteint: streak >= 7, color: '#3498DB' },
    { id: 'maitre', emoji: '🏆', label: 'Maître du feu', desc: '30 jours de streak', atteint: streak >= 30, color: '#9B59B6' },
    { id: 'centurion', emoji: '💯', label: 'Centurion', desc: '100 tâches faites', atteint: totalFaites >= 100, color: '#2ECC71' },
    { id: 'legende', emoji: '💎', label: 'Légende', desc: '500 tâches faites', atteint: totalFaites >= 500, color: '#E91E63' },
    { id: 'discipline', emoji: '⭐', label: 'Discipliné', desc: 'Score ≥ 70', atteint: score >= 70, color: '#6366F1' },
    { id: 'habituel', emoji: '🌟', label: 'Habituel', desc: '5 habitudes actives', atteint: habitudes >= 5, color: '#00BCD4' },
    { id: 'bilan', emoji: '📊', label: 'Bilan régulier', desc: '10 bilans enregistrés', atteint: stats.length >= 10, color: '#FF9800' },
  ];

  const atteints = badges.filter(b => b.atteint).length;

  return (
    <div className="mb-3 rounded-3xl p-5" style={{ background: '#1C1C1E' }}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-[10px] font-bold tracking-widest" style={{ color: 'rgba(255,255,255,0.35)' }}>TROPHÉES</p>
          <p className="text-sm font-black text-white">{atteints}/{badges.length} débloqués</p>
        </div>
        <span className="text-2xl">🏅</span>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {badges.map(b => (
          <div key={b.id} className="flex flex-col items-center text-center py-2 rounded-2xl transition-all"
            style={{
              background: b.atteint ? `${b.color}15` : 'rgba(255,255,255,0.03)',
              border: `1px solid ${b.atteint ? b.color + '50' : 'rgba(255,255,255,0.06)'}`,
              opacity: b.atteint ? 1 : 0.4,
            }}
            title={b.desc}
          >
            <span className="text-xl mb-0.5" style={{ filter: b.atteint ? 'none' : 'grayscale(1)' }}>{b.emoji}</span>
            <p className="text-[8px] font-bold leading-tight" style={{ color: b.atteint ? b.color : 'rgba(255,255,255,0.4)' }}>{b.label}</p>
            {b.atteint
              ? <Check size={9} className="mt-0.5" style={{ color: b.color }} />
              : <Lock size={9} className="mt-0.5" style={{ color: 'rgba(255,255,255,0.25)' }} />}
          </div>
        ))}
      </div>
    </div>
  );
}