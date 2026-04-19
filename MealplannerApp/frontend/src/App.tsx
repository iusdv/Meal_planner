import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './context/useAuth';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';
import AIAssistant from './components/AIAssistant';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import MealsPage from './pages/MealsPage';
import MealDetailPage from './pages/MealDetailPage';
import FavoritesPage from './pages/FavoritesPage';
import ProfilePage from './pages/ProfilePage';
import AdminPage from './pages/AdminPage';
import SetupPage from './pages/SetupPage';

function AppLayout() {
  const [showAI, setShowAI] = useState(false);
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const hideNavbar = ['/setup', '/login', '/register'].includes(location.pathname);
  const isSetupRoute = location.pathname === '/setup';

  return (
    <div className="min-h-screen bg-[#f6fbf7]">
      {!hideNavbar && <Navbar />}
      <main>
        <Routes>
          <Route path="/" element={<Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/setup" element={
            <ProtectedRoute setupMode="setup-only"><SetupPage /></ProtectedRoute>
          } />
          <Route path="/dashboard" element={
            <ProtectedRoute><DashboardPage /></ProtectedRoute>
          } />
          <Route path="/meals" element={
            <ProtectedRoute><MealsPage /></ProtectedRoute>
          } />
          <Route path="/meals/:id" element={
            <ProtectedRoute><MealDetailPage /></ProtectedRoute>
          } />
          <Route path="/favorites" element={
            <ProtectedRoute><FavoritesPage /></ProtectedRoute>
          } />
          <Route path="/profile" element={
            <ProtectedRoute><ProfilePage /></ProtectedRoute>
          } />
          <Route path="/admin" element={
            <ProtectedRoute adminOnly><AdminPage /></ProtectedRoute>
          } />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {isAuthenticated && !isSetupRoute && (
        <>
          {!showAI && (
            <button
              onClick={() => setShowAI(true)}
              className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-green-600 text-sm font-bold text-white shadow-lg transition hover:bg-green-700"
              title="AI Voedingscoach"
            >
              AI
            </button>
          )}
          {showAI && <AIAssistant onClose={() => setShowAI(false)} />}
        </>
      )}
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppLayout />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
