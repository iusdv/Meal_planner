import type { GoalDto, MealDto, ProfileDto } from '../types';

export type ProfileForm = Omit<ProfileDto, 'id' | 'userId'>;
export type GoalForm = Omit<GoalDto, 'id' | 'userId'>;

export const ACTIVITEITSNIVEAUS = [
  'Zittend werk, lichte beweging',
  'Licht actief, 3-4 keer sporten per week',
  'Dagelijks actief, vaak sporten',
  'Zeer atletisch',
] as const;
export const DIEETOPTIES = ['Alles', 'Keto', 'Mediterraan', 'Paleo', 'Vegan', 'Vegetarisch'] as const;
export const DOELTYPES = ['Afvallen', 'Balans', 'Spiermassa opbouwen', 'Gezonder eten'] as const;
export const HOOFDMAALTIJDMOMENTEN = ['Ontbijt', 'Lunch', 'Diner'] as const;
export const MAALTIJDCATEGORIEEN = ['Ontbijt', 'Lunch', 'Diner', 'Snack'] as const;
export const STANDAARD_MAALTIJDMOMENTEN = ['Ontbijt 1', 'Lunch 1', 'Diner 1'] as const;

export type MealCategory = (typeof MAALTIJDCATEGORIEEN)[number];

const LEGACY_SNACK_VALUES = new Set(['snack', 'snacks', 'ochtend snack', 'middag snack', 'avond snack']);

const LEGACY_ACTIVITY_MAP: Record<string, (typeof ACTIVITEITSNIVEAUS)[number]> = {
  Sedentair: 'Zittend werk, lichte beweging',
  'Licht actief': 'Licht actief, 3-4 keer sporten per week',
  'Matig actief': 'Dagelijks actief, vaak sporten',
  'Zeer actief': 'Dagelijks actief, vaak sporten',
  Atleet: 'Zeer atletisch',
};

const ACTIVITY_MULTIPLIERS: Record<string, number> = {
  'Zittend werk, lichte beweging': 1.2,
  'Licht actief, 3-4 keer sporten per week': 1.375,
  'Dagelijks actief, vaak sporten': 1.625,
  'Zeer atletisch': 1.85,
};

export function normalizeActivityValue(value?: string) {
  if (!value) return '';
  return LEGACY_ACTIVITY_MAP[value] ?? value;
}

export function normalizeGenderValue(value?: string) {
  return value === 'Man' || value === 'Vrouw' ? value : '';
}

export function normalizeDietValue(value?: string) {
  const mapping: Record<string, string> = {
    Anything: 'Alles',
    Alles: 'Alles',
    Keto: 'Keto',
    Mediterranean: 'Mediterraan',
    Mediterraan: 'Mediterraan',
    Paleo: 'Paleo',
    Vegan: 'Vegan',
    Vegetarian: 'Vegetarisch',
    Vegetarisch: 'Vegetarisch',
  };

  return mapping[value ?? ''] ?? 'Alles';
}

export function getMealMomentCategory(value: string): MealCategory {
  const trimmed = value.trim();
  const normalized = trimmed.toLowerCase();

  if (normalized.startsWith('ontbijt')) return 'Ontbijt';
  if (normalized.startsWith('lunch')) return 'Lunch';
  if (normalized.startsWith('diner')) return 'Diner';
  if (LEGACY_SNACK_VALUES.has(normalized) || normalized.startsWith('snack')) return 'Snack';

  return 'Snack';
}

export function createMealSlot(category: MealCategory, index: number) {
  return `${category} ${index}`;
}

export function getMealCategoryCounts(slots: string[]) {
  const counts: Record<MealCategory, number> = {
    Ontbijt: 0,
    Lunch: 0,
    Diner: 0,
    Snack: 0,
  };

  for (const slot of slots) {
    counts[getMealMomentCategory(slot)] += 1;
  }

  return counts;
}

export function buildMealSlotsFromCounts(counts: Partial<Record<MealCategory, number>>) {
  return MAALTIJDCATEGORIEEN.flatMap((category) => {
    const amount = Math.max(0, Math.floor(counts[category] ?? 0));
    return Array.from({ length: amount }, (_, index) => createMealSlot(category, index + 1));
  });
}

