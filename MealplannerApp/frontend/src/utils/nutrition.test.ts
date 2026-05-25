import { describe, expect, it } from 'vitest';
import type { MealDto } from '../types';
import {
  calculateMealNutrition,
  distributeCaloriesAcrossMoments,
  estimateGoals,
  getMealCategoryCounts,
  getMealMomentCategory,
  getMealMomentDescription,
  getMealMomentDisplayName,
  macroPercentages,
  mealMatchesPreferences,
  normalizeActivityValue,
  normalizeDietValue,
  normalizeGenderValue,
  parsePreferredMealTypes,
  scaleMeasure,
} from './nutrition';

function meal(overrides: Partial<MealDto> = {}): MealDto {
  return {
    id: 1,
    naam: 'Chicken rice bowl',
    beschrijving: 'Chicken with rice',
    instructies: '',
    categorie: 'Diner',
    bereidingstijd: 30,
    porties: 1,
    afbeeldingUrl: '',
    dieetLabels: 'Anything',
    isZelfgemaakt: false,
    ingredienten: [],
    nutritionFacts: null,
    ...overrides,
  };
}

describe('nutrition normalization', () => {
  it('normalizes old activity, gender and diet values to the current Dutch values', () => {
    expect(normalizeActivityValue('Sedentair')).toBe('Zittend werk, lichte beweging');
    expect(normalizeActivityValue('Matig actief')).toBe('Dagelijks actief, vaak sporten');
    expect(normalizeGenderValue('Man')).toBe('Man');
    expect(normalizeGenderValue('Other')).toBe('');
    expect(normalizeDietValue('Vegetarian')).toBe('Vegetarisch');
    expect(normalizeDietValue(undefined)).toBe('Alles');
  });
});

describe('meal moment helpers', () => {
  it('detects meal categories from numbered and legacy slot names', () => {
    expect(getMealMomentCategory('Ontbijt 2')).toBe('Ontbijt');
    expect(getMealMomentCategory('Lunch 1')).toBe('Lunch');
    expect(getMealMomentCategory('Diner')).toBe('Diner');
    expect(getMealMomentCategory('Ochtend snack')).toBe('Snack');
    expect(getMealMomentCategory('Onbekend')).toBe('Snack');
  });

  it('counts and displays repeated meal moments clearly', () => {
    const moments = ['Ontbijt 1', 'Lunch 1', 'Diner 1', 'Diner 2', 'Snack 1'];

    expect(getMealCategoryCounts(moments)).toEqual({
      Ontbijt: 1,
      Lunch: 1,
      Diner: 2,
      Snack: 1,
    });
    expect(getMealMomentDisplayName('Diner 2', moments)).toBe('Diner 2');
    expect(getMealMomentDisplayName('Lunch 1', moments)).toBe('Lunch');
    expect(getMealMomentDescription('Snack 1')).toBe('Tussendoortje.');
  });

  it('parses preferred meal categories into normalized numbered slots', () => {
    expect(parsePreferredMealTypes('Diner, Ontbijt, Snack, Diner')).toEqual([
      'Ontbijt 1',
      'Diner 1',
      'Diner 2',
      'Snack 1',
    ]);
    expect(parsePreferredMealTypes('')).toEqual(['Ontbijt 1', 'Lunch 1', 'Diner 1']);
  });

  it('distributes calories lower for snack moments than for main meal moments', () => {
    const distribution = distributeCaloriesAcrossMoments(2400, ['Ontbijt 1', 'Lunch 1', 'Diner 1', 'Snack 1']);

    expect(distribution).toEqual({
      'Ontbijt 1': 678,
      'Lunch 1': 678,
      'Diner 1': 678,
      'Snack 1': 367,
    });
  });
});

describe('goal estimation', () => {
  it('calculates balanced goals for a male profile', () => {
    const goals = estimateGoals({
      gender: 'Man',
      leeftijd: 30,
      gewicht: 80,
      lengteCm: 180,
      activiteit: 'Zittend werk, lichte beweging',
      dieetvoorkeur: 'Alles',
      allergieen: '',
      maaltijdenPerDag: 3,
      gewensteMaaltijden: 'Ontbijt 1,Lunch 1,Diner 1',
    });

    expect(goals).toEqual({
      doelType: 'Balans',
      caloriedoel: 2136,
      eiwitdoel: 144,
      koolhydraatdoel: 246,
      vetdoel: 64,
    });
  });

  it('uses a calorie deficit and higher protein target when the goal is weight loss', () => {
    const goals = estimateGoals({
      gender: 'Vrouw',
      leeftijd: 28,
      gewicht: 65,
      lengteCm: 170,
      activiteit: 'Licht actief, 3-4 keer sporten per week',
      dieetvoorkeur: 'Alles',
      allergieen: '',
      maaltijdenPerDag: 3,
      gewensteMaaltijden: 'Ontbijt 1,Lunch 1,Diner 1',
    }, 'Afvallen');

    expect(goals).toEqual({
      doelType: 'Afvallen',
      caloriedoel: 1650,
      eiwitdoel: 130,
      koolhydraatdoel: 168,
      vetdoel: 51,
    });
  });
});

