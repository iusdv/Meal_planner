import { useEffect, useState } from 'react';
import type { FormEvent, InputHTMLAttributes, ReactNode } from 'react';
import { getGoals, getProfile, upsertGoals, upsertProfile } from '../services/mealService';
import type { GoalDto, ProfileDto } from '../types';
import {
  ACTIVITEITSNIVEAUS,
  createMealSlot,
  DOELTYPES,
  getMealMomentCategory,
  getMealMomentDescription,
  getMealMomentDisplayName,
  MAALTIJDCATEGORIEEN,
  estimateGoals,
  normalizeActivityValue,
  normalizeDietValue,
  normalizeGenderValue,
  parsePreferredMealTypes,
  summarizeMealSlots,
  type MealCategory,
} from '../utils/nutrition';
import { useAuth } from '../context/useAuth';

const EETMOMENT_AANTALLEN = [1, 2, 3, 4, 5, 6] as const;

function normalizeMealSelection(selected: string[], count: number) {
  const boundedCount = Math.max(1, Math.min(count, 6));
  const categories = selected.slice(0, boundedCount).map(getMealMomentCategory);

  while (categories.length < boundedCount) {
    categories.push(
      MAALTIJDCATEGORIEEN.find((category) => !categories.includes(category)) ??
        getDefaultCategoryForIndex(categories.length)
    );
  }

  return buildSlotsFromCategorySequence(categories);
}

function buildSlotsFromCategorySequence(categories: MealCategory[]) {
  const counts: Record<MealCategory, number> = {
    Ontbijt: 0,
    Lunch: 0,
    Diner: 0,
    Snack: 0,
  };

  return categories.map((category) => {
    counts[category] += 1;
    return createMealSlot(category, counts[category]);
  });
}

function getDefaultCategoryForIndex(index: number): MealCategory {
  const defaults: MealCategory[] = ['Ontbijt', 'Lunch', 'Diner', 'Snack', 'Lunch', 'Diner'];
  return defaults[index] ?? 'Snack';
}

