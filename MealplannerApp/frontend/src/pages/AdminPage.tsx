import { useEffect, useState } from 'react';
import { getMeals } from '../services/mealService';
import api from '../services/api';
import { useAuth } from '../context/useAuth';
import type { MealDto } from '../types';

export default function AdminPage() {
  useAuth();
  const [meals, setMeals] = useState<MealDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMeal, setNewMeal] = useState({ naam: '', beschrijving: '', categorie: 'Ontbijt', bereidingstijd: 30, afbeeldingUrl: '' });
  const [msg, setMsg] = useState('');

  useEffect(() => {
    getMeals().then((r) => setMeals(r.data)).finally(() => setLoading(false));
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data } = await api.post<MealDto>('/meals', newMeal);
      setMeals((prev) => [...prev, data]);
      setNewMeal({ naam: '', beschrijving: '', categorie: 'Ontbijt', bereidingstijd: 30, afbeeldingUrl: '' });
      setMsg('Maaltijd aangemaakt!');
      setTimeout(() => setMsg(''), 2000);
    } catch {
      setMsg('Aanmaken mislukt.');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Maaltijd verwijderen?')) return;
    await api.delete(`/meals/${id}`);
    setMeals((prev) => prev.filter((m) => m.id !== id));
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-yellow-400 text-black text-xs font-bold px-3 py-1 rounded-full">ADMIN</div>
        <h1 className="text-2xl font-bold text-gray-800">Beheer Panel</h1>
      </div>

      {msg && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm ${msg.includes('mislukt') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          {msg}
        </div>
      )}

      {/* Create meal form */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-6">
        <h2 className="font-semibold text-gray-700 mb-4">Nieuwe maaltijd toevoegen</h2>
        <form onSubmit={handleCreate} className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-gray-600 mb-1 block">Naam</label>
            <input
              required
              value={newMeal.naam}
              onChange={(e) => setNewMeal({ ...newMeal, naam: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              placeholder="Kip tikka masala"
            />
          </div>
          <div>
            <label className="text-sm text-gray-600 mb-1 block">Categorie</label>
            <select
              value={newMeal.categorie}
              onChange={(e) => setNewMeal({ ...newMeal, categorie: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              {['Ontbijt', 'Lunch', 'Diner', 'Snack'].map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className="text-sm text-gray-600 mb-1 block">Beschrijving</label>
            <textarea
              value={newMeal.beschrijving}
              onChange={(e) => setNewMeal({ ...newMeal, beschrijving: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              rows={2}
              placeholder="Korte beschrijving..."
            />
          </div>
          <div>
            <label className="text-sm text-gray-600 mb-1 block">Bereidingstijd (min)</label>
            <input
              type="number"
              value={newMeal.bereidingstijd}
              onChange={(e) => setNewMeal({ ...newMeal, bereidingstijd: Number(e.target.value) })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-sm text-gray-600 mb-1 block">Afbeelding URL</label>
            <input
              value={newMeal.afbeeldingUrl}
              onChange={(e) => setNewMeal({ ...newMeal, afbeeldingUrl: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              placeholder="https://..."
            />
          </div>
          <div className="col-span-2">
            <button
              type="submit"
              className="bg-green-600 text-white px-6 py-2 rounded-lg text-sm font-semibold hover:bg-green-700 transition"
            >
              + Maaltijd toevoegen
            </button>
          </div>
        </form>
      </div>

      {/* Meals table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-700">Alle maaltijden ({meals.length})</h2>
        </div>
        {loading ? (
          <div className="p-8 text-center text-gray-400">Laden...</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs text-gray-500 font-medium">#</th>
                <th className="px-4 py-3 text-left text-xs text-gray-500 font-medium">Naam</th>
                <th className="px-4 py-3 text-left text-xs text-gray-500 font-medium">Categorie</th>
                <th className="px-4 py-3 text-left text-xs text-gray-500 font-medium">Bereidingstijd</th>
                <th className="px-4 py-3 text-right text-xs text-gray-500 font-medium">Acties</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {meals.map((m) => (
                <tr key={m.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-400">{m.id}</td>
                  <td className="px-4 py-3 font-medium text-gray-800">{m.naam}</td>
                  <td className="px-4 py-3">
                    <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full">{m.categorie}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{m.bereidingstijd} min</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDelete(m.id)}
                      className="text-xs text-red-500 hover:text-red-700 font-medium"
                    >
                      Verwijderen
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
