import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import StatusToast from '../components/StatusToast';
import {
  addPlannedMeal,
  getMeals,
  getPlannedMeals,
  getProfile,
  removePlannedMeal,
} from '../services/mealService';
import type { MealDto, PlannedMealDto } from '../types';
import { useAuth } from '../context/useAuth';
import {
  getMealMomentCategory,
  getMealMomentDisplayName,
  isSnackMoment,
  mealMatchesPreferences,
  parsePreferredMealTypes,
  type ProfileForm,
} from '../utils/nutrition';
import {
  DASHBOARD_FLASH_STORAGE_KEY,
  PLANNER_SWAP_STORAGE_KEY,
  type PlannerSwapContext,
  type PlannerSwapTarget,
} from '../utils/plannerSwap';

const DEFAULT_MEAL_TYPES = ['Ontbijt 1', 'Lunch 1', 'Diner 1'];

interface ScheduleSlot {
  key: string;
  date: string;
  type: string;
  dayLabel: string;
  dayShortLabel: string;
  dayDateLabel: string;
  displayMealId: number | null;
  displayMealName: string;
  displayImageUrl?: string;
  displaySubtitle: string;
  plannedItemId: number | null;
}

interface SwapModalState {
  mealType: string;
  currentMealId: number | null;
  currentMealName: string;
  targets: ScheduleSlot[];
  selectedKeys: string[];
  mode: 'random' | 'pick';
}

function getWeekDays(): Date[] {
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - today.getDay() + 1);
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    return day;
  });
}

function toDateKey(date: Date) {
  return date.toISOString().split('T')[0];
}

function slotKey(date: Date, type: string) {
  return `${toDateKey(date)}-${type}`;
}

function buildMealPoolForType(type: string, preferredMeals: MealDto[], allMeals: MealDto[]) {
  const basePool = preferredMeals.length > 0 ? preferredMeals : allMeals;
  const mealCategory = getMealMomentCategory(type).toLowerCase();
  const exactMatches = basePool.filter((meal) => meal.categorie.toLowerCase() === mealCategory);

  if (exactMatches.length > 0) {
    return exactMatches;
  }

  if (isSnackMoment(type)) {
    const quickMeals = basePool.filter((meal) => meal.bereidingstijd <= 20);
    if (quickMeals.length > 0) {
      return quickMeals;
    }
  }

  return basePool;
}

