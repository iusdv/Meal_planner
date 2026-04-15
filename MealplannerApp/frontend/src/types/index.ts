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
  voedingswaarde?: NutritionalValueDto;
}

export interface NutritionalValueDto {
  kcal: number;
  eiwit: number;
  koolhydraat: number;
  vet: number;
}

export interface MealDto {
  id: number;
  naam: string;
  beschrijving: string;
  categorie: string;
  bereidingstijd: number;
  afbeeldingUrl?: string;
  ingredienten: MealIngredientDto[];
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
  activiteit: string;
}

export interface GoalDto {
  id: number;
  userId: number;
  caloriedoel: number;
  eiwitdoel: number;
  koolhydraatdoel: number;
  vetdoel: number;
}
