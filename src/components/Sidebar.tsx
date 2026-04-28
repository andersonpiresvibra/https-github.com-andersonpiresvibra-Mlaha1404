import React from 'react';
import { LayoutDashboard, Users, Table, Database } from 'lucide-react';
import { ViewState } from '../types';

interface SidebarProps {
  activeView: ViewState;
  onViewChange: (view: ViewState) => void;
  isDarkMode: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeView, onViewChange, isDarkMode }) => {
  const navItems = [
    { id: 'GRID_OPS' as ViewState, icon: Table, label: 'Malha' },
    { id: 'OPERATIONAL_MESH' as ViewState, icon: Database, label: 'Base' },
    { id: 'SHIFT_OPERATORS' as ViewState, icon: Users, label: 'Equipe' },
  ];

  return (
    <aside className={`w-20 shrink-0 border-r flex flex-col items-center py-6 transition-all duration-300 ${
      isDarkMode 
        ? 'bg-slate-900 border-slate-800' 
        : 'bg-[#2C864C] border-white/10'
    }`}>
      <div className="flex flex-col gap-6 w-full items-center">
        <nav className={`flex flex-col gap-4 w-full px-2 ${!isDarkMode ? 'bg-[#268200]' : ''}`}>
          {navItems.map((item) => {
            const isActive = activeView === item.id;
            const Icon = item.icon;
            
            return (
              <button
                key={item.id}
                onClick={() => onViewChange(item.id)}
                data-active={isActive}
                title={item.label}
                className={`sidebar-nav-btn flex flex-col items-center justify-center p-3 rounded-xl transition-all group ${
                  isActive 
                    ? isDarkMode 
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' 
                      : 'bg-white text-emerald-900 shadow-lg' 
                    : isDarkMode
                      ? 'text-slate-400 hover:text-white hover:bg-slate-800'
                      : 'text-white/70 hover:text-white hover:bg-white/10'
                }`}
              >
                <Icon size={22} strokeWidth={isActive ? 2.5 : 2} className="transition-transform group-hover:scale-110" />
                <span className={`text-[8px] font-black uppercase tracking-tighter mt-1 whitespace-nowrap ${
                  isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                } transition-opacity`}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>
      </div>
    </aside>
  );
};
