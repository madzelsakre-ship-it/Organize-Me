import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Bell, BellOff, Plus, Trash2, X, Clock, Star, Settings, Check } from 'lucide-react';
import { DEFAULT_PREFS, saveNotifPrefs } from '@/hooks/useTaskNotifications';

function RappelList({ rappels, onToggleImportant, onDelete }) {
  if (!rappels.length) return null;
  return (
    <div className="space-y-2">
      {rappels.map(r => (
        <div key={r.id} className="flex items-center gap-3 p-3 rounded-xl border border-border" style={{ background: 'var(--surface)' }}>
          <Clock size={14} style={{ color: r.important ? 'var(--gold)' : '#666677' }} className="shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{r.titre}</p>
            <p className="text-xs text-muted-foreground">{r.heure}</p>
          </div>
          <button onClick={() => onToggleImportant(r)}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: r.important ? 'var(--gold)' : '#555' }}>
            <Star size={14} fill={r.important ? 'var(--gold)' : 'none'} />
          </button>
          <button onClick={() => onDelete(r.id)} className="p-1.5 rounded-lg hover:bg-destructive/20 opacity-60 hover:opacity-100 transition-colors">
            <Trash2 size={14} className="text-destructive" />
          </button>
        </div>
      ))}
    </div>
  );
}

