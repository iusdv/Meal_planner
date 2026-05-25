import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import StatusToast from '../components/StatusToast';
import { addFavorite, addPlannedMeal, createSelfMadeMeal, getPagedMeals, searchIngredients } from '../services/mealService';
import type { CreateSelfMadeMealDto, IngredientDto, MealDto } from '../types';
import { getIngredientImageUrl } from '../utils/ingredientImages';
import { calculateMealNutrition } from '../utils/nutrition';
import { getMealMomentCategory } from '../utils/nutrition';
import {
  DASHBOARD_FLASH_STORAGE_KEY,
  PLANNER_SWAP_STORAGE_KEY,
  type PlannerSwapContext,
} from '../utils/plannerSwap';

const CATEGORIES = ['Alle', 'Ontbijt', 'Lunch', 'Diner', 'Snack', 'Zelfgemaakt'];
const MEAL_MOMENT_CATEGORIES = ['Ontbijt', 'Lunch', 'Diner', 'Snack'];
const INGREDIENT_UNITS = ['g', 'kg', 'ml', 'l', 'stuk', 'stuks', 'el', 'tl', 'snufje', 'portie', 'blik', 'pak', 'kop', 'cup'];
const PAGE_SIZE = 12;

type SelfMadeMealForm = CreateSelfMadeMealDto;

function createEmptySelfMadeMeal(): SelfMadeMealForm {
  return {
    naam: '',
    beschrijving: '',
    instructies: '',
    categorie: 'Diner',
    bereidingstijd: 30,
    porties: 2,
    afbeeldingUrl: '',
    dieetLabels: '',
    ingredienten: [
      { naam: '', hoeveelheid: 100, eenheid: 'g', ingredientId: null, kcalPer100: 100, eiwitPer100: 1, koolhydraatPer100: 10, vetPer100: 1 },
      { naam: '', hoeveelheid: 1, eenheid: 'stuk', ingredientId: null, kcalPer100: 100, eiwitPer100: 1, koolhydraatPer100: 10, vetPer100: 1 },
    ],
  };
}

function isFilledNumber(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value);
}

