import { AnimatePresence, motion } from 'framer-motion';
import { useMemo, useState } from 'react';
import type { InputHTMLAttributes, ReactNode } from 'react';
import type { GoalDto, MealDto, ProfileDto } from '../types';
import {
  ACTIVITEITSNIVEAUS,
  buildMealSlotsFromCounts,
  DIEETOPTIES,
  DOELTYPES,
  distributeCaloriesAcrossMoments,
  getMealCategoryCounts,
  getMealMomentCategory,
  getMealMomentDisplayName,
  getMealMomentDescription,
  MAALTIJDCATEGORIEEN,
  estimateGoals,
  mealMatchesPreferences,
  normalizeActivityValue,
  normalizeDietValue,
  normalizeGenderValue,
  parsePreferredMealTypes,
  summarizeMealSlots,
  type MealCategory,
  type GoalForm,
  type ProfileForm,
} from '../utils/nutrition';

interface OnboardingWizardProps {
  initialProfile?: Partial<ProfileDto>;
  initialGoal?: Partial<GoalDto>;
  meals: MealDto[];
  loadError?: string;
  onSave: (profile: ProfileForm, goal: GoalForm) => Promise<void>;
  onLogout: () => void;
}

const ALLERGIE_OPTIES = ['Zuivel', 'Eieren', 'Vis', 'Gluten', 'Pinda', 'Sesam', 'Schaaldieren', 'Soja', 'Noten'];
const STAPPEN = [
  { key: 'welkom', titel: 'Jouw account instellen', tekst: 'We stemmen je planner af op jouw doel, voorkeuren en ritme.' },
  { key: 'voorkeuren', titel: 'Doel en eetstijl', tekst: 'Kies waar je naartoe werkt en welke stijl je het liefst volgt.' },
  { key: 'vermijden', titel: 'Wat wil je vermijden?', tekst: 'Allergieen en ingredienten die je liever niet terugziet.' },
  { key: 'profiel', titel: 'Vertel iets over jezelf', tekst: 'Deze gegevens gebruiken we voor je dagelijkse richtlijn.' },
  { key: 'ritme', titel: 'Jouw eetmomenten', tekst: 'Bepaal hoeveel eetmomenten je wilt plannen.' },
  { key: 'voorbeelden', titel: 'Passende maaltijdideeen', tekst: 'Een eerste selectie op basis van jouw keuzes.' },
  { key: 'samenvatting', titel: 'Je startpunt staat klaar', tekst: 'Controleer je richtlijn en ga door naar je dashboard.' },
] as const;
const EETMOMENT_AANTALLEN = [1, 2, 3, 4, 5, 6] as const;

const DOEL_BESCHRIJVINGEN: Record<string, string> = {
  Afvallen: 'Minder calorieen, met extra focus op verzadiging.',
  Balans: 'Een stabiele basis om goed te eten en je gewicht te behouden.',
  'Spiermassa opbouwen': 'Meer energie en eiwitten om sterker te trainen.',
  'Gezonder eten': 'Een haalbare richtlijn met voedzame keuzes.',
};

const DIEET_BESCHRIJVINGEN: Record<string, string> = {
  Alles: 'Geen vaste beperking, later nog verder te verfijnen.',
  Keto: 'Laag in koolhydraten, rijker in vetten en eiwitten.',
  Mediterraan: 'Veel groenten, granen, vis en simpele ingredienten.',
  Paleo: 'Zo min mogelijk bewerkt, met vlees, groente en fruit.',
  Vegan: 'Volledig plantaardig.',
  Vegetarisch: 'Geen vlees of vis.',
};

function normalizeMealSelection(selected: string[], count: number) {
  const boundedCount = Math.max(1, Math.min(count, 6));
  const trimmed = selected.slice(0, boundedCount);
  const counts = getMealCategoryCounts(trimmed);
  const slots = buildMealSlotsFromCounts(counts);

  if (slots.length >= boundedCount) {
    return slots.slice(0, boundedCount);
  }

  const nextCounts = { ...counts };
  let fillIndex = 0;
  while (buildMealSlotsFromCounts(nextCounts).length < boundedCount) {
    const preferredCategory =
      MAALTIJDCATEGORIEEN.find((category) => nextCounts[category] === 0) ??
      MAALTIJDCATEGORIEEN[fillIndex % MAALTIJDCATEGORIEEN.length];
    nextCounts[preferredCategory] += 1;
    fillIndex += 1;
  }

  return buildMealSlotsFromCounts(nextCounts).slice(0, boundedCount);
}

