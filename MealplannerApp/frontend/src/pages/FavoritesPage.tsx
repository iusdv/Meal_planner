import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import StatusToast from '../components/StatusToast';
import { getFavorites, removeFavorite } from '../services/mealService';
import type { FavoriteDto } from '../types';

function truncateText(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength).trimEnd()}...`;
}

export default function FavoritesPage() {
  const navigate = useNavigate();
  const [favorites, setFavorites] = useState<FavoriteDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const notifyError = (text: string) => {
    setError(text);
    window.setTimeout(() => setError(''), 3500);
  };

  useEffect(() => {
    getFavorites()
      .then((r) => setFavorites(r.data))
      .catch(() => notifyError('Favorieten konden niet worden geladen. Probeer het later opnieuw.'))
      .finally(() => setLoading(false));
  }, []);

  const handleRemove = async (id: number) => {
    try {
      await removeFavorite(id);
      setFavorites((prev) => prev.filter((f) => f.id !== id));
    } catch {
      notifyError('Favoriet verwijderen mislukt.');
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-600"></div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <StatusToast message={error} tone="error" />

      <h1 className="text-2xl font-bold text-gray-800 mb-6">Mijn Favorieten</h1>

      {favorites.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg">Je hebt nog geen favorieten.</p>
          <p className="text-sm mt-1">Voeg maaltijden toe via de Maaltijden pagina.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {favorites.map((fav) => (
            <div
              key={fav.id}
              onClick={() => navigate(`/meals/${fav.mealId}`)}
              className="flex h-full cursor-pointer flex-col overflow-hidden rounded-[24px] border border-green-100 bg-white transition-colors hover:bg-slate-50"
            >
              {fav.afbeeldingUrl ? (
                <img src={fav.afbeeldingUrl} alt={fav.mealNaam} className="w-full h-36 object-cover" />
              ) : (
                <div className="w-full h-36 bg-gradient-to-br from-red-50 to-pink-100 flex items-center justify-center text-sm font-semibold text-red-500">
                  Favoriet
                </div>
              )}
              <div className="flex flex-1 flex-col p-4">
                <h3 className="mb-1 min-h-[3.5rem] text-lg font-semibold leading-7 text-gray-800">{truncateText(fav.mealNaam, 54)}</h3>
                <p className="mb-3 text-xs text-gray-400">
                  Toegevoegd op {new Date(fav.datumToegevoegd).toLocaleDateString('nl-NL')}
                </p>
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    handleRemove(fav.id);
                  }}
                  className="mt-auto w-full rounded-lg border border-red-200 py-1.5 text-sm text-red-500"
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