export function summarizeMealSlots(slots: string[]) {
  const counts = getMealCategoryCounts(slots);

  return MAALTIJDCATEGORIEEN
    .filter((category) => counts[category] > 0)
    .map((category) => `${counts[category]}x ${category}`)
    .join(', ');
}

export function isSnackMoment(value: string) {
  return getMealMomentCategory(value) === 'Snack';
}

export function getMealMomentDescription(value: string) {
  switch (getMealMomentCategory(value)) {
    case 'Ontbijt':
      return 'Je eerste hoofdmaaltijd om de dag sterk te starten.';
    case 'Lunch':
      return 'Je middagmaaltijd voor focus en energie.';
    case 'Diner':
      return 'Je hoofdmaaltijd in de avond.';
    case 'Snack':
      return 'Een lichter tussendoortje naast je hoofdmaaltijden.';
    default:
      return 'Een extra eetmoment in je planning.';
  }
}

export function getMealMomentDisplayName(value: string, allMoments: string[] = []) {
  const category = getMealMomentCategory(value);
  const sameCategoryCount = allMoments.filter((moment) => getMealMomentCategory(moment) === category).length;
  const match = value.trim().match(/(\d+)$/);

  if (sameCategoryCount <= 1) {
    return category;
  }

  return `${category} ${match?.[1] ?? '1'}`;
}

export function distributeCaloriesAcrossMoments(totalCalories: number, moments: string[]) {
  const fallbackMoments = moments.length > 0 ? moments : [...STANDAARD_MAALTIJDMOMENTEN];
  const weights = fallbackMoments.map((moment) => (isSnackMoment(moment) ? 0.65 : 1.2));
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0) || 1;

  return Object.fromEntries(
    fallbackMoments.map((moment, index) => [
      moment,
      Math.round((totalCalories * weights[index]) / totalWeight),
    ])
  ) as Record<string, number>;
}

export function estimateGoals(profile: ProfileForm, doelType = 'Balans'): GoalForm {
  const base =
    10 * profile.gewicht +
    6.25 * profile.lengteCm -
    5 * profile.leeftijd +
    (profile.gender === 'Vrouw' ? -161 : profile.gender === 'Man' ? 5 : -78);

  const onderhoud = base * (ACTIVITY_MULTIPLIERS[profile.activiteit] ?? 1.2);
  const calorieFactor =
    doelType === 'Afvallen' ? 0.85 :
    doelType === 'Spiermassa opbouwen' ? 1.1 :
    doelType === 'Gezonder eten' ? 0.95 :
    1;
  const calories = Math.max(1200, Math.round(onderhoud * calorieFactor));

  const proteinFactor =
    doelType === 'Afvallen' ? 2 :
    doelType === 'Spiermassa opbouwen' ? 2.1 :
    1.8;
  const protein = Math.round(profile.gewicht * proteinFactor);
  const fatRatio =
    doelType === 'Afvallen' ? 0.28 :
    doelType === 'Spiermassa opbouwen' ? 0.25 :
    0.27;
  const fat = Math.round((calories * fatRatio) / 9);
  const carbs = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4));

  return {
    doelType,
    caloriedoel: calories,
    eiwitdoel: protein,
    koolhydraatdoel: carbs,
    vetdoel: fat,
  };
}

export function parsePreferredMealTypes(value?: string | null) {
  const parsedCategories = (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => getMealMomentCategory(item));

  if (parsedCategories.length === 0) {
    return [...STANDAARD_MAALTIJDMOMENTEN];
  }

  const counts = parsedCategories.reduce<Record<MealCategory, number>>(
    (result, category) => ({
      ...result,
      [category]: result[category] + 1,
    }),
    {
      Ontbijt: 0,
      Lunch: 0,
      Diner: 0,
      Snack: 0,
    }
  );

  return buildMealSlotsFromCounts(counts);
}

export function allergyTerms(profile?: ProfileForm | null): string[] {
  if (!profile?.allergieen) return [];
  return profile.allergieen
    .split(/[,\n]/)
    .map((term) => term.trim().toLowerCase())
    .filter(Boolean);
}