function capitalize(value: string) {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatDayLabel(date: Date) {
  return capitalize(date.toLocaleDateString('nl-NL', { weekday: 'long' }));
}

function formatShortDayLabel(date: Date) {
  return capitalize(date.toLocaleDateString('nl-NL', { weekday: 'short' })).slice(0, 2);
}

function formatDayDate(date: Date) {
  return date.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [planned, setPlanned] = useState<PlannedMealDto[]>([]);
  const [meals, setMeals] = useState<MealDto[]>([]);
  const [profile, setProfile] = useState<ProfileForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [swapModal, setSwapModal] = useState<SwapModalState | null>(null);
  const [swapBusy, setSwapBusy] = useState(false);

  const weekDays = useMemo(() => getWeekDays(), []);
  const mealTypes = useMemo(
    () => (profile ? parsePreferredMealTypes(profile.gewensteMaaltijden) : DEFAULT_MEAL_TYPES),
    [profile]
  );

  const notify = (text: string) => {
    setError('');
    setMessage(text);
    window.setTimeout(() => setMessage(''), 2600);
  };

  const notifyError = (text: string) => {
    setMessage('');
    setError(text);
    window.setTimeout(() => setError(''), 3500);
  };

  useEffect(() => {
    const flashMessage = sessionStorage.getItem(DASHBOARD_FLASH_STORAGE_KEY);
    if (!flashMessage) return;

    sessionStorage.removeItem(DASHBOARD_FLASH_STORAGE_KEY);
    notify(flashMessage);
  }, []);

  useEffect(() => {
    async function loadDashboard() {
      setLoading(true);
      setError('');
      try {
        const [plannedResult, mealsResult] = await Promise.all([getPlannedMeals(), getMeals()]);
        setPlanned(plannedResult.data);
        setMeals(mealsResult.data);

        try {
          const profileResult = await getProfile();
          const p = profileResult.data;
          setProfile({
            gender: p.gender,
            leeftijd: p.leeftijd,
            gewicht: p.gewicht,
            lengteCm: p.lengteCm,
            activiteit: p.activiteit,
            dieetvoorkeur: p.dieetvoorkeur,
            allergieen: p.allergieen,
            maaltijdenPerDag: p.maaltijdenPerDag,
            gewensteMaaltijden: p.gewensteMaaltijden,
          });
        } catch {
          setProfile(null);
        }
      } catch {
        setError('Dashboard kon niet worden geladen. Controleer of de backend draait en probeer opnieuw.');
      } finally {
        setLoading(false);
      }
    }

    void loadDashboard();
  }, []);

  const mealsByType = useMemo(() => {
    const result: Record<string, MealDto[]> = {};
    const preferredMeals = meals.filter((meal) => mealMatchesPreferences(meal, profile));

    for (const type of mealTypes) {
      result[type] = buildMealPoolForType(type, preferredMeals, meals);
    }

    return result;
  }, [mealTypes, meals, profile]);

  const getPlannedForSlot = (date: Date, type: string) => {
    const dateStr = toDateKey(date);
    const exactMatch = planned.find(
      (item) => item.datum.split('T')[0] === dateStr && item.maaltijdtype.toLowerCase() === type.toLowerCase()
    );

    if (exactMatch) {
      return exactMatch;
    }

    return planned.find(
      (item) =>
        item.datum.split('T')[0] === dateStr &&
        item.maaltijdtype.toLowerCase() === getMealMomentCategory(type).toLowerCase()
    );
  };

  const getSuggestedForSlot = (dayIndex: number, type: string) => {
    const pool = mealsByType[type] ?? [];
    if (pool.length === 0) return null;

    const typeIndex = mealTypes.indexOf(type);
    const baseIndex = (dayIndex * mealTypes.length + typeIndex) % pool.length;
    return pool[baseIndex % pool.length];
  };

  const getScheduleSlot = (date: Date, dayIndex: number, type: string): ScheduleSlot => {
    const plannedItem = getPlannedForSlot(date, type);
    const suggestion = plannedItem ? null : getSuggestedForSlot(dayIndex, type);

    if (plannedItem) {
      return {
        key: slotKey(date, type),
        date: toDateKey(date),
        type,
        dayLabel: formatDayLabel(date),
        dayShortLabel: formatShortDayLabel(date),
        dayDateLabel: formatDayDate(date),
        displayMealId: plannedItem.mealId,
        displayMealName: plannedItem.mealNaam,
        displayImageUrl: plannedItem.afbeeldingUrl,
        displaySubtitle: 'Staat in je planning',
        plannedItemId: plannedItem.id,
      };
    }

    if (suggestion) {
      return {
        key: slotKey(date, type),
        date: toDateKey(date),
        type,
        dayLabel: formatDayLabel(date),
        dayShortLabel: formatShortDayLabel(date),
        dayDateLabel: formatDayDate(date),
        displayMealId: suggestion.id,
        displayMealName: suggestion.naam,
        displayImageUrl: suggestion.afbeeldingUrl,
        displaySubtitle: suggestion.ingredienten
          .slice(0, 2)
          .map((ingredient) => ingredient.ingredientNaam)
          .join(' + '),
        plannedItemId: null,
      };
    }

    return {
      key: slotKey(date, type),
      date: toDateKey(date),
      type,
      dayLabel: formatDayLabel(date),
      dayShortLabel: formatShortDayLabel(date),
      dayDateLabel: formatDayDate(date),
      displayMealId: null,
      displayMealName: 'Nog geen maaltijd gekozen',
      displaySubtitle: 'Gebruik wisselen om iets willekeurigs te pakken of zelf te kiezen.',
      plannedItemId: null,
    };
  };

  const refreshPlannedMeals = async () => {
    const plannedResult = await getPlannedMeals();
    setPlanned(plannedResult.data);
  };

  const openSwapModal = (slot: ScheduleSlot) => {
    const recurringTargets =
      slot.displayMealId === null
        ? [slot]
        : weekDays
            .map((day, dayIndex) => getScheduleSlot(day, dayIndex, slot.type))
            .filter((candidate) => candidate.displayMealId === slot.displayMealId);

    const targets = recurringTargets.length > 0 ? recurringTargets : [slot];

    setSwapModal({
      mealType: slot.type,
      currentMealId: slot.displayMealId,
      currentMealName: slot.displayMealName,
      targets,
      selectedKeys: targets.map((target) => target.key),
      mode: 'random',
    });
  };

  const toggleSwapTarget = (targetKey: string) => {
    setSwapModal((current) => {
      if (!current) return current;

      const selectedKeys = current.selectedKeys.includes(targetKey)
        ? current.selectedKeys.filter((key) => key !== targetKey)
        : [...current.selectedKeys, targetKey];

      return {
        ...current,
        selectedKeys,
      };
    });
  };

  const selectedSwapTargets = swapModal
    ? swapModal.targets.filter((target) => swapModal.selectedKeys.includes(target.key))
    : [];

  const applyReplacement = async (replacementMealId: number, replacementMealName: string, targets: ScheduleSlot[]) => {
    setSwapBusy(true);
    setError('');

    try {
      for (const target of targets) {
        if (target.plannedItemId) {
          await removePlannedMeal(target.plannedItemId);
        }

        await addPlannedMeal(replacementMealId, target.date, target.type);
      }

      await refreshPlannedMeals();
      setSwapModal(null);

      const dayLabel = targets.length === 1 ? '1 dag' : `${targets.length} dagen`;
      notify(`"${replacementMealName}" ingepland voor ${dayLabel}.`);
    } catch {
      notifyError('Wisselen van maaltijd is mislukt. Probeer het opnieuw.');
    } finally {
      setSwapBusy(false);
    }
  };

  const handleRandomSwap = async () => {
    if (!swapModal || selectedSwapTargets.length === 0) {
      notifyError('Selecteer minstens een dag om te wisselen.');
      return;
    }

    const pool = mealsByType[swapModal.mealType] ?? [];
    const candidates = pool.filter((meal) => meal.id !== swapModal.currentMealId);
    const replacementPool = candidates.length > 0 ? candidates : pool;
    const replacementMeal = replacementPool[Math.floor(Math.random() * replacementPool.length)];

    if (!replacementMeal) {
      notifyError('Er is geen vervangende maaltijd gevonden voor dit moment.');
      return;
    }

    await applyReplacement(replacementMeal.id, replacementMeal.naam, selectedSwapTargets);
  };

  const handlePickSwap = () => {
    if (!swapModal || selectedSwapTargets.length === 0) {
      notifyError('Selecteer minstens een dag om te wisselen.');
      return;
    }

    const context: PlannerSwapContext = {
      mealType: swapModal.mealType,
      currentMealId: swapModal.currentMealId,
      currentMealName: swapModal.currentMealName,
      targets: selectedSwapTargets.map<PlannerSwapTarget>((target) => ({
        key: target.key,
        date: target.date,
        type: target.type,
        plannedItemId: target.plannedItemId,
      })),
    };

    sessionStorage.setItem(PLANNER_SWAP_STORAGE_KEY, JSON.stringify(context));
    setSwapModal(null);
    navigate(`/meals?swap=1&type=${encodeURIComponent(swapModal.mealType)}`);
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <StatusToast message={message} tone="success" />
      <StatusToast message={error} tone="error" />

      <div className="mb-6 rounded-[24px] border border-green-100 bg-white px-6 py-5">
        <h1 className="text-2xl font-bold text-slate-800">Welkom, {user?.naam}!</h1>
        <p className="mt-1 text-sm text-slate-500">Jouw maaltijdplanning voor deze week</p>
      </div>

      <div className="overflow-hidden rounded-[24px] border border-green-100 bg-white">
        <div className="border-b border-green-100 px-6 py-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-green-700/70">Planner</p>
          <h2 className="mt-2 text-3xl font-semibold text-slate-800">Deze week</h2>
          <p className="mt-1 text-sm text-slate-500">Wissel maaltijden per dag of vervang meteen alle herhalingen in je week.</p>
        </div>

        <div className="divide-y divide-green-100">
          {weekDays.map((day, dayIndex) => (
            <section key={toDateKey(day)} className="px-6 py-6">
              <div className="mb-4">
                <h3 className="text-2xl font-semibold text-slate-800">{formatDayLabel(day)}</h3>
                <p className="text-sm text-green-700/70">{formatDayDate(day)}</p>
              </div>

              <div className="space-y-3">
                {mealTypes.map((type) => {
                  const slot = getScheduleSlot(day, dayIndex, type);

                  return (
                    <PlannerMealRow
                      key={slot.key}
                      type={type}
                      allTypes={mealTypes}
                      slot={slot}
                      onOpen={slot.displayMealId ? () => navigate(`/meals/${slot.displayMealId}`) : undefined}
                      onSwap={() => openSwapModal(slot)}
                    />
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </div>

      {swapModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-xl overflow-hidden rounded-[24px] border border-green-100 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-green-100 px-5 py-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-800">Maaltijden wisselen</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Kies welke dagen je "{swapModal.currentMealName}" wilt vervangen.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSwapModal(null)}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-green-100 text-slate-400"
              >
                x
              </button>
            </div>

            <div className="space-y-3 px-5 py-5">
              {swapModal.targets.map((target) => {
                const checked = swapModal.selectedKeys.includes(target.key);

                return (
                  <label
                    key={target.key}
                    className="flex items-center gap-4 rounded-[20px] border border-green-200 px-4 py-3"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleSwapTarget(target.key)}
                      className="h-4 w-4 rounded border-green-300 text-green-600 focus:ring-green-500"
                    />

                    <div className="w-14 shrink-0 text-sm font-semibold text-slate-700">
                      <div>{target.dayShortLabel}</div>
                      <div className="text-xs font-normal text-slate-400">{target.dayDateLabel}</div>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-slate-700">Vervang maaltijd</div>
                      <div className="truncate text-sm text-slate-500">{target.displayMealName}</div>
                    </div>
                  </label>
                );
              })}

              <div className="grid gap-3 md:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setSwapModal((current) => (current ? { ...current, mode: 'random' } : current))}
                  className={`rounded-[18px] border px-4 py-3 text-left ${
                    swapModal.mode === 'random'
                      ? 'border-green-300 bg-[#f7fcf8] text-green-800'
                      : 'border-green-100 bg-white text-slate-600'
                  }`}
                >
                  <div className="font-semibold">Willekeurig</div>
                  <div className="mt-1 text-sm">Laat de planner zelf een vervangende maaltijd kiezen.</div>
                </button>

                <button
                  type="button"
                  onClick={() => setSwapModal((current) => (current ? { ...current, mode: 'pick' } : current))}
                  className={`rounded-[18px] border px-4 py-3 text-left ${
                    swapModal.mode === 'pick'
                      ? 'border-green-300 bg-[#f7fcf8] text-green-800'
                      : 'border-green-100 bg-white text-slate-600'
                  }`}
                >
                  <div className="font-semibold">Zelf kiezen</div>
                  <div className="mt-1 text-sm">Open de maaltijdenpagina en kies zelf een vervanging.</div>
                </button>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-green-100 px-5 py-4">
              <button
                type="button"
                onClick={() => setSwapModal(null)}
                className="rounded-xl border border-green-200 bg-white px-5 py-2 text-sm font-semibold text-green-700 hover:bg-[#f4faf5]"
              >
                Annuleren
              </button>
              <button
                type="button"
                disabled={swapBusy}
                onClick={swapModal.mode === 'random' ? () => void handleRandomSwap() : handlePickSwap}
                className="rounded-xl border border-green-200 bg-white px-5 py-2 text-sm font-semibold text-green-800 hover:bg-[#f4faf5] disabled:opacity-60"
              >
                {swapBusy ? 'Bezig...' : swapModal.mode === 'random' ? 'Vind vervanging' : 'Kies op maaltijdenpagina'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PlannerMealRow({
  type,
  allTypes,
  slot,
  onOpen,
  onSwap,
}: {
  type: string;
  allTypes: string[];
  slot: ScheduleSlot;
  onOpen?: () => void;
  onSwap: () => void;
}) {
  return (
    <div className="flex min-h-[112px] overflow-hidden rounded-[24px] border border-green-100 bg-white">
      <div
        className="flex w-14 shrink-0 items-center justify-center border-r border-green-100 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500"
        style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
      >
        {getMealMomentDisplayName(type, allTypes)}
      </div>

      {slot.displayMealId ? (
        <button type="button" onClick={onOpen} className="w-[120px] shrink-0 overflow-hidden bg-[#f6fbf7]">
          {slot.displayImageUrl ? (
            <img src={slot.displayImageUrl} alt={slot.displayMealName} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-xs font-medium text-slate-400">Geen afbeelding</div>
          )}
        </button>
      ) : (
        <div className="flex w-[120px] shrink-0 items-center justify-center bg-[#f8fcf9] text-xs font-medium text-slate-400">
          Kies maaltijd
        </div>
      )}

      {slot.displayMealId && onOpen ? (
        <button type="button" onClick={onOpen} className="min-w-0 flex-1 px-4 py-4 text-left">
          <div className="text-base font-semibold text-slate-800">{slot.displayMealName}</div>
          <div className="mt-1 line-clamp-2 text-sm text-slate-500">{slot.displaySubtitle}</div>
        </button>
      ) : (
        <div className="min-w-0 flex-1 px-4 py-4">
          <div className="text-base font-semibold text-slate-800">{slot.displayMealName}</div>
          <div className="mt-1 line-clamp-2 text-sm text-slate-500">{slot.displaySubtitle}</div>
        </div>
      )}

      <button
        type="button"
        onClick={onSwap}
        className="flex w-[104px] shrink-0 flex-col items-center justify-center gap-2 border-l border-green-100 bg-white text-sm font-semibold text-green-700 hover:bg-[#f4faf5]"
      >
        <span>Wisselen</span>
      </button>
    </div>
  );
}
