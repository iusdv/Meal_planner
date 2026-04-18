import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import StatusToast from '../components/StatusToast';
import { addFavorite, addPlannedMeal, getMeal } from '../services/mealService';
import type { MealDto, NutritionFactRowDto, NutritionFactSectionDto } from '../types';
import { calculateMealNutrition, macroPercentages, scaleMeasure } from '../utils/nutrition';

type InstructionItem =
  | { kind: 'heading'; text: string }
  | { kind: 'step'; text: string };

const PLAIN_NUMBER_INPUT_CLASS = 'appearance-none [-moz-appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none';

export default function MealDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [meal, setMeal] = useState<MealDto | null>(null);
  const [servings, setServings] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;

    getMeal(Number(id))
      .then((result) => {
        setMeal(result.data);
        setServings(Math.max(1, result.data.porties || 1));
      })
      .catch(() => setError('Maaltijd kon niet worden geladen. Probeer het later opnieuw.'))
      .finally(() => setLoading(false));
  }, [id]);

  const nutrition = useMemo(() => meal ? calculateMealNutrition(meal, servings) : null, [meal, servings]);
  const percentages = nutrition ? macroPercentages(nutrition) : { protein: 0, carbs: 0, fat: 0 };
  const instructionItems = useMemo(() => parseInstructionItems(meal?.instructies || meal?.beschrijving || ''), [meal]);
  const sections = useMemo(() => {
    if (!meal || !nutrition) return [];
    return buildNutritionSections(meal, servings, nutrition);
  }, [meal, servings, nutrition]);

  const notify = (text: string) => {
    setError('');
    setMessage(text);
    setTimeout(() => setMessage(''), 2500);
  };

  const notifyError = (text: string) => {
    setMessage('');
    setError(text);
    setTimeout(() => setError(''), 3500);
  };

  const handleFavorite = async () => {
    if (!meal) return;
    setSaving(true);
    setError('');
    try {
      await addFavorite(meal.id);
      notify('Toegevoegd aan favorieten.');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      notifyError(axiosErr.response?.data?.message ?? 'Favoriet toevoegen mislukt.');
    } finally {
      setSaving(false);
    }
  };

  const handlePlanToday = async () => {
    if (!meal) return;
    setSaving(true);
    setError('');
    try {
      const today = new Date().toISOString().split('T')[0];
      await addPlannedMeal(meal.id, today, meal.categorie || 'Diner');
      notify('Maaltijd ingepland voor vandaag.');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      notifyError(axiosErr.response?.data?.message ?? 'Inplannen mislukt.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center bg-white">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-green-600"></div>
      </div>
    );
  }

  if (!meal) {
    return (
      <div className="mx-auto max-w-3xl bg-white px-4 py-10">
        <p className="text-sm text-red-600">{error || 'Maaltijd niet gevonden.'}</p>
        <button onClick={() => navigate(-1)} className="mt-4 border border-gray-300 px-4 py-2 text-sm text-gray-700">
          Terug
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white px-4 py-6 text-gray-900">
      <StatusToast message={message} tone="success" />
      <StatusToast message={error} tone="error" />

      <div className="mx-auto max-w-6xl">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <Link to="/meals" className="text-sm font-medium text-green-700 hover:text-green-800">
            Terug naar maaltijden
          </Link>
          <div className="flex gap-2">
            <button
              disabled={saving}
              onClick={handleFavorite}
              className="border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              Favoriet
            </button>
            <button
              disabled={saving}
              onClick={handlePlanToday}
              className="border border-green-200 bg-white px-4 py-2 text-sm font-semibold text-green-800 hover:bg-[#f4faf5] disabled:opacity-60"
            >
              Vandaag plannen
            </button>
          </div>
        </div>

        <h1 className="mb-8 text-center text-3xl font-bold tracking-wide text-gray-800">{meal.naam}</h1>

        <div className="grid gap-10 lg:grid-cols-[1fr_380px]">
          <main className="space-y-10">
            {meal.afbeeldingUrl && (
              <img src={meal.afbeeldingUrl} alt={meal.naam} className="mx-auto h-[280px] w-full max-w-[640px] object-cover" />
            )}

            <section className="mx-auto max-w-[640px]">
              <p className="max-w-xl text-sm leading-6 text-gray-800">{meal.beschrijving}</p>
              <div className="mt-9 grid grid-cols-2 gap-x-10 gap-y-3 text-sm text-gray-800 sm:grid-cols-3">
                <InfoStat label="Makes" value={`${servings} serving${servings === 1 ? '' : 's'}`} />
                <InfoStat label="Prep Time" value={`${meal.bereidingstijd} minutes`} />
                <InfoStat label="Category" value={meal.categorie} />
              </div>
            </section>

            <section className="mx-auto max-w-[640px]">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-center text-3xl font-semibold text-gray-800 sm:text-left">Ingredients</h2>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={servings}
                    onChange={(event) => setServings(Math.max(1, Number(event.target.value)))}
                    className={`${PLAIN_NUMBER_INPUT_CLASS} w-20 border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-700`}
                  />
                  <span>servings</span>
                </div>
              </div>

              <div className="divide-y divide-gray-200">
                {meal.ingredienten.map((ingredient) => (
                  <div key={ingredient.ingredientId} className="grid grid-cols-[56px_1fr_auto] gap-4 py-3 text-sm">
                    <IngredientThumbnail name={ingredient.ingredientNaam} />
                    <div className="min-w-0">
                      <div className="font-semibold text-gray-900">{ingredient.ingredientNaam}</div>
                      <div className="text-xs text-gray-500">
                        {ingredient.eenheid && ingredient.eenheid.toLowerCase() !== 'portie' ? ingredient.eenheid : 'Ingredient'}
                      </div>
                    </div>
                    <div className="text-right text-gray-900">
                      {scaleMeasure(ingredient.origineleHoeveelheid, servings, meal.porties || 1)}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="mx-auto max-w-[640px] pb-12">
              <h2 className="mb-6 text-center text-3xl font-semibold text-gray-800">Directions</h2>
              <InstructionList items={instructionItems} />
            </section>
          </main>

          <aside className="space-y-6">
            <MacroPie protein={percentages.protein} carbs={percentages.carbs} fat={percentages.fat} hasData={!!nutrition?.hasData} />

            <div className="flex justify-center gap-2 text-sm">
              <input
                type="number"
                min={1}
                max={20}
                value={servings}
                onChange={(event) => setServings(Math.max(1, Number(event.target.value)))}
                className={`${PLAIN_NUMBER_INPUT_CLASS} w-16 border border-gray-300 px-2 py-1 text-right focus:outline-none focus:ring-1 focus:ring-gray-700`}
              />
              <select className="border border-gray-300 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-gray-700" value="serving" onChange={() => undefined}>
                <option value="serving">serving</option>
              </select>
            </div>

            <NutritionFactsLabel
              meal={meal}
              servings={servings}
              sections={sections}
            />
          </aside>
        </div>
      </div>
    </div>
  );
}

function InfoStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-sm text-gray-700">{label}</div>
      <div className="font-medium text-gray-950">{value}</div>
    </div>
  );
}

function IngredientThumbnail({ name }: { name: string }) {
  const [hasError, setHasError] = useState(false);
  const imageUrl = getIngredientImageUrl(name);

  return (
    <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-gray-50">
      {!hasError ? (
        <img
          src={imageUrl}
          alt={name}
          className="h-12 w-12 object-contain"
          onError={() => setHasError(true)}
        />
      ) : (
        <span className="text-sm font-semibold text-gray-400">{name.slice(0, 1).toUpperCase()}</span>
      )}
    </div>
  );
}

function InstructionList({ items }: { items: InstructionItem[] }) {
  const indexedItems = items.map((item, index) => ({
    item,
    index,
    stepNumber:
      item.kind === 'step'
        ? items.slice(0, index + 1).filter((entry) => entry.kind === 'step').length
        : null,
  }));

  return (
    <div className="space-y-3 text-sm leading-6 text-gray-800">
      {indexedItems.map(({ item, index, stepNumber }) => {
        if (item.kind === 'heading') {
          return (
            <div key={`${index}-${item.text}`} className="pt-2 text-base font-semibold text-gray-900">
              {item.text}
            </div>
          );
        }

        return (
          <div key={`${index}-${item.text.slice(0, 16)}`} className="grid grid-cols-[24px_1fr] gap-3">
            <span>{stepNumber}.</span>
            <span>{item.text}</span>
          </div>
        );
      })}
    </div>
  );
}

function MacroPie({ protein, carbs, fat, hasData }: { protein: number; carbs: number; fat: number; hasData: boolean }) {
  if (!hasData) {
    return (
      <div className="mx-auto grid h-48 w-48 place-items-center rounded-full border border-gray-300 text-sm text-gray-500">
        No data
      </div>
    );
  }

  const slices = [
    { key: 'fat', label: 'Fat', value: fat, color: '#12b6c7' },
    { key: 'carbs', label: 'Carbs', value: carbs, color: '#f0bd05' },
    { key: 'protein', label: 'Protein', value: protein, color: '#9667f2' },
  ];

  let startAngle = -90;

  return (
    <div className="text-center">
      <svg viewBox="0 0 200 200" className="mx-auto h-48 w-48">
        {slices.map((slice) => {
          const endAngle = startAngle + (slice.value / 100) * 360;
          const middleAngle = startAngle + (endAngle - startAngle) / 2;
          const path = describeSlice(100, 100, 86, startAngle, endAngle);
          const labelPoint = polarToCartesian(100, 100, 48, middleAngle);
          startAngle = endAngle;

          return (
            <g key={slice.key}>
              <path d={path} fill={slice.color} stroke="#fff" strokeWidth="1.5" />
              {slice.value >= 7 && (
                <text x={labelPoint.x} y={labelPoint.y - 4} textAnchor="middle" fill="#fff" fontSize="11" fontWeight="600">
                  <tspan x={labelPoint.x}>{slice.label}</tspan>
                  <tspan x={labelPoint.x} dy="13">{slice.value}%</tspan>
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <div className="mt-1 text-sm text-gray-900">Percent Calories</div>
    </div>
  );
}

function NutritionFactsLabel({
  meal,
  servings,
  sections,
}: {
  meal: MealDto;
  servings: number;
  sections: NutritionFactSectionDto[];
}) {
  return (
    <section className="border border-gray-900 bg-white p-2 text-gray-950">
      <div className="border-b-4 border-gray-900 pb-2">
        <h2 className="text-3xl font-bold leading-none">Nutrition Facts</h2>
        <p className="mt-1 text-xs">
          For {servings} serving{servings === 1 ? '' : 's'} of {meal.naam.toLowerCase()}
          {meal.nutritionFacts?.servingGrams ? ` (${formatValue(meal.nutritionFacts.servingGrams * servings / Math.max(1, meal.porties || 1), 'g')})` : ''}
        </p>
      </div>

      <div className="grid grid-cols-[1fr_82px_52px] border-b border-gray-300 py-1 text-[11px]">
        <span>Nutrient</span>
        <span className="text-right">Value</span>
        <span className="text-right">%DV</span>
      </div>

      {sections.length === 0 ? (
        <p className="py-4 text-sm text-gray-600">Voedingswaarden zijn nog niet beschikbaar voor dit recept.</p>
      ) : (
        sections.map((section) => (
          <div key={section.title}>
            {section.title !== 'Main' && (
              <h3 className="mt-3 border-t-4 border-gray-900 pt-2 text-xl font-medium">{section.title}</h3>
            )}
            {section.rows.map((row) => (
              <NutritionFactRow key={`${section.title}-${row.key}`} row={row} />
            ))}
          </div>
        ))
      )}
    </section>
  );
}

function NutritionFactRow({ row }: { row: NutritionFactRowDto }) {
  return (
    <div className={`grid grid-cols-[1fr_82px_52px] border-b border-gray-300 py-1 text-sm ${row.highlight ? 'font-bold' : ''}`}>
      <span>{row.label}</span>
      <span className="text-right">{formatValue(row.value, row.unit)}</span>
      <span className="text-right">{row.dailyValuePercent ? `${formatPercent(row.dailyValuePercent)}%` : ''}</span>
    </div>
  );
}

function buildNutritionSections(meal: MealDto, servings: number, fallback: NonNullable<ReturnType<typeof calculateMealNutrition>>) {
  const factor = servings / Math.max(1, meal.porties || 1);
  if (meal.nutritionFacts?.sections.length) {
    return meal.nutritionFacts.sections.map((section) => ({
      ...section,
      rows: section.rows.map((row) => ({
        ...row,
        value: row.value * factor,
      })),
    }));
  }

  if (!fallback.hasData) return [];

  return [
    {
      title: 'Main',
      rows: [
        { key: 'calories', label: 'Calories', value: fallback.calories, unit: 'kcal', dailyValuePercent: null, highlight: true },
        { key: 'fat', label: 'Fat', value: fallback.fat, unit: 'g', dailyValuePercent: null, highlight: false },
        { key: 'carbs', label: 'Carbs', value: fallback.carbs, unit: 'g', dailyValuePercent: null, highlight: false },
        { key: 'protein', label: 'Protein', value: fallback.protein, unit: 'g', dailyValuePercent: null, highlight: true },
      ],
    },
  ];
}

function formatValue(value: number, unit: string) {
  const rounded = unit === 'kcal' || unit === 'IU'
    ? Math.round(value)
    : value >= 10
      ? Math.round(value)
      : value >= 1
        ? Number(value.toFixed(1))
        : Number(value.toFixed(2));

  return `${rounded}${unit === 'kcal' ? '' : unit}`;
}

function formatPercent(value: number) {
  return value >= 10 ? Math.round(value) : Number(value.toFixed(1));
}

function getIngredientImageUrl(name: string) {
  const normalized = name
    .trim()
    .toLowerCase()
    .replace(/[()]/g, '')
    .replace(/\s+/g, '_');

  return `https://www.themealdb.com/images/ingredients/${encodeURIComponent(normalized)}-medium.png`;
}

function parseInstructionItems(text: string): InstructionItem[] {
  const normalized = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/(step\s*\d+\b:?)/gi, '\n$1\n')
    .trim();

  if (!normalized) {
    return [];
  }

  const blocks = normalized
    .split(/\n+/)
    .map((block) => block.trim())
    .filter(Boolean);

  const items: InstructionItem[] = [];

  for (const block of blocks) {
    const headingOnlyMatch = /^step\s*(\d+)\b:?$/i.exec(block);
    if (headingOnlyMatch) {
      items.push({ kind: 'heading', text: `Step ${headingOnlyMatch[1]}` });
      continue;
    }

    const headingWithTextMatch = /^step\s*(\d+)\b:?\s*(.+)$/i.exec(block);
    if (headingWithTextMatch) {
      items.push({ kind: 'heading', text: `Step ${headingWithTextMatch[1]}` });
      for (const sentence of splitInstructionSentences(headingWithTextMatch[2])) {
        items.push({ kind: 'step', text: sentence });
      }
      continue;
    }

    for (const sentence of splitInstructionSentences(block)) {
      items.push({ kind: 'step', text: sentence });
    }
  }

  return items;
}

function splitInstructionSentences(text: string) {
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function polarToCartesian(centerX: number, centerY: number, radius: number, angleInDegrees: number) {
  const angleInRadians = (angleInDegrees * Math.PI) / 180.0;
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
}

function describeSlice(x: number, y: number, radius: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(x, y, radius, endAngle);
  const end = polarToCartesian(x, y, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';

  return [
    `M ${x} ${y}`,
    `L ${start.x} ${start.y}`,
    `A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`,
    'Z',
  ].join(' ');
}