export function mealMatchesPreferences(meal: MealDto, profile?: ProfileForm | null): boolean {
  if (!profile) return true;

  const text = [
    meal.naam,
    meal.beschrijving,
    meal.categorie,
    meal.dieetLabels,
    ...meal.ingredienten.map((ingredient) => ingredient.ingredientNaam),
  ].join(' ').toLowerCase();

  if (allergyTerms(profile).some((term) => text.includes(term))) {
    return false;
  }

  const diet = profile.dieetvoorkeur.toLowerCase();
  const labels = meal.dieetLabels.toLowerCase();

  if (diet === 'anything' || diet === 'alles' || !diet) return true;
  if (diet === 'vegan') return labels.includes('vegan');
  if (diet === 'vegetarisch' || diet === 'vegetarian') return labels.includes('vegetarian') || labels.includes('vegan');
  if (diet === 'carnivore') return labels.includes('carnivore');
  if (diet === 'keto') return labels.includes('keto') || labels.includes('carnivore');
  if (diet === 'mediterraan' || diet === 'mediterranean') return true;
  if (diet === 'paleo') return true;

  return true;
}

interface MacroEstimate {
  terms: string[];
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

const FALLBACK_MACROS: MacroEstimate[] = [
  { terms: ['chicken', 'turkey'], kcal: 165, protein: 31, carbs: 0, fat: 4 },
  { terms: ['beef', 'steak'], kcal: 250, protein: 26, carbs: 0, fat: 15 },
  { terms: ['salmon', 'fish', 'tuna'], kcal: 200, protein: 22, carbs: 0, fat: 12 },
  { terms: ['egg'], kcal: 143, protein: 13, carbs: 1, fat: 10 },
  { terms: ['rice', 'pasta', 'noodle'], kcal: 360, protein: 8, carbs: 75, fat: 2 },
  { terms: ['potato'], kcal: 77, protein: 2, carbs: 17, fat: 0 },
  { terms: ['bread', 'flour', 'tortilla'], kcal: 265, protein: 9, carbs: 49, fat: 3 },
  { terms: ['bean', 'lentil', 'chickpea'], kcal: 165, protein: 9, carbs: 27, fat: 3 },
  { terms: ['cheese'], kcal: 402, protein: 25, carbs: 1, fat: 33 },
  { terms: ['milk', 'yogurt'], kcal: 61, protein: 3, carbs: 5, fat: 3 },
  { terms: ['cream', 'butter'], kcal: 717, protein: 1, carbs: 0, fat: 81 },
  { terms: ['oil', 'olive oil'], kcal: 884, protein: 0, carbs: 0, fat: 100 },
  { terms: ['avocado'], kcal: 160, protein: 2, carbs: 9, fat: 15 },
  { terms: ['sugar', 'honey', 'syrup'], kcal: 304, protein: 0, carbs: 82, fat: 0 },
  { terms: ['apple', 'banana', 'fruit'], kcal: 75, protein: 1, carbs: 19, fat: 0 },
  { terms: ['broccoli', 'spinach', 'pepper', 'onion', 'tomato', 'carrot', 'vegetable'], kcal: 35, protein: 2, carbs: 7, fat: 0 },
];

export interface MealNutrition {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  estimated: boolean;
  hasData: boolean;
}

export function calculateMealNutrition(meal: MealDto, servings: number): MealNutrition {
  if (meal.nutritionFacts?.sections.length) {
    const factor = servings / Math.max(1, meal.porties || 1);
    const calories = getNutritionFactValue(meal, 'calories') * factor;
    const protein = getNutritionFactValue(meal, 'protein') * factor;
    const carbs = getNutritionFactValue(meal, 'carbs') * factor;
    const fat = getNutritionFactValue(meal, 'fat') * factor;

    return {
      calories: Math.round(calories),
      protein: Math.round(protein),
      carbs: Math.round(carbs),
      fat: Math.round(fat),
      estimated: meal.nutritionFacts.estimated,
      hasData: calories > 0 || protein > 0 || carbs > 0 || fat > 0,
    };
  }

  const servingFactor = servings / Math.max(1, meal.porties || 1);
  let calories = 0;
  let protein = 0;
  let carbs = 0;
  let fat = 0;
  let estimated = false;
  let hasData = false;

  for (const ingredient of meal.ingredienten) {
    const grams = estimateIngredientGrams(ingredient.origineleHoeveelheid, ingredient.hoeveelheid) * servingFactor;
    const exact = ingredient.voedingswaarde;
    const fallback = exact ? null : findFallbackMacro(ingredient.ingredientNaam);
    const source = exact
      ? { kcal: exact.kcal, protein: exact.eiwit, carbs: exact.koolhydraat, fat: exact.vet }
      : fallback;

    if (!source) continue;

    hasData = true;
    estimated = estimated || !exact;
    const factor = grams / 100;
    calories += source.kcal * factor;
    protein += source.protein * factor;
    carbs += source.carbs * factor;
    fat += source.fat * factor;
  }

  return {
    calories: Math.round(calories),
    protein: Math.round(protein),
    carbs: Math.round(carbs),
    fat: Math.round(fat),
    estimated,
    hasData,
  };
}

export function getNutritionFactValue(meal: MealDto, key: string) {
  return meal.nutritionFacts?.sections
    .flatMap((section) => section.rows)
    .find((row) => row.key === key)?.value ?? 0;
}

export function macroPercentages(nutrition: MealNutrition) {
  const proteinCalories = nutrition.protein * 4;
  const carbCalories = nutrition.carbs * 4;
  const fatCalories = nutrition.fat * 9;
  const total = proteinCalories + carbCalories + fatCalories;

  if (total <= 0) {
    return { protein: 0, carbs: 0, fat: 0 };
  }

  return {
    protein: Math.round((proteinCalories / total) * 100),
    carbs: Math.round((carbCalories / total) * 100),
    fat: Math.max(0, 100 - Math.round((proteinCalories / total) * 100) - Math.round((carbCalories / total) * 100)),
  };
}

export function scaleMeasure(measure: string, servings: number, baseServings: number) {
  const factor = servings / Math.max(1, baseServings);
  if (!measure) return factor === 1 ? '1 portie' : `${formatNumber(factor)} porties`;
  if (factor === 1) return measure;
  return scaleLeadingQuantity(measure, factor) ?? `${measure} x ${formatNumber(factor)}`;
}

function findFallbackMacro(name: string) {
  const normalized = name.toLowerCase();
  return FALLBACK_MACROS.find((item) => item.terms.some((term) => normalized.includes(term))) ?? null;
}

function estimateIngredientGrams(measure: string, amount: number) {
  const lower = measure.toLowerCase();
  if (isNonConsumableMeasure(lower)) return 0;
  const parsed = amount > 0 ? amount : parseFirstQuantity(lower)?.value ?? 1;

  if (hasMeasureUnit(lower, ['kg', 'kilogram', 'kilograms'])) return parsed * 1000;
  if (hasMeasureUnit(lower, ['mg'])) return parsed / 1000;
  if (hasMeasureUnit(lower, ['g', 'gram', 'grams'])) return parsed;
  if (hasMeasureUnit(lower, ['lb', 'lbs', 'pound', 'pounds'])) return parsed * 454;
  if (hasMeasureUnit(lower, ['oz', 'ounce', 'ounces'])) return parsed * 28;
  if (hasMeasureUnit(lower, ['ml'])) return parsed;
  if (hasMeasureUnit(lower, ['l', 'liter', 'liters', 'litre', 'litres'])) return parsed * 1000;
  if (hasMeasureUnit(lower, ['tsp', 'teaspoon', 'teaspoons'])) return parsed * 5;
  if (hasMeasureUnit(lower, ['tbsp', 'tablespoon', 'tablespoons'])) return parsed * 15;
  if (hasMeasureUnit(lower, ['cup', 'cups'])) return parsed * 240;
  if (hasMeasureUnit(lower, ['clove', 'cloves'])) return parsed * 5;
  if (hasMeasureUnit(lower, ['slice', 'slices'])) return parsed * 30;
  if (hasMeasureUnit(lower, ['egg', 'eggs'])) return parsed * 50;
  if (hasMeasureUnit(lower, ['leaf', 'leaves'])) return parsed * estimateLeafGrams(measure);
  if (hasMeasureUnit(lower, ['sprig', 'sprigs'])) return parsed * estimateSprigGrams(measure);
  if (hasMeasureUnit(lower, ['pinch', 'pinches'])) return parsed * 0.36;
  if (hasMeasureUnit(lower, ['dash', 'dashes'])) return parsed * 0.6;

  return parsed * estimateDefaultUnitGrams(measure);
}

function hasMeasureUnit(text: string, units: string[]) {
  return units.some((unit) => {
    const escaped = unit.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`(?:^|[^a-z])${escaped}(?:$|[^a-z])|\\d+(?:[.,]\\d+)?\\s*${escaped}(?:$|[^a-z])`, 'i');
    return pattern.test(text);
  });
}

