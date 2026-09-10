import { useState } from 'react';
import { base44 } from '@/api/supabaseClient';
import { ChevronRight, Check } from 'lucide-react';

const OBJECTIFS = [
  { label: 'Réussir mes études', emoji: '🎓', desc: 'Révisions, examens, organisation' },
  { label: 'Me remettre en forme', emoji: '💪', desc: 'Sport, alimentation, santé' },
  { label: 'Lancer mon business', emoji: '🚀', desc: 'Projets, productivité, création' },
  { label: 'Discipline spirituelle', emoji: '🙏', desc: 'Prières, lecture, développement' },
  { label: 'Équilibre vie/travail', emoji: '⚖️', desc: 'Famille, santé mentale, repos' },
  { label: 'Apprendre une compétence', emoji: '📚', desc: 'Code, langue, instrument…' },
];

const HEURES = ['5h00','5h30','6h00','6h30','7h00','7h30','8h00','8h30','9h00'];

const MANTRAS = [
  'Je fais au jour le jour, je résous au jour le jour mes problèmes.',
  "Je ne détourne pas les yeux, j'affronte avec calme.",
  'La discipline est ma liberté.',
  'Petits efforts constants, grands résultats durables.',
  'Je suis la personne que je veux devenir.',
];

export default function OnboardingModal({ user, onDone }) {
  const [etape, setEtape] = useState(0);
  const [objectif, setObjectif] = useState(null);
  const [heure, setHeure] = useState('6h30');
  const [mantra, setMantra] = useState('');
  const [mantraPerso, setMantraPerso] = useState('');
  const [saving, setSaving] = useState(false);

  async function terminer() {
    setSaving(true);
    await base44.auth.updateMe({
      objectif_principal: objectif.label,
      objectif_emoji: objectif.emoji,
      mantra: mantra || mantraPerso || '',
      heure_reveil: heure,
      premiere_connexion: false,
    });
    localStorage.setItem('onboarding-done', 'true');
    onDone({ objectif_principal: objectif.label, objectif_emoji: objectif.emoji, mantra: mantra || mantraPerso, heure_reveil: heure });
    setSaving(false);
  }

  const prenom = user?.full_name?.split(' ')[0] || 'Champion';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.95)' }}>
      <div className="w-full max-w-sm animate-fade-in">

        {/* Étape 0 — Bienvenue */}
        {etape === 0 && (
          <div className="text-center space-y-6">
            <div className="text-7xl">👑</div>
            <div>
              <h1 className="text-3xl font-black text-white mb-2">Bienvenue {prenom}</h1>
              <p className="text-base text-white/50">Ton coach de discipline personnel.</p>
              <p className="text-base text-white/50">Setup en 30 secondes.</p>
            </div>
            <button onClick={() => setEtape(1)}
              className="w-full py-4 rounded-2xl font-black text-lg flex items-center justify-center gap-2"
              style={{ background: '#F97316', color: '#000' }}>
              Commencer <ChevronRight size={20} />
            </button>
          </div>
        )}

        {/* Étape 1 — Objectif */}
        {etape === 1 && (
          <div className="space-y-4">
            <div className="mb-6">
              <p className="text-xs tracking-widest text-white/30 mb-1">1 / 3</p>
              <h2 className="text-2xl font-black text-white">Ton objectif principal ?</h2>
              <p className="text-sm text-white/40 mt-1">Ça guide toute l'intelligence du coach.</p>
            </div>
            <div className="space-y-2">
              {OBJECTIFS.map(obj => (
                <button key={obj.label} onClick={() => setObjectif(obj)}
                  className="w-full flex items-center gap-3 p-4 rounded-2xl border text-left transition-all"
                  style={{
                    background: objectif?.label === obj.label ? 'rgba(249,115,22,0.12)' : '#1C1C1E',
                    borderColor: objectif?.label === obj.label ? '#F97316' : 'rgba(255,255,255,0.08)',
                  }}>
                  <span className="text-2xl shrink-0">{obj.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white">{obj.label}</p>
                    <p className="text-xs text-white/35">{obj.desc}</p>
                  </div>
                  {objectif?.label === obj.label && <Check size={16} style={{ color: '#F97316', shrink: 0 }} />}
                </button>
              ))}
            </div>
            <button onClick={() => setEtape(2)} disabled={!objectif}
              className="w-full py-4 rounded-2xl font-black text-base disabled:opacity-30 mt-2"
              style={{ background: '#F97316', color: '#000' }}>
              Continuer →
            </button>
          </div>
        )}

        {/* Étape 2 — Mantra */}
        {etape === 2 && (
          <div className="space-y-4">
            <div className="mb-6">
              <p className="text-xs tracking-widest text-white/30 mb-1">2 / 3</p>
              <h2 className="text-2xl font-black text-white">Ta mantra</h2>
              <p className="text-sm text-white/40 mt-1">Une phrase qui te guide au quotidien. Affichée chaque jour.</p>
            </div>
            <div className="space-y-2">
              {MANTRAS.map(m => (
                <button key={m} onClick={() => { setMantra(m); setMantraPerso(''); }}
                  className="w-full p-4 rounded-2xl border text-left text-sm transition-all"
                  style={{
                    background: mantra === m ? 'rgba(249,115,22,0.12)' : '#1C1C1E',
                    borderColor: mantra === m ? '#F97316' : 'rgba(255,255,255,0.08)',
                    color: mantra === m ? '#fff' : 'rgba(255,255,255,0.7)',
                  }}>
                  "{m}"
                </button>
              ))}
            </div>
            <input value={mantraPerso} onChange={e => { setMantraPerso(e.target.value); setMantra(''); }}
              placeholder="Ou écris la tienne…"
              className="w-full bg-[#1C1C1E] border border-white/10 rounded-2xl px-4 py-3 text-sm text-white outline-none focus:border-[#F97316]" />
            <button onClick={() => setEtape(3)} disabled={!mantra && !mantraPerso}
              className="w-full py-4 rounded-2xl font-black text-base disabled:opacity-30 mt-2"
              style={{ background: '#F97316', color: '#000' }}>
              Continuer →
            </button>
          </div>
        )}

        {/* Étape 3 — Heure réveil */}
        {etape === 3 && (
          <div className="space-y-4">
            <div className="mb-6">
              <p className="text-xs tracking-widest text-white/30 mb-1">3 / 3</p>
              <h2 className="text-2xl font-black text-white">Tu te lèves à quelle heure ?</h2>
              <p className="text-sm text-white/40 mt-1">Pour planifier ta première tâche du matin.</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {HEURES.map(h => (
                <button key={h} onClick={() => setHeure(h)}
                  className="py-3 rounded-xl text-sm font-black transition-all"
                  style={heure === h
                    ? { background: '#F97316', color: '#000' }
                    : { background: '#1C1C1E', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  {h}
                </button>
              ))}
            </div>
            <div className="pt-4 rounded-2xl p-4 border" style={{ background: 'rgba(249,115,22,0.08)', borderColor: 'rgba(249,115,22,0.2)' }}>
              <p className="text-xs text-white/40 mb-1">Récapitulatif</p>
              <p className="text-sm font-bold text-white">{objectif?.emoji} {objectif?.label}</p>
              <p className="text-sm text-white/50">Réveil à {heure}</p>
            </div>
            <button onClick={terminer} disabled={saving}
              className="w-full py-4 rounded-2xl font-black text-base disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ background: '#F97316', color: '#000' }}>
              {saving ? 'Sauvegarde…' : '🚀 C\'est parti !'}
            </button>
          </div>
        )}

      </div>
    </div>
  );
}