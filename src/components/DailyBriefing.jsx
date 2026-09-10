import { useState } from 'react';
import { base44 } from '@/api/supabaseClient';
import { Sparkles, X, Loader2 } from 'lucide-react';
import { CATEGORIES } from '@/lib/coachData';

export default function DailyBriefing({ userName, objectif, tachesAujourd, streak, onClose }) {
  const [briefing, setBriefing] = useState(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const tachesHaute = tachesAujourd.filter(t => t.priorite === 'haute' && !t.faite);
  const tachesNormales = tachesAujourd.filter(t => t.priorite !== 'haute' && !t.faite);
  const faites = tachesAujourd.filter(t => t.faite).length;
  const total = tachesAujourd.length;

  async function generer() {
    setOpen(true);
    if (briefing) return; // déjà généré
    setLoading(true);

    const prompt = `Tu es un coach de vie élite. Génère un briefing de journée ULTRA CONCIS en français pour ${userName || 'le champion'}.

Données du jour :
- Objectif principal : ${objectif || 'non défini'}
- Streak : ${streak} jours consécutifs
- Tâches total : ${total} (${faites} déjà faites)
- Tâches prioritaires restantes (${tachesHaute.length}) : ${tachesHaute.map(t => `"${t.titre}" à ${t.heure}`).join(', ') || 'aucune'}
- Autres tâches (${tachesNormales.length}) : ${tachesNormales.slice(0, 5).map(t => `"${t.titre}"`).join(', ') || 'aucune'}

Format OBLIGATOIRE (réponds EXACTEMENT avec ce JSON) :
{
  "titre": "phrase d'accroche courte et percutante (max 8 mots)",
  "priorites": ["tâche prioritaire 1", "tâche prioritaire 2", "tâche prioritaire 3"],
  "conseil": "1 conseil actionnable pour la journée (1 phrase max)",
  "energie": "haute" | "moyenne" | "basse"
}`;

    const result = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          titre: { type: 'string' },
          priorites: { type: 'array', items: { type: 'string' } },
          conseil: { type: 'string' },
          energie: { type: 'string' }
        },
        required: ['titre', 'priorites', 'conseil', 'energie']
      }
    });
    setBriefing(result);
    setLoading(false);
  }

  function fermer() {
    setOpen(false);
  }

  const energieColor = briefing?.energie === 'haute' ? '#30D158' : briefing?.energie === 'basse' ? '#FF453A' : '#F97316';
  const energieEmoji = briefing?.energie === 'haute' ? '⚡' : briefing?.energie === 'basse' ? '🧘' : '🔥';

  return (
    <>
      {/* Bouton */}
      <button
        onClick={generer}
        className="w-full flex items-center justify-center gap-2 py-4 rounded-3xl font-black text-sm transition-all active:scale-95 mb-3"
        style={{ background: 'linear-gradient(135deg, #F97316, #EA580C)', color: '#fff', boxShadow: '0 4px 24px rgba(249,115,22,0.35)' }}
      >
        <Sparkles size={16} />
        Briefing du jour en 1 clic
      </button>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.85)' }}>
          <div className="w-full max-w-md rounded-3xl border border-border animate-fade-in overflow-hidden"
            style={{ background: '#0D0D18' }}>

            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Sparkles size={16} style={{ color: '#F97316' }} />
                <span className="text-sm font-black text-white">Briefing du jour</span>
              </div>
              <button onClick={fermer} className="p-1.5 rounded-xl hover:bg-accent transition-colors">
                <X size={16} className="text-muted-foreground" />
              </button>
            </div>

            <div className="p-5">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-10 gap-3">
                  <Loader2 size={28} className="animate-spin" style={{ color: '#F97316' }} />
                  <p className="text-sm font-bold text-white">Génération en cours…</p>
                  <p className="text-xs text-muted-foreground">Analyse de tes tâches et objectifs</p>
                </div>
              ) : briefing ? (
                <div className="space-y-4">
                  {/* Titre accroche */}
                  <div className="text-center py-3">
                    <p className="text-xl font-black text-white leading-tight">{briefing.titre}</p>
                    <span className="inline-flex items-center gap-1 mt-2 px-3 py-1 rounded-full text-xs font-bold"
                      style={{ background: `${energieColor}20`, color: energieColor, border: `1px solid ${energieColor}30` }}>
                      {energieEmoji} Énergie {briefing.energie}
                    </span>
                  </div>

                  {/* Priorités */}
                  {briefing.priorites?.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold tracking-widest text-muted-foreground mb-2">🎯 PRIORITÉS</p>
                      <div className="space-y-2">
                        {briefing.priorites.map((p, i) => (
                          <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                            style={{ background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.15)' }}>
                            <span className="text-xs font-black w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                              style={{ background: '#F97316', color: '#000' }}>{i + 1}</span>
                            <p className="text-sm text-white font-semibold">{p}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Conseil */}
                  <div className="px-4 py-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <p className="text-[10px] font-bold tracking-widest text-muted-foreground mb-1">💡 CONSEIL DU JOUR</p>
                    <p className="text-sm text-white leading-relaxed">{briefing.conseil}</p>
                  </div>

                  {/* Stats rapides */}
                  <div className="flex gap-2 text-center">
                    <div className="flex-1 py-3 rounded-xl" style={{ background: 'rgba(48,209,88,0.08)' }}>
                      <p className="text-lg font-black" style={{ color: '#30D158' }}>{faites}/{total}</p>
                      <p className="text-[10px] text-muted-foreground">tâches</p>
                    </div>
                    <div className="flex-1 py-3 rounded-xl" style={{ background: 'rgba(249,115,22,0.08)' }}>
                      <p className="text-lg font-black" style={{ color: '#F97316' }}>{streak}🔥</p>
                      <p className="text-[10px] text-muted-foreground">streak</p>
                    </div>
                    <div className="flex-1 py-3 rounded-xl" style={{ background: 'rgba(249,115,22,0.08)' }}>
                      <p className="text-lg font-black" style={{ color: '#F97316' }}>{tachesHaute.length}</p>
                      <p className="text-[10px] text-muted-foreground">prioritaires</p>
                    </div>
                  </div>

                  <button onClick={fermer}
                    className="w-full py-3 rounded-2xl font-black text-sm"
                    style={{ background: '#F97316', color: '#000' }}>
                    C'est parti ! 🚀
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </>
  );
}