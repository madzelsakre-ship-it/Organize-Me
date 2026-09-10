import { useState } from 'react';
import { base44 } from '@/api/supabaseClient';
import { X } from 'lucide-react';
import { aujourdISO } from '@/lib/surveillance';

export default function FormTacheEnfant({ suiviId, tache, onSaved, onClose }) {
  const edit = !!tache;
  const [form, setForm] = useState({
    titre: tache?.titre || '',
    jour: tache?.jour || aujourdISO(),
    heure: tache?.heure || '08h00',
    important: tache?.important || false,
    note_parent: tache?.note_parent || '',
  });
  const [saving, setSaving] = useState(false);

  async function sauver() {
    if (!form.titre.trim()) return;
    setSaving(true);
    const payload = {
      suivi_id: suiviId,
      titre: form.titre,
      jour: form.jour,
      heure: form.heure,
      important: form.important,
      note_parent: form.note_parent,
    };
    if (edit) {
      await base44.entities.TacheEnfant.update(tache.id, payload);
    } else {
      await base44.entities.TacheEnfant.create({ ...payload, statut: 'a_faire' });
    }
    setSaving(false);
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="w-full max-w-md rounded-2xl border border-border p-6" style={{ background: '#0D0D18' }}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-black text-foreground">{edit ? 'Modifier la tâche' : 'Nouvelle tâche'}</h2>
          <button onClick={onClose}><X size={20} className="text-muted-foreground" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold tracking-widest text-muted-foreground block mb-1.5">TITRE</label>
            <input value={form.titre} onChange={e => setForm(f => ({ ...f, titre: e.target.value }))}
              placeholder="Ex: Faire les devoirs"
              className="w-full bg-accent border border-border rounded-xl px-4 py-2.5 text-sm text-foreground outline-none focus:border-gold" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold tracking-widest text-muted-foreground block mb-1.5">DATE</label>
              <input type="date" value={form.jour} onChange={e => setForm(f => ({ ...f, jour: e.target.value }))}
                className="w-full bg-accent border border-border rounded-xl px-3 py-2.5 text-sm text-foreground outline-none focus:border-gold" />
            </div>
            <div>
              <label className="text-xs font-bold tracking-widest text-muted-foreground block mb-1.5">HEURE</label>
              <input value={form.heure} onChange={e => setForm(f => ({ ...f, heure: e.target.value }))}
                placeholder="08h00" className="w-full bg-accent border border-border rounded-xl px-3 py-2.5 text-sm text-foreground outline-none focus:border-gold" />
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.important} onChange={e => setForm(f => ({ ...f, important: e.target.checked }))}
              className="w-4 h-4 accent-yellow-500" />
            <span className="text-sm text-foreground">Tâche importante ⚡</span>
          </label>
          <div>
            <label className="text-xs font-bold tracking-widest text-muted-foreground block mb-1.5">NOTE (optionnel)</label>
            <input value={form.note_parent} onChange={e => setForm(f => ({ ...f, note_parent: e.target.value }))}
              placeholder="Consigne pour l'enfant"
              className="w-full bg-accent border border-border rounded-xl px-4 py-2.5 text-sm text-foreground outline-none focus:border-gold" />
          </div>
          <button onClick={sauver} disabled={saving || !form.titre.trim()}
            className="w-full py-3 rounded-xl font-black text-sm tracking-wide disabled:opacity-50"
            style={{ background: 'var(--gold)', color: '#080810' }}>
            {saving ? '…' : edit ? 'ENREGISTRER' : 'AJOUTER LA TÂCHE'}
          </button>
        </div>
      </div>
    </div>
  );
}