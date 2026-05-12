import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import StatusToast from '../components/StatusToast';
import {
  addPlannedMeal,
  getGoals,
  getPlannerMeals,
  getPlannedMeals,
  getProfile,
} from '../services/mealService';
import type { MealDto, PlannedMealDto } from '../types';
import { useAuth } from '../context/useAuth';
import {
  calculateMealNutrition,
  distributeCaloriesAcrossMoments,
  getMealMomentCategory,
  getMealMomentDisplayName,
  isSnackMoment,
  MACRO_COLORS,
  mealMatchesPreferences,
  parsePreferredMealTypes,
  type GoalForm,
  type ProfileForm,
} from '../utils/nutrition';
import {
  DASHBOARD_FLASH_STORAGE_KEY,
  PLANNER_SWAP_STORAGE_KEY,
  type PlannerSwapContext,
  type PlannerSwapTarget,
} from '../utils/plannerSwap';

const DEFAULT_MEAL_TYPES = ['Ontbijt 1', 'Lunch 1', 'Diner 1'];
const PLANNER_MEALS_PER_CATEGORY = 18;
const SWAP_MEALS_PER_CATEGORY = 60;

interface MacroTotals {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
}

interface DailyMacroSummary {
  key: string;
  label: string;
  shortLabel: string;
  totals: MacroTotals;
}

type MacroKey = 'protein' | 'fat' | 'carbs';
type MacroGoalKey = 'eiwitdoel' | 'vetdoel' | 'koolhydraatdoel';
type MacroItem = {
  key: MacroKey;
  goalKey: MacroGoalKey;
  label: string;
  color: string;
  caloriesPerGram: number;
};
type MacroDonutSegment = MacroItem & {
  value: number;
  length: number;
  offset: number;
};

const MACRO_ITEMS: MacroItem[] = [
  { key: 'protein', goalKey: 'eiwitdoel', label: 'Eiwit', color: MACRO_COLORS.protein, caloriesPerGram: 4 },
  { key: 'fat', goalKey: 'vetdoel', label: 'Vet', color: MACRO_COLORS.fat, caloriesPerGram: 9 },
  { key: 'carbs', goalKey: 'koolhydraatdoel', label: 'Koolhydraten', color: MACRO_COLORS.carbs, caloriesPerGram: 4 },
];

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
  const daysSinceMonday = today.getDay() === 0 ? 6 : today.getDay() - 1;
  monday.setDate(today.getDate() - daysSinceMonday);
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

function createEmptyMacroTotals(): MacroTotals {
  return { calories: 0, protein: 0, fat: 0, carbs: 0 };
}

function addNutritionToTotals(totals: MacroTotals, nutrition: MacroTotals) {
  totals.calories += nutrition.calories;
  totals.protein += nutrition.protein;
  totals.fat += nutrition.fat;
  totals.carbs += nutrition.carbs;
}

function roundMacroTotals(totals: MacroTotals): MacroTotals {
  return {
    calories: Math.round(totals.calories),
    protein: Math.round(totals.protein),
    fat: Math.round(totals.fat),
    carbs: Math.round(totals.carbs),
  };
}

function getMacroCalories(totals: MacroTotals, macro: MacroKey) {
  const item = MACRO_ITEMS.find((macroItem) => macroItem.key === macro);
  return totals[macro] * (item?.caloriesPerGram ?? 1);
}

function getMacroPercentages(totals: MacroTotals) {
  const totalMacroCalories = MACRO_ITEMS.reduce(
    (sum, item) => sum + totals[item.key] * item.caloriesPerGram,
    0
  );

  if (totalMacroCalories <= 0) {
    return { protein: 0, fat: 0, carbs: 0 };
  }

  const protein = Math.round((getMacroCalories(totals, 'protein') / totalMacroCalories) * 100);
  const fat = Math.round((getMacroCalories(totals, 'fat') / totalMacroCalories) * 100);

  return {
    protein,
    fat,
    carbs: Math.max(0, 100 - protein - fat),
  };
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, value));
}

function formatMacroValue(value: number) {
  return Math.round(value).toLocaleString('nl-NL');
}

function mergeMealsById(...groups: MealDto[][]) {
  const merged = new Map<number, MealDto>();

  for (const group of groups) {
    for (const meal of group) {
      merged.set(meal.id, meal);
    }
  }

  return Array.from(merged.values());
}

