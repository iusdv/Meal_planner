import { describe, expect, it } from 'vitest';
import { isSetupComplete } from './setup';

const completeProfile = {
  gender: 'Man',
  leeftijd: 30,
  gewicht: 80,
  lengteCm: 180,
  activiteit: 'Zittend werk, lichte beweging',
  dieetvoorkeur: 'Alles',
  allergieen: '',
  maaltijdenPerDag: 3,
  gewensteMaaltijden: 'Ontbijt 1,Lunch 1,Diner 1',
};

const completeGoal = {
  doelType: 'Balans',
  caloriedoel: 2200,
  eiwitdoel: 140,
  koolhydraatdoel: 250,
  vetdoel: 70,
};

describe('isSetupComplete', () => {
  it('returns true when all required profile and goal fields are filled', () => {
    expect(isSetupComplete(completeProfile, completeGoal)).toBe(true);
  });

  it('returns false when profile or goal data is missing', () => {
    expect(isSetupComplete(null, completeGoal)).toBe(false);
    expect(isSetupComplete(completeProfile, null)).toBe(false);
    expect(isSetupComplete({ ...completeProfile, leeftijd: 0 }, completeGoal)).toBe(false);
    expect(isSetupComplete(completeProfile, { ...completeGoal, caloriedoel: 0 })).toBe(false);
  });
});
