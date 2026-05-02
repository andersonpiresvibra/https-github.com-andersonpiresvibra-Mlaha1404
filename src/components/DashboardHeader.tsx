import React, { useState, useEffect } from 'react';
import { Sun, Moon, User, Edit2, Maximize, Minimize, Plane, Search, RefreshCw } from 'lucide-react';

interface DashboardHeaderProps {
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  globalSearchTerm: string;
  setGlobalSearchTerm: (term: string) => void;
  ltName: string;
  setLtName: (name: string) => void;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({ isDarkMode, toggleDarkMode, isFullscreen, onToggleFullscreen, globalSearchTerm, setGlobalSearchTerm, ltName, setLtName }) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [editingField, setEditingField] = useState<'density' | 'temperature' | 'ltName' | null>(null);
  const [densityN, setDensityN] = useState(0.803);
  const [temperature, setTemperature] = useState(24.5);
  const [tempLtName, setTempLtName] = useState('');

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false }).replace(':', 'H');
  };

  const formatDate = (date: Date) => {
    const weekday = date.toLocaleDateString('pt-BR', { weekday: 'short' }).toUpperCase().replace('.', '');
    const dayMonth = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    return `${weekday} - ${dayMonth}`;
  };

  return (
    <>
      <header className={`h-20 ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-[#004D24] border-transparent'} border-b flex items-center justify-between px-8 z-[100] relative transition-colors duration-500`}>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-lg shadow-[0_0_20px_rgba(255,255,255,0.2)]">
              <Plane className="text-white" size={20} />
            </div>
          </div>

          <div className="w-px h-10 bg-white/20"></div>

          <div className="flex items-center gap-3 group cursor-pointer">
              <div className="w-11 h-11 rounded-full bg-white/10 border-2 border-white/20 flex items-center justify-center group-hover:border-white/40 transition-colors">
                  <User size={18} className="text-white" />
              </div>
              <div className="text-left">
                  {editingField === 'ltName' ? (
                      <input 
                          type="text" 
                          value={tempLtName}
                          onChange={(e) => setTempLtName(e.target.value)}
                          onBlur={() => { setLtName(tempLtName); setEditingField(null); }}
                          onKeyDown={(e) => { 
                              if (e.key === 'Enter') { 
                                  setLtName(tempLtName); 
                                  setEditingField(null); 
                              } 
                          }}
                          placeholder="INSIRA SEU NOME"
                          autoFocus
                          className="bg-black/20 text-white font-bold text-sm rounded outline-none border border-emerald-500/50 px-1 uppercase w-36 placeholder:text-white/50"
                      />
                  ) : (
                      <span 
                          className={`text-sm font-bold transition-colors uppercase block select-none ${ltName ? 'text-white group-hover:text-emerald-200' : 'text-white/50 group-hover:text-white/80'}`}
                          onClick={() => { setTempLtName(ltName); setEditingField('ltName'); }}
                      >
                          {ltName || 'INSIRA SEU NOME'}
                      </span>
                  )}
                  <span className="text-[10px] text-emerald-200 font-black tracking-widest uppercase block">Líder de Solo</span>
              </div>
          </div>

          <div className="w-px h-10 bg-white/20"></div>

          <div>
              <h1 className={`text-4xl font-bold tracking-tighter font-mono ${isDarkMode ? 'text-white' : 'text-[#4ade80]'}`}>{formatTime(currentTime)}</h1>
              <p className="text-xs text-emerald-100 font-bold tracking-widest">{formatDate(currentTime)}</p>
          </div>

          <div className="w-px h-10 bg-white/20"></div>

          <div className="flex items-center gap-6">
              <div className="text-sm">
                  <div className="flex items-center gap-2">
                      <span className="text-emerald-100/70 font-bold text-xs uppercase w-10">DENS.</span>
                      {editingField === 'density' ? (
                          <input 
                              type="text"
                              inputMode="decimal"
                              value={densityN} 
                              onChange={(e) => {
                                  const val = e.target.value.replace(',', '.');
                                  if (!isNaN(Number(val)) || val === '' || val === '.') {
                                      setDensityN(val as any);
                                  }
                              }}
                              onBlur={() => {
                                  setEditingField(null);
                                  setDensityN(Number(densityN) || 0.803);
                              }}
                              onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                      setEditingField(null);
                                      setDensityN(Number(densityN) || 0.803);
                                  }
                              }}
                              autoFocus
                              className="w-16 bg-white/10 text-white font-mono font-bold text-lg rounded px-1 outline-none"
                          />
                      ) : (
                          <span 
                              className={`font-mono font-bold ${isDarkMode ? 'text-white' : 'text-[#4ade80]'} text-lg cursor-pointer hover:text-emerald-200 transition-colors w-16 inline-block`}
                              onClick={() => setEditingField('density')}
                          >
                              {Number(densityN).toFixed(3)}
                          </span>
                      )}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                      <span className="text-emerald-100/70 font-bold text-xs uppercase w-10">TEMP.</span>
                      {editingField === 'temperature' ? (
                          <input 
                              type="text"
                              inputMode="decimal"
                              value={temperature} 
                              onChange={(e) => {
                                  const val = e.target.value.replace(',', '.');
                                  if (!isNaN(Number(val)) || val === '' || val === '-' || val === '.') {
                                      setTemperature(val as any);
                                  }
                              }}
                              onBlur={() => {
                                  setEditingField(null);
                                  setTemperature(Number(temperature) || 24.5);
                              }}
                              onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                      setEditingField(null);
                                      setTemperature(Number(temperature) || 24.5);
                                  }
                              }}
                              autoFocus
                              className="w-16 bg-white/10 text-white font-mono font-bold text-lg rounded px-1 outline-none"
                          />
                      ) : (
                          <span 
                              className={`font-mono font-bold ${isDarkMode ? 'text-white' : 'text-[#4ade80]'} text-lg cursor-pointer hover:text-emerald-200 transition-colors w-16 inline-block`}
                              onClick={() => setEditingField('temperature')}
                          >
                              {Number(temperature).toFixed(1)}°C
                          </span>
                      )}
                  </div>
              </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button 
            onClick={onToggleFullscreen} 
            className="p-2.5 text-emerald-100 hover:text-white hover:bg-white/10 transition-all rounded-md"
          >
            {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
          </button>
          <button 
            onClick={toggleDarkMode} 
            className="p-2.5 text-emerald-100 hover:text-white hover:bg-white/10 transition-all rounded-md"
          >
              {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <div id="header-options-portal-target"></div>
        </div>
      </header>
    </>
  );
};
