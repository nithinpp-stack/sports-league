import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  FiHome,
  FiAward,
  FiUsers,
  FiUser,
  FiShield,
  FiClipboard,
  FiLogOut,
  FiChevronLeft,
  FiChevronRight,
  FiKey,
} from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';

const navItems = [
  { to: '/', label: 'Dashboard', icon: FiHome, exact: true },
  { to: '/tournaments', label: 'Tournaments', icon: FiAward },
  { to: '/teams', label: 'Teams', icon: FiShield },
  { to: '/users', label: 'Event Managers', icon: FiUsers },
  { to: '/managers', label: 'Managers', icon: FiUsers },
  { to: '/players', label: 'Players', icon: FiUser },
  { to: '/registrations', label: 'Registrations', icon: FiClipboard },
  { to: '/roles', label: 'Roles', icon: FiKey },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const perms = user?.roleId?.permissions || user?.permissions || [];
  const hasWildcard = perms.includes('*');
  const hasPerm = (p) => hasWildcard || perms.includes(p);

  const visibleItems = navItems.filter((item) => {
    if (item.to === '/') return true;
    if (item.to === '/tournaments') return hasPerm('tournaments.view');
    if (item.to === '/teams') return hasPerm('teams.view');
    if (item.to === '/managers') return hasPerm('managers.view');
    if (item.to === '/players') return hasPerm('players.view');
    if (item.to === '/users') return hasPerm('admins.view');
    if (item.to === '/registrations') return hasPerm('registrations.view');
    if (item.to === '/roles') return hasPerm('roles.view');
    return true;
  });

  return (
    <div
      className={`relative shrink-0 h-full transition-all duration-300 ${
        collapsed ? 'w-[68px]' : 'w-64'
      }`}
    >
      {collapsed && (
        <button
          onClick={() => setCollapsed(false)}
          className="absolute -right-3 top-5 z-20 flex h-6 w-6 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 shadow-sm hover:bg-gray-50 hover:text-gray-900 transition-colors"
        >
          <FiChevronRight size={14} />
        </button>
      )}

      <div className="flex flex-col h-full overflow-y-auto overflow-x-hidden border-r border-gray-200 bg-[#f8f8f8] shadow-sm">
        <div className="flex items-center gap-3 border-b border-gray-200 px-4 py-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white font-bold text-sm">
            SL
          </div>
          {!collapsed && (
            <>
              <div className="min-w-0 flex-1">
                <h1 className="text-sm font-bold text-gray-900 truncate">Admin Panel</h1>
                <p className="text-[11px] text-gray-500 truncate">Sports League</p>
              </div>
              <button
                onClick={() => setCollapsed(true)}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-gray-400 hover:bg-gray-200 hover:text-gray-700 transition-colors"
              >
                <FiChevronLeft size={16} />
              </button>
            </>
          )}
        </div>

        <nav className="flex-1 py-3 px-2 space-y-0.5">
          {visibleItems.map(({ to, label, icon: Icon, exact }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
              title={collapsed ? label : undefined}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-gray-200 text-gray-900'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                } ${collapsed ? 'justify-center' : ''}`
              }
            >
              <Icon size={18} className="shrink-0" />
              {!collapsed && <span className="truncate">{label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="px-3 py-3 space-y-2">
          {/* User info card */}
          <div className={`rounded-xl bg-white border border-gray-200 shadow-[0_1px_3px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.06)] ${collapsed ? 'p-2 flex justify-center' : 'p-3'}`}>
            <div className={`flex items-center gap-3 ${collapsed ? 'justify-center' : ''}`}>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-gray-700 to-gray-900 text-white text-xs font-bold shadow-sm">
                {user?.name?.charAt(0)?.toUpperCase() || '?'}
              </div>
              {!collapsed && (
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900 truncate">{user?.name}</p>
                  <p className="text-[11px] text-gray-500 truncate">{user?.email}</p>
                </div>
              )}
            </div>
          </div>
          {/* Logout card */}
          <button
            onClick={handleLogout}
            title={collapsed ? 'Logout' : undefined}
            className={`w-full rounded-xl bg-white border border-gray-200 shadow-[0_1px_3px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.06)] hover:border-red-200 hover:bg-red-50 hover:shadow-[0_2px_4px_rgba(239,68,68,0.1)] transition-all flex items-center gap-3 text-sm font-medium text-gray-600 hover:text-red-600 ${
              collapsed ? 'justify-center p-2.5' : 'px-4 py-2.5'
            }`}
          >
            <FiLogOut size={16} className="shrink-0" />
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
      </div>
    </div>
  );
}
