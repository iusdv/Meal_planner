import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';

export default function Navbar() {
  const { user, logout, isAuthenticated, isAdmin } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navLinkClassName = ({ isActive }: { isActive: boolean }) =>
    [
      'inline-flex items-center justify-center rounded-full border border-transparent px-5 py-2 text-sm font-semibold text-green-700 transition-colors',
      isActive
        ? 'border-green-200 bg-[#f4faf5] text-green-800'
        : 'hover:border-green-100 hover:bg-[#f8fbf8]',
    ].join(' ');

  return (
    <nav className="border-b border-green-100 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <Link to="/" className="text-2xl font-bold tracking-tight text-green-900">
          MealPlanner
        </Link>

        <div className="flex items-center gap-6 text-sm font-medium">
          {isAuthenticated ? (
            <>
              <NavLink to="/dashboard" className={navLinkClassName}>
                Dashboard
              </NavLink>
              <NavLink to="/meals" className={navLinkClassName}>
                Maaltijden
              </NavLink>
              <NavLink to="/favorites" className={navLinkClassName}>
                Favorieten
              </NavLink>
              <NavLink to="/profile" className={navLinkClassName}>
                Profiel
              </NavLink>
              {isAdmin && (
                <NavLink
                  to="/admin"
                  className="rounded-full border border-yellow-200 px-5 py-2 text-sm font-semibold text-yellow-800"
                >
                  Admin
                </NavLink>
              )}
              <div className="ml-2 flex items-center gap-3">
                <span className="text-sm font-medium text-slate-500">{user?.naam}</span>
                <button
                  onClick={handleLogout}
                  className="rounded-full border border-green-200 px-5 py-2 text-sm font-semibold text-green-800 transition-colors hover:bg-[#f4faf5]"
                >
                  Uitloggen
                </button>
              </div>
            </>
          ) : (
            <>
              <NavLink to="/login" className={navLinkClassName}>
                Inloggen
              </NavLink>
              <NavLink
                to="/register"
                className="rounded-full border border-green-200 px-5 py-2 text-sm font-semibold text-green-800 transition-colors hover:bg-[#f4faf5]"
              >
                Registreren
              </NavLink>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
