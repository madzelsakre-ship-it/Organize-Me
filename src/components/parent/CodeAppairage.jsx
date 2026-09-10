import { useState } from 'react';
import { X, Copy, Check, KeyRound, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function CodeAppairage({ suivi, onClose }) {
  const [copied, setCopied] = useState(false);
  const code = suivi?.code_appairage || '';

  function copier() {
    navigator.clipboard?.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.85)' }}>
      <div className="w-full max-w-sm rounded-3xl border border-border p-6 text-center" style={{ background: '#0D0D18' }}>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <KeyRound size={18} style={{ color: 'var(--gold)' }} />
            <h2 className="text-base font-black text-foreground">Code d'appairage</h2>
          </div>
          <button onClick={onClose}><X size={20} className="text-muted-foreground" /></button>
        </div>

        <p className="text-sm text-muted-foreground mb-4">
          Donnez ce code à <span className="font-bold text-foreground">{suivi?.enfant_nom}</span>. Sur son appareil, ouvrez le Mode Enfant et saisissez-le.
        </p>

        <div className="rounded-2xl border-2 border-dashed py-6 mb-4" style={{ borderColor: 'var(--gold)', background: 'var(--gold-dim)' }}>
          <p className="text-4xl font-black tracking-[0.3em]" style={{ color: 'var(--gold)' }}>{code}</p>
        </div>

        <button onClick={copier}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm mb-3 transition-colors"
          style={{ background: copied ? 'rgba(34,197,94,0.15)' : 'var(--gold)', color: copied ? '#22C55E' : '#080810' }}>
          {copied ? <><Check size={16} /> Code copié !</> : <><Copy size={16} /> Copier le code</>}
        </button>

        <Link to="/enfant"
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm border border-border text-muted-foreground">
          <ExternalLink size={16} /> Ouvrir le Mode Enfant
        </Link>
      </div>
    </div>
  );
}