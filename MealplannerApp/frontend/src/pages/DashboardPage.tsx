import { useEffect, useState } from 'react';
import { getPlannedMeals, getMeals, addPlannedMeal, removePlannedMeal } from '../services/mealService';
import type { PlannedMealDto, MealDto } from '../types';
import { useAuth } from '../context/AuthContext';

const MEAL_TYPES = ['Ontbijt', 'Lunch', 'Diner'];

function getWeekDays(): Date[] {
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - today.getDay() + 1);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

const DAY_NAMES = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'];

export default function DashboardPage() {
  const { user } = useAuth();
  const [planned, setPlanned] = useState<PlannedMealDto[]>([]);
  const [meals, setMeals] = useState<MealDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedType, setSelectedType] = useState(MEAL_TYPES[0]);
  const [selectedMeal, setSelectedMeal] = useState<number>(0);
  const weekDays = getWeekDays();

  useEffect(() => {
    Promise.all([getPlannedMeals(), getMeals()])
      .then(([p, m]) => {
        setPlanned(p.data);
        setMeals(m.data);
        if (m.data.length > 0) setSelectedMeal(m.data[0].id);
      })
      .finally(() => setLoading(false));
  }, []);

  const getPlannedForDay = (date: Date, type: string) => {
    const dateStr = date.toISOString().split('T')[0];
    return planned.filter(
      (p) => p.datum.split('T')[0] === dateStr && p.maaltijdtype.toLowerCase() === type.toLowerCase()
    );
  };

  const handleAdd = async () => {
    if (!selectedMeal || !selectedDate) return;
    const result = await addPlannedMeal(selectedMeal, selectedDate, selectedType);
    setPlanned((prev) => [...prev, result.data]);
    setShowModal(false);
  };

  const handleRemove = async (id: number) => {
    await removePlannedMeal(id);
    setPlanned((prev) => prev.filter((p) => p.id !== id));
  };

  const openModal = (date: Date, type: string) => {
    setSelectedDate(date.toISOString().split('T')[0]);
    setSelectedType(type);
    setShowModal(true);
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-600"></div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            Welkom, {user?.naam}! 👋
          </h1>
          <p className="text-gray-500 text-sm mt-1">Jouw maaltijdplanning voor deze week</p>
        </div>
      </div>

      {/* Week Planner Grid */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-8 bg-green-600 text-white text-sm font-semibold">
          <div className="px-3 py-3 text-center">Type</div>
          {weekDays.map((day, i) => (
            <div key={i} className="px-2 py-3 text-center">
              <div>{DAY_NAMES[i]}</div>
              <div className="text-xs font-normal opacity-80">
                {day.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
              </div>
            </div>
          ))}
        </div>

        {/* Meal type rows */}
        {MEAL_TYPES.map((type) => (
          <div key={type} className="grid grid-cols-8 border-t border-gray-100">
            <div className="px-3 py-4 flex items-center bg-gray-50 border-r border-gray-100">
              <span className="text-sm font-medium text-gray-600">{type}</span>
            </div>
            {weekDays.map((day, i) => {
              const items = getPlannedForDay(day, type);
              return (
                <div key={i} className="px-2 py-3 border-r border-gray-50 min-h-[80px]">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="group relative bg-green-50 border border-green-200 rounded-lg p-2 mb-1 text-xs"
                    >
                      {item.afbeeldingUrl && (
                        <img
                          src={item.afbeeldingUrl}
                          alt={item.mealNaam}
                          className="w-full h-10 object-cover rounded mb-1"
                        />
                      )}
                      <span className="text-green-800 font-medium line-clamp-2">{item.mealNaam}</span>
                      <button
                        onClick={() => handleRemove(item.id)}
                        className="absolute top-1 right-1 hidden group-hover:flex text-red-400 hover:text-red-600"
                        title="Verwijderen"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => openModal(day, type)}
                    className="w-full text-xs text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg py-1 border border-dashed border-gray-200 hover:border-green-300 transition"
                  >
                    + Toevoegen
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Add meal modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-bold text-gray-800 mb-4">
              Maaltijd inplannen – {selectedType} op {new Date(selectedDate).toLocaleDateString('nl-NL')}
            </h2>
            <select
              value={selectedMeal}
              onChange={(e) => setSelectedMeal(Number(e.target.value))}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              {meals.map((m) => (
                <option key={m.id} value={m.id}>{m.naam}</option>
              ))}
            </select>
            <div className="flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 border border-gray-300 text-gray-700 rounded-lg py-2 text-sm hover:bg-gray-50 transition"
              >
                Annuleren
              </button>
              <button
                onClick={handleAdd}
                className="flex-1 bg-green-600 text-white rounded-lg py-2 text-sm font-semibold hover:bg-green-700 transition"
              >
                Inplannen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