export default function ProfilePage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Omit<ProfileDto, 'id' | 'userId'>>({
    gender: '',
    leeftijd: 0,
    gewicht: 0,
    lengteCm: 0,
    activiteit: '',
    dieetvoorkeur: 'Alles',
    allergieen: '',
    maaltijdenPerDag: 3,
    gewensteMaaltijden: 'Ontbijt 1,Lunch 1,Diner 1',
  });
  const [goal, setGoal] = useState<Omit<GoalDto, 'id' | 'userId'>>({
    doelType: 'Balans',
    caloriedoel: 2000,
    eiwitdoel: 150,
    koolhydraatdoel: 250,
    vetdoel: 65,
  });
  const [geselecteerdeMaaltijden, setGeselecteerdeMaaltijden] = useState<string[]>(['Ontbijt 1', 'Lunch 1', 'Diner 1']);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    getProfile()
      .then((response) => {
        const data = response.data;
        const mealCount = Math.max(1, Math.min(data.maaltijdenPerDag || 3, 6));
        const meals = normalizeMealSelection(parsePreferredMealTypes(data.gewensteMaaltijden), mealCount);
        setProfile({
          gender: normalizeGenderValue(data.gender),
          leeftijd: data.leeftijd,
          gewicht: data.gewicht,
          lengteCm: data.lengteCm,
          activiteit: normalizeActivityValue(data.activiteit),
          dieetvoorkeur: normalizeDietValue(data.dieetvoorkeur),
          allergieen: data.allergieen,
          maaltijdenPerDag: mealCount,
          gewensteMaaltijden: meals.join(','),
        });
        setGeselecteerdeMaaltijden(meals);
      })
      .catch(() => {});

    getGoals()
      .then((response) => {
        const data = response.data;
        setGoal({
          doelType: data.doelType,
          caloriedoel: data.caloriedoel,
          eiwitdoel: data.eiwitdoel,
          koolhydraatdoel: data.koolhydraatdoel,
          vetdoel: data.vetdoel,
        });
      })
      .catch(() => {});
  }, []);

  const handleMealCountChange = (count: number) => {
    const currentCategories = geselecteerdeMaaltijden.map(getMealMomentCategory);
    const nextCategories = Array.from(
      { length: count },
      (_, index) => currentCategories[index] ?? getDefaultCategoryForIndex(index)
    );
    const meals = buildSlotsFromCategorySequence(nextCategories);

    setGeselecteerdeMaaltijden(meals);
    setProfile((current) => ({
      ...current,
      maaltijdenPerDag: count,
      gewensteMaaltijden: meals.join(','),
    }));
  };

  const updateMealSlotCategory = (index: number, category: MealCategory) => {
    const nextCategories = geselecteerdeMaaltijden.map(getMealMomentCategory);
    nextCategories[index] = category;
    const meals = buildSlotsFromCategorySequence(nextCategories);

    setGeselecteerdeMaaltijden(meals);
    setProfile((current) => ({
      ...current,
      gewensteMaaltijden: meals.join(','),
    }));
    setMsg('');
  };

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    if (profile.lengteCm > 251) {
      setMsg('Lengte mag maximaal 251 cm zijn.');
      return;
    }
    if (geselecteerdeMaaltijden.length !== profile.maaltijdenPerDag) {
      setMsg(`Verdeel eerst alle ${profile.maaltijdenPerDag} eetmomenten over ontbijt, lunch, diner en snack.`);
      return;
    }
    setSaving(true);
    try {
      await Promise.all([
        upsertProfile({ ...profile, gewensteMaaltijden: geselecteerdeMaaltijden.join(',') }),
        upsertGoals(goal),
      ]);
      sessionStorage.setItem('setupComplete', 'true');
      setMsg('Profiel opgeslagen!');
      setTimeout(() => setMsg(''), 2500);
    } catch {
      setMsg('Opslaan mislukt.');
    } finally {
      setSaving(false);
    }
  };

  const applyEstimate = () => {
    if (!profile.gender || !profile.leeftijd || !profile.gewicht || !profile.lengteCm || !profile.activiteit) {
      setMsg('Vul eerst je basisgegevens in.');
      return;
    }

    if (profile.lengteCm > 251) {
      setMsg('Lengte mag maximaal 251 cm zijn.');
      return;
    }

    setGoal(estimateGoals(profile, goal.doelType));
    setMsg('Calorie- en macrodoelen berekend.');
    setTimeout(() => setMsg(''), 2500);
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <h1 className="mb-6 text-2xl font-bold text-gray-800">Mijn profiel</h1>

      {msg && (
        <div className={`mb-4 rounded-lg px-4 py-3 text-sm font-medium ${msg.includes('mislukt') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          {msg}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <h2 className="mb-4 font-semibold text-gray-700">Accountgegevens</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500">Naam</label>
              <p className="font-medium text-gray-800">{user?.naam}</p>
            </div>
            <div>
              <label className="text-xs text-gray-500">E-mail</label>
              <p className="font-medium text-gray-800">{user?.email}</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <h2 className="mb-4 font-semibold text-gray-700">Lichaamsprofiel</h2>
          <div className="grid grid-cols-2 gap-4">
            <SelectField label="Geslacht" value={profile.gender} onChange={(value) => setProfile({ ...profile, gender: value })}>
              <option value="">Kies...</option>
              <option value="Man">Man</option>
              <option value="Vrouw">Vrouw</option>
            </SelectField>
            <InputField label="Leeftijd" type="number" value={profile.leeftijd || ''} onChange={(value) => setProfile({ ...profile, leeftijd: Number(value) })} />
            <InputField label="Gewicht (kg)" type="number" step="0.1" value={profile.gewicht || ''} onChange={(value) => setProfile({ ...profile, gewicht: Number(value) })} />
            <InputField label="Lengte (cm)" type="number" max="251" value={profile.lengteCm || ''} onChange={(value) => setProfile({ ...profile, lengteCm: Number(value) })} />
            <SelectField label="Activiteitsniveau" value={profile.activiteit} onChange={(value) => setProfile({ ...profile, activiteit: value })}>
              <option value="">Kies...</option>
              {ACTIVITEITSNIVEAUS.map((item) => <option key={item} value={item}>{item}</option>)}
            </SelectField>
            <SelectField label="Eetstijl" value={profile.dieetvoorkeur} onChange={(value) => setProfile({ ...profile, dieetvoorkeur: value })}>
              <option value="Alles">Alles</option>
              <option value="Vegan">Vegan</option>
              <option value="Vegetarisch">Vegetarisch</option>
              <option value="Paleo">Paleo</option>
              <option value="Keto">Keto</option>
              <option value="Mediterraan">Mediterraan</option>
            </SelectField>
            <div className="col-span-2">
              <label className="mb-1 block text-sm text-gray-600">Allergieen of ingredienten vermijden</label>
              <textarea
                value={profile.allergieen}
                onChange={(event) => setProfile({ ...profile, allergieen: event.target.value })}
                rows={3}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="Bijv. pinda, lactose, koriander"
              />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <h2 className="mb-4 font-semibold text-gray-700">Plannerinstellingen</h2>
          <div className="mx-auto max-w-3xl">
            <div className="border-b border-green-100 pb-6">
              <h3 className="text-lg font-semibold text-gray-900">Hoeveel eetmomenten wil je plannen?</h3>
              <p className="mt-2 max-w-xl text-sm leading-6 text-gray-600">
                Kies het aantal momenten per dag. Daarna geef je elk moment simpelweg een type.
              </p>
              <label className="mt-4 block max-w-xs">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-green-700">Per dag</span>
                <select
                  value={profile.maaltijdenPerDag}
                  onChange={(event) => handleMealCountChange(Number(event.target.value))}
                  className="w-full rounded-2xl border border-green-200 bg-white px-4 py-3 text-sm font-semibold text-gray-900 focus:border-green-500 focus:outline-none"
                >
                  {EETMOMENT_AANTALLEN.map((count) => (
                    <option key={count} value={count}>
                      {count} eetmoment{count === 1 ? '' : 'en'}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="pt-6">
              <h3 className="text-lg font-semibold text-gray-900">Welke momenten zijn dat?</h3>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600">
                Wil je bijvoorbeeld twee keer ontbijten of twee keer dineren? Kies dan hetzelfde type meerdere keren.
              </p>
              <div className="mt-4 divide-y divide-green-100 rounded-[24px] border border-green-100 bg-[#fbfefb]">
                {geselecteerdeMaaltijden.map((moment, index) => {
                  const category = getMealMomentCategory(moment);

                  return (
                    <div key={`${moment}-${index}`} className="px-4 py-4">
                      <div className="text-sm font-semibold text-green-700">Moment {index + 1}</div>
                      <div>
                        <div className="font-semibold text-gray-900">{getMealMomentDisplayName(moment, geselecteerdeMaaltijden)}</div>
                        <div className="mt-1 text-sm text-gray-500">{getMealMomentDescription(moment)}</div>
                      </div>
                      <select
                        value={category}
                        onChange={(event) => updateMealSlotCategory(index, event.target.value as MealCategory)}
                        className="mt-3 w-full max-w-xs rounded-2xl border border-green-200 bg-white px-4 py-3 text-sm font-medium text-gray-900 focus:border-green-500 focus:outline-none"
                      >
                        {MAALTIJDCATEGORIEEN.map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 rounded-2xl bg-green-50 px-4 py-3 text-sm text-green-800">
                Huidige verdeling: {summarizeMealSlots(geselecteerdeMaaltijden)}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="font-semibold text-gray-700">Voedingsdoelen</h2>
            <button
              type="button"
              onClick={applyEstimate}
              className="rounded-lg border border-green-200 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-50"
            >
              Bereken opnieuw
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <SelectField label="Doel" value={goal.doelType} onChange={(value) => setGoal({ ...goal, doelType: value })}>
              {DOELTYPES.map((item) => <option key={item} value={item}>{item}</option>)}
            </SelectField>
            <InputField label="Caloriedoel (kcal)" type="number" value={goal.caloriedoel || ''} onChange={(value) => setGoal({ ...goal, caloriedoel: Number(value) })} />
            <InputField label="Eiwitdoel (g)" type="number" value={goal.eiwitdoel || ''} onChange={(value) => setGoal({ ...goal, eiwitdoel: Number(value) })} />
            <InputField label="Koolhydraatdoel (g)" type="number" value={goal.koolhydraatdoel || ''} onChange={(value) => setGoal({ ...goal, koolhydraatdoel: Number(value) })} />
            <InputField label="Vetdoel (g)" type="number" value={goal.vetdoel || ''} onChange={(value) => setGoal({ ...goal, vetdoel: Number(value) })} />
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-xl bg-green-600 py-3 font-semibold text-white transition hover:bg-green-700 disabled:opacity-60"
        >
          {saving ? 'Opslaan...' : 'Profiel opslaan'}
        </button>
      </form>
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
  ...props
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'>) {
  const numberInputClasses =
    props.type === 'number'
      ? 'appearance-none [-moz-appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none'
      : '';

  return (
    <div>
      <label className="mb-1 block text-sm text-gray-600">{label}</label>
      <input
        {...props}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`${numberInputClasses} w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500`}
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm text-gray-600">{label}</label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
      >
        {children}
      </select>
    </div>
  );
}
