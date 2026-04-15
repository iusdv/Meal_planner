import { useEffect, useState } from 'react';
import { getFavorites, removeFavorite } from '../services/mealService';
import type { FavoriteDto } from '../types';

export default function FavoritesPage() {
  const [favorites, setFavorites] = useState<FavoriteDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getFavorites()
      .then((r) => setFavorites(r.data))
      .finally(() => setLoading(false));
  }, []);

  const handleRemove = async (id: number) => {
    await removeFavorite(id);
    setFavorites((prev) => prev.filter((f) => f.id !== id));
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-600"></div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Mijn Favorieten ♥</h1>

      {favorites.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <div className="text-6xl mb-4">💚</div>
          <p className="text-lg">Je hebt nog geen favorieten.</p>
          <p className="text-sm mt-1">Voeg maaltijden toe via de Maaltijden pagina.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {favorites.map((fav) => (
            <div key={fav.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              {fav.afbeeldingUrl ? (
                <img src={fav.afbeeldingUrl} alt={fav.mealNaam} className="w-full h-36 object-cover" />
              ) : (
                <div className="w-full h-36 bg-gradient-to-br from-red-50 to-pink-100 flex items-center justify-center text-4xl">
                  ♥
                </div>
              )}
              <div className="p-4">
                <h3 className="font-semibold text-gray-800 mb-1">{fav.mealNaam}</h3>
                <p className="text-xs text-gray-400 mb-3">
                  Toegevoegd op {new Date(fav.datumToegevoegd).toLocaleDateString('nl-NL')}
                </p>
                <button
                  onClick={() => handleRemove(fav.id)}
                  className="w-full text-sm border border-red-200 text-red-500 rounded-lg py-1.5 hover:bg-red-50 transition"
                >
                  Verwijderen
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
