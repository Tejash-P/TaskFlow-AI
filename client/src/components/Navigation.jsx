import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Zap, LogOut, Sparkles, Users, MessageSquare, FileText, Calendar as CalendarIcon, BarChart2 } from 'lucide-react';

export default function Navigation() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Workflows', path: '/workflows', icon: Zap },
    { name: 'Calendar', path: '/calendar', icon: CalendarIcon },
    { name: 'Meetings', path: '/meetings', icon: MessageSquare },
    { name: 'Documents', path: '/documents', icon: FileText },
    { name: 'Content AI', path: '/content', icon: Sparkles },
    { name: 'Analytics', path: '/analytics', icon: BarChart2 },
    { name: 'Team Space', path: '/team', icon: Users },
  ];

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 border-r border-zinc-900 bg-zinc-950/80 backdrop-blur-md p-6 h-screen sticky top-0 shrink-0">
        {/* Brand Header */}
        <div className="flex items-center gap-3 mb-8 px-2">
          <div className="h-9 w-9 rounded-lg bg-linear-to-tr from-purple-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-purple-500/10">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight text-white flex items-center gap-1">
            TaskFlow <span className="bg-linear-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">AI</span>
          </span>
        </div>

        {/* User profile preview */}
        <div className="mb-8 p-3 bg-zinc-900/40 border border-zinc-800/60 rounded-xl flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold text-sm">
            {user.email ? user.email.charAt(0).toUpperCase() : 'U'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-zinc-500 font-medium">Logged in as</p>
            <p className="text-xs text-zinc-200 font-semibold truncate">{user.email || 'User'}</p>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 cursor-pointer ${
                    isActive
                      ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/15'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
                  }`
                }
              >
                <Icon className="h-4.5 w-4.5" />
                {item.name}
              </NavLink>
            );
          })}
        </nav>

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-4 py-3 text-sm font-semibold text-zinc-400 hover:text-red-400 hover:bg-red-500/5 rounded-xl transition-all duration-200 cursor-pointer mt-auto"
        >
          <LogOut className="h-4.5 w-4.5" />
          Sign Out
        </button>
      </aside>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-zinc-950/90 border-t border-zinc-900 backdrop-blur-lg flex items-center justify-around z-50 px-6">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 py-1 px-3 text-xs font-medium transition-all ${
                  isActive ? 'text-purple-400' : 'text-zinc-500'
                }`
              }
            >
              <Icon className="h-5 w-5" />
              {item.name}
            </NavLink>
          );
        })}
        <button
          onClick={handleLogout}
          className="flex flex-col items-center gap-1 py-1 px-3 text-xs font-medium text-zinc-500 hover:text-red-400 cursor-pointer"
        >
          <LogOut className="h-5 w-5" />
          Logout
        </button>
      </nav>
    </>
  );
}
