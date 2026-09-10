import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { CATEGORIES, JOURS } from '@/lib/coachData';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Flame, Target, TrendingUp, CheckCircle2, X, Moon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const SLIDERS = [
  { key: 'energie', label: 'Énergie', emoji: '⚡', color: '#F97316' },
  { key: 'focus', label: 'Concentration', emoji: '🎯', color: '#3498DB' },
  { key: 'humeur', label: 'Humeur', emoji: '😊', color: '#2ECC71' },
];

const NIVEAU_LABELS = ['', 'Très bas', 'Bas', 'Moyen', 'Bon', 'Excellent'];

export default function Stats() {
  const [taches, setTaches] = useState([]);
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showBilan, setShowBilan] = useState(false);
  const [enregistrement, setEnregistrement] = useState(false);
  const [sliders, setSliders] = useState({ energie: 3, focus: 3, humeur: 3 });
  const [showEliteStamp, setShowEliteStamp] = useState(false);
  const [roxValidating, setRoxValidating] = useState(false);

  useEffect(() => {
    Promise.all([
      base44.entities.Tache.list('-created_date', 500),
      base44.entities.StatJour.list('-created_date', 30),
    ]).then(([t, s]) => {
      setTaches(t);
      setStats(s);
      setLoading(false);
    });
  }, []);

  async function enregistrerBilan() {
    setEnregistrement(true);
    const today = new Date().toISOString().split('T')[0];
    const todayName = JOURS[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1];
    const tachesAujourd = taches.filter(t => t.jour === todayName);
    const faites = tachesAujourd.filter(t => t.faite).length;
    const total = tachesAujourd.length;
    const dernierStreak = stats.length > 0 ? (stats[0].streak || 0) : 0;
    const ratio = total > 0 ? faites / total : 0;
    const newStreak = ratio >= 0.8 ? dernierStreak + 1 : 0;

    const stat = await base44.entities.StatJour.create({
      date: today, total, faites, streak: newStreak,
      ...sliders
    });
    setStats(prev => [stat, ...prev]);
    setEnregistrement(false);
    setShowBilan(false);
    setSliders({ energie: 3, focus: 3, humeur: 3 });
    // Déclencher Rox + tampon ÉLITE
    setRoxValidating(true);
    setShowEliteStamp(true);
    setTimeout(() => setShowEliteStamp(false), 2500);
    setTimeout(() => setRoxValidating(false), 2500);
  }

  const totalFaites = taches.filter(t => t.faite).length;
  const streak = stats.length > 0 ? (stats[0].streak || 0) : 0;
  const tauxMoyen = stats.length > 0
    ? Math.round(stats.slice(0, 7).reduce((a, s) => a + (s.total > 0 ? s.faites / s.total : 0), 0) / Math.min(7, stats.length) * 100)
    : 0;

  const chartData = stats.slice(0, 14).reverse().map(s => ({
    date: new Date(s.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
    taux: Math.round(s.total > 0 ? s.faites / s.total * 100 : 0),
    energie: s.energie || 0,
    focus: s.focus || 0,
    humeur: s.humeur || 0,
  }));

  const parCat = taches.reduce((acc, t) => {
    const cat = t.categorie || 'autre';
    if (!acc[cat]) acc[cat] = { total: 0, faites: 0 };
    acc[cat].total++;
    if (t.faite) acc[cat].faites++;
    return acc;
  }, {});

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--gold)', borderTopColor: 'transparent' }} />
    </div>
  );

  return (
    <div className="p-4 lg:p-8 max-w-3xl mx-auto pb-28">
      <div className="mb-6">
        <h1 className="text-xl font-black text-foreground">Statistiques</h1>
        <p className="text-sm text-muted-foreground">Votre progression élite</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { icon: CheckCircle2, label: 'Tâches faites', value: totalFaites, color: '#2ECC71' },
          { icon: Flame, label: 'Streak actuel', value: `${streak}j`, color: '#F97316' },
          { icon: TrendingUp, label: 'Taux moyen 7j', value: `${tauxMoyen}%`, color: '#3498DB' },
          { icon: Target, label: 'Bilans', value: stats.length, color: '#9B59B6' },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="rounded-xl p-4 border border-border" style={{ background: 'var(--surface)' }}>
            <Icon size={18} style={{ color }} className="mb-2" />
            <p className="text-xl font-black text-foreground">{value}</p>
            <p className="text-[10px] text-muted-foreground font-medium mt-0.5 leading-tight">{label}</p>
          </div>
        ))}
      </div>

      {/* Courbe de complétion */}
      {chartData.length > 0 && (
        <div className="rounded-2xl border border-border p-4 mb-4" style={{ background: 'var(--surface)' }}>
          <p className="text-xs font-bold tracking-widest text-muted-foreground mb-4">📈 TAUX DE COMPLÉTION</p>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="gradTaux" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#F97316" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#F97316" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fill: '#666677', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#666677', fontSize: 10 }} axisLine={false} tickLine={false} domain={[0, 100]} unit="%" />
              <Tooltip contentStyle={{ background: '#12121C', border: '1px solid #252535', borderRadius: 8, color: '#F0EDE8', fontSize: 12 }} formatter={(v) => [`${v}%`, 'Complétion']} />
              <Area type="monotone" dataKey="taux" stroke="#F97316" strokeWidth={2.5} fill="url(#gradTaux)" dot={{ fill: '#F97316', r: 3 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Courbe Énergie / Focus / Humeur */}
      {chartData.filter(d => d.energie > 0).length > 0 && (
        <div className="rounded-2xl border border-border p-4 mb-6" style={{ background: 'var(--surface)' }}>
          <p className="text-xs font-bold tracking-widest text-muted-foreground mb-1">⚡ ÉNERGIE · FOCUS · HUMEUR</p>
          <div className="flex gap-4 mb-3">
            {[{ label: 'Énergie', color: '#F97316' }, { label: 'Focus', color: '#3498DB' }, { label: 'Humeur', color: '#2ECC71' }].map(l => (
              <div key={l.label} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: l.color }} />
                <span className="text-[10px] text-muted-foreground font-medium">{l.label}</span>
              </div>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={chartData}>
              <XAxis dataKey="date" tick={{ fill: '#666677', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#666677', fontSize: 10 }} axisLine={false} tickLine={false} domain={[0, 5]} ticks={[1, 2, 3, 4, 5]} />
              <Tooltip contentStyle={{ background: '#12121C', border: '1px solid #252535', borderRadius: 8, color: '#F0EDE8', fontSize: 12 }} />
              <Line type="monotone" dataKey="energie" stroke="#F97316" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="focus" stroke="#3498DB" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="humeur" stroke="#2ECC71" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Par catégorie */}
      {Object.keys(parCat).length > 0 && (
        <div className="rounded-2xl border border-border overflow-hidden" style={{ background: 'var(--surface)' }}>
          <div className="p-4 border-b border-border">
            <p className="text-xs font-bold tracking-widest text-muted-foreground">PAR CATÉGORIE</p>
          </div>
          <div className="divide-y divide-border">
            {Object.entries(parCat).sort((a, b) => b[1].total - a[1].total).map(([cat, data]) => {
              const catInfo = CATEGORIES[cat] || CATEGORIES.autre;
              const taux = data.total > 0 ? Math.round(data.faites / data.total * 100) : 0;
              return (
                <div key={cat} className="flex items-center gap-3 p-3">
                  <span className="text-xl">{catInfo.emoji}</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold text-foreground">{catInfo.label}</span>
                      <span className="text-xs font-bold" style={{ color: catInfo.color }}>{taux}%</span>
                    </div>
                    <div className="h-1.5 bg-border rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${taux}%`, background: catInfo.color }} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{data.faites}/{data.total} tâches</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {stats.length === 0 && taches.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-4xl mb-3">📊</p>
          <p className="font-semibold">Pas encore de données</p>
          <p className="text-sm">Enregistrez votre premier bilan du soir</p>
        </div>
      )}

      {/* ── TAMPON ÉLITE ── */}
      <AnimatePresence>
        {showEliteStamp && (
          <motion.div
            className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ scale: 3, rotate: -20, opacity: 0 }}
              animate={{ scale: 1, rotate: -15, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className="flex flex-col items-center justify-center"
              style={{
                border: '6px solid #F97316',
                borderRadius: 16,
                padding: '18px 36px',
                background: 'rgba(249,115,22,0.12)',
                boxShadow: '0 0 60px rgba(249,115,22,0.5)',
              }}
            >
              <span style={{ fontSize: 48 }}>🦊</span>
              <p className="font-black text-4xl tracking-[0.3em] mt-2" style={{ color: '#F97316' }}>ÉLITE</p>
              <p className="text-xs tracking-widest mt-1" style={{ color: 'rgba(249,115,22,0.7)' }}>VALIDÉ PAR ROX</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── BOUTON STICKY ── */}
      <div className="fixed bottom-20 md:bottom-6 left-0 right-0 flex justify-center px-4 z-40 pointer-events-none">
        <motion.button
          onClick={() => setShowBilan(true)}
          whileTap={{ scale: 0.92 }}
          animate={roxValidating ? { scale: [1, 1.08, 1] } : {}}
          transition={{ duration: 0.3 }}
          className="pointer-events-auto flex items-center gap-2 px-6 py-3.5 rounded-2xl font-black text-sm shadow-2xl"
          style={{ background: 'var(--gold)', color: '#fff', boxShadow: '0 8px 32px rgba(249,115,22,0.45)' }}
        >
          <Moon size={16} /> BILAN DU SOIR
        </motion.button>
      </div>

      {/* ── MODAL BILAN AVEC SLIDERS ── */}
      {showBilan && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.75)' }}>
          <div className="w-full max-w-md rounded-2xl border border-border p-6 animate-fade-in" style={{ background: '#0D0D18' }}>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-base font-black text-foreground">🌙 Bilan du soir</h2>
              <button onClick={() => setShowBilan(false)}><X size={20} className="text-muted-foreground" /></button>
            </div>
            <p className="text-xs text-muted-foreground mb-6">Comment s'est passée votre journée ?</p>

            <div className="space-y-6 mb-6">
              {SLIDERS.map(({ key, label, emoji, color }) => (
                <div key={key}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold text-foreground">{emoji} {label}</span>
                    <span className="text-xs font-black px-2 py-0.5 rounded-lg" style={{ background: `${color}20`, color }}>
                      {sliders[key]}/5 — {NIVEAU_LABELS[sliders[key]]}
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      type="range" min={1} max={5} step={1}
                      value={sliders[key]}
                      onChange={e => setSliders(s => ({ ...s, [key]: Number(e.target.value) }))}
                      className="w-full h-2 rounded-full appearance-none cursor-pointer"
                      style={{
                        background: `linear-gradient(to right, ${color} 0%, ${color} ${(sliders[key] - 1) / 4 * 100}%, #252535 ${(sliders[key] - 1) / 4 * 100}%, #252535 100%)`,
                        accentColor: color
                      }}
                    />
                    <div className="flex justify-between mt-1">
                      {[1,2,3,4,5].map(n => (
                        <span key={n} className="text-[10px] text-muted-foreground">{n}</span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button onClick={enregistrerBilan} disabled={enregistrement}
              className="w-full py-3 rounded-xl font-black text-sm tracking-wide disabled:opacity-50"
              style={{ background: 'var(--gold)', color: '#fff' }}
            >
              {enregistrement ? 'Enregistrement...' : '✅ VALIDER LE BILAN'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}