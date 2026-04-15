import api from './api';
import type {
  AuthResponseDto,
  MealDto,
  PlannedMealDto,
  FavoriteDto,
  ProfileDto,
  GoalDto,
} from '../types';

// Auth
export const register = (naam: string, email: string, wachtwoord: string) =>
  api.post<AuthResponseDto>('/auth/register', { naam, email, wachtwoord });

export const login = (email: string, wachtwoord: string) =>
  api.post<AuthResponseDto>('/auth/login', { email, wachtwoord });

// Meals
export const getMeals = () => api.get<MealDto[]>('/meals');
export const getMeal = (id: number) => api.get<MealDto>(`/meals/${id}`);

// Planned meals
export const getPlannedMeals = () => api.get<PlannedMealDto[]>('/plannedmeals');
export const addPlannedMeal = (mealId: number, datum: string, maaltijdtype: string) =>
  api.post<PlannedMealDto>('/plannedmeals', { mealId, datum, maaltijdtype });
export const removePlannedMeal = (id: number) => api.delete(`/plannedmeals/${id}`);

// Favorites
export const getFavorites = () => api.get<FavoriteDto[]>('/favorites');
export const addFavorite = (mealId: number) => api.post<FavoriteDto>('/favorites', { mealId });
export const removeFavorite = (id: number) => api.delete(`/favorites/${id}`);

// Profile
export const getProfile = () => api.get<ProfileDto>('/profile');
export const upsertProfile = (data: Omit<ProfileDto, 'id' | 'userId'>) =>
  api.put<ProfileDto>('/profile', data);

// Goals
export const getGoals = () => api.get<GoalDto>('/goals');
export const upsertGoals = (data: Omit<GoalDto, 'id' | 'userId'>) =>
  api.put<GoalDto>('/goals', data);

// AI Suggestions
export const getSuggestion = (vraag: string) =>
  api.post<{ antwoord: string }>('/suggestions', { vraag });
