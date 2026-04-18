import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import StatusToast from '../components/StatusToast';
import { addFavorite, addPlannedMeal, getMeals, removePlannedMeal } from '../services/mealService';
import type { MealDto } from '../types';
import { calculateMealNutrition } from '../utils/nutrition';
import { getMealMomentCategory } from '../utils/nutrition';
import {
  DASHBOARD_FLASH_STORAGE_KEY,
  PLANNER_SWAP_STORAGE_KEY,
  type PlannerSwapContext,
} from '../utils/plannerSwap';

const CATEGORIES = ['Alle', 'Ontbijt', 'Lunch', 'Diner', 'Snack'];

function truncateText(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength).trimEnd()}...`;
}

export default function MealsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [meals, setMeals] = useState<MealDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('Alle');
  const [search, setSearch] = useState('');
  const [notification, setNotification] = useState('');
  const [error, setError] = useState('');
  const [swapContext, setSwapContext] = useState<PlannerSwapContext | null>(null);
  const [swapBusy, setSwapBusy] = useState(false);
  const isSwapQuery = searchParams.get('swap') === '1';

  const isSwapMode = isSwapQuery && swapContext !== null;

  useEffect(() => {
    if (isSwapQuery) {
      const rawContext = sessionStorage.getItem(PLANNER_SWAP_STORAGE_KEY);

      if (rawContext) {
        try {
          const parsed = JSON.parse(rawContext) as PlannerSwapContext;
          setSwapContext(parsed);

          if (parsed.mealType) {
            setCategory(getMealMomentCategory(parsed.mealType));
          }
        } catch {
          sessionStorage.removeItem(PLANNER_SWAP_STORAGE_KEY);
        }
      }
    } else {
      setSwapContext(null);
      setCategory('Alle');
    }

    getMeals()
      .then((response) => setMeals(response.data))
      .catch(() => setError('Maaltijden konden niet worden geladen. Controleer de backend of probeer later opnieuw.'))
      .finally(() => setLoading(false));
  }, [isSwapQuery]);

  const notify = (msg: string) => {
    setError('');
    setNotification(msg);
    setTimeout(() => setNotification(''), 2500);
  };

  const notifyError = (msg: string) => {
    setNotification('');
    setError(msg);
    setTimeout(() => setError(''), 3500);
  };

  const handleAddFavorite = async (mealId: number, naam: string) => {
    try {
      await addFavorite(mealId);
      notify(`"${naam}" toegevoegd aan favorieten.`);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      notifyError(axiosErr.response?.data?.message ?? 'Favoriet toevoegen mislukt.');
    }
  };

  const handleQuickPlan = async (mealId: number, naam: string) => {
    const today = new Date().toISOString().split('T')[0];

    try {
      await addPlannedMeal(mealId, today, 'Diner');
      notify(`"${naam}" ingepland voor vandaag.`);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      notifyError(axiosErr.response?.data?.message ?? 'Inplannen mislukt.');
    }
  };

  const handleSelectSwapMeal = async (meal: MealDto) => {
    if (!swapContext) return;

    if (swapContext.currentMealId === meal.id) {
      setError('Deze maaltijd staat al ingepland. Kies een andere maaltijd.');
      return;
    }

    setSwapBusy(true);
    setError('');

    try {
      for (const target of swapContext.targets) {
        if (target.plannedItemId) {
          await removePlannedMeal(target.plannedItemId);
        }

        await addPlannedMeal(meal.id, target.date, target.type);
      }

      sessionStorage.removeItem(PLANNER_SWAP_STORAGE_KEY);
      sessionStorage.setItem(
        DASHBOARD_FLASH_STORAGE_KEY,
        `"${meal.naam}" ingepland voor ${swapContext.targets.length === 1 ? '1 dag' : `${swapContext.targets.length} dagen`}.`
      );
      navigate('/dashboard');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      notifyError(axiosErr.response?.data?.message ?? 'Wisselen mislukt.');
    } finally {
      setSwapBusy(false);
    }
  };

  const handleCancelSwap = () => {
    sessionStorage.removeItem(PLANNER_SWAP_STORAGE_KEY);
    navigate('/dashboard');
  };

  const filtered = meals.filter((meal) => {
    const matchCat = category === 'Alle' || getMealMomentCategory(meal.categorie) === category;
    const matchSearch = meal.naam.toLowerCase().includes(search.toLowerCase());
    const matchSwap = !isSwapMode || meal.id !== swapContext?.currentMealId;
    return matchCat && matchSearch && matchSwap;
  });

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <StatusToast message={notification} tone="success" />
      <StatusToast message={error} tone="error" />

      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Maaltijden</h1>
      </div>

      {isSwapMode && swapContext && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-[24px] border border-green-100 bg-white px-5 py-4">
          <div>
            <p className="text-sm font-semibold text-slate-800">Kies een vervanging voor {swapContext.targets.length} moment(en)</p>
            <p className="mt-1 text-sm text-slate-500">
              Huidige maaltijd: {swapContext.currentMealName} ({swapContext.mealType})
            </p>
          </div>
          <button
            type="button"
            onClick={handleCancelSwap}
            className="rounded-xl border border-green-200 bg-white px-4 py-2 text-sm font-semibold text-green-700 hover:bg-[#f4faf5]"
          >
            Terug naar planner
          </button>
        </div>
      )}

      <div className="mb-6 flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Zoeken..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-48 rounded-lg border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />

        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`rounded-full border px-4 py-2 text-sm font-medium ${
                category === cat
                  ? 'border-green-300 bg-white text-green-800'
                  : 'border-gray-200 bg-white text-gray-600'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="py-12 text-center text-gray-400">
          <p>Geen maaltijden gevonden</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((meal) => (
            <MealCard
              key={meal.id}
              meal={meal}
              isSwapMode={isSwapMode}
              swapBusy={swapBusy}
              onOpen={() => navigate(`/meals/${meal.id}`)}
              onFavorite={() => handleAddFavorite(meal.id, meal.naam)}
              onPlan={() => handleQuickPlan(meal.id, meal.naam)}
              onSelectSwap={() => void handleSelectSwapMeal(meal)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MealCard({
  meal,
  isSwapMode,
  swapBusy,
  onOpen,
  onFavorite,
  onPlan,
  onSelectSwap,
}: {
  meal: MealDto;
  isSwapMode: boolean;
  swapBusy: boolean;
  onOpen: () => void;
  onFavorite: () => void;
  onPlan: () => void;
  onSelectSwap: () => void;
}) {
  const nutrition = calculateMealNutrition(meal, meal.porties || 1);
  const shortTitle = truncateText(meal.naam, 46);
  const shortDescription = truncateText(meal.beschrijving || 'Geen beschrijving beschikbaar.', 90);

  return (
    <div
      onClick={onOpen}
      className="flex h-full cursor-pointer flex-col overflow-hidden rounded-[24px] border border-green-100 bg-white transition-colors hover:bg-slate-50"
    >
      {meal.afbeeldingUrl ? (
        <img
          src={meal.afbeeldingUrl}
          alt={meal.naam}
          className="h-40 w-full object-cover"
        />
      ) : (
        <div className="flex h-40 w-full items-center justify-center bg-gradient-to-br from-green-100 to-emerald-200 text-sm font-semibold text-green-700">
          Maaltijd
        </div>
      )}

      <div className="flex flex-1 flex-col p-4">
        <div className="mb-1 flex items-start justify-between">
          <h3 className="min-h-[3rem] max-w-[70%] text-sm font-semibold leading-6 text-gray-800">{shortTitle}</h3>
          <span className="ml-2 whitespace-nowrap rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
            {meal.categorie}
          </span>
        </div>

        <p className="mb-3 min-h-[2.5rem] text-xs leading-5 text-gray-500">{shortDescription}</p>

        <div className="mb-3 flex items-center justify-between text-xs text-gray-400">
          <span>{meal.bereidingstijd} min</span>
          <span>{nutrition.hasData ? `${nutrition.calories} kcal` : 'Kcal onbekend'}</span>
        </div>

        {nutrition.hasData && (
          <div className="mb-3 grid grid-cols-3 gap-1">
            <NutritionMini label="Eiwit" value={`${nutrition.protein}g`} />
            <NutritionMini label="Koolh." value={`${nutrition.carbs}g`} />
            <NutritionMini label="Vet" value={`${nutrition.fat}g`} />
          </div>
        )}

        <div className="mt-auto flex gap-2">
          <button
            onClick={(event) => {
              event.stopPropagation();
              onFavorite();
            }}
            className="flex-1 rounded-lg border border-gray-200 py-1.5 text-xs text-gray-600 hover:bg-slate-100"
          >
            Favoriet
          </button>

          {isSwapMode ? (
            <button
              onClick={(event) => {
                event.stopPropagation();
                onSelectSwap();
              }}
              disabled={swapBusy}
              className="flex-1 rounded-lg border border-green-200 bg-white py-1.5 text-xs font-semibold text-green-800 hover:bg-[#f4faf5] disabled:opacity-60"
            >
              Kies
            </button>
          ) : (
            <button
              onClick={(event) => {
                event.stopPropagation();
                onPlan();
              }}
              className="flex-1 rounded-lg border border-green-200 bg-white py-1.5 text-xs font-semibold text-green-800 hover:bg-[#f4faf5]"
            >
              Plannen
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function NutritionMini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-gray-50 p-1.5 text-center">
      <div className="text-xs font-semibold text-gray-700">{value}</div>
      <div className="text-[10px] text-gray-400">{label}</div>
    </div>
  );
}
