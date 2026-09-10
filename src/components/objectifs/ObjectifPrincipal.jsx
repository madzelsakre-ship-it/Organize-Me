import { useState } from 'react';
import { base44 } from '@/api/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { Pencil, Check, X, Lightbulb, Target } from 'lucide-react';
import { OBJECTIFS_PRINCIPAUX } from '@/lib/objectifs';

export default function ObjectifPrincipal() {
  const { currentUser } = useAuth();
  const [edit, setEdit] = useState(false);
  const [emoji, setEmoji] = useState(currentUser?.objectif_emoji || '🎯');
  const [texte, setTexte] = useState(currentUser?.objectif_principal || '');
  const [saving, setSaving] = useState(false);

  function commencer() {
    setEmoji(currentUser?.objectif_emoji || '🎯');
    setTexte(currentUser?.objectif_principal || '');
    setEdit(true);
  }

  async function valider() {
    if (!texte.trim()) return;
    setSaving(true);
    await base44.auth.updateMe({ objectif_principal: texte.trim(), objectif_emoji: emoji });
    setSaving(false);
    setEdit(false);
  }

  // Mode édition
  if (edit) {
    return (
      <div className="mb-4 p-4 rounded-2xl border animate-fade-in" style={{ background: 'var(--surface)', borderColor: 'var(--gold)' }}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] font-bold tracking-widest" style={{ color: 'var(--gold)' }}>MON OBJECTIF PRINCIPAL</p>
          <button onClick={() => setEdit(false)} className="text-muted-foreground"><X size={16} /></button>
        </div>

        {/* Suggestions proposées */}
        <p className="text-[10px] font-bold tracking-widest text-muted-foreground mb-1.5 flex items-center gap-1"><Lightbulb size={11} /> SUGGESTIONS</p>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {OBJECTIFS_PRINCIPAUX.map(o => (
            <button key={o.label} onClick={() => { setEmoji(o.emoji); setTexte(o.label); }}
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={texte === o.label
                ? { background: 'var(--gold)', color: '#000' }
                : { background: 'var(--accent)', color: 'var(--muted-foreground)', border: '1px solid var(--border)' }}>
              {o.emoji} {o.label}
            </button>
          ))}
        </div>

        {/* Champ libre */}
        <p className="text-[10px] font-bold tracking-widest text-muted-foreground mb-1.5">OU ÉCRIS LE TIEN</p>
        <div className="flex gap-2">
          <input value={emoji} onChange={e => setEmoji(e.target.value)} maxLength={2} className="w-12 text-center text-lg bg-background border border-border rounded-lg px-1 py-2.5" />
          <input value={texte} onChange={e => setTexte(e.target.value)} onKeyDown={e => e.key === 'Enter' && valider()}
            placeholder="Mon objectif…" autoFocus
            className="flex-1 bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-foreground outline-none focus:border-gold" />
        </div>
        <button onClick={valider} disabled={saving || !texte.trim()}
          className="w-full mt-3 py-2.5 rounded-xl font-black text-sm flex items-center justify-center gap-2 disabled:opacity-50"
          style={{ background: 'var(--gold)', color: '#000' }}>
          <Check size={15} /> {saving ? 'Sauvegarde…' : 'Définir mon objectif'}
        </button>
      </div>
    );
  }

  // Affichage
  return (
    <div className="mb-4 p-4 rounded-2xl border border-border flex items-center gap-3" style={{ background: 'var(--surface)' }}>
      <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'var(--gold-dim)' }}>
        {currentUser?.objectif_principal
          ? <span className="text-xl">{currentUser.objectif_emoji || '🎯'}</span>
          : <Target size={20} style={{ color: 'var(--gold)' }} />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold tracking-widest text-muted-foreground">OBJECTIF PRINCIPAL</p>
        {currentUser?.objectif_principal
          ? <p className="text-sm font-black text-foreground truncate">{currentUser.objectif_principal}</p>
          : <p className="text-sm text-muted-foreground">Aucun objectif défini</p>}
      </div>
      <button onClick={commencer}
        className="p-2 rounded-lg border border-border hover:border-gold transition-colors shrink-0"
        style={{ background: 'var(--accent)' }}>
        <Pencil size={14} className="text-muted-foreground" />
      </button>
    </div>
  );
}