export default function Rappels() {
  const [rappels, setRappels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [form, setForm] = useState({ titre: '', heure: '', important: false });
  const [permission, setPermission] = useState(
    'Notification' in window ? Notification.permission : 'denied'
  );
  const [prefs, setPrefs] = useState(() => {
    try { return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem('notif-prefs') || '{}') }; }
    catch { return { ...DEFAULT_PREFS }; }
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    base44.entities.Rappel.list('-created_date', 100).then(data => {
      setRappels(data);
      setLoading(false);
    });
  }, []);

  async function demanderPermission() {
    if (!('Notification' in window)) return;
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === 'granted') {
      new Notification('🔔 Rappels activés !', { body: 'Tu recevras des rappels intelligents pour tes tâches.' });
    }
  }

  async function ajouter() {
    if (!form.titre.trim() || !form.heure.trim()) return;
    const nouveau = await base44.entities.Rappel.create(form);
    setRappels(prev => [nouveau, ...prev]);
    setForm({ titre: '', heure: '', important: false });
    setShowForm(false);
  }

  async function toggleImportant(r) {
    await base44.entities.Rappel.update(r.id, { important: !r.important });
    setRappels(prev => prev.map(x => x.id === r.id ? { ...x, important: !x.important } : x));
  }

  async function supprimer(id) {
    await base44.entities.Rappel.delete(id);
    setRappels(prev => prev.filter(r => r.id !== id));
  }

  function sauvegarderPrefs() {
    saveNotifPrefs(prefs);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const importants = rappels.filter(r => r.important);
  const normaux = rappels.filter(r => !r.important);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--gold)', borderTopColor: 'transparent' }} />
    </div>
  );

  return (
    <div className="p-4 lg:p-8 max-w-2xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-black text-foreground">Rappels</h1>
          <p className="text-sm text-muted-foreground">{rappels.length} rappel{rappels.length !== 1 ? 's' : ''} · {importants.length} important{importants.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowSettings(true)}
            className="p-2 rounded-xl border border-border hover:border-gold transition-colors"
            style={{ background: 'var(--surface)' }}>
            <Settings size={16} className="text-muted-foreground" />
          </button>
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm"
            style={{ background: 'var(--gold)', color: '#080810' }}>
            <Plus size={16} /> Ajouter
          </button>
        </div>
      </div>

      {/* Banner permission */}
      {permission !== 'granted' && (
        <div className="rounded-2xl border p-4 mb-5 flex items-center gap-3"
          style={{ background: 'rgba(249,115,22,0.08)', borderColor: 'rgba(249,115,22,0.35)' }}>
          <Bell size={18} style={{ color: 'var(--gold)' }} />
          <div className="flex-1">
            <p className="text-sm font-bold text-foreground">Notifications désactivées</p>
            <p className="text-xs text-muted-foreground">Active les notifications push pour recevoir tes rappels</p>
          </div>
          <button onClick={demanderPermission}
            className="px-3 py-1.5 rounded-lg text-xs font-black shrink-0"
            style={{ background: 'var(--gold)', color: '#080810' }}>
            Activer
          </button>
        </div>
      )}

      {permission === 'granted' && (
        <div className="rounded-2xl border p-3 mb-5 flex items-center gap-2"
          style={{ background: 'rgba(46,204,113,0.08)', borderColor: 'rgba(46,204,113,0.3)' }}>
          <Check size={14} style={{ color: '#2ECC71' }} />
          <p className="text-xs font-bold" style={{ color: '#2ECC71' }}>Notifications push actives — tu recevras tes rappels automatiquement</p>
        </div>
      )}

      {/* Importants */}
      {importants.length > 0 && (
        <div className="mb-5">
          <p className="text-xs font-bold tracking-widest text-muted-foreground mb-2">⭐ IMPORTANTS</p>
          <RappelList rappels={importants} onToggleImportant={toggleImportant} onDelete={supprimer} />
        </div>
      )}

      {/* Normaux */}
      {normaux.length > 0 && (
        <div className="mb-5">
          <p className="text-xs font-bold tracking-widest text-muted-foreground mb-2">RAPPELS</p>
          <RappelList rappels={normaux} onToggleImportant={toggleImportant} onDelete={supprimer} />
        </div>
      )}

      {rappels.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-4xl mb-3">🔔</p>
          <p className="font-semibold">Aucun rappel</p>
          <p className="text-sm mt-1">Ajoute des rappels pour ne rien oublier</p>
        </div>
      )}

      {/* Modal Ajouter */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.8)' }}>
          <div className="w-full max-w-md rounded-2xl border border-border p-6 animate-fade-in" style={{ background: '#0D0D18' }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-black text-foreground">Nouveau rappel</h2>
              <button onClick={() => setShowForm(false)}><X size={20} className="text-muted-foreground" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold tracking-widest text-muted-foreground block mb-1.5">TITRE</label>
                <input value={form.titre} onChange={e => setForm(f => ({ ...f, titre: e.target.value }))}
                  placeholder="Ex: Prendre mes médicaments..."
                  className="w-full bg-accent border border-border rounded-xl px-4 py-2.5 text-sm text-foreground outline-none focus:border-gold"
                />
              </div>
              <div>
                <label className="text-xs font-bold tracking-widest text-muted-foreground block mb-1.5">HEURE</label>
                <input value={form.heure} onChange={e => setForm(f => ({ ...f, heure: e.target.value }))}
                  placeholder="Ex: 08h00, 14h30..."
                  className="w-full bg-accent border border-border rounded-xl px-4 py-2.5 text-sm text-foreground outline-none focus:border-gold"
                />
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => setForm(f => ({ ...f, important: !f.important }))}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl border transition-colors text-sm font-bold"
                  style={form.important
                    ? { background: 'rgba(249,115,22,0.15)', borderColor: 'var(--gold)', color: 'var(--gold)' }
                    : { borderColor: 'var(--border)', color: '#666' }}>
                  <Star size={14} fill={form.important ? 'var(--gold)' : 'none'} />
                  Important
                </button>
              </div>
              <button onClick={ajouter} disabled={!form.titre.trim() || !form.heure.trim()}
                className="w-full py-3 rounded-xl font-black text-sm disabled:opacity-40"
                style={{ background: 'var(--gold)', color: '#080810' }}>
                AJOUTER LE RAPPEL
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Paramètres de notifications */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.8)' }}>
          <div className="w-full max-w-md rounded-2xl border border-border p-6 animate-fade-in overflow-y-auto" style={{ background: '#0D0D18', maxHeight: '90vh' }}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <Bell size={16} style={{ color: 'var(--gold)' }} />
                <h2 className="text-base font-black text-foreground">Paramètres de rappels</h2>
              </div>
              <button onClick={() => setShowSettings(false)}><X size={20} className="text-muted-foreground" /></button>
            </div>

            <div className="space-y-5">

              {/* Rappel avant tâche */}
              <div>
                <label className="text-xs font-bold tracking-widest text-muted-foreground block mb-2">
                  RAPPEL AVANT CHAQUE TÂCHE
                </label>
                <div className="flex gap-2 flex-wrap">
                  {[5, 10, 15, 20, 30].map(m => (
                    <button key={m} onClick={() => setPrefs(p => ({ ...p, rappel_avant: m }))}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                      style={prefs.rappel_avant === m
                        ? { background: 'var(--gold)', color: '#080810' }
                        : { background: 'var(--surface)', color: '#666', border: '1px solid var(--border)' }}>
                      {m} min
                    </button>
                  ))}
                </div>
              </div>

              {/* Toggles */}
              {[
                { key: 'bilan_midi', label: 'Bilan de la matinée (12h00)', emoji: '☀️' },
                { key: 'retard_alerte', label: 'Alertes tâches en retard', emoji: '🚨' },
                { key: 'rappel_programme', label: 'Rappels créneaux du programme', emoji: '📅' },
              ].map(({ key, label, emoji }) => (
                <div key={key} className="flex items-center justify-between py-2 border-b border-border">
                  <div className="flex items-center gap-2">
                    <span>{emoji}</span>
                    <span className="text-sm font-semibold text-foreground">{label}</span>
                  </div>
                  <button
                    onClick={() => setPrefs(p => ({ ...p, [key]: !p[key] }))}
                    className="w-11 h-6 rounded-full transition-all relative"
                    style={{ background: prefs[key] ? 'var(--gold)' : 'var(--border)' }}>
                    <div className="w-4 h-4 rounded-full bg-white absolute top-1 transition-all"
                      style={{ left: prefs[key] ? 26 : 4 }} />
                  </button>
                </div>
              ))}

              {/* Bilan soir */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span>🌅</span>
                    <span className="text-sm font-semibold text-foreground">Bilan du soir</span>
                  </div>
                  <button
                    onClick={() => setPrefs(p => ({ ...p, bilan_soir: !p.bilan_soir }))}
                    className="w-11 h-6 rounded-full transition-all relative"
                    style={{ background: prefs.bilan_soir ? 'var(--gold)' : 'var(--border)' }}>
                    <div className="w-4 h-4 rounded-full bg-white absolute top-1 transition-all"
                      style={{ left: prefs.bilan_soir ? 26 : 4 }} />
                  </button>
                </div>
                {prefs.bilan_soir && (
                  <div className="flex gap-2 flex-wrap mt-2">
                    {[17, 18, 19, 20, 21].map(h => (
                      <button key={h} onClick={() => setPrefs(p => ({ ...p, heure_bilan_soir: h }))}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                        style={prefs.heure_bilan_soir === h
                          ? { background: 'var(--gold)', color: '#080810' }
                          : { background: 'var(--surface)', color: '#666', border: '1px solid var(--border)' }}>
                        {h}h00
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button onClick={sauvegarderPrefs}
                className="w-full py-3 rounded-xl font-black text-sm flex items-center justify-center gap-2"
                style={{ background: saved ? '#2ECC71' : 'var(--gold)', color: '#080810' }}>
                {saved ? <><Check size={16} /> Sauvegardé !</> : 'SAUVEGARDER'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}