function truncateText(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

export default function OnboardingWizard({
  initialProfile,
  initialGoal,
  meals,
  loadError = '',
  onSave,
  onLogout,
}: OnboardingWizardProps) {
  const startCount = Math.max(1, Math.min(initialProfile?.maaltijdenPerDag ?? 3, 6));
  const startMeals = normalizeMealSelection(parsePreferredMealTypes(initialProfile?.gewensteMaaltijden), startCount);
  const [stap, setStap] = useState(0);
  const [opslaan, setOpslaan] = useState(false);
  const [fout, setFout] = useState('');
  const [doelType, setDoelType] = useState(initialGoal?.doelType ?? 'Balans');
  const [geselecteerdeMaaltijden, setGeselecteerdeMaaltijden] = useState<string[]>(startMeals);
  const [profiel, setProfiel] = useState<ProfileForm>({
    gender: normalizeGenderValue(initialProfile?.gender),
    leeftijd: initialProfile?.leeftijd ?? 0,
    gewicht: initialProfile?.gewicht ?? 0,
    lengteCm: initialProfile?.lengteCm ?? 0,
    activiteit: normalizeActivityValue(initialProfile?.activiteit),
    dieetvoorkeur: normalizeDietValue(initialProfile?.dieetvoorkeur),
    allergieen: initialProfile?.allergieen ?? '',
    maaltijdenPerDag: startCount,
    gewensteMaaltijden: startMeals.join(','),
  });

  const huidigeStap = STAPPEN[stap];
  const allergieLijst = useMemo(
    () => profiel.allergieen.split(',').map((item) => item.trim()).filter(Boolean),
    [profiel.allergieen]
  );
  const doel = useMemo(() => estimateGoals(profiel, doelType), [doelType, profiel]);
  const previewProfile = useMemo(
    () => ({ ...profiel, gewensteMaaltijden: geselecteerdeMaaltijden.join(',') }),
    [geselecteerdeMaaltijden, profiel]
  );
  const mealCategoryCounts = useMemo(() => getMealCategoryCounts(geselecteerdeMaaltijden), [geselecteerdeMaaltijden]);
  const kcalPerMoment = useMemo(
    () => distributeCaloriesAcrossMoments(doel.caloriedoel, geselecteerdeMaaltijden),
    [doel.caloriedoel, geselecteerdeMaaltijden]
  );
  const voorbeelden = useMemo(() => {
    const gefilterd = meals.filter((meal) => mealMatchesPreferences(meal, previewProfile));
    const bron = gefilterd.length > 0 ? gefilterd : meals;

    return geselecteerdeMaaltijden.map((type) => {
      const category = getMealMomentCategory(type).toLowerCase();
      const exact = bron.filter((meal) => meal.categorie.toLowerCase() === category);
      const fallback =
        category === 'snack'
          ? bron.filter((meal) => ['snack', 'ontbijt', 'lunch'].includes(meal.categorie.toLowerCase()))
          : bron;

      return {
        type,
        items: (exact.length > 0 ? exact : fallback.length > 0 ? fallback : bron).slice(0, 2),
      };
    });
  }, [geselecteerdeMaaltijden, meals, previewProfile]);

  const updateProfiel = <K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) =>
    setProfiel((current) => ({ ...current, [key]: value }));

  const setMealCount = (count: number) => {
    const next = normalizeMealSelection(geselecteerdeMaaltijden, count);
    setGeselecteerdeMaaltijden(next);
    setProfiel((current) => ({
      ...current,
      maaltijdenPerDag: count,
      gewensteMaaltijden: next.join(','),
    }));
  };

  const toggleAllergie = (item: string) => {
    const values = new Set(allergieLijst);
    if (values.has(item)) values.delete(item);
    else values.add(item);
    updateProfiel('allergieen', Array.from(values).join(', '));
  };

  const updateMealCategoryCount = (category: MealCategory, delta: number) => {
    const currentCount = mealCategoryCounts[category];
    const nextCount = Math.max(0, currentCount + delta);
    const totalWithoutCurrent = geselecteerdeMaaltijden.length - currentCount;

    if (totalWithoutCurrent + nextCount > profiel.maaltijdenPerDag) {
      setFout(`Je kunt maximaal ${profiel.maaltijdenPerDag} eetmomenten verdelen.`);
      return;
    }

    const nextSlots = buildMealSlotsFromCounts({
      ...mealCategoryCounts,
      [category]: nextCount,
    });

    setFout('');
    setGeselecteerdeMaaltijden(nextSlots);
    updateProfiel('gewensteMaaltijden', nextSlots.join(','));
  };

  const validate = () => {
    if (huidigeStap.key === 'voorkeuren' && (!doelType || !profiel.dieetvoorkeur)) {
      return 'Kies eerst je doel en eetstijl.';
    }
    if (huidigeStap.key === 'profiel') {
      if (!profiel.gender || profiel.leeftijd < 12 || profiel.gewicht <= 0 || profiel.lengteCm <= 0) {
        return 'Vul geslacht, leeftijd, gewicht en lengte in.';
      }
      if (profiel.lengteCm > 251) return 'Lengte mag maximaal 251 cm zijn.';
      if (!profiel.activiteit) return 'Kies ook je activiteitsniveau.';
    }
    if (huidigeStap.key === 'ritme' && geselecteerdeMaaltijden.length !== profiel.maaltijdenPerDag) {
      return `Verdeel precies ${profiel.maaltijdenPerDag} eetmomenten over ontbijt, lunch, diner en snack.`;
    }
    return '';
  };

  const gaVerder = async () => {
    const melding = validate();
    if (melding) {
      setFout(melding);
      return;
    }

    setFout('');

    if (stap === STAPPEN.length - 1) {
      setOpslaan(true);
      try {
        await onSave(
          { ...profiel, gewensteMaaltijden: geselecteerdeMaaltijden.join(',') },
          { ...doel, doelType }
        );
      } catch {
        setFout('Opslaan mislukt. Probeer het opnieuw.');
      } finally {
        setOpslaan(false);
      }
      return;
    }

    setStap((current) => Math.min(current + 1, STAPPEN.length - 1));
  };

  const gaTerug = () => {
    setFout('');
    setStap((current) => Math.max(current - 1, 0));
  };

  return (
    <div
      className="grid overflow-hidden bg-[#f6fbf7] text-slate-900 grid-rows-[72px_minmax(0,1fr)_84px]"
      style={{ height: '100dvh' }}
    >
      <header className="border-b border-green-100 bg-white">
        <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-6">
          <div className="text-2xl font-bold tracking-tight text-green-700">MealPlanner</div>
          <button
            type="button"
            onClick={onLogout}
            className="rounded-full border border-green-200 bg-white px-4 py-2 text-xs font-medium text-green-700"
          >
            Uitloggen
          </button>
        </div>
      </header>

      <main className="min-h-0 overflow-hidden">
        <div className="mx-auto grid h-full max-w-7xl gap-6 px-6 py-6 lg:grid-cols-[248px_minmax(0,1fr)]">
          <aside className="hidden rounded-[28px] border border-green-100 bg-white p-5 lg:flex lg:flex-col">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-green-700">Stappen</div>
              <div className="mt-4 space-y-2">
                {STAPPEN.map((item, index) => (
                  <StepperItem
                    key={item.key}
                    index={index}
                    active={index === stap}
                    complete={index < stap}
                    title={item.titel}
                  />
                ))}
              </div>
            </div>
            <div className="mt-auto rounded-[24px] border border-green-100 bg-[#f7fbf8] p-4 text-sm leading-6 text-slate-600">
              Je kunt deze keuzes later altijd nog aanpassen op je profielpagina.
            </div>
          </aside>

          <section className="flex min-h-0 flex-col overflow-hidden rounded-[28px] border border-green-100 bg-white shadow-[0_16px_48px_rgba(22,101,52,0.08)]">
            <div className="border-b border-green-100 px-6 py-5">
              <h1 className="text-3xl font-semibold">{huidigeStap.titel}</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{huidigeStap.tekst}</p>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-6">
              {loadError && <Notice tone="amber">{loadError}</Notice>}
              {fout && <Notice tone="red">{fout}</Notice>}

              <AnimatePresence mode="wait">
                <motion.div
                  key={huidigeStap.key}
                  initial={{ opacity: 0, x: 18 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  transition={{ duration: 0.22, ease: 'easeOut' }}
                >
                  {huidigeStap.key === 'welkom' && <WelkomStap />}

                  {huidigeStap.key === 'voorkeuren' && (
                    <div className="grid gap-5 xl:grid-cols-2">
                      <div>
                        <Title>Kies je doel</Title>
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          {DOELTYPES.map((item) => (
                            <ChoiceCard
                              key={item}
                              active={doelType === item}
                              title={item}
                              text={DOEL_BESCHRIJVINGEN[item]}
                              onClick={() => setDoelType(item)}
                            />
                          ))}
                        </div>
                      </div>
                      <div>
                        <Title>Kies je eetstijl</Title>
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          {DIEETOPTIES.map((item) => (
                            <ChoiceCard
                              key={item}
                              active={profiel.dieetvoorkeur === item}
                              title={item}
                              text={DIEET_BESCHRIJVINGEN[item]}
                              onClick={() => updateProfiel('dieetvoorkeur', item)}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {huidigeStap.key === 'vermijden' && (
                    <div className="grid gap-5 xl:grid-cols-[1fr_1.1fr]">
                      <div className="rounded-[24px] border border-green-100 bg-[#f7fbf8] p-5">
                        <Title>Snelle keuzes</Title>
                        <div className="mt-4 flex flex-wrap gap-2">
                          {ALLERGIE_OPTIES.map((item) => (
                            <button
                              key={item}
                              type="button"
                              onClick={() => toggleAllergie(item)}
                              className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                                allergieLijst.includes(item)
                                  ? 'border-green-600 bg-green-600 text-white'
                                  : 'border-green-200 bg-white text-green-700 hover:border-green-300 hover:bg-green-50'
                              }`}
                            >
                              {item}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="rounded-[24px] border border-green-100 bg-white p-5">
                        <Title>Extra ingredienten</Title>
                        <textarea
                          value={profiel.allergieen}
                          onChange={(event) => updateProfiel('allergieen', event.target.value)}
                          rows={8}
                          placeholder="Bijvoorbeeld: koriander, champignons, lactose"
                          className="mt-4 w-full rounded-2xl border border-green-200 bg-[#fbfefb] px-4 py-3 text-sm placeholder:text-slate-400 focus:border-green-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  )}

                  {huidigeStap.key === 'profiel' && (
                    <div className="grid gap-4 md:grid-cols-2">
                      <Field label="Geslacht">
                        <div className="grid grid-cols-2 gap-2">
                          {['Man', 'Vrouw'].map((item) => (
                            <SegmentButton key={item} active={profiel.gender === item} onClick={() => updateProfiel('gender', item)}>
                              {item}
                            </SegmentButton>
                          ))}
                        </div>
                      </Field>
                      <Field label="Leeftijd">
                        <Input
                          type="number"
                          value={profiel.leeftijd || ''}
                          onChange={(event) => updateProfiel('leeftijd', Number(event.target.value))}
                          placeholder="25"
                        />
                      </Field>
                      <Field label="Gewicht (kg)">
                        <Input
                          type="number"
                          step="0.1"
                          value={profiel.gewicht || ''}
                          onChange={(event) => updateProfiel('gewicht', Number(event.target.value))}
                          placeholder="78"
                        />
                      </Field>
                      <Field label="Lengte (cm)">
                        <Input
                          type="number"
                          min="1"
                          max="251"
                          value={profiel.lengteCm || ''}
                          onChange={(event) => updateProfiel('lengteCm', Number(event.target.value))}
                          placeholder="182"
                        />
                      </Field>
                      <Field label="Activiteitsniveau">
                        <select
                          value={profiel.activiteit}
                          onChange={(event) => updateProfiel('activiteit', event.target.value)}
                          className="w-full rounded-2xl border border-green-200 bg-white px-4 py-3 text-sm focus:border-green-500 focus:outline-none"
                        >
                          <option value="">Kies je activiteitsniveau</option>
                          {ACTIVITEITSNIVEAUS.map((item) => (
                            <option key={item} value={item}>
                              {item}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <div className="rounded-[24px] border border-green-100 bg-[#f7fbf8] p-5 text-sm leading-6 text-slate-600">
                        Hiermee berekenen we je startdoel volgens de Mifflin-St Jeor formule. Daarna verdelen we dat
                        slimmer over hoofdmaaltijden en snackmomenten.
                      </div>
                    </div>
                  )}

                  {huidigeStap.key === 'ritme' && (
                    <div className="grid gap-6 xl:grid-cols-[240px_minmax(0,1fr)]">
                      <div className="h-fit rounded-[24px] border border-green-100 bg-[#f8fcf9] p-5">
                        <Title>Hoeveel eetmomenten?</Title>
                        <p className="mt-2 text-sm leading-6 text-slate-600">Kies simpelweg hoeveel momenten je op een dag wilt plannen.</p>
                        <select
                          value={profiel.maaltijdenPerDag}
                          onChange={(event) => setMealCount(Number(event.target.value))}
                          className="mt-4 w-full rounded-2xl border border-green-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 focus:border-green-500 focus:outline-none"
                        >
                          {EETMOMENT_AANTALLEN.map((count) => (
                            <option key={count} value={count}>
                              {count} {count === 1 ? '' : ''} per dag
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <Title>Welke momenten wil je plannen?</Title>
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                          Verdeel je {profiel.maaltijdenPerDag} eetmomenten over ontbijt, lunch, diner en snack.
                          Je kunt dezelfde categorie meerdere keren kiezen, zoals 2x ontbijt of 2x diner.
                        </p>
                        <div className="mt-4 space-y-3">
                          {MAALTIJDCATEGORIEEN.map((item) => (
                            <MealCategoryCard
                              key={item}
                              category={item}
                              count={mealCategoryCounts[item]}
                              maxTotal={profiel.maaltijdenPerDag}
                              selectedTotal={geselecteerdeMaaltijden.length}
                              description={getMealMomentDescription(item)}
                              onDecrease={() => updateMealCategoryCount(item, -1)}
                              onIncrease={() => updateMealCategoryCount(item, 1)}
                            />
                          ))}
                        </div>
                        <div className="mt-4 text-sm text-slate-500">
                          {geselecteerdeMaaltijden.length === profiel.maaltijdenPerDag
                            ? 'Je verdeling is compleet.'
                            : `Nog ${profiel.maaltijdenPerDag - geselecteerdeMaaltijden.length} eetmoment(en) te verdelen.`}
                        </div>
                      </div>
                    </div>
                  )}

                  {huidigeStap.key === 'voorbeelden' && (
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {voorbeelden.map((groep) => (
                        <div key={groep.type} className="flex h-full flex-col rounded-[26px] border border-green-100 bg-[#fbfefb] p-4">
                          <div className="mb-4 flex min-h-[52px] items-start justify-between gap-3">
                            <div>
                              <div className="text-xl font-semibold text-slate-900">{getMealMomentDisplayName(groep.type, geselecteerdeMaaltijden)}</div>
                              <div className="mt-1 text-xs uppercase tracking-[0.18em] text-green-700">
                                {getMealMomentCategory(groep.type)}
                              </div>
                            </div>
                            <div className="shrink-0 rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
                              {(kcalPerMoment[groep.type] ?? Math.round(doel.caloriedoel / profiel.maaltijdenPerDag))} kcal
                            </div>
                          </div>
                          <div className="space-y-3">
                            {groep.items.map((meal) => (
                              <MealCard key={`${groep.type}-${meal.id}`} meal={meal} />
                            ))}
                            {groep.items.length === 0 && (
                              <div className="rounded-2xl border border-dashed border-green-200 px-4 py-5 text-sm text-slate-500">
                                Nog geen passende voorbeelden gevonden.
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {huidigeStap.key === 'samenvatting' && (
                    <div className="grid gap-5 xl:grid-cols-[1fr_0.9fr]">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <GoalCard label="Doel" value={doelType} />
                        <GoalCard label="Eetstijl" value={profiel.dieetvoorkeur} />
                        <GoalCard label="Caloriedoel" value={`${doel.caloriedoel} kcal`} />
                        <GoalCard label="Eiwitdoel" value={`${doel.eiwitdoel} g`} />
                        <GoalCard label="Koolhydraten" value={`${doel.koolhydraatdoel} g`} />
                        <GoalCard label="Vetten" value={`${doel.vetdoel} g`} />
                      </div>
                      <div className="rounded-[24px] border border-green-100 bg-[#f7fbf8] p-5">
                        <Title>Jouw planner start met</Title>
                        <div className="mt-4 space-y-3 text-sm">
                          <SummaryRow label="Eetmomenten per dag" value={String(profiel.maaltijdenPerDag)} />
                          <SummaryRow label="Gekozen momenten" value={summarizeMealSlots(geselecteerdeMaaltijden)} />
                          <SummaryRow
                            label="Gemiddeld per eetmoment"
                            value={`${Math.round(doel.caloriedoel / profiel.maaltijdenPerDag)} kcal`}
                          />
                          <SummaryRow label="Vermijden" value={profiel.allergieen || 'Geen extra uitsluitingen'} />
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </section>
        </div>
      </main>

      <footer className="border-t border-green-100 bg-white">
        <div className="mx-auto flex h-full max-w-7xl items-center justify-between gap-4 px-6">
          <button
            type="button"
            onClick={gaTerug}
            className={`rounded-full px-4 py-2 text-sm font-medium ${
              stap === 0 ? 'pointer-events-none text-slate-300' : 'text-slate-600 hover:bg-green-50 hover:text-green-700'
            }`}
          >
            Terug
          </button>
          <div className="hidden flex-1 sm:block">
            <div className="h-2 overflow-hidden rounded-full bg-green-100">
              <div
                className="h-full rounded-full bg-green-600 transition-all duration-200"
                style={{ width: `${((stap + 1) / STAPPEN.length) * 100}%` }}
              />
            </div>
          </div>
          <button
            type="button"
            disabled={opslaan}
            onClick={gaVerder}
            className="rounded-full bg-green-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60"
          >
            {stap === STAPPEN.length - 1 ? (opslaan ? 'Opslaan...' : 'Opslaan en afronden') : 'Verder'}
          </button>
        </div>
      </footer>
    </div>
  );
}

function WelkomStap() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <IntroFeature
        number="1"
        title="Doel en voorkeuren"
        text="We vragen waar je naartoe werkt en welke eetstijl je prettig vindt."
      />
      <IntroFeature
        number="2"
        title="Profiel en ritme"
        text="Je lichaamsgegevens en eetmomenten maken je planning persoonlijker."
      />
      <IntroFeature
        number="3"
        title="Maaltijdideeen"
        text="Nog voor je begint laten we al passende suggesties zien per gekozen moment."
      />
    </div>
  );
}

function Notice({ tone, children }: { tone: 'amber' | 'red'; children: ReactNode }) {
  const styles =
    tone === 'amber'
      ? 'mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700'
      : 'mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700';

  return <div className={styles}>{children}</div>;
}

function Title({ children }: { children: ReactNode }) {
  return <div className="text-lg font-semibold text-slate-900">{children}</div>;
}

function StepperItem({
  index,
  active,
  complete,
  title,
}: {
  index: number;
  active: boolean;
  complete: boolean;
  title: string;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-2xl border px-3 py-3 ${
        active ? 'border-green-200 bg-green-50' : 'border-transparent bg-white'
      }`}
    >
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
          complete || active ? 'bg-green-600 text-white' : 'bg-[#f4f7f5] text-slate-500'
        }`}
      >
        {index + 1}
      </div>
      <div className={`text-sm ${active ? 'font-semibold text-slate-900' : 'text-slate-600'}`}>{title}</div>
    </div>
  );
}

function IntroFeature({ number, title, text }: { number: string; title: string; text: string }) {
  return (
    <div className="rounded-[24px] border border-green-100 bg-[#fbfefb] p-5">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-50 text-sm font-semibold text-green-700">
        {number}
      </div>
      <div className="mt-4 text-lg font-semibold text-slate-900">{title}</div>
      <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
    </div>
  );
}

function ChoiceCard({
  active,
  title,
  text,
  onClick,
  className = '',
}: {
  active: boolean;
  title: string;
  text: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border px-4 py-4 text-left transition ${
        active ? 'border-green-600 bg-green-50' : 'border-green-200 bg-white hover:border-green-300 hover:bg-green-50/70'
      } ${className}`}
    >
      <div className="text-sm font-semibold text-slate-900">{title}</div>
      <div className="mt-1 text-sm leading-6 text-slate-600">{text}</div>
    </button>
  );
}

function MealCategoryCard({
  category,
  count,
  maxTotal,
  selectedTotal,
  description,
  onDecrease,
  onIncrease,
}: {
  category: MealCategory;
  count: number;
  maxTotal: number;
  selectedTotal: number;
  description: string;
  onDecrease: () => void;
  onIncrease: () => void;
}) {
  const increaseDisabled = selectedTotal >= maxTotal;
  const decreaseDisabled = count <= 0;

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-green-200 bg-white px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-3">
          <div className="text-base font-semibold text-slate-900">{category}</div>
          <div className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">{count}x</div>
        </div>
        <div className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{description}</div>
      </div>

      <div className="flex shrink-0 items-center gap-2 rounded-full border border-green-100 bg-[#f8fcf9] px-2 py-2">
        <button
          type="button"
          disabled={decreaseDisabled}
          onClick={onDecrease}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-green-200 bg-white text-lg font-semibold text-green-700 disabled:opacity-35"
        >
          -
        </button>
        <div className="min-w-[48px] text-center text-lg font-semibold text-slate-900">{count}</div>
        <button
          type="button"
          disabled={increaseDisabled}
          onClick={onIncrease}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-green-200 bg-white text-lg font-semibold text-green-700 disabled:opacity-35"
        >
          +
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block rounded-2xl border border-green-100 bg-[#fbfefb] p-5">
      <span className="mb-3 block text-sm font-semibold text-slate-700">{label}</span>
      {children}
    </label>
  );
}

function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  const numberInputClasses =
    props.type === 'number'
      ? 'appearance-none [-moz-appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none'
      : '';

  return (
    <input
      {...props}
      className={`${numberInputClasses} w-full rounded-2xl border border-green-200 bg-white px-4 py-3 text-sm placeholder:text-slate-400 focus:border-green-500 focus:outline-none`}
    />
  );
}

function SegmentButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border px-3 py-3 text-sm font-medium ${
        active ? 'border-green-600 bg-green-600 text-white' : 'border-green-200 bg-white text-slate-700 hover:bg-green-50'
      }`}
    >
      {children}
    </button>
  );
}

function MealCard({ meal }: { meal: MealDto }) {
  const subtitle = truncateText(meal.ingredienten.slice(0, 2).map((item) => item.ingredientNaam).join(' + '), 42);
  const title = truncateText(meal.naam, 46);

  return (
    <div className="flex min-h-[268px] flex-col overflow-hidden rounded-[24px] border border-green-100 bg-white">
      {meal.afbeeldingUrl ? (
        <img src={meal.afbeeldingUrl} alt={meal.naam} className="h-36 w-full object-cover" />
      ) : (
        <div className="h-36 w-full bg-[#f4f7f5]" />
      )}
      <div className="flex flex-1 flex-col p-4">
        <div className="min-h-[86px]">
          <div className="text-lg font-semibold leading-7 text-slate-900">{title}</div>
          <div className="mt-2 text-xs uppercase tracking-[0.18em] text-green-700">{meal.categorie}</div>
        </div>
        <div className="mt-auto min-h-[56px] text-sm leading-7 text-slate-600">
          {subtitle ? `Met ${subtitle}` : 'Past bij jouw voorkeuren.'}
        </div>
      </div>
    </div>
  );
}

function GoalCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[24px] border border-green-100 bg-white p-5">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-green-700">{label}</div>
      <div className="mt-3 text-2xl font-semibold">{value}</div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-green-100 pb-3 last:border-b-0 last:pb-0">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-900">{value}</span>
    </div>
  );
}
