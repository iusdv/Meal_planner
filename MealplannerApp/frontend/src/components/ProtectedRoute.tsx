import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../context/useAuth';
import { getGoals, getProfile } from '../services/mealService';
import { isSetupComplete } from '../utils/setup';

interface Props {
  children: ReactNode;
  adminOnly?: boolean;
  setupMode?: 'require-complete' | 'setup-only' | 'skip-check';
}

export default function ProtectedRoute({
  children,
  adminOnly = false,
  setupMode = 'require-complete',
}: Props) {
  const { isAuthenticated, isAdmin } = useAuth();
  const [setupState, setSetupState] = useState<'loading' | 'complete' | 'incomplete'>(() => {
    if (setupMode === 'skip-check') return 'complete';
    const cachedState = sessionStorage.getItem('setupComplete');
    if (cachedState === 'true') return 'complete';
    if (cachedState === 'false') return 'incomplete';
    return 'loading';
  });

  useEffect(() => {
    if (!isAuthenticated || setupMode === 'skip-check') {
      return;
    }

    let active = true;

    getProfile()
      .then(async (profileResult) => {
        if (!active) return;
        const goalsResult = await getGoals();
        if (!active) return;
        const complete = isSetupComplete(profileResult.data, goalsResult.data);
        sessionStorage.setItem('setupComplete', complete ? 'true' : 'false');
        setSetupState(complete ? 'complete' : 'incomplete');
      })
      .catch(() => {
        if (!active) return;
        sessionStorage.removeItem('setupComplete');
        setSetupState('incomplete');
      });

    return () => {
      active = false;
    };
  }, [isAuthenticated, setupMode]);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (adminOnly && !isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  if (setupMode !== 'skip-check' && setupState === 'loading') {
    return (
      <div className="flex h-[70vh] items-center justify-center bg-[#f6fbf7]">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-green-600"></div>
      </div>
    );
  }

  if (setupMode === 'setup-only' && setupState === 'complete') {
    return <Navigate to="/dashboard" replace />;
  }

  if (setupMode === 'require-complete' && setupState === 'incomplete') {
    return <Navigate to="/setup" replace />;
  }

  return <>{children}</>;
}
