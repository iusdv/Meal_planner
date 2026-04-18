import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import OnboardingWizard from '../components/OnboardingWizard';
import { useAuth } from '../context/useAuth';
import { getGoals, getMeals, getProfile, upsertGoals, upsertProfile } from '../services/mealService';
import type { GoalDto, MealDto, ProfileDto } from '../types';
import type { GoalForm, ProfileForm } from '../utils/nutrition';

export default function SetupPage() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [initialProfile, setInitialProfile] = useState<Partial<ProfileDto>>();
  const [initialGoal, setInitialGoal] = useState<Partial<GoalDto>>();
  const [meals, setMeals] = useState<MealDto[]>([]);

  useEffect(() => {
    Promise.allSettled([getProfile(), getGoals(), getMeals()])
      .then(([profileResult, goalsResult, mealsResult]) => {
        if (profileResult.status === 'fulfilled') {
          setInitialProfile(profileResult.value.data);
        }

        if (goalsResult.status === 'fulfilled') {
          setInitialGoal(goalsResult.value.data);
        }

        if (mealsResult.status === 'fulfilled') {
          setMeals(mealsResult.value.data);
        } else {
          setError('De maaltijden konden niet worden geladen. Je kunt de setup wel invullen.');
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (profile: ProfileForm, goal: GoalForm) => {
    await Promise.all([upsertProfile(profile), upsertGoals(goal)]);
    sessionStorage.setItem('setupComplete', 'true');
    navigate('/dashboard', { replace: true });
  };

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f6fbf7]">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <OnboardingWizard
      initialProfile={initialProfile}
      initialGoal={initialGoal}
      meals={meals}
      loadError={error}
      onSave={handleSave}
      onLogout={handleLogout}
    />
  );
}
