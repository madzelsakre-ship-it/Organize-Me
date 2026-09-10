import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Sparkles, ChevronDown } from 'lucide-react';
import { TYPES_ORDRE, TYPES_OBJECTIF } from '@/lib/objectifs';
import MantraBanner from '@/components/objectifs/MantraBanner';
import ObjectifListe from '@/components/objectifs/ObjectifListe';
import ObjectifPrincipal from '@/components/objectifs/ObjectifPrincipal';

export default function Objectifs() {
  const [objectifs, setObjectifs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ouverts, setOuverts] = useState(() => new Set(['jour']));

  useEffect(() => {
    base44.entities.Objectif.list('-created_date', 200).then(data => {
      setObjectifs(data);
      setLoading(false);
    });
    const unsub = base44.entities.Objectif.subscribe((event) => {
      if (event.type === 'create') setObjectifs(prev => prev.some(o => o.id === event.data.id) ? prev : [event.data, ...prev]);
      else if (event.type === 'update') setObjectifs(prev => prev.map(o => o.id === event.data.id ? { ...o, ...event.data } : o));
      else if (event.type === 'delete') setObjectifs(prev => prev.filter(o => o.id !== event.data.id));
    });
    return unsub;
  }, []);

  function toggleOuvert(type) {
    setOuverts(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type); else next.add(type);
      return next;
    });
  }

  async function ajouter(type, titre, emoji) {
    const o = await base44.entities.Objectif.create({ type, titre, emoji, atteint: false });
    setObjectifs(prev => [o, ...prev]);
  }
  async function toggle(o) {
    await base44.entities.Objectif.update(o.id, { atteint: !o.atteint });
    setObjectifs(prev => prev.map(x => x.id === o.id ? { ...x, atteint: !o.atteint } : x));
  }
  async function supprimer(o) {
    await base44.entities.Objectif.delete(o.id);
    setObjectifs(prev => prev.filter(x => x.id !== o.id));
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--gold)', borderTopColor: 'transparent' }} /></div>;

  return (
    <div className="p-4 lg:p-8 max-w-2xl mx-auto pb-28 md:pb-8">
      <div className="mb-5">
        <h1 className="text-xl font-black text-foreground flex items-center gap-2"><Sparkles size={20} style={{ color: 'var(--gold)' }} /> Mes Objectifs</h1>
        <p className="text-sm text-muted-foreground">Déroule chaque horizon et définis tes objectifs.</p>
      </div>

      <ObjectifPrincipal />
      <MantraBanner />

      {/* Accordéon déroulé */}
      <div className="space-y-2">
        {TYPES_ORDRE.map(type => {
          const cfg = TYPES_OBJECTIF[type];
          const count = objectifs.filter(o => o.type === type).length;
          const faites = objectifs.filter(o => o.type === type && o.atteint).length;
          const ouvert = ouverts.has(type);
          return (
            <div key={type} className="rounded-2xl border border-border overflow-hidden" style={{ background: ouvert ? cfg.color + '08' : 'var(--surface)', borderColor: ouvert ? cfg.color + '60' : 'var(--border)' }}>
              <button onClick={() => toggleOuvert(type)}
                className="w-full flex items-center gap-3 p-4 transition-colors"
                style={{ background: ouvert ? cfg.color + '12' : 'transparent' }}>
                <span className="text-xl shrink-0">{cfg.emoji}</span>
                <div className="flex-1 text-left">
                  <p className="text-sm font-black text-foreground">Objectifs {cfg.label.toLowerCase()}</p>
                  <p className="text-[10px] text-muted-foreground">{cfg.desc}</p>
                </div>
                {count > 0 && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: cfg.color + '22', color: cfg.color }}>
                    {faites}/{count}
                  </span>
                )}
                <ChevronDown size={18} className="shrink-0 transition-transform" style={{ color: cfg.color, transform: ouvert ? 'rotate(180deg)' : 'none' }} />
              </button>
              {ouvert && (
                <div className="px-4 pb-4 animate-fade-in">
                  <ObjectifListe type={type} objectifs={objectifs} onAjouter={ajouter} onToggle={toggle} onSupprimer={supprimer} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}