function isNonConsumableMeasure(measure: string) {
  return measure.includes('to serve')
    || measure.includes('to taste')
    || measure.includes('for garnish')
    || measure.includes('for serving');
}

function estimateLeafGrams(name: string) {
  const lower = name.toLowerCase();
  if (isBayLeaf(lower)) return 0.2;
  if (isLeafyHerb(lower)) return 1;
  return 2;
}

function estimateSprigGrams(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes('thyme') || lower.includes('rosemary')) return 1;
  if (isLeafyHerb(lower)) return 2;
  return 2;
}

function estimateDefaultUnitGrams(name: string) {
  const lower = name.toLowerCase();
  if (isBayLeaf(lower)) return 0.2;
  if (isLeafyHerb(lower)) return 1;
  if (isDrySpice(lower)) return 2;
  if (lower.includes('egg')) return 50;
  if (lower.includes('bread')) return 30;
  if (lower.includes('salt')) return 6;
  if (lower.includes('pepper')) return 2;
  if (lower.includes('garlic')) return 5;
  if (lower.includes('onion')) return 110;
  if (lower.includes('tomato')) return 120;
  if (lower.includes('potato')) return 150;
  if (lower.includes('butter')) return 14;
  if (lower.includes('oil')) return 14;
  if (lower.includes('cheese')) return 28;
  if (lower.includes('chicken')) return 120;
  if (lower.includes('beef')) return 120;
  if (lower.includes('fish') || lower.includes('salmon') || lower.includes('tuna')) return 120;
  return 100;
}

