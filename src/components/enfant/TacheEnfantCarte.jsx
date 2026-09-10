import { Play, Check, Clock } from 'lucide-react';
import { STATUTS } from '@/lib/surveillance';

export default function TacheEnfantCarte({ tache, onCommencer, onTerminer }) {
  const st = STATUTS[tache.statut] || STATUTS.a_faire;
  const terminee = tache.statut === 'validee';
  const enCours = tache.statut === 'en_cours';

  return (
    <div className="rounded-3xl border p-4 transition-all" style={{ borderColor: st.color + '55', background: st.bg }}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{st.emoji}</span>
          <span className="text-xs font-black uppercase tracking-wider" style={{ color: st.color }}>{st.label}</span>
        </div>
        <div className="flex items-center gap-1 px-2.5 py-1 rounded-full" style={{ background: 'rgba(0,0,0,0.25)' }}>
          <Clock size={12} style={{ color: st.color }} />
          <span className="text-sm font-black" style={{ color: st.color }}>{tache.heure}</span>
        </div>
      </div>
      <p className={`text-lg font-black mb-1 ${terminee ? 'line-through opacity-60' : ''}`} style={{ color: '#fff' }}>
        {tache.titre} {tache.important && '⚡'}
      </p>
      {tache.note_parent && <p className="text-xs mb-3 opacity-70" style={{ color: '#fff' }}>📝 {tache.note_parent}</p>}

      {!terminee && !enCours && (
        <button onClick={() => onCommencer(tache)}
          className="w-full py-3 rounded-2xl font-black text-base flex items-center justify-center gap-2 active:scale-95 transition-transform"
          style={{ background: '#3B82F6', color: '#fff' }}>
          <Play size={18} /> Commencer
        </button>
      )}
      {enCours && (
        <button onClick={() => onTerminer(tache)}
          className="w-full py-3 rounded-2xl font-black text-base flex items-center justify-center gap-2 active:scale-95 transition-transform"
          style={{ background: '#22C55E', color: '#fff' }}>
          <Check size={18} /> J'ai terminé !
        </button>
      )}
      {terminee && (
        <div className="w-full py-2.5 rounded-2xl font-black text-sm text-center" style={{ background: 'rgba(34,197,94,0.2)', color: '#22C55E' }}>
          ✅ Bravo, c'est fait !
        </div>
      )}
    </div>
  );
}