function truncateText(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength).trimEnd()}...`;
}

function getVisiblePages(currentPage: number, totalPages: number) {
  if (totalPages <= 0) return [];

  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const start = Math.max(1, Math.min(safeCurrentPage - 2, totalPages - 4));
  const end = Math.min(totalPages, start + 4);
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

function isHttpImageUrl(value: string) {
  try {
    const url = new URL(value.trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function hasMarkup(value: string) {
  return value.includes('<') || value.includes('>');
}

function validateSelfMadeMeal(form: SelfMadeMealForm) {
  const name = form.naam.trim();
  const description = form.beschrijving.trim();
  const instructions = form.instructies.trim();
  const imageUrl = form.afbeeldingUrl.trim();
  const ingredientNames = form.ingredienten.map((ingredient) => ingredient.naam.trim().toLowerCase());

  if (name.length < 3 || name.length > 80) return 'Naam moet tussen 3 en 80 tekens zijn.';
  if (description.length < 20 || description.length > 800) return 'Beschrijving moet tussen 20 en 800 tekens zijn.';
  if (instructions.length < 30 || instructions.length > 4000) return 'Bereiding moet tussen 30 en 4000 tekens zijn.';
  if (!MEAL_MOMENT_CATEGORIES.includes(form.categorie)) return 'Kies een geldig eetmoment.';
  if (form.bereidingstijd < 5 || form.bereidingstijd > 240) return 'Bereidingstijd moet tussen 5 en 240 minuten zijn.';
  if (form.porties < 1 || form.porties > 12) return 'Porties moet tussen 1 en 12 zijn.';
  if (!isHttpImageUrl(imageUrl)) return 'Voeg een geldige http(s) afbeelding-URL toe.';
  if ([name, description, instructions, imageUrl, form.dieetLabels ?? ''].some(hasMarkup)) return 'Gebruik platte tekst zonder HTML.';
  if (form.ingredienten.length < 2) return 'Voeg minimaal 2 ingredienten toe.';
  if (form.ingredienten.length > 20) return 'Gebruik maximaal 20 ingredienten.';

  for (const ingredient of form.ingredienten) {
    const ingredientName = ingredient.naam.trim();
    if (ingredientName.length < 2 || ingredientName.length > 80) return 'Ingredientnamen moeten tussen 2 en 80 tekens zijn.';
    if (hasMarkup(ingredientName)) return 'Gebruik platte tekst zonder HTML in ingredientnamen.';
    if (ingredient.hoeveelheid < 0.01 || ingredient.hoeveelheid > 10000) return 'Hoeveelheden moeten tussen 0,01 en 10000 liggen.';
    if (!INGREDIENT_UNITS.includes(ingredient.eenheid)) return 'Kies een geldige eenheid.';
    if (ingredient.ingredientId) continue;
    if (
      !isFilledNumber(ingredient.kcalPer100) ||
      !isFilledNumber(ingredient.eiwitPer100) ||
      !isFilledNumber(ingredient.koolhydraatPer100) ||
      !isFilledNumber(ingredient.vetPer100)
    ) {
      return 'Vul voedingswaarden in voor custom ingredienten.';
    }
    if (ingredient.kcalPer100 < 1 || ingredient.kcalPer100 > 900) return 'Kcal moet tussen 1 en 900 per 100g/ml of stuk liggen.';
    if (ingredient.eiwitPer100 < 0 || ingredient.eiwitPer100 > 100) return 'Eiwit moet tussen 0 en 100 liggen.';
    if (ingredient.koolhydraatPer100 < 0 || ingredient.koolhydraatPer100 > 100) return 'Koolhydraten moet tussen 0 en 100 liggen.';
    if (ingredient.vetPer100 < 0 || ingredient.vetPer100 > 100) return 'Vet moet tussen 0 en 100 liggen.';
    if (ingredient.eiwitPer100 === 0 && ingredient.koolhydraatPer100 === 0 && ingredient.vetPer100 === 0) {
      return 'Vul minimaal een macro in per ingredient.';
    }
  }

  if (new Set(ingredientNames).size !== ingredientNames.length) return 'Ingredienten mogen niet dubbel voorkomen.';

  return '';
}

export default function MealsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [meals, setMeals] = useState<MealDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [category, setCategory] = useState('Alle');
  const [search, setSearch] = useState('');
  const [notification, setNotification] = useState('');
  const [error, setError] = useState('');
  const [swapContext, setSwapContext] = useState<PlannerSwapContext | null>(null);
  const [swapBusy, setSwapBusy] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isSelfMadeOpen, setIsSelfMadeOpen] = useState(false);
  const [selfMadeMeal, setSelfMadeMeal] = useState<SelfMadeMealForm>(() => createEmptySelfMadeMeal());
  const [selfMadeSaving, setSelfMadeSaving] = useState(false);
  const [selfMadeError, setSelfMadeError] = useState('');
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
          setPage(1);
        } catch {
          sessionStorage.removeItem(PLANNER_SWAP_STORAGE_KEY);
        }
      }
    } else {
      setSwapContext(null);
      setCategory('Alle');
      setPage(1);
    }
  }, [isSwapQuery]);

  useEffect(() => {
    let active = true;

    setLoading(true);
    setError('');

    getPagedMeals({
      page,
      pageSize: PAGE_SIZE,
      category: category === 'Alle' ? undefined : category,
      search: search.trim() || undefined,
      excludeMealId: isSwapMode ? swapContext?.currentMealId : undefined,
    })
      .then((response) => {
        if (!active) return;

        setMeals(response.data.items);
        setTotalItems(response.data.totalItems);
        setTotalPages(response.data.totalPages);

        if (response.data.page !== page) {
          setPage(response.data.page);
        }
      })
      .catch(() => {
        if (active) {
          setError('Maaltijden konden niet worden geladen. Controleer de backend of probeer later opnieuw.');
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [category, isSwapMode, page, refreshKey, search, swapContext?.currentMealId]);

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

  const updateSelfMadeIngredient = (
    index: number,
    field: keyof SelfMadeMealForm['ingredienten'][number],
    value: string | number | null
  ) => {
    setSelfMadeMeal((current) => ({
      ...current,
      ingredienten: current.ingredienten.map((ingredient, ingredientIndex) =>
        ingredientIndex === index ? { ...ingredient, [field]: value } : ingredient
      ),
    }));
  };

  const patchSelfMadeIngredient = (
    index: number,
    patch: Partial<SelfMadeMealForm['ingredienten'][number]>
  ) => {
    setSelfMadeMeal((current) => ({
      ...current,
      ingredienten: current.ingredienten.map((ingredient, ingredientIndex) =>
        ingredientIndex === index ? { ...ingredient, ...patch } : ingredient
      ),
    }));
  };

  const addSelfMadeIngredient = () => {
    setSelfMadeMeal((current) => ({
      ...current,
      ingredienten: [
        ...current.ingredienten,
        { naam: '', hoeveelheid: 100, eenheid: 'g', ingredientId: null, kcalPer100: 100, eiwitPer100: 1, koolhydraatPer100: 10, vetPer100: 1 },
      ],
    }));
  };

  const removeSelfMadeIngredient = (index: number) => {
    setSelfMadeMeal((current) => ({
      ...current,
      ingredienten: current.ingredienten.filter((_, ingredientIndex) => ingredientIndex !== index),
    }));
  };

  const handleCreateSelfMadeMeal = async (event: React.FormEvent) => {
    event.preventDefault();

    const validationMessage = validateSelfMadeMeal(selfMadeMeal);
    if (validationMessage) {
      setSelfMadeError(validationMessage);
      return;
    }

    setSelfMadeSaving(true);
    setSelfMadeError('');

    try {
      const payload: CreateSelfMadeMealDto = {
        ...selfMadeMeal,
        naam: selfMadeMeal.naam.trim(),
        beschrijving: selfMadeMeal.beschrijving.trim(),
        instructies: selfMadeMeal.instructies.trim(),
        afbeeldingUrl: selfMadeMeal.afbeeldingUrl.trim(),
        dieetLabels: selfMadeMeal.dieetLabels?.trim(),
        ingredienten: selfMadeMeal.ingredienten.map((ingredient) => ({
          naam: ingredient.naam.trim(),
          hoeveelheid: ingredient.hoeveelheid,
          eenheid: ingredient.eenheid,
          ingredientId: ingredient.ingredientId ?? null,
          kcalPer100: ingredient.ingredientId ? null : ingredient.kcalPer100,
          eiwitPer100: ingredient.ingredientId ? null : ingredient.eiwitPer100,
          koolhydraatPer100: ingredient.ingredientId ? null : ingredient.koolhydraatPer100,
          vetPer100: ingredient.ingredientId ? null : ingredient.vetPer100,
        })),
      };

      const { data } = await createSelfMadeMeal(payload);
      setSelfMadeMeal(createEmptySelfMadeMeal());
      setIsSelfMadeOpen(false);
      setSearch('');
      setCategory('Zelfgemaakt');
      setPage(1);
      setRefreshKey((current) => current + 1);
      notify(`"${data.naam}" toegevoegd als zelfgemaakte maaltijd.`);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } };
      const firstModelError = axiosErr.response?.data?.errors
        ? Object.values(axiosErr.response.data.errors)[0]?.[0]
        : undefined;
      setSelfMadeError(axiosErr.response?.data?.message ?? firstModelError ?? 'Zelfgemaakte maaltijd opslaan mislukt.');
    } finally {
      setSelfMadeSaving(false);
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
      await Promise.all(swapContext.targets.map((target) => addPlannedMeal(meal.id, target.date, target.type)));

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

  const firstItem = totalItems === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const lastItem = Math.min(page * PAGE_SIZE, totalItems);
  const visiblePages = getVisiblePages(page, totalPages);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <StatusToast message={notification} tone="success" />
      <StatusToast message={error} tone="error" />

      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Maaltijden</h1>
        {!isSwapMode && (
          <button
            type="button"
            onClick={() => {
              setSelfMadeError('');
              setIsSelfMadeOpen(true);
            }}
            className="rounded-full border border-green-200 bg-white px-4 py-2 text-sm font-semibold text-green-800 hover:bg-[#f4faf5]"
          >
            Eigen maaltijd
          </button>
        )}
      </div>

      {isSelfMadeOpen && (
        <SelfMadeMealDialog
          form={selfMadeMeal}
          error={selfMadeError}
          saving={selfMadeSaving}
          onClose={() => {
            setIsSelfMadeOpen(false);
            setSelfMadeError('');
          }}
          onSubmit={handleCreateSelfMadeMeal}
          onChange={(patch) => setSelfMadeMeal((current) => ({ ...current, ...patch }))}
          onIngredientChange={updateSelfMadeIngredient}
          onIngredientPatch={patchSelfMadeIngredient}
          onAddIngredient={addSelfMadeIngredient}
          onRemoveIngredient={removeSelfMadeIngredient}
        />
      )}

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
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="w-48 rounded-lg border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />

        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => {
                setCategory(cat);
                setPage(1);
              }}
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

        <div className="ml-auto self-center text-sm text-slate-500">
          {totalItems > 0 ? `${firstItem}-${lastItem} van ${totalItems}` : '0 maaltijden'}
        </div>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-green-600"></div>
        </div>
      ) : meals.length === 0 ? (
        <div className="py-12 text-center text-gray-400">
          <p>Geen maaltijden gevonden</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {meals.map((meal) => (
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

          {totalPages > 1 && (
            <nav className="mt-8 flex flex-wrap items-center justify-center gap-2" aria-label="Maaltijden pagina's">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page <= 1}
                className="rounded-xl border border-green-100 bg-white px-4 py-2 text-sm font-semibold text-green-800 hover:bg-[#f4faf5] disabled:cursor-not-allowed disabled:text-slate-300"
              >
                Vorige
              </button>

              {visiblePages.map((pageNumber) => (
                <button
                  key={pageNumber}
                  type="button"
                  onClick={() => setPage(pageNumber)}
                  className={`h-10 w-10 rounded-xl border text-sm font-semibold ${
                    pageNumber === page
                      ? 'border-green-300 bg-green-600 text-white'
                      : 'border-green-100 bg-white text-green-800 hover:bg-[#f4faf5]'
                  }`}
                >
                  {pageNumber}
                </button>
              ))}

              <button
                type="button"
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                disabled={page >= totalPages}
                className="rounded-xl border border-green-100 bg-white px-4 py-2 text-sm font-semibold text-green-800 hover:bg-[#f4faf5] disabled:cursor-not-allowed disabled:text-slate-300"
              >
                Volgende
              </button>
            </nav>
          )}
        </>
      )}
    </div>
  );
}

function SelfMadeMealDialog({
  form,
  error,
  saving,
  onClose,
  onSubmit,
  onChange,
  onIngredientChange,
  onIngredientPatch,
  onAddIngredient,
  onRemoveIngredient,
}: {
  form: SelfMadeMealForm;
  error: string;
  saving: boolean;
  onClose: () => void;
  onSubmit: (event: React.FormEvent) => void;
  onChange: (patch: Partial<SelfMadeMealForm>) => void;
  onIngredientChange: (index: number, field: keyof SelfMadeMealForm['ingredienten'][number], value: string | number | null) => void;
  onIngredientPatch: (index: number, patch: Partial<SelfMadeMealForm['ingredienten'][number]>) => void;
  onAddIngredient: () => void;
  onRemoveIngredient: (index: number) => void;
}) {
  const [suggestionsByIndex, setSuggestionsByIndex] = useState<Record<number, IngredientDto[]>>({});
  const ingredientQueryKey = form.ingredienten
    .map((ingredient) => `${ingredient.ingredientId ?? ''}:${ingredient.naam.trim().toLowerCase()}`)
    .join('|');

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      form.ingredienten.forEach((ingredient, index) => {
        const query = ingredient.naam.trim();
        if (ingredient.ingredientId || query.length < 2 || hasMarkup(query)) {
          setSuggestionsByIndex((current) => ({ ...current, [index]: [] }));
          return;
        }

        searchIngredients(query, 6)
          .then((response) => {
            setSuggestionsByIndex((current) => ({ ...current, [index]: response.data }));
          })
          .catch(() => {
            setSuggestionsByIndex((current) => ({ ...current, [index]: [] }));
          });
      });
    }, 180);

    return () => window.clearTimeout(timeoutId);
  }, [form.ingredienten, ingredientQueryKey]);

  const selectIngredient = (index: number, ingredient: IngredientDto) => {
    onIngredientPatch(index, {
      ingredientId: ingredient.id,
      naam: ingredient.naam,
      kcalPer100: ingredient.voedingswaarde?.kcal ?? null,
      eiwitPer100: ingredient.voedingswaarde?.eiwit ?? null,
      koolhydraatPer100: ingredient.voedingswaarde?.koolhydraat ?? null,
      vetPer100: ingredient.voedingswaarde?.vet ?? null,
    });
    setSuggestionsByIndex((current) => ({ ...current, [index]: [] }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6">
      <form
        onSubmit={onSubmit}
        className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-[24px] border border-green-100 bg-white p-5 shadow-xl"
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Eigen maaltijd toevoegen</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 px-3 py-1 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            Sluiten
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium text-slate-700">
            Naam
            <input
              required
              minLength={3}
              maxLength={80}
              value={form.naam}
              onChange={(event) => onChange({ naam: event.target.value })}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Eetmoment
            <select
              value={form.categorie}
              onChange={(event) => onChange({ categorie: event.target.value })}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              {MEAL_MOMENT_CATEGORIES.map((categoryOption) => (
                <option key={categoryOption} value={categoryOption}>
                  {categoryOption}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Bereidingstijd
            <input
              required
              type="number"
              min={5}
              max={240}
              value={form.bereidingstijd}
              onChange={(event) => onChange({ bereidingstijd: Number(event.target.value) })}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Porties
            <input
              required
              type="number"
              min={1}
              max={12}
              value={form.porties}
              onChange={(event) => onChange({ porties: Number(event.target.value) })}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </label>

          <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
            Afbeelding URL
            <input
              required
              type="url"
              maxLength={1000}
              value={form.afbeeldingUrl}
              onChange={(event) => onChange({ afbeeldingUrl: event.target.value })}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </label>

          {isHttpImageUrl(form.afbeeldingUrl) && (
            <div className="sm:col-span-2">
              <img src={form.afbeeldingUrl} alt={form.naam || 'Eigen maaltijd'} className="h-40 w-full rounded-xl object-cover" />
            </div>
          )}

          <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
            Beschrijving
            <textarea
              required
              minLength={20}
              maxLength={800}
              value={form.beschrijving}
              onChange={(event) => onChange({ beschrijving: event.target.value })}
              rows={3}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </label>

          <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
            Bereiding
            <textarea
              required
              minLength={30}
              maxLength={4000}
              value={form.instructies}
              onChange={(event) => onChange({ instructies: event.target.value })}
              rows={5}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </label>

          <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
            Dieetlabels
            <input
              maxLength={500}
              value={form.dieetLabels ?? ''}
              onChange={(event) => onChange({ dieetLabels: event.target.value })}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </label>
        </div>

        <div className="mt-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800">Ingredienten</h3>
            <button
              type="button"
              onClick={onAddIngredient}
              disabled={form.ingredienten.length >= 20}
              className="rounded-full border border-green-200 bg-white px-3 py-1 text-xs font-semibold text-green-800 hover:bg-[#f4faf5] disabled:opacity-50"
            >
              Toevoegen
            </button>
          </div>

          <div className="space-y-3">
            {form.ingredienten.map((ingredient, index) => {
              const showNutritionFields = !ingredient.ingredientId && ingredient.naam.trim().length >= 2;

              return (
              <div key={index} className="rounded-xl border border-slate-100 bg-slate-50/40 p-3">
                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_96px_108px_auto]">
                  <div className="relative">
                    <div className="flex gap-2">
                      {ingredient.ingredientId && <IngredientSuggestionImage name={ingredient.naam} />}
                      <input
                        required
                        minLength={2}
                        maxLength={80}
                        value={ingredient.naam}
                        onChange={(event) => onIngredientPatch(index, { naam: event.target.value, ingredientId: null })}
                        placeholder="Ingredient"
                        className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                    </div>

                    {!ingredient.ingredientId && (suggestionsByIndex[index]?.length ?? 0) > 0 && (
                      <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                        {(suggestionsByIndex[index] ?? []).map((suggestion) => (
                          <button
                            key={suggestion.id}
                            type="button"
                            onClick={() => selectIngredient(index, suggestion)}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-[#f4faf5]"
                          >
                            <IngredientSuggestionImage name={suggestion.naam} />
                            <span className="min-w-0 flex-1 truncate">{suggestion.naam}</span>
                            <span className="text-xs text-slate-400">{suggestion.eenheid}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <input
                    required
                    type="number"
                    min={0.01}
                    max={10000}
                    step={0.01}
                    value={ingredient.hoeveelheid}
                    onChange={(event) => onIngredientChange(index, 'hoeveelheid', Number(event.target.value))}
                    className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                  <select
                    value={ingredient.eenheid}
                    onChange={(event) => onIngredientChange(index, 'eenheid', event.target.value)}
                    className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    {INGREDIENT_UNITS.map((unit) => (
                      <option key={unit} value={unit}>
                        {unit}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => onRemoveIngredient(index)}
                    disabled={form.ingredienten.length <= 2}
                    className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-500 hover:bg-slate-50 disabled:opacity-40"
                  >
                    Weg
                  </button>
                </div>

                {ingredient.ingredientId ? (
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                    <span>Gekoppeld ingredient</span>
                    <button
                      type="button"
                      onClick={() => onIngredientPatch(index, {
                        ingredientId: null,
                        kcalPer100: 100,
                        eiwitPer100: 1,
                        koolhydraatPer100: 10,
                        vetPer100: 1,
                      })}
                      className="font-semibold text-green-800 hover:text-green-900"
                    >
                      Loskoppelen
                    </button>
                  </div>
                ) : showNutritionFields ? (
                  <div className="mt-2 rounded-lg border border-slate-100 bg-white px-3 py-2">
                    <div className="grid gap-2 sm:grid-cols-4">
                    <label className="grid grid-cols-[auto_1fr] items-center gap-2 text-xs font-semibold text-slate-600">
                      <span>Kcal</span>
                      <input
                        required
                        type="number"
                        min={1}
                        max={900}
                        step={1}
                        value={ingredient.kcalPer100 ?? ''}
                        onChange={(event) => onIngredientChange(index, 'kcalPer100', Number(event.target.value))}
                        className="h-8 min-w-0 rounded-md border border-slate-200 px-2 text-right text-sm font-normal text-slate-800 focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                    </label>
                    <label className="grid grid-cols-[auto_1fr] items-center gap-2 text-xs font-semibold text-slate-600">
                      <span>Eiwit</span>
                      <input
                        required
                        type="number"
                        min={0}
                        max={100}
                        step={0.1}
                        value={ingredient.eiwitPer100 ?? ''}
                        onChange={(event) => onIngredientChange(index, 'eiwitPer100', Number(event.target.value))}
                        className="h-8 min-w-0 rounded-md border border-slate-200 px-2 text-right text-sm font-normal text-slate-800 focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                    </label>
                    <label className="grid grid-cols-[auto_1fr] items-center gap-2 text-xs font-semibold text-slate-600">
                      <span>Koolh.</span>
                      <input
                        required
                        type="number"
                        min={0}
                        max={100}
                        step={0.1}
                        value={ingredient.koolhydraatPer100 ?? ''}
                        onChange={(event) => onIngredientChange(index, 'koolhydraatPer100', Number(event.target.value))}
                        className="h-8 min-w-0 rounded-md border border-slate-200 px-2 text-right text-sm font-normal text-slate-800 focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                    </label>
                    <label className="grid grid-cols-[auto_1fr] items-center gap-2 text-xs font-semibold text-slate-600">
                      <span>Vet</span>
                      <input
                        required
                        type="number"
                        min={0}
                        max={100}
                        step={0.1}
                        value={ingredient.vetPer100 ?? ''}
                        onChange={(event) => onIngredientChange(index, 'vetPer100', Number(event.target.value))}
                        className="h-8 min-w-0 rounded-md border border-slate-200 px-2 text-right text-sm font-normal text-slate-800 focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                    </label>
                    </div>
                  </div>
                ) : null}
              </div>
              );
            })}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            Annuleren
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl border border-green-200 bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60"
          >
            {saving ? 'Opslaan...' : 'Opslaan'}
          </button>
        </div>
      </form>
    </div>
  );
}

function IngredientSuggestionImage({ name }: { name: string }) {
  const [failedName, setFailedName] = useState<string | null>(null);
  const hasError = failedName === name;

  return (
    <div className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-slate-50">
      {!hasError ? (
        <img
          src={getIngredientImageUrl(name)}
          alt={name}
          className="h-8 w-8 object-contain"
          onError={() => setFailedName(name)}
        />
      ) : (
        <span className="text-xs font-semibold text-slate-400">{name.slice(0, 1).toUpperCase()}</span>
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
          <div className="ml-2 flex flex-col items-end gap-1">
            {meal.isZelfgemaakt && (
              <span className="whitespace-nowrap rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                Zelfgemaakt
              </span>
            )}
            <span className="whitespace-nowrap rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
              {meal.categorie}
            </span>
          </div>
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