function isBayLeaf(name: string) {
  return name.includes('bay leaf') || name.includes('bay leaves');
}

function isLeafyHerb(name: string) {
  return name.includes('parsley')
    || name.includes('cilantro')
    || name.includes('coriander')
    || name.includes('mint')
    || name.includes('basil')
    || name.includes('sage')
    || name.includes('thyme')
    || name.includes('rosemary');
}

function isDrySpice(name: string) {
  return name.includes('cinnamon')
    || name.includes('paprika')
    || name.includes('cumin')
    || name.includes('nutmeg')
    || name.includes('turmeric')
    || name.includes('oregano')
    || name.includes('allspice')
    || name.includes('clove')
    || name.includes('peppercorn');
}

function scaleLeadingQuantity(measure: string, factor: number) {
  const normalized = normalizeFractions(measure);
  const parsed = parseFirstQuantity(normalized);
  if (!parsed || parsed.index > 3) return null;

  const scaled = formatNumber(parsed.value * factor);
  return `${normalized.slice(0, parsed.index)}${scaled}${normalized.slice(parsed.index + parsed.length)}`;
}

function parseFirstQuantity(text: string) {
  const normalized = normalizeFractions(text);
  const match = normalized.match(/(\d+(?:[.,]\d+)?)\s+(\d+)\/(\d+)|(\d+)\/(\d+)|\d+(?:[.,]\d+)?/);
  if (!match || match.index === undefined) return null;

  if (match[1] && match[2] && match[3]) {
    const whole = Number(match[1].replace(',', '.'));
    const numerator = Number(match[2]);
    const denominator = Number(match[3]);
    return {
      value: denominator === 0 ? whole : whole + numerator / denominator,
      index: match.index,
      length: match[0].length,
    };
  }

  if (match[4] && match[5]) {
    const numerator = Number(match[4]);
    const denominator = Number(match[5]);
    return {
      value: denominator === 0 ? numerator : numerator / denominator,
      index: match.index,
      length: match[0].length,
    };
  }

  return {
    value: Number(match[0].replace(',', '.')),
    index: match.index,
    length: match[0].length,
  };
}

function normalizeFractions(text: string) {
  return text
    .replace(/\u00BD/g, '1/2')
    .replace(/\u00BC/g, '1/4')
    .replace(/\u00BE/g, '3/4');
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, '');
}
