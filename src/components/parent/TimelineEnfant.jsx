import { CheckCircle2, RotateCcw, Trash2, Pencil, AlertTriangle, Clock } from 'lucide-react';
import { STATUTS, parseHeureMin } from '@/lib/surveillance';

export default function TimelineEnfant({ tasks, onValider, onRouvrir, onSupprimer, onEditer }) {
  const sorted = [...tasks].sort((a, b) => (parseHeureMin(a.heure) || 0) - (parseHeureMin(b.heure) || 0));
  const alertes = sorted.filter(t => t.statut === 'manquee' || t.statut === 'en_retard');
  const faites = sorted.filter(t => t.statut === 'validee').length;

  if (sorted.length === 0) {
    return (
      <div className="text-center py-10 text-muted-foreground">
        <p className="text-3xl mb-2">📋</p>
        <p className="text-sm font-semibold">Aucune tâche aujourd'hui</p>
        <p className="text-xs">Ajoutez une tâche pour démarrer le suivi</p>
      </div>
    );
  }

  return (
    <div>
      {alertes.length > 0 && (
        <div className="rounded-2xl border p-3 mb-4 flex items-center gap-2 animate-fade-in" style={{ borderColor: 'rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.08)' }}>
          <AlertTriangle size={16} className="text-destructive shrink-0" />
          <p className="text-xs font-bold text-destructive">{alertes.length} tâche(s) en retard/manquée(s) — activité suivie en temps réel</p>
        </div>
      )}

      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-bold tracking-widest text-muted-foreground">JOURNÉE EN DIRECT</p>
        <p className="text-xs font-bold" style={{ color: 'var(--gold)' }}>{faites}/{sorted.length} validées</p>
      </div>

      <div className="relative pl-5 space-y-2">
        <div className="absolute left-2 top-1 bottom-1 w-px" style={{ background: 'var(--border)' }} />
        {sorted.map(t => {
          const st = STATUTS[t.statut] || STATUTS.a_faire;
          return (
            <div key={t.id} className="relative rounded-2xl border border-border p-3" style={{ background: 'var(--surface)' }}>
              <div className="absolute -left-3.5 top-4 w-3 h-3 rounded-full border-2" style={{ background: st.color, borderColor: '#0D0D18' }} />
              <div className="flex items-center gap-3">
                <div className="text-center shrink-0 w-12">
                  <Clock size={11} className="text-muted-foreground mx-auto" />
                  <p className="text-[11px] font-mono font-bold text-foreground mt-0.5">{t.heure}</p>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-foreground truncate">{t.titre}</p>
                    {t.important && <span className="text-xs">⚡</span>}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: st.bg, color: st.color }}>{st.emoji} {st.label}</span>
                    {t.commencee_a && <span className="text-[10px] text-muted-foreground">début {new Date(t.commencee_a).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>}
                  </div>
                  {t.note_parent && <p className="text-[11px] text-muted-foreground mt-1">📝 {t.note_parent}</p>}
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  {t.statut !== 'validee' ? (
                    <button onClick={() => onValider(t)} title="Valider à distance" className="p-1.5 rounded-lg hover:bg-accent" style={{ background: 'rgba(34,197,94,0.1)' }}>
                      <CheckCircle2 size={14} className="text-green-500" />
                    </button>
                  ) : (
                    <button onClick={() => onRouvrir(t)} title="Rouvrir" className="p-1.5 rounded-lg hover:bg-accent" style={{ background: 'rgba(156,163,175,0.1)' }}>
                      <RotateCcw size={14} className="text-muted-foreground" />
                    </button>
                  )}
                  <button onClick={() => onEditer(t)} title="Modifier" className="p-1.5 rounded-lg hover:bg-accent">
                    <Pencil size={14} className="text-muted-foreground" />
                  </button>
                  <button onClick={() => onSupprimer(t)} title="Supprimer" className="p-1.5 rounded-lg hover:bg-destructive/20">
                    <Trash2 size={14} className="text-destructive" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}