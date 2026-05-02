import React, { useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';

interface AirlineLogoProps {
  airlineCode: string;
  className?: string;
}

const AIRLINE_INFO: Record<string, { iata: string, name: string }> = {
  'RG': { iata: 'G3', name: 'GOL' },
  'G3': { iata: 'G3', name: 'GOL' },
  'GOL': { iata: 'G3', name: 'GOL' },
  'GLO': { iata: 'G3', name: 'GOL' },
  'LA': { iata: 'LA', name: 'LATAM' },
  'TAM': { iata: 'LA', name: 'LATAM' },
  'LATAM': { iata: 'LA', name: 'LATAM' },
  'LAT': { iata: 'LA', name: 'LATAM' },
  'AD': { iata: 'AD', name: 'AZUL' },
  'AZUL': { iata: 'AD', name: 'AZUL' },
  'AZU': { iata: 'AD', name: 'AZUL' },
  'TP': { iata: 'TP', name: 'TAP' },
  'TAP': { iata: 'TP', name: 'TAP' },
  'AF': { iata: 'AF', name: 'AIR FR' },
  'LH': { iata: 'LH', name: 'LUFTH' },
  'CM': { iata: 'CM', name: 'COPA' },
  'UA': { iata: 'UA', name: 'UNITED' },
  'AA': { iata: 'AA', name: 'AMERIC' },
  'KL': { iata: 'KL', name: 'KLM' },
  'DL': { iata: 'DL', name: 'DELTA' },
  'TT': { iata: 'TT', name: 'TOTAL' },
};

export const AirlineLogo: React.FC<AirlineLogoProps> = ({ airlineCode, className = "" }) => {
  const [imgError, setImgError] = useState(false);
  const { isDarkMode } = useTheme();
  
  const normalizedCode = airlineCode?.toUpperCase() || '';
  const info = AIRLINE_INFO[normalizedCode] || { iata: normalizedCode, name: normalizedCode };
  
  const iconUrl = `https://images.kiwi.com/airlines/64/${info.iata}.png`;

  return (
    <div className={`flex items-center gap-2 pl-1 ${className}`}>
      <div className={`w-6 h-6 flex items-center justify-center shrink-0 rounded-sm ${isDarkMode ? 'bg-white/10' : 'bg-transparent'}`}>
        {!imgError ? (
          <img 
            src={iconUrl} 
            alt={info.name} 
            className="w-full h-full object-contain drop-shadow-[1px_1px_1px_rgba(0,0,0,0.5)] hover:scale-110 transition-transform duration-300"
            onError={() => setImgError(true)}
          />
        ) : (
          <span className={`text-[10px] font-bold ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{info.iata}</span>
        )}
      </div>
      <span className={`text-[10px] font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'} tracking-wider uppercase truncate max-w-[50px]`} title={info.name}>
        {info.name}
      </span>
    </div>
  );
};
