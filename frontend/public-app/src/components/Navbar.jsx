import React, { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { HiMenu, HiX, HiShieldCheck } from 'react-icons/hi';
import AuthModal from './AuthModal';

function SunIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  );
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [authModal, setAuthModal] = useState(null); // null | 'login' | 'register'

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const navLinkClass = ({ isActive }) =>
    isActive
      ? 'text-emerald-600 dark:text-emerald-400 font-semibold text-[15px] transition-all duration-200'
      : 'text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white text-[15px] font-medium transition-all duration-200';

  return (
    <>
      <nav className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-b border-slate-200/80 dark:border-gray-800/80 shadow-sm dark:shadow-none sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">

            {/* Brand */}
            <Link to="/" className="flex items-center gap-2 group">
              <div className="w-8 h-8 bg-emerald-600 dark:bg-emerald-500/10 dark:border dark:border-emerald-500/30 rounded-lg flex items-center justify-center group-hover:bg-emerald-700 dark:group-hover:bg-emerald-500/20 transition-all duration-200">
                <HiShieldCheck className="text-white dark:text-emerald-400 w-4 h-4" />
              </div>
              <span className="text-slate-900 dark:text-white font-bold text-lg tracking-tight">
                Sports<span className="text-emerald-600 dark:text-emerald-400">League</span>
              </span>
            </Link>

            {/* Desktop nav */}
            <div className="hidden md:flex items-center gap-7">
              <NavLink to="/tournaments" className={navLinkClass}>Tournaments</NavLink>
              <NavLink to="/matches" className={navLinkClass}>Matches</NavLink>
              <NavLink to="/matches/live" className={({ isActive }) =>
                `flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold transition-all duration-200 ${
                  isActive
                    ? 'bg-red-500 text-white'
                    : 'bg-red-500/10 text-red-500 dark:text-red-400 border border-red-500/20 hover:bg-red-500/20 hover:border-red-500/40'
                }`
              }>
                <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                Live
              </NavLink>
            </div>

            {/* Right side: theme toggle + auth */}
            <div className="hidden md:flex items-center gap-3">
              {/* Theme toggle */}
              <button
                onClick={toggleTheme}
                className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-gray-800 transition-all duration-200"
                title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
              >
                {theme === 'light' ? <MoonIcon /> : <SunIcon />}
              </button>

              {user ? (
                <>
                  <Link
                    to="/profile"
                    className="text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white transition-all duration-200 text-sm font-medium"
                  >
                    {user.name}
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="border border-slate-200 dark:border-gray-700 hover:border-slate-400 dark:hover:border-gray-500 text-slate-600 dark:text-gray-300 hover:text-slate-900 dark:hover:text-white text-sm px-4 py-1.5 rounded-lg transition-all duration-200"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setAuthModal('login')}
                    className="border border-slate-200 dark:border-gray-700 hover:border-emerald-400 dark:hover:border-gray-500 text-slate-600 dark:text-gray-300 hover:text-slate-900 dark:hover:text-white text-sm px-4 py-1.5 rounded-lg transition-all duration-200"
                  >
                    Login
                  </button>
                  <button
                    onClick={() => setAuthModal('register')}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-1.5 rounded-lg shadow-sm hover:shadow-md transition-all duration-200"
                  >
                    Register
                  </button>
                </>
              )}
            </div>

            {/* Mobile: theme toggle + hamburger */}
            <div className="md:hidden flex items-center gap-2">
              <button
                onClick={toggleTheme}
                className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-500 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-gray-800 transition-all duration-200"
              >
                {theme === 'light' ? <MoonIcon /> : <SunIcon />}
              </button>
              <button
                className="text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                onClick={() => setMenuOpen(!menuOpen)}
              >
                {menuOpen ? <HiX size={24} /> : <HiMenu size={24} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden bg-white dark:bg-gray-900/98 backdrop-blur-md border-t border-slate-100 dark:border-gray-800 px-4 py-5 flex flex-col gap-4 shadow-lg dark:shadow-none">
            <NavLink to="/tournaments" className={navLinkClass} onClick={() => setMenuOpen(false)}>Tournaments</NavLink>
            <NavLink to="/matches" className={navLinkClass} onClick={() => setMenuOpen(false)}>Matches</NavLink>
            <NavLink to="/matches/live" className="flex items-center gap-1.5 text-red-500 dark:text-red-400 font-semibold" onClick={() => setMenuOpen(false)}>
              <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
              Live
            </NavLink>
            {user ? (
              <>
                <Link to="/profile" className="text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white transition-colors" onClick={() => setMenuOpen(false)}>{user.name}</Link>
                <button onClick={handleLogout} className="text-left text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white transition-colors">Logout</button>
              </>
            ) : (
              <>
                <button onClick={() => { setMenuOpen(false); setAuthModal('login'); }} className="text-left text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white transition-colors">Login</button>
                <button onClick={() => { setMenuOpen(false); setAuthModal('register'); }} className="inline-block bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-2 rounded-lg transition-colors text-center">Register</button>
              </>
            )}
          </div>
        )}
      </nav>

      {/* Auth Modal */}
      {authModal && (
        <AuthModal mode={authModal} onClose={() => setAuthModal(null)} />
      )}
    </>
  );
}
