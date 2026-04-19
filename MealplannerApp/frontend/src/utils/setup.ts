import type { GoalDto, ProfileDto } from '../types';

export function isSetupComplete(profile?: Partial<ProfileDto> | null, goal?: Partial<GoalDto> | null) {
  if (!profile || !goal) return false;

  return Boolean(
    profile.gender &&
    (profile.leeftijd ?? 0) > 0 &&
    (profile.gewicht ?? 0) > 0 &&
    (profile.lengteCm ?? 0) > 0 &&
    profile.activiteit &&
    profile.dieetvoorkeur &&
    (profile.maaltijdenPerDag ?? 0) > 0 &&
    profile.gewensteMaaltijden &&
    goal.doelType &&
    (goal.caloriedoel ?? 0) > 0 &&
    (goal.eiwitdoel ?? 0) > 0 &&
    (goal.koolhydraatdoel ?? 0) > 0 &&
    (goal.vetdoel ?? 0) > 0
  );
}
