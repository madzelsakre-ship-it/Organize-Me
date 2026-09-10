import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Sparkles, RefreshCw } from 'lucide-react';

export default function CoachMessage({ userName, objectif, tachesAujourd, streak, stats }) {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  const heure = new Date().getHours();
  const isMatin = heure < 14;
  const isSoir = heure >= 19;

  async function fetchMessage() {
    setLoading(true);
    const faites = tachesAujourd.filter(t => t.faite).length;
    const total = tachesAujourd.length;
    const taux = total > 0 ? Math.round(faites / total * 100) : 0;

    const dernierStat = stats[0];
    const energieMoyenne = stats.slice(0, 3).length > 0
      ? (stats.slice(0, 3).reduce((a, s) => a + (s.energie || 3), 0) / Math.min(3, stats.length)).toFixed(1)
      : null;

    const moment = isMatin ? 'matin' : isSoir ? 'soir' : 'après-midi';
    const prompt = `Tu es un coach de vie élite, motivant et direct. Génère UN SEUL message court (2-3 phrases max) en français pour ${userName || 'le champion'} en ce ${moment}.

Contexte :
- Heure : ${heure}h
- Objectif principal : ${objectif || 'non défini'}
- Streak actuel : ${streak} jours consécutifs
- Tâches aujourd'hui : ${faites}/${total} complétées (${taux}%)
- Énergie moyenne (3 derniers jours) : ${energieMoyenne ? `${energieMoyenne}/5` : 'pas encore de données'}
${dernierStat ? `- Dernier bilan : énergie ${dernierStat.energie}/5, focus ${dernierStat.focus}/5, humeur ${dernierStat.humeur}/5` : ''}

Instructions :
- Tiens compte de l'objectif principal pour personnaliser le message
- Si c'est le matin : motive pour la journée à venir, rappelle les tâches du jour
- Si c'est le soir : félicite ou encourage selon les tâches complétées, rappelle de faire le bilan
- Si c'est l'après-midi : boost d'énergie pour finir fort
- Commence TOUJOURS par "💪" ou "🔥" ou "⚡" ou "🎯" selon l'énergie
- Cite le prénom si disponible
- Sois direct, percutant, style coach élite (pas scolaire)
- Maximum 2 phrases. Aucun titre, aucune liste.`;

    try {
      const result = await base44.integrations.Core.InvokeLLM({ prompt });
      localStorage.setItem(`coach-msg-${new Date().toISOString().slice(0, 10)}`, result);
      setMessage(result);
    } catch (e) {
      const faites = tachesAujourd.filter(t => t.faite).length;
      const total = tachesAujourd.length;
      if (total > 0 && faites === total) {
        setMessage(`🏆 Toutes les tâches du jour sont complètes${userName ? `, ${userName}` : ''} — quelle discipline ! Continue sur cette lancée.`);
      } else if (streak > 2) {
        setMessage(`🔥 ${streak} jours de streak${userName ? ` ${userName}` : ''} — ne laisse rien briser ton élan aujourd'hui !`);
      } else {
        setMessage(`⚡ Chaque effort compte${userName ? ` ${userName}` : ''}. Reste focus, la discipline se construit tâche après tâche.`);
      }
    }
    setLoading(false);
  }

  useEffect(() => {
    // Cache quotidien : évite un appel LLM (crédits + latence) à chaque montage du Dashboard
    const cached = localStorage.getItem(`coach-msg-${new Date().toISOString().slice(0, 10)}`);
    if (cached) {
      setMessage(cached);
      setLoading(false);
      return;
    }
    fetchMessage();
  }, []);

  const bgGradient = isMatin
    ? 'linear-gradient(135deg, rgba(249,115,22,0.12), rgba(234,179,8,0.08))'
    : isSoir
    ? 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(249,115,22,0.08))'
    : 'linear-gradient(135deg, rgba(249,115,22,0.1), rgba(239,68,68,0.06))';

  const label = isMatin ? '🌅 Bonjour Champion' : isSoir ? '🌙 Ce soir' : '☀️ Cet après-midi';

  return (
    <div
      className="rounded-2xl border border-border p-4 mb-6 relative overflow-hidden"
      style={{ background: 'var(--surface)' }}
    >
      <div className="absolute inset-0 rounded-2xl" style={{ background: bgGradient }} />
      <div className="relative">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Sparkles size={14} style={{ color: 'var(--gold)' }} />
            <span className="text-xs font-black tracking-widest" style={{ color: 'var(--gold)' }}>
              {label.toUpperCase()}
            </span>
          </div>
          <button
            onClick={fetchMessage}
            className="p-1 rounded-lg hover:bg-accent/50 transition-colors"
            disabled={loading}
          >
            <RefreshCw size={12} className={`text-muted-foreground ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {loading ? (
          <div className="space-y-2">
            <div className="h-3 rounded-full bg-border animate-pulse w-4/5" />
            <div className="h-3 rounded-full bg-border animate-pulse w-3/5" />
          </div>
        ) : (
          <p className="text-sm font-medium text-foreground leading-relaxed">{message}</p>
        )}
      </div>
    </div>
  );
}