function hashString(value: string) {
  let hash = 2166136261;

  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function getSeededIndex(seed: number, length: number) {
  if (length <= 0) return 0;
  return Math.abs(seed) % length;
}

function getMealMacroTotals(meal: MealDto): MacroTotals | null {
  const nutrition = calculateMealNutrition(meal, meal.porties || 1);
  if (!nutrition.hasData) {
    return null;
  }

  return {
    calories: nutrition.calories,
    protein: nutrition.protein,
    fat: nutrition.fat,
    carbs: nutrition.carbs,
  };
}

function getRotatedMeal(pool: MealDto[], seed: number) {
  if (pool.length === 0) return null;
  return pool[getSeededIndex(seed, pool.length)];
}

function scoreNutritionFit(nutrition: MacroTotals, target: MacroTotals, remaining: MacroTotals) {
  const calorieTarget = Math.max(1, target.calories);
  const calorieScore = Math.abs(nutrition.calories - target.calories) / calorieTarget;
  const macroScore = MACRO_ITEMS.reduce((score, item) => {
    const targetValue = Math.max(0, target[item.key]);
    const remainingValue = remaining[item.key];
    const distanceScore = Math.abs(nutrition[item.key] - targetValue) / Math.max(10, targetValue);
    const overflowScore = remainingValue <= 0
      ? nutrition[item.key] / 20
      : Math.max(0, nutrition[item.key] - remainingValue) / Math.max(10, remainingValue);

    return score + distanceScore + overflowScore * 1.5;
  }, 0) / MACRO_ITEMS.length;

  return calorieScore + macroScore * 0.8;
}

function pickLightFallbackMeal(
  pool: MealDto[],
  usedMealIds: Set<number>,
  seed: number,
  getNutrition: (meal: MealDto) => MacroTotals | null,
  target?: MacroTotals,
  remaining?: MacroTotals
) {
  if (pool.length === 0) {
    return null;
  }

  const unusedMeals = pool.filter((meal) => !usedMealIds.has(meal.id));
  const source = unusedMeals.length > 0 ? unusedMeals : pool;
  const candidates = source
    .map((meal) => ({ meal, nutrition: getNutrition(meal) }))
    .filter((candidate): candidate is { meal: MealDto; nutrition: MacroTotals } =>
      candidate.nutrition !== null && candidate.nutrition.calories > 0
    )
    .sort((a, b) => {
      if (target && remaining) {
        const scoreA = scoreNutritionFit(a.nutrition, target, remaining);
        const scoreB = scoreNutritionFit(b.nutrition, target, remaining);
        return scoreA - scoreB || a.nutrition.calories - b.nutrition.calories || a.meal.id - b.meal.id;
      }

      return a.nutrition.calories - b.nutrition.calories || a.meal.id - b.meal.id;
    });

  if (candidates.length > 0) {
    const topCount = Math.min(5, candidates.length);
    return candidates[getSeededIndex(seed, topCount)].meal;
  }

  return source[getSeededIndex(seed, source.length)];
}

function pickCalorieBudgetedMeal(
  pool: MealDto[],
  remaining: MacroTotals,
  target: MacroTotals,
  usedMealIds: Set<number>,
  seed: number,
  getNutrition: (meal: MealDto) => MacroTotals | null
) {
  if (remaining.calories <= 0) {
    return pickLightFallbackMeal(pool, usedMealIds, seed, getNutrition, target, remaining);
  }

  const candidates = pool
    .map((meal) => ({ meal, nutrition: getNutrition(meal) }))
    .filter((candidate): candidate is { meal: MealDto; nutrition: MacroTotals } =>
      candidate.nutrition !== null &&
      candidate.nutrition.calories > 0 &&
      candidate.nutrition.calories <= remaining.calories
    );

  if (candidates.length === 0) {
    return pickLightFallbackMeal(pool, usedMealIds, seed, getNutrition, target, remaining);
  }

  const uniqueCandidates = candidates.filter((candidate) => !usedMealIds.has(candidate.meal.id));
  const source = uniqueCandidates.length > 0 ? uniqueCandidates : candidates;
  const preferredMax = Math.min(remaining.calories, Math.max(target.calories * 1.2, target.calories + 75));
  const preferredSource = source.filter((candidate) => candidate.nutrition.calories <= preferredMax);
  const scoringSource = preferredSource.length > 0 ? preferredSource : source;

  const sorted = [...scoringSource].sort((a, b) => {
    const scoreA = scoreNutritionFit(a.nutrition, target, remaining);
    const scoreB = scoreNutritionFit(b.nutrition, target, remaining);
    return scoreA - scoreB || a.nutrition.calories - b.nutrition.calories || a.meal.id - b.meal.id;
  });
  const topCount = Math.min(5, sorted.length);

  return sorted[getSeededIndex(seed, topCount)].meal;
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [planned, setPlanned] = useState<PlannedMealDto[]>([]);
  const [meals, setMeals] = useState<MealDto[]>([]);
  const [profile, setProfile] = useState<ProfileForm | null>(null);
  const [goal, setGoal] = useState<GoalForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [swapModal, setSwapModal] = useState<SwapModalState | null>(null);
  const [swapBusy, setSwapBusy] = useState(false);

  const weekDays = useMemo(() => getWeekDays(), []);
  const [selectedMacroDayIndex, setSelectedMacroDayIndex] = useState(() =>
    Math.max(0, weekDays.findIndex((day) => toDateKey(day) === toDateKey(new Date())))
  );
  const mealTypes = useMemo(
    () => (profile ? parsePreferredMealTypes(profile.gewensteMaaltijden) : DEFAULT_MEAL_TYPES),
    [profile]
  );
  const plannerSeed = useMemo(() => {
    const seedInput = [
      user?.id ?? 'guest',
      profile?.gender ?? '',
      profile?.leeftijd ?? '',
      profile?.gewicht ?? '',
      profile?.lengteCm ?? '',
      profile?.activiteit ?? '',
      profile?.dieetvoorkeur ?? '',
      profile?.allergieen ?? '',
      profile?.maaltijdenPerDag ?? '',
      profile?.gewensteMaaltijden ?? '',
      goal?.doelType ?? '',
      goal?.caloriedoel ?? '',
      goal?.eiwitdoel ?? '',
      goal?.vetdoel ?? '',
      goal?.koolhydraatdoel ?? '',
    ].join('|');

    return hashString(seedInput);
  }, [
    goal?.caloriedoel,
    goal?.doelType,
    goal?.eiwitdoel,
    goal?.koolhydraatdoel,
    goal?.vetdoel,
    profile?.activiteit,
    profile?.allergieen,
    profile?.dieetvoorkeur,
    profile?.gender,
    profile?.gewicht,
    profile?.gewensteMaaltijden,
    profile?.leeftijd,
    profile?.lengteCm,
    profile?.maaltijdenPerDag,
    user?.id,
  ]);

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
        const [plannedResult, goalsResult, profileResult] = await Promise.allSettled([
          getPlannedMeals(),
          getGoals(),
          getProfile(),
        ]);

        if (plannedResult.status !== 'fulfilled' || goalsResult.status !== 'fulfilled') {
          throw new Error('Dashboard basisgegevens konden niet worden geladen.');
        }

        setPlanned(plannedResult.value.data);
        setGoal({
          doelType: goalsResult.value.data.doelType,
          caloriedoel: goalsResult.value.data.caloriedoel,
          eiwitdoel: goalsResult.value.data.eiwitdoel,
          koolhydraatdoel: goalsResult.value.data.koolhydraatdoel,
          vetdoel: goalsResult.value.data.vetdoel,
        });

        let loadedProfile: ProfileForm | null = null;
        if (profileResult.status === 'fulfilled') {
          const p = profileResult.value.data;
          loadedProfile = {
            gender: p.gender,
            leeftijd: p.leeftijd,
            gewicht: p.gewicht,
            lengteCm: p.lengteCm,
            activiteit: p.activiteit,
            dieetvoorkeur: p.dieetvoorkeur,
            allergieen: p.allergieen,
            maaltijdenPerDag: p.maaltijdenPerDag,
            gewensteMaaltijden: p.gewensteMaaltijden,
          };
          setProfile(loadedProfile);
        } else {
          setProfile(null);
        }

        const plannerMealTypes = loadedProfile
          ? parsePreferredMealTypes(loadedProfile.gewensteMaaltijden)
          : DEFAULT_MEAL_TYPES;
        const categories = Array.from(new Set(plannerMealTypes.map((type) => getMealMomentCategory(type))));
        const mealsResult = await getPlannerMeals(categories, PLANNER_MEALS_PER_CATEGORY);
        setMeals(mealsResult.data);
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

  const getPlannedForSlot = useCallback((date: Date, type: string) => {
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
  }, [planned]);

  const suggestedMealsBySlot = useMemo(() => {
    const suggestions: Record<string, MealDto | null> = {};
    const calorieGoal = goal?.caloriedoel ?? 0;
    const slotBudgets = calorieGoal > 0
      ? distributeCaloriesAcrossMoments(calorieGoal, mealTypes)
      : {};
    const mealById = new Map(meals.map((meal) => [meal.id, meal]));
    const getPlanningNutrition = (meal: MealDto) => getMealMacroTotals(meal);

    for (const [dayIndex, day] of weekDays.entries()) {
      const runningTotals = createEmptyMacroTotals();
      const usedMealIds = new Set<number>();

      for (const type of mealTypes) {
        const plannedItem = getPlannedForSlot(day, type);
        if (!plannedItem) {
          continue;
        }

        usedMealIds.add(plannedItem.mealId);
        const plannedMeal = mealById.get(plannedItem.mealId);
        const plannedNutrition = plannedMeal ? getPlanningNutrition(plannedMeal) : null;
        if (plannedNutrition) {
          addNutritionToTotals(runningTotals, plannedNutrition);
        }
      }

      for (const [typeIndex, type] of mealTypes.entries()) {
        const key = slotKey(day, type);
        if (getPlannedForSlot(day, type)) {
          suggestions[key] = null;
          continue;
        }

        const pool = mealsByType[type] ?? [];
        const seed = plannerSeed + hashString(`${toDateKey(day)}|${type}|${dayIndex}|${typeIndex}`);

        if (calorieGoal <= 0) {
          suggestions[key] = getRotatedMeal(pool, seed);
          continue;
        }

        const remainingOpenSlots = mealTypes
          .slice(typeIndex)
          .filter((candidateType) => !getPlannedForSlot(day, candidateType))
          .length || 1;
        const remainingTotals: MacroTotals = {
          calories: calorieGoal - runningTotals.calories,
          protein: (goal?.eiwitdoel ?? 0) - runningTotals.protein,
          fat: (goal?.vetdoel ?? 0) - runningTotals.fat,
          carbs: (goal?.koolhydraatdoel ?? 0) - runningTotals.carbs,
        };
        const targetTotals: MacroTotals = {
          calories: Math.min(
            slotBudgets[type] ?? remainingTotals.calories / remainingOpenSlots,
            remainingTotals.calories / remainingOpenSlots,
            remainingTotals.calories
          ),
          protein: Math.max(0, remainingTotals.protein / remainingOpenSlots),
          fat: Math.max(0, remainingTotals.fat / remainingOpenSlots),
          carbs: Math.max(0, remainingTotals.carbs / remainingOpenSlots),
        };
        const suggestion = pickCalorieBudgetedMeal(
          pool,
          remainingTotals,
          targetTotals,
          usedMealIds,
          seed,
          getPlanningNutrition
        );
        suggestions[key] = suggestion;

        if (suggestion) {
          usedMealIds.add(suggestion.id);
          const suggestionNutrition = getPlanningNutrition(suggestion);
          if (suggestionNutrition) {
            addNutritionToTotals(runningTotals, suggestionNutrition);
          }
        }
      }
    }

    return suggestions;
  }, [
    goal?.caloriedoel,
    goal?.eiwitdoel,
    goal?.koolhydraatdoel,
    goal?.vetdoel,
    getPlannedForSlot,
    mealTypes,
    meals,
    mealsByType,
    plannerSeed,
    weekDays,
  ]);

  const getSuggestedForSlot = (date: Date, type: string) => suggestedMealsBySlot[slotKey(date, type)] ?? null;

  const getScheduleSlot = (date: Date, _dayIndex: number, type: string): ScheduleSlot => {
    const plannedItem = getPlannedForSlot(date, type);
    const suggestion = plannedItem ? null : getSuggestedForSlot(date, type);

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

  const weekNutrition = weekDays.map<DailyMacroSummary>((day, dayIndex) => {
    const summary: DailyMacroSummary = {
      key: toDateKey(day),
      label: formatDayLabel(day),
      shortLabel: formatShortDayLabel(day),
      totals: createEmptyMacroTotals(),
    };

    for (const type of mealTypes) {
      const slot = getScheduleSlot(day, dayIndex, type);
      if (!slot.displayMealId) {
        continue;
      }

      const meal = meals.find((item) => item.id === slot.displayMealId);
      if (!meal) {
        continue;
      }

      const nutrition = calculateMealNutrition(meal, meal.porties || 1);

      if (nutrition.hasData) {
        addNutritionToTotals(summary.totals, nutrition);
      }
    }

    return {
      ...summary,
      totals: roundMacroTotals(summary.totals),
    };
  });

  const todayKey = toDateKey(new Date());
  const todayNutrition = weekNutrition.find((summary) => summary.key === todayKey) ?? weekNutrition[0];
  const selectedNutrition = weekNutrition[selectedMacroDayIndex] ?? todayNutrition;
  const goToPreviousMacroDay = () => {
    setSelectedMacroDayIndex((current) => (current - 1 + weekNutrition.length) % weekNutrition.length);
  };
  const goToNextMacroDay = () => {
    setSelectedMacroDayIndex((current) => (current + 1) % weekNutrition.length);
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

  const getMealForNutrition = (mealId: number, candidateMeals: MealDto[] = []) =>
    candidateMeals.find((meal) => meal.id === mealId) ?? meals.find((meal) => meal.id === mealId);

  const calculateDayCaloriesWithReplacement = (
    day: Date,
    dayIndex: number,
    replacementMeal: MealDto,
    selectedTargetKeys: Set<string>,
    candidateMeals: MealDto[]
  ) => {
    return mealTypes.reduce((total, type) => {
      const slot = getScheduleSlot(day, dayIndex, type);
      const meal = selectedTargetKeys.has(slot.key)
        ? replacementMeal
        : slot.displayMealId
          ? getMealForNutrition(slot.displayMealId, candidateMeals)
          : null;

      if (!meal) {
        return total;
      }

      const nutrition = calculateMealNutrition(meal, meal.porties || 1);
      return nutrition.hasData ? total + nutrition.calories : total;
    }, 0);
  };

  const replacementFitsCalorieGoal = (
    replacementMeal: MealDto,
    targets: ScheduleSlot[],
    candidateMeals: MealDto[]
  ) => {
    const calorieGoal = goal?.caloriedoel ?? 0;
    if (calorieGoal <= 0) {
      return true;
    }

    const selectedTargetKeys = new Set(targets.map((target) => target.key));
    const targetDates = new Set(targets.map((target) => target.date));

    return weekDays.every((day, dayIndex) => {
      if (!targetDates.has(toDateKey(day))) {
        return true;
      }

      const calories = calculateDayCaloriesWithReplacement(
        day,
        dayIndex,
        replacementMeal,
        selectedTargetKeys,
        candidateMeals
      );

      return calories <= calorieGoal;
    });
  };

  const findRandomCalorieSafeReplacement = (candidates: MealDto[], targets: ScheduleSlot[]) => {
    const shuffled = [...candidates].sort(() => Math.random() - 0.5);

    for (const candidate of shuffled) {
      const nutrition = calculateMealNutrition(candidate, candidate.porties || 1);
      if (!nutrition.hasData) {
        continue;
      }

      if (replacementFitsCalorieGoal(candidate, targets, candidates)) {
        return candidate;
      }
    }

    return null;
  };

  const loadSwapCandidatePool = async (mealType: string, currentMealId: number | null) => {
    const dashboardPool = mealsByType[mealType] ?? [];
    let expandedPool: MealDto[] = [];

    try {
      const category = getMealMomentCategory(mealType);
      const { data } = await getPlannerMeals([category], SWAP_MEALS_PER_CATEGORY);
      expandedPool = data;

      if (data.length > 0) {
        setMeals((current) => mergeMealsById(current, data));
      }
    } catch {
      expandedPool = [];
    }

    const combinedPool = mergeMealsById(dashboardPool, expandedPool)
      .filter((meal) => meal.id !== currentMealId);
    const preferredPool = profile
      ? combinedPool.filter((meal) => mealMatchesPreferences(meal, profile))
      : combinedPool;

    return preferredPool.length > 0 ? preferredPool : combinedPool;
  };

  const applyReplacement = async (replacementMealId: number, replacementMealName: string, targets: ScheduleSlot[]) => {
    setSwapBusy(true);
    setError('');

    try {
      await Promise.all(targets.map((target) => addPlannedMeal(replacementMealId, target.date, target.type)));

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

    setSwapBusy(true);
    const replacementPool = await loadSwapCandidatePool(swapModal.mealType, swapModal.currentMealId);

    if (replacementPool.length === 0) {
      setSwapBusy(false);
      notifyError('Er is geen vervangende maaltijd gevonden voor dit moment.');
      return;
    }

    const replacementMeal = goal?.caloriedoel
      ? await findRandomCalorieSafeReplacement(replacementPool, selectedSwapTargets)
      : replacementPool[Math.floor(Math.random() * replacementPool.length)];
    setSwapBusy(false);

    if (!replacementMeal) {
      notifyError('Geen vervangende maaltijd gevonden die binnen je dagdoel blijft.');
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
    <div className="mx-auto max-w-7xl px-4 py-6">
      <StatusToast message={message} tone="success" />
      <StatusToast message={error} tone="error" />

      <div className="mb-6 rounded-[24px] border border-green-100 bg-white px-6 py-5">
        <h1 className="text-2xl font-bold text-slate-800">Welkom, {user?.naam}!</h1>
        <p className="mt-1 text-sm text-slate-500">Jouw maaltijdplanning voor deze week</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        <aside className="space-y-5 xl:sticky xl:top-6 xl:self-start">
          <MacroOverviewCard
            summary={selectedNutrition}
            goal={goal}
            onPreviousDay={goToPreviousMacroDay}
            onNextDay={goToNextMacroDay}
          />
          <WeeklyMacroTrendsCard summaries={weekNutrition} goal={goal} />
        </aside>

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

function MacroOverviewCard({
  summary,
  goal,
  onPreviousDay,
  onNextDay,
}: {
  summary?: DailyMacroSummary;
  goal: GoalForm | null;
  onPreviousDay: () => void;
  onNextDay: () => void;
}) {
  const totals = summary?.totals ?? createEmptyMacroTotals();
  const percentages = getMacroPercentages(totals);
  const circumference = 2 * Math.PI * 70;
  const segments = MACRO_ITEMS.reduce<MacroDonutSegment[]>((result, item) => {
      const offset = result.reduce((sum, segment) => sum + segment.length, 0);
      const value = percentages[item.key];
      const length = (value / 100) * circumference;

      if (length <= 0) {
        return result;
      }

      return [...result, { ...item, value, length, offset }];
    }, []);

  return (
    <section className="rounded-[24px] border border-green-100 bg-white p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-green-700/70">Nutrition</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-800">Macro overzicht</h2>
        </div>
        <div className="flex items-center overflow-hidden rounded-full border border-green-100 bg-white text-xs font-medium text-green-700">
          <button
            type="button"
            onClick={onPreviousDay}
            aria-label="Vorige dag"
            className="flex h-7 w-7 items-center justify-center hover:bg-[#f4faf5] focus:outline-none focus:ring-1 focus:ring-green-500"
          >
            &lt;
          </button>
          <div className="min-w-[76px] border-x border-green-100 px-3 py-1 text-center">
            {summary?.label ?? 'Vandaag'}
          </div>
          <button
            type="button"
            onClick={onNextDay}
            aria-label="Volgende dag"
            className="flex h-7 w-7 items-center justify-center hover:bg-[#f4faf5] focus:outline-none focus:ring-1 focus:ring-green-500"
          >
            &gt;
          </button>
        </div>
      </div>

      <div className="flex justify-center">
        <div className="relative h-52 w-52">
          <svg viewBox="0 0 180 180" className="h-full w-full -rotate-90">
            <circle cx="90" cy="90" r="70" fill="none" stroke="#eef2f7" strokeWidth="18" />
            {segments.map((segment) => (
              <circle
                key={segment.key}
                cx="90"
                cy="90"
                r="70"
                fill="none"
                stroke={segment.color}
                strokeWidth="18"
                strokeDasharray={`${segment.length} ${circumference - segment.length}`}
                strokeDashoffset={-segment.offset}
              />
            ))}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <div className="text-3xl font-semibold text-green-600">{formatMacroValue(totals.calories)}</div>
            <div className="text-xs font-medium uppercase text-slate-400">calorieen</div>
            <div className="mt-2 rounded-full border border-green-100 px-3 py-1 text-xs text-slate-500">
              Doel: {goal?.caloriedoel ? formatMacroValue(goal.caloriedoel) : '-'}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-2 grid gap-3">
        {MACRO_ITEMS.map((item) => (
          <MacroMetric
            key={item.key}
            label={item.label}
            color={item.color}
            value={totals[item.key]}
            goal={goal?.[item.goalKey] ?? 0}
            percentage={percentages[item.key]}
          />
        ))}
      </div>
    </section>
  );
}

function MacroMetric({
  label,
  color,
  value,
  goal,
  percentage,
}: {
  label: string;
  color: string;
  value: number;
  goal: number;
  percentage: number;
}) {
  const progress = goal > 0 ? clampPercent((value / goal) * 100) : 0;

  return (
    <div>
      <div className="mb-1 flex items-end justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-800">{formatMacroValue(value)}g</div>
          <div className="text-xs text-slate-500">{label}</div>
        </div>
        <div className="text-right text-xs font-medium" style={{ color }}>
          {percentage}%
        </div>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full" style={{ width: `${progress}%`, backgroundColor: color }} />
      </div>
      <div className="mt-1 text-xs text-slate-400">Doel: {goal > 0 ? `${formatMacroValue(goal)}g` : '-'}</div>
    </div>
  );
}

function WeeklyMacroTrendsCard({ summaries, goal }: { summaries: DailyMacroSummary[]; goal: GoalForm | null }) {
  const goalCalories = goal?.caloriedoel ?? 0;
  const maxCalories = Math.max(
    goalCalories * 1.2,
    ...summaries.map((summary) => summary.totals.calories),
    1200
  );
  const averageCalories = summaries.length
    ? Math.round(summaries.reduce((sum, summary) => sum + summary.totals.calories, 0) / summaries.length)
    : 0;
  const daysInRange = goalCalories > 0
    ? summaries.filter((summary) =>
        summary.totals.calories > 0 &&
        summary.totals.calories <= goalCalories
      ).length
    : 0;
  const goalLineBottom = goalCalories > 0
    ? 32 + clampPercent((goalCalories / maxCalories) * 100) * 1.28
    : 0;

  return (
    <section className="rounded-[24px] border border-green-100 bg-white p-5">
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-green-700/70">Week</p>
        <h2 className="mt-1 text-lg font-semibold text-slate-800">Macro trends</h2>
      </div>

      <div className="relative h-48 rounded-[18px] bg-slate-50 px-4 pb-8 pt-5">
        {goalCalories > 0 && (
          <div
            className="absolute left-4 right-4 border-t border-dashed border-green-400"
            style={{ bottom: `${goalLineBottom}px` }}
          >
            <span className="absolute -right-1 -top-5 bg-slate-50 pl-2 text-[11px] font-medium text-green-700">
              doel {formatMacroValue(goalCalories)}
            </span>
          </div>
        )}

        <div className="flex h-full items-end gap-3">
          {summaries.map((summary) => (
            <DailyMacroBar key={summary.key} summary={summary} maxCalories={maxCalories} />
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        {MACRO_ITEMS.map((item) => (
          <div key={item.key} className="flex items-center gap-2 text-xs text-slate-500">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
            {item.label}
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-[18px] border border-green-100 bg-[#f7fcf8] px-4 py-3">
        <div className="text-sm font-semibold text-slate-800">
          {goalCalories > 0 ? `${daysInRange} van 7 dagen binnen je caloriedoel` : 'Plan maaltijden om trends te vullen'}
        </div>
        <div className="mt-1 text-xs text-slate-500">
          Weekgemiddelde: {formatMacroValue(averageCalories)} kcal per dag.
        </div>
      </div>
    </section>
  );
}

function DailyMacroBar({ summary, maxCalories }: { summary: DailyMacroSummary; maxCalories: number }) {
  const totalHeight = clampPercent((summary.totals.calories / maxCalories) * 100);

  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-2">
      <div className="flex h-32 w-full max-w-[30px] items-end overflow-hidden rounded-t-lg bg-slate-200">
        {summary.totals.calories > 0 ? (
          <div className="flex w-full flex-col-reverse" style={{ height: `${Math.max(totalHeight, 4)}%` }}>
            {MACRO_ITEMS.map((item) => {
              const macroCalories = getMacroCalories(summary.totals, item.key);
              const height = summary.totals.calories > 0
                ? clampPercent((macroCalories / summary.totals.calories) * 100)
                : 0;

              return (
                <div
                  key={item.key}
                  style={{ height: `${height}%`, backgroundColor: item.color }}
                  title={`${item.label}: ${formatMacroValue(summary.totals[item.key])}g`}
                />
              );
            })}
          </div>
        ) : null}
      </div>
      <div className="text-[11px] font-medium text-slate-500">{summary.shortLabel}</div>
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
