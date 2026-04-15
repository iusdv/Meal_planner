import { useEffect, useState } from 'react';
import { getMeals, addFavorite, addPlannedMeal } from '../services/mealService';
import type { MealDto } from '../types';

const CATEGORIES = ['Alle', 'Ontbijt', 'Lunch', 'Diner', 'Snack'];

export default function MealsPage() {
  const [meals, setMeals] = useState<MealDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('Alle');
  const [search, setSearch] = useState('');
  const [notification, setNotification] = useState('');

  useEffect(() => {
    getMeals()
      .then((r) => setMeals(r.data))
      .finally(() => setLoading(false));
  }, []);

  const notify = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(''), 2500);
  };

  const handleAddFavorite = async (mealId: number, naam: string) => {
    try {
      await addFavorite(mealId);
      notify(`"${naam}" toegevoegd aan favorieten!`);
    } catch {
      notify('Al in favorieten of fout opgetreden.');
    }
  };

  const handleQuickPlan = async (mealId: number, naam: string) => {
    const today = new Date().toISOString().split('T')[0];
    try {
      await addPlannedMeal(mealId, today, 'Diner');
      notify(`"${naam}" ingepland voor vandaag (diner)!`);
    } catch {
      notify('Inplannen mislukt.');
    }
  };

  const filtered = meals.filter((m) => {
    const matchCat = category === 'Alle' || m.categorie.toLowerCase() === category.toLowerCase();
    const matchSearch = m.naam.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const getTotalKcal = (meal: MealDto) => {
    return Math.round(
      meal.ingredienten.reduce((sum, ing) => {
        const kcalPer100 = ing.voedingswaarde?.kcal ?? 0;
        return sum + (kcalPer100 * ing.hoeveelheid) / 100;
      }, 0)
    );
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-600"></div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Notification toast */}
      {notification && (
        <div className="fixed top-4 right-4 bg-green-600 text-white px-5 py-3 rounded-xl shadow-lg z-50 text-sm font-medium animate-bounce">
          ✓ {notification}
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Maaltijden</h1>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <input
          type="text"
          placeholder="Zoeken..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 w-48"
        />
        <div className="flex gap-2 flex-wrap">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                category === cat
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Meal Cards Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <div className="text-5xl mb-3">🔍</div>
          <p>Geen maaltijden gevonden</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filtered.map((meal) => (
            <div key={meal.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition group">
              {meal.afbeeldingUrl ? (
                <img
                  src={meal.afbeeldingUrl}
                  alt={meal.naam}
                  className="w-full h-40 object-cover group-hover:scale-105 transition duration-300"
                />
              ) : (
                <div className="w-full h-40 bg-gradient-to-br from-green-100 to-emerald-200 flex items-center justify-center">
                  <span className="text-4xl">🍽️</span>
                </div>
              )}
              <div className="p-4">
                <div className="flex items-start justify-between mb-1">
                  <h3 className="font-semibold text-gray-800 text-sm leading-tight">{meal.naam}</h3>
                  <span className="ml-2 bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full whitespace-nowrap">
                    {meal.categorie}
                  </span>
                </div>
                <p className="text-gray-500 text-xs line-clamp-2 mb-3">{meal.beschrijving}</p>
                <div className="flex items-center justify-between text-xs text-gray-400 mb-3">
                  <span>⏱ {meal.bereidingstijd} min</span>
                  <span>🔥 {getTotalKcal(meal)} kcal</span>
                </div>

                {/* Nutritional breakdown */}
                {meal.ingredienten.length > 0 && (
                  <div className="grid grid-cols-3 gap-1 mb-3">
                    {['Eiwit', 'Koolh.', 'Vet'].map((label, idx) => {
                      const vals = meal.ingredienten.reduce((sum, ing) => {
                        const nv = ing.voedingswaarde;
                        if (!nv) return sum;
                        const factor = ing.hoeveelheid / 100;
                        return [
                          sum[0] + nv.eiwit * factor,
                          sum[1] + nv.koolhydraat * factor,
                          sum[2] + nv.vet * factor,
                        ];
                      }, [0, 0, 0]);
                      return (
                        <div key={label} className="bg-gray-50 rounded-lg p-1.5 text-center">
                          <div className="font-semibold text-gray-700 text-xs">{Math.round(vals[idx])}g</div>
                          <div className="text-gray-400 text-[10px]">{label}</div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => handleAddFavorite(meal.id, meal.naam)}
                    className="flex-1 text-xs border border-gray-200 text-gray-600 rounded-lg py-1.5 hover:border-red-300 hover:text-red-500 transition"
                  >
                    ♥ Favoriet
                  </button>
                  <button
                    onClick={() => handleQuickPlan(meal.id, meal.naam)}
                    className="flex-1 text-xs bg-green-600 text-white rounded-lg py-1.5 hover:bg-green-700 transition"
                  >
                    + Plannen
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
