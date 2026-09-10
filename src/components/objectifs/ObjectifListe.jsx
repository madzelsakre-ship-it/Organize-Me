import { useState } from 'react';
import { Plus, Check, Trash2, X, Lightbulb } from 'lucide-react';
import { TYPES_OBJECTIF, SUGGESTIONS_OBJECTIF } from '@/lib/objectifs';

export default function ObjectifListe({ type, objectifs, onAjouter, onToggle, onSupprimer }) {
  const cfg = TYPES_OBJECTIF[type];
  const suggestion = SUGGESTIONS_OBJECTIF[type];
  const [ajout, setAjout] = useState(false);
  const [titre, setTitre] = useState('');
  const [emoji, setEmoji] = useState('🎯');
  const liste = objectifs.filter(o => o.type === type);
  const faites = liste.filter(o => o.atteint).length;

  function valider() {
    if (!titre.trim()) return;
    onAjouter(type, titre.trim(), emoji);
    setTitre('');
    setEmoji('🎯');
    setAjout(false);
  }

  return (
    <div className="space-y-2">
      <div className="space-y-1.5">
        {liste.length === 0 && !ajout && <p className="text-xs text-muted-foreground py-1">Aucun objectif — ajoute le premier.</p>}
        {liste.map(o => (
          <div key={o.id} className="flex items-center gap-2 p-2.5 rounded-xl" style={{ background: 'var(--surface)' }}>
            <button onClick={() => onToggle(o)}
              className="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors"
              style={o.atteint ? { background: cfg.color, borderColor: cfg.color } : { borderColor: 'rgba(255,255,255,0.2)' }}>
              {o.atteint && <Check size={12} className="text-black" />}
            </button>
            <span className="text-sm">{o.emoji}</span>
            <p className={`flex-1 text-sm font-semibold ${o.atteint ? 'line-through opacity-50' : ''}`} style={{ color: 'var(--foreground)' }}>{o.titre}</p>
            <button onClick={() => onSupprimer(o)} className="p-1 rounded-lg hover:bg-destructive/20"><Trash2 size={12} className="text-destructive" /></button>
          </div>
        ))}
      </div>

      {ajout ? (
        <div className="p-3 rounded-xl border border-border" style={{ background: 'var(--surface)' }}>
          {/* Suggestion proposée */}
          <button onClick={() => { setTitre(suggestion); setEmoji(cfg.emoji); }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold mb-2 transition-colors"
            style={{ background: cfg.color + '15', color: cfg.color, border: `1px solid ${cfg.color}40` }}>
            <Lightbulb size={13} />
            <span className="flex-1 text-left">{suggestion}</span>
            <span className="text-[10px] opacity-70">utiliser</span>
          </button>
          {/* Champ libre */}
          <div className="flex gap-2">
            <input value={emoji} onChange={e => setEmoji(e.target.value)} maxLength={2} className="w-10 text-center bg-background border border-border rounded-lg px-1 py-2 text-sm" />
            <input value={titre} onChange={e => setTitre(e.target.value)} onKeyDown={e => e.key === 'Enter' && valider()}
              placeholder="Ou écris le tien…" autoFocus
              className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-gold" />
            <button onClick={valider} className="px-3 rounded-lg font-bold flex items-center justify-center" style={{ background: cfg.color, color: '#000' }}><Check size={16} /></button>
            <button onClick={() => setAjout(false)} className="px-2 rounded-lg text-muted-foreground flex items-center"><X size={16} /></button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAjout(true)}
          className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold border border-dashed border-border text-muted-foreground hover:border-gold hover:text-gold transition-colors">
          <Plus size={14} /> Ajouter un objectif
        </button>
      )}
    </div>
  );
}