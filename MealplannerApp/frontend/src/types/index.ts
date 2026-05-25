// Type definitions mirroring backend DTOs

export interface UserDto {
  id: number;
  naam: string;
  email: string;
  rol: string;
}

export interface AuthResponseDto {
  token: string;
  user: UserDto;
}

export interface MealIngredientDto {
  ingredientId: number;
  ingredientNaam: string;
  hoeveelheid: number;
  eenheid: string;
  origineleHoeveelheid: string;
  voedingswaarde?: NutritionalValueDto;
}

export interface NutritionalValueDto {
  kcal: number;
  eiwit: number;
  koolhydraat: number;
  vet: number;
}

export interface IngredientDto {
  id: number;
  naam: string;
  eenheid: string;
  voedingswaarde?: NutritionalValueDto | null;
}

export interface MealDto {
  id: number;
  naam: string;
  beschrijving: string;
  instructies: string;
  categorie: string;
  bereidingstijd: number;
  porties: number;
  afbeeldingUrl?: string;
  dieetLabels: string;
  isZelfgemaakt: boolean;
  ingredienten: MealIngredientDto[];
  nutritionFacts?: NutritionFactsDto | null;
}

export interface CreateSelfMadeMealIngredientDto {
  naam: string;
  hoeveelheid: number;
  eenheid: string;
  ingredientId?: number | null;
  kcalPer100?: number | null;
  eiwitPer100?: number | null;
  koolhydraatPer100?: number | null;
  vetPer100?: number | null;
}

export interface CreateSelfMadeMealDto {
  naam: string;
  beschrijving: string;
  instructies: string;
  categorie: string;
  bereidingstijd: number;
  porties: number;
  afbeeldingUrl: string;
  dieetLabels?: string;
  ingredienten: CreateSelfMadeMealIngredientDto[];
}

export interface PaginatedResultDto<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface NutritionFactsDto {
  servingGrams: number;
  estimated: boolean;
  source: string;
  sections: NutritionFactSectionDto[];
}

export interface NutritionFactSectionDto {
  title: string;
  rows: NutritionFactRowDto[];
}

export interface NutritionFactRowDto {
  key: string;
  label: string;
  value: number;
  unit: string;
  dailyValuePercent: number | null;
  highlight: boolean;
}

export interface PlannedMealDto {
  id: number;
  userId: number;
  mealId: number;
  mealNaam: string;
  afbeeldingUrl?: string;
  datum: string;
  maaltijdtype: string;
}

export interface FavoriteDto {
  id: number;
  mealId: number;
  mealNaam: string;
  afbeeldingUrl?: string;
  datumToegevoegd: string;
}

export interface ProfileDto {
  id: number;
  userId: number;
  gender: string;
  leeftijd: number;
  gewicht: number;
  lengteCm: number;
  activiteit: string;
  dieetvoorkeur: string;
  allergieen: string;
  maaltijdenPerDag: number;
  gewensteMaaltijden: string;
}

export interface GoalDto {
  id: number;
  userId: number;
  doelType: string;
  caloriedoel: number;
  eiwitdoel: number;
  koolhydraatdoel: number;
  vetdoel: number;
}
