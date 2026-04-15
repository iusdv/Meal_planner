import { useEffect, useState } from 'react';
import { getProfile, upsertProfile, getGoals, upsertGoals } from '../services/mealService';
import type { ProfileDto, GoalDto } from '../types';
import { useAuth } from '../context/AuthContext';

export default function ProfilePage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Omit<ProfileDto, 'id' | 'userId'>>({
    gender: '',
    leeftijd: 0,
    gewicht: 0,
    activiteit: '',
  });
  const [goal, setGoal] = useState<Omit<GoalDto, 'id' | 'userId'>>({
    caloriedoel: 2000,
    eiwitdoel: 150,
    koolhydraatdoel: 250,
    vetdoel: 65,
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    getProfile().then((r) => {
      const p = r.data;
      setProfile({ gender: p.gender, leeftijd: p.leeftijd, gewicht: p.gewicht, activiteit: p.activiteit });
    }).catch(() => {});
    getGoals().then((r) => {
      const g = r.data;
      setGoal({ caloriedoel: g.caloriedoel, eiwitdoel: g.eiwitdoel, koolhydraatdoel: g.koolhydraatdoel, vetdoel: g.vetdoel });
    }).catch(() => {});
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await Promise.all([upsertProfile(profile), upsertGoals(goal)]);
      setMsg('Profiel opgeslagen!');
      setTimeout(() => setMsg(''), 2500);
    } catch {
      setMsg('Opslaan mislukt.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Mijn Profiel</h1>

      {msg && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm font-medium ${msg.includes('mislukt') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          {msg}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* User info */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-700 mb-4">Accountgegevens</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500">Naam</label>
              <p className="font-medium text-gray-800">{user?.naam}</p>
            </div>
            <div>
              <label className="text-xs text-gray-500">E-mail</label>
              <p className="font-medium text-gray-800">{user?.email}</p>
            </div>
          </div>
        </div>

        {/* Profile section */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-700 mb-4">Lichaamsprofiel</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Geslacht</label>
              <select
                value={profile.gender}
                onChange={(e) => setProfile({ ...profile, gender: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="">Kies...</option>
                <option value="Man">Man</option>
                <option value="Vrouw">Vrouw</option>
                <option value="Anders">Anders</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Leeftijd</label>
              <input
                type="number"
                value={profile.leeftijd || ''}
                onChange={(e) => setProfile({ ...profile, leeftijd: Number(e.target.value) })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="25"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Gewicht (kg)</label>
              <input
                type="number"
                step="0.1"
                value={profile.gewicht || ''}
                onChange={(e) => setProfile({ ...profile, gewicht: Number(e.target.value) })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="75.0"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Activiteitsniveau</label>
              <select
                value={profile.activiteit}
                onChange={(e) => setProfile({ ...profile, activiteit: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="">Kies...</option>
                <option value="Sedentair">Sedentair</option>
                <option value="Licht actief">Licht actief</option>
                <option value="Matig actief">Matig actief</option>
                <option value="Zeer actief">Zeer actief</option>
              </select>
            </div>
          </div>
        </div>

        {/* Goals section */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-700 mb-4">Voedingsdoelen</h2>
          <div className="grid grid-cols-2 gap-4">
            {([
              ['caloriedoel', 'Caloriedoel (kcal)'],
              ['eiwitdoel', 'Eiwitdoel (g)'],
              ['koolhydraatdoel', 'Koolhydraatdoel (g)'],
              ['vetdoel', 'Vetdoel (g)'],
            ] as [keyof typeof goal, string][]).map(([key, label]) => (
              <div key={key}>
                <label className="block text-sm text-gray-600 mb-1">{label}</label>
                <input
                  type="number"
                  value={goal[key] || ''}
                  onChange={(e) => setGoal({ ...goal, [key]: Number(e.target.value) })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-xl transition disabled:opacity-60"
        >
          {saving ? 'Opslaan...' : 'Profiel opslaan'}
        </button>
      </form>
    </div>
  );
}