describe('preference matching', () => {
  it('rejects meals containing allergy terms', () => {
    const result = mealMatchesPreferences(
      meal({
        naam: 'Rice noodles',
        ingredienten: [
          {
            ingredientId: 1,
            ingredientNaam: 'Peanut',
            hoeveelheid: 100,
            eenheid: 'g',
            origineleHoeveelheid: '100g',
          },
        ],
      }),
      {
        gender: 'Man',
        leeftijd: 30,
        gewicht: 80,
        lengteCm: 180,
        activiteit: 'Zittend werk, lichte beweging',
        dieetvoorkeur: 'Alles',
        allergieen: 'peanut',
        maaltijdenPerDag: 3,
        gewensteMaaltijden: 'Ontbijt 1,Lunch 1,Diner 1',
      }
    );

    expect(result).toBe(false);
  });

  it('allows vegan meals for vegetarian users but rejects non-vegetarian meals', () => {
    const vegetarianProfile = {
      gender: 'Vrouw',
      leeftijd: 25,
      gewicht: 60,
      lengteCm: 168,
      activiteit: 'Zittend werk, lichte beweging',
      dieetvoorkeur: 'Vegetarisch',
      allergieen: '',
      maaltijdenPerDag: 3,
      gewensteMaaltijden: 'Ontbijt 1,Lunch 1,Diner 1',
    };

    expect(mealMatchesPreferences(meal({ naam: 'Vegan bowl', beschrijving: 'Vegetables and rice', dieetLabels: 'Vegan,Vegetarian' }), vegetarianProfile)).toBe(true);
    expect(mealMatchesPreferences(meal({ naam: 'Beef stew', beschrijving: 'Beef with vegetables', dieetLabels: 'Carnivore' }), vegetarianProfile)).toBe(false);
  });
});

describe('meal nutrition calculation', () => {
  it('scales nutrition facts by the selected serving and base recipe portions', () => {
    const nutrition = calculateMealNutrition(
      meal({
        porties: 4,
        nutritionFacts: {
          servingGrams: 840,
          estimated: false,
          source: 'FoodDataCentral',
          sections: [
            {
              title: 'Main',
              rows: [
                { key: 'calories', label: 'Calories', value: 1524, unit: 'kcal', dailyValuePercent: null, highlight: true },
                { key: 'protein', label: 'Protein', value: 52, unit: 'g', dailyValuePercent: null, highlight: false },
                { key: 'carbs', label: 'Carbs', value: 288, unit: 'g', dailyValuePercent: null, highlight: false },
                { key: 'fat', label: 'Fat', value: 16, unit: 'g', dailyValuePercent: null, highlight: false },
              ],
            },
          ],
        },
      }),
      1
    );

    expect(nutrition).toEqual({
      calories: 381,
      protein: 13,
      carbs: 72,
      fat: 4,
      estimated: false,
      hasData: true,
    });
  });

  it('calculates exact ingredient nutrition from grams and portions', () => {
    const nutrition = calculateMealNutrition(
      meal({
        porties: 2,
        ingredienten: [
          {
            ingredientId: 1,
            ingredientNaam: 'Chicken',
            hoeveelheid: 200,
            eenheid: 'g',
            origineleHoeveelheid: '200g',
            voedingswaarde: {
              kcal: 165,
              eiwit: 31,
              koolhydraat: 0,
              vet: 4,
            },
          },
        ],
      }),
      1
    );

    expect(nutrition).toEqual({
      calories: 165,
      protein: 31,
      carbs: 0,
      fat: 4,
      estimated: false,
      hasData: true,
    });
  });

  it('falls back to macro estimates when exact ingredient nutrition is missing', () => {
    const nutrition = calculateMealNutrition(
      meal({
        ingredienten: [
          {
            ingredientId: 1,
            ingredientNaam: 'Olive oil',
            hoeveelheid: 0,
            eenheid: 'tbsp',
            origineleHoeveelheid: '1 tbsp',
          },
        ],
      }),
      1
    );

    expect(nutrition.calories).toBe(133);
    expect(nutrition.fat).toBe(15);
    expect(nutrition.estimated).toBe(true);
    expect(nutrition.hasData).toBe(true);
  });

  it('uses Dutch snack fallbacks when exact ingredient nutrition is missing', () => {
    const nutrition = calculateMealNutrition(
      meal({
        naam: 'Stroopwafel',
        ingredienten: [
          {
            ingredientId: 1,
            ingredientNaam: 'stroop',
            hoeveelheid: 100,
            eenheid: 'g',
            origineleHoeveelheid: '100 g',
          },
          {
            ingredientId: 2,
            ingredientNaam: 'wafel',
            hoeveelheid: 1,
            eenheid: 'stuk',
            origineleHoeveelheid: '1 stuk',
          },
        ],
      }),
      1
    );

    expect(nutrition.calories).toBe(754);
    expect(nutrition.carbs).toBe(147);
    expect(nutrition.estimated).toBe(true);
    expect(nutrition.hasData).toBe(true);
  });

  it('calculates macro calorie percentages and handles empty values', () => {
    expect(macroPercentages({ calories: 0, protein: 0, carbs: 0, fat: 0, estimated: false, hasData: false })).toEqual({
      protein: 0,
      carbs: 0,
      fat: 0,
    });
    expect(macroPercentages({ calories: 170, protein: 10, carbs: 20, fat: 10, estimated: false, hasData: true })).toEqual({
      protein: 19,
      carbs: 38,
      fat: 43,
    });
  });
});

describe('measure scaling', () => {
  it('scales leading quantities including fractions', () => {
    expect(scaleMeasure('1/2 cup rice', 2, 1)).toBe('1 cup rice');
    expect(scaleMeasure('2 eggs', 3, 2)).toBe('3 eggs');
    expect(scaleMeasure('', 2, 1)).toBe('2 porties');
  });
});
