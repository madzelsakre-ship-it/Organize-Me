import { useState } from 'react';
import { base44 } from '@/api/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { Sparkles, Pencil, X, Check } from 'lucide-react';
import { MANTRAS_SUGGESTIONS } from '@/lib/objectifs';

export default function MantraBanner() {
  const { currentUser } = useAuth();
  const [editing, setEditing] = useState(false);
  const [texte, setTexte] = useState('');
  const [saving, setSaving] = useState(false);

  const mantra = currentUser?.mantra;

  async function sauver() {
    setSaving(true);
    await base44.auth.updateMe({ mantra: texte.trim() });
    setEditing(false);
    setSaving(false);
  }

  function commencerEdition() {
    setTexte(mantra || '');
    setEditing(true);
  }

  if (editing) {
    return (
      <div className="mb-3 rounded-2xl border p-4" style={{ background: 'var(--surface)', borderColor: 'var(--gold-line)' }}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-bold tracking-widest" style={{ color: 'var(--gold)' }}>✦ MA MANTRA</span>
          <button onClick={() => setEditing(false)}><X size={14} className="text-muted-foreground" /></button>
        </div>
        <textarea value={texte} onChange={e => setTexte(e.target.value)} rows={2}
          placeholder="Ta phrase guide…"
          className="w-full bg-accent border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-gold resize-none" />
        <div className="flex flex-wrap gap-1.5 mt-2">
          {MANTRAS_SUGGESTIONS.map(m => (
            <button key={m} onClick={() => setTexte(m)}
              className="text-[10px] px-2 py-1 rounded-full border border-border text-muted-foreground hover:border-gold transition-colors">
              {m.length > 28 ? m.slice(0, 28) + '…' : m}
            </button>
          ))}
        </div>
        <button onClick={sauver} disabled={saving || !texte.trim()}
          className="w-full mt-2 py-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1 disabled:opacity-50"
          style={{ background: 'var(--gold)', color: '#080810' }}>
          <Check size={13} /> {saving ? '…' : 'Enregistrer'}
        </button>
      </div>
    );
  }

  if (!mantra) {
    return (
      <button onClick={commencerEdition}
        className="w-full mb-3 flex items-center justify-center gap-2 py-3 rounded-2xl text-xs font-bold border border-dashed transition-colors"
        style={{ borderColor: 'var(--gold-line)', color: 'var(--gold)', background: 'var(--gold-dim)' }}>
        <Sparkles size={14} /> Définir ta mantra
      </button>
    );
  }

  return (
    <div className="mb-3 rounded-2xl border p-4 relative overflow-hidden" style={{ background: 'var(--surface)', borderColor: 'var(--gold-line)' }}>
      <div className="absolute inset-0 opacity-10" style={{ background: 'radial-gradient(circle at 90% 10%, var(--gold), transparent 70%)' }} />
      <div className="relative">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-bold tracking-widest" style={{ color: 'var(--gold)' }}>✦ MA MANTRA</span>
          <button onClick={commencerEdition} className="p-1 rounded-lg hover:bg-accent"><Pencil size={12} className="text-muted-foreground" /></button>
        </div>
        <p className="text-sm font-semibold italic leading-relaxed" style={{ color: 'rgba(255,255,255,0.85)' }}>"{mantra}"</p>
      </div>
    </div>
  );
}