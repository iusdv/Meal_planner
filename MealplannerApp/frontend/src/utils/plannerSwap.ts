export const PLANNER_SWAP_STORAGE_KEY = 'mealplanner.swapContext';
export const DASHBOARD_FLASH_STORAGE_KEY = 'mealplanner.dashboardFlash';

export interface PlannerSwapTarget {
  key: string;
  date: string;
  type: string;
  plannedItemId: number | null;
}

export interface PlannerSwapContext {
  mealType: string;
  currentMealId: number | null;
  currentMealName: string;
  targets: PlannerSwapTarget[];
}
