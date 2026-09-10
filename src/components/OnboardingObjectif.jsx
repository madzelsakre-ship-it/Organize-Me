import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { X, ChevronRight } from 'lucide-react';

const OBJECTIFS = [
  { emoji: '🎓', label: 'Réussir mes études', desc: 'Révisions, examens, diplôme' },
  { emoji: '💪', label: 'Me remettre en forme', desc: 'Sport, alimentation, santé' },
  { emoji: '💼', label: 'Lancer mon projet', desc: 'Business, freelance, side-project' },
  { emoji: '🙏', label: 'Discipline spirituelle', desc: 'Prières, lecture, croissance' },
  { emoji: '🧠', label: 'Apprendre une compétence', desc: 'Code, langue, formation' },
  { emoji: '⚖️', label: 'Équilibre vie-travail', desc: 'Productivité + temps pour soi' },
];

export default function OnboardingObjectif({ onClose }) {
  const [selected, setSelected] = useState('');
  const [custom, setCustom] = useState('');
  const [saving, setSaving] = useState(false);

  async function sauvegarder() {
    const objectif = custom.trim() || selected;
    if (!objectif) return;
    setSaving(true);
    await base44.auth.updateMe({ objectif_principal: objectif });
    setSaving(false);
    onClose();
  }

  const objectifFinal = custom.trim() || selected;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.85)' }}>
      <div className="w-full max-w-sm rounded-3xl border border-border p-6 animate-fade-in" style={{ background: '#0D0D18' }}>

        <div className="flex items-start justify-between mb-2">
          <div>
            <p className="text-xs font-bold tracking-widest" style={{ color: 'var(--gold)' }}>BIENVENUE 👋</p>
            <h2 className="text-lg font-black text-foreground mt-1">Quel est ton objectif<br />principal ?</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-accent/50 mt-1">
            <X size={16} className="text-muted-foreground" />
          </button>
        </div>

        <p className="text-xs text-muted-foreground mb-4">Cela permet au coach IA de personnaliser tes rappels et défis.</p>

        <div className="space-y-2 mb-4">
          {OBJECTIFS.map(obj => (
            <button key={obj.label} onClick={() => { setSelected(obj.label); setCustom(''); }}
              className="w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all"
              style={{
                background: selected === obj.label && !custom ? 'rgba(249,115,22,0.1)' : 'var(--accent)',
                borderColor: selected === obj.label && !custom ? 'var(--gold)' : 'var(--border)',
              }}>
              <span className="text-xl shrink-0">{obj.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-foreground">{obj.label}</p>
                <p className="text-xs text-muted-foreground">{obj.desc}</p>
              </div>
              {selected === obj.label && !custom && (
                <div className="w-4 h-4 rounded-full shrink-0" style={{ background: 'var(--gold)' }} />
              )}
            </button>
          ))}
        </div>

        <div className="mb-4">
          <input
            value={custom}
            onChange={e => { setCustom(e.target.value); setSelected(''); }}
            placeholder="Ou décris ton objectif…"
            className="w-full bg-accent border border-border rounded-xl px-4 py-2.5 text-sm text-foreground outline-none focus:border-gold"
          />
        </div>

        <button onClick={sauvegarder} disabled={!objectifFinal || saving}
          className="w-full py-3 rounded-xl font-black text-sm flex items-center justify-center gap-2 disabled:opacity-40"
          style={{ background: 'var(--gold)', color: '#080810' }}>
          {saving ? 'Sauvegarde…' : <><span>C'est parti !</span> <ChevronRight size={16} /></>}
        </button>
      </div>
    </div>
  );
}