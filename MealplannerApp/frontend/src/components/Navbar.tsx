import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout, isAuthenticated, isAdmin } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="bg-green-700 text-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link to="/" className="text-xl font-bold tracking-tight flex items-center gap-2">
          🥗 MealPlanner
        </Link>

        <div className="flex items-center gap-4 text-sm font-medium">
          {isAuthenticated ? (
            <>
              <Link to="/dashboard" className="hover:text-green-200 transition">Dashboard</Link>
              <Link to="/meals" className="hover:text-green-200 transition">Maaltijden</Link>
              <Link to="/favorites" className="hover:text-green-200 transition">Favorieten</Link>
              <Link to="/profile" className="hover:text-green-200 transition">Profiel</Link>
              {isAdmin && (
                <Link to="/admin" className="bg-yellow-500 text-black px-3 py-1 rounded-full text-xs font-bold hover:bg-yellow-400">
                  Admin
                </Link>
              )}
              <div className="flex items-center gap-2 ml-2">
                <span className="text-green-200 text-xs">{user?.naam}</span>
                <button
                  onClick={handleLogout}
                  className="bg-white text-green-700 px-3 py-1 rounded-full text-xs font-bold hover:bg-green-100 transition"
                >
                  Uitloggen
                </button>
              </div>
            </>
          ) : (
            <>
              <Link to="/login" className="hover:text-green-200 transition">Inloggen</Link>
              <Link to="/register" className="bg-white text-green-700 px-3 py-1 rounded-full text-xs font-bold hover:bg-green-100 transition">
                Registreren
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
