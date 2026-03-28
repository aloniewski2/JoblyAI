import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Calendar, Table2, Columns, FileText,
  Settings, Sun, Moon, Briefcase, Plus, ChevronRight, PlayCircle, Users, BarChart2
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '../../lib/utils';
import QuickAddModal from '../applications/QuickAddModal';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/today', icon: Calendar, label: 'Today' },
  { to: '/applications', icon: Table2, label: 'Applications' },
  { to: '/kanban', icon: Columns, label: 'Kanban Board' },
  { to: '/resumes', icon: FileText, label: 'Resumes' },
  { to: '/connections', icon: Users, label: 'Connections' },
  { to: '/analytics', icon: BarChart2, label: 'Analytics' },
];

export default function Sidebar() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  const [quickAdd, setQuickAdd] = useState(false);

  const toggleDark = () => {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    setDark(isDark);
  };

  return (
    <>
      <aside className="w-60 flex-shrink-0 h-screen sticky top-0 flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center flex-shrink-0">
              <Briefcase className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-tight">JoblyAI</div>
              <div className="text-xs text-slate-400 dark:text-slate-500">Application Tracker</div>
            </div>
          </div>
        </div>

        {/* Quick Add */}
        <div className="px-3 py-3 border-b border-slate-100 dark:border-slate-800">
          <button
            onClick={() => setQuickAdd(true)}
            className="w-full flex items-center gap-2 px-3 py-2.5 bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Quick Add Application
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors group',
                isActive
                  ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
              )}
            >
              {({ isActive }) => (
                <>
                  <Icon className={cn('w-4 h-4 flex-shrink-0',
                    isActive ? 'text-primary-600 dark:text-primary-400' : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300'
                  )} />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Bottom */}
        <div className="px-2 py-3 border-t border-slate-100 dark:border-slate-800 space-y-0.5">
          <NavLink
            to="/demo"
            className={({ isActive }) => cn(
              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
              isActive
                ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
            )}
          >
            <PlayCircle className="w-4 h-4 text-slate-400 dark:text-slate-500" />
            View Demo
          </NavLink>
          <NavLink
            to="/settings"
            className={({ isActive }) => cn(
              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
              isActive
                ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
            )}
          >
            <Settings className="w-4 h-4 text-slate-400 dark:text-slate-500" />
            Settings
          </NavLink>

          <button
            onClick={toggleDark}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
          >
            {dark
              ? <Sun className="w-4 h-4 text-slate-400" />
              : <Moon className="w-4 h-4 text-slate-400" />
            }
            {dark ? 'Light Mode' : 'Dark Mode'}
          </button>
        </div>
      </aside>

      {quickAdd && (
        <QuickAddModal onClose={() => setQuickAdd(false)} />
      )}
    </>
  );
}
