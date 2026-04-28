import React, { useState, useEffect, useMemo } from 'react';
import { OperatorProfile, FlightData, Vehicle } from '../types';
import { UserPlus, AlertTriangle, X, Check, User, Clock, Briefcase } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

interface DesigOprProps {
    isOpen: boolean;
    onClose: () => void;
    flight?: FlightData | null;
    vehicle?: Vehicle | null;
    operators: OperatorProfile[];
    onConfirm: (operatorId: string) => void;
}

type Tab = 'TODOS' | 'SRV' | 'CTA';

export const DesigOpr: React.FC<DesigOprProps> = ({ isOpen, onClose, flight, vehicle, operators, onConfirm }) => {
    const { isDarkMode } = useTheme();
    const [selectedOperatorId, setSelectedOperatorId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<Tab>('TODOS');

    const handleConfirm = () => {
        if (selectedOperatorId) {
            onConfirm(selectedOperatorId);
            setSelectedOperatorId(null);
        }
    };

    const handleClose = () => {
        setSelectedOperatorId(null);
        onClose();
    };

    // Reset tab when opening
    useEffect(() => {
        if (isOpen) {
            setActiveTab('TODOS');
            setSelectedOperatorId(null);
        }
    }, [isOpen]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Enter' && isOpen && selectedOperatorId) {
                handleConfirm();
            }
            if (e.key === 'Escape' && isOpen) {
                handleClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, selectedOperatorId, handleConfirm]);

    const availableOperators = useMemo(() => {
        // Apenas operadores disponíveis
        return operators.filter(op => op.status === 'DISPONÍVEL');
    }, [operators]);

    const categorizedOperators = useMemo(() => {
        return {
            TODOS: availableOperators,
            SRV: availableOperators.filter(op => op.fleetCapability === 'SRV'),
            CTA: availableOperators.filter(op => op.fleetCapability === 'CTA'),
        };
    }, [availableOperators]);

    const isOperatorDisabled = (op: OperatorProfile) => {
        if (!flight) return false;
        // Se a posição for CTA, inabilitar SRVs
        if (flight.positionType === 'CTA' && op.fleetCapability === 'SRV') return true;
        return false;
    };

    // Fallback logic if statuses aren't exactly matching, or to ensure everyone is somewhere
const OperatorImage = ({ op, isSelected, isDisabled }: { op: OperatorProfile, isSelected: boolean, isDisabled: boolean }) => {
    const [error, setError] = useState(false);
    return (
        <div className={`w-9 h-12 rounded-lg flex items-end justify-center text-sm font-black border overflow-hidden shrink-0 ${
            isDisabled
                ? 'bg-slate-50 text-slate-300 border-slate-100 opacity-50'
                : isSelected 
                    ? 'bg-indigo-100 text-indigo-600 border-indigo-200' 
                    : 'bg-slate-100 text-slate-400 border-slate-200 group-hover:border-slate-300'
        }`}>
            {op.photoUrl && !error ? (
                <img src={op.photoUrl} alt={op.warName} className={`w-full h-full object-cover ${isDisabled ? 'grayscale opacity-50' : ''}`} onError={() => setError(true)} referrerPolicy="no-referrer" />
            ) : (
                <User size={24} className={`${isDisabled ? 'text-slate-200' : isSelected ? 'text-indigo-300' : 'text-slate-300'} mb-1`} />
            )}
        </div>
    );
};

    const currentList = categorizedOperators[activeTab];

    if (!isOpen || (!flight && !vehicle)) return null;

    const title = "Designação de Operador";
    let subtitle = "";
    const isCtaPosition = flight?.positionType === 'CTA';

    if (flight) {
        subtitle = `Voo ${flight.flightNumber} • POS: ${flight.positionId} (${flight.positionType || 'GERAL'})`;
    } else if (vehicle) {
        subtitle = `Frota ${vehicle.id} • ${vehicle.type}`;
    }

    return (
        <div 
            className="fixed inset-0 z-[9999] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-200"
            onClick={handleClose}
        >
            <div 
                className={`${isDarkMode ? 'bg-slate-900 border-emerald-500/30' : 'bg-white border-slate-200'} border-[0.5px] w-full max-w-md rounded-[8px] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200`}
                onClick={e => e.stopPropagation()}
            >
                {/* HEADER FINO */}
                <div className={`flex items-center justify-between px-6 py-4 border-b ${isDarkMode ? 'border-slate-800 bg-slate-950' : 'border-[#2C864C] bg-[#2C864C]'}`}>
                    <div className="flex items-center gap-4">
                <div className={`w-10 h-10 flex items-center justify-center shrink-0 ${isDarkMode ? 'text-indigo-400' : 'text-emerald-100'}`}>
                    <UserPlus size={24} />
                </div>
                        <div>
                            <h3 className="text-lg font-bold text-white uppercase tracking-tight leading-none">{title}</h3>
                            <p className={`text-[10px] font-bold uppercase tracking-widest mt-1.5 ${isDarkMode ? 'text-slate-400' : 'text-emerald-100'}`}>
                                {subtitle}
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={handleClose}
                        className={`transition-colors p-2 rounded-full ${isDarkMode ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-emerald-100 hover:text-white hover:bg-emerald-700'}`}
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* TABS */}
                <div className="flex border-b border-slate-100 bg-white px-2">
                    {(['TODOS', 'SRV', 'CTA'] as Tab[]).map(tab => {
                        const count = categorizedOperators[tab].length;
                        const isActive = activeTab === tab;
                        
                        let activeColor = 'text-indigo-600 border-indigo-600';
                        if (tab === 'SRV') activeColor = 'text-emerald-600 border-emerald-600';
                        if (tab === 'CTA') activeColor = 'text-yellow-600 border-yellow-600';

                        return (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`
                                    flex-1 py-4 text-[10px] font-bold uppercase tracking-wider border-b-2 transition-all flex items-center justify-center gap-2 ${
                                    isActive 
                                        ? `bg-slate-50/50 ${activeColor}` 
                                        : 'border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                                }`}
                            >
                                {tab === 'TODOS' && <User size={12} />}
                                {tab === 'SRV' && <Briefcase size={12} />}
                                {tab === 'CTA' && <Clock size={12} />}
                                {tab === 'TODOS' ? 'Todos' : tab}
                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-black ${isActive ? 'bg-white shadow-sm' : 'bg-slate-100'}`}>
                                    {count}
                                </span>
                            </button>
                        );
                    })}
                </div>

                {/* AVISO DE RESTRIÇÃO */}
                {isCtaPosition && (
                    <div className="px-6 py-2 bg-yellow-50 border-b border-yellow-100 flex items-center gap-2">
                        <AlertTriangle size={14} className="text-yellow-600" />
                        <span className="text-[9px] font-bold text-yellow-700 uppercase tracking-wider">
                            Posição CTA: Apenas caminhões tanque (CTA) permitidos.
                        </span>
                    </div>
                )}

                {/* LISTA DE OPERADORES */}
                <div className="flex-1 p-6 min-h-[300px] max-h-[450px] overflow-y-auto custom-scrollbar bg-white">
                    {currentList.length > 0 ? (
                        <div className="grid grid-cols-1 gap-3">
                            {currentList.map(op => {
                                const isSelected = selectedOperatorId === op.id;
                                const isDisabled = isOperatorDisabled(op);
                                
                                let statusColor = 'text-emerald-600 bg-emerald-50 border-emerald-100';
                                if (op.status === 'DESIGNADO') statusColor = 'text-blue-600 bg-blue-50 border-blue-100';
                                if (op.status === 'OCUPADO' || op.status === 'ENCHIMENTO') statusColor = 'text-amber-600 bg-amber-50 border-amber-100';

                                return (
                                    <button 
                                        key={op.id}
                                        onClick={() => !isDisabled && setSelectedOperatorId(op.id)}
                                        disabled={isDisabled}
                                        className={`group w-full flex items-center justify-between px-4 py-3.5 rounded-lg border transition-all relative overflow-hidden active:scale-[0.98] ${
                                            isDisabled
                                                ? 'bg-slate-50 border-slate-100 cursor-not-allowed opacity-60'
                                                : isSelected 
                                                    ? 'bg-indigo-50 border-indigo-200 shadow-sm' 
                                                    : 'bg-slate-50 border-slate-200 hover:border-slate-300 hover:bg-slate-100/50'
                                        }`}
                                    >
                                        <div className="flex items-center gap-4 relative z-10">
                                            <OperatorImage op={op} isSelected={isSelected} isDisabled={isDisabled} />
                                            <div className="text-left">
                                                <div className={`text-sm font-bold uppercase tracking-tight ${isDisabled ? 'text-slate-400' : isSelected ? 'text-indigo-900' : 'text-slate-900'}`}>
                                                    {op.warName} {op.assignedVehicle ? `| ${op.assignedVehicle}` : ''}
                                                </div>
                                                <div className="flex items-center gap-2 mt-1.5">
                                                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${isDisabled ? 'bg-slate-100 text-slate-400 border-slate-200' : isSelected ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : statusColor}`}>
                                                        {op.status}
                                                    </span>
                                                    {op.fleetCapability && (
                                                        <span className={`text-[9px] font-mono font-bold ${isDisabled ? 'text-slate-300' : isSelected ? 'text-indigo-400' : 'text-slate-500'}`}>
                                                            {op.fleetCapability}
                                                        </span>
                                                    )}
                                                    {isDisabled && (
                                                        <span className="text-[8px] font-black text-red-500 uppercase tracking-tighter bg-red-50 px-1 rounded border border-red-100">
                                                            Incompatível
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        
                                        {isSelected && (
                                            <div className="absolute right-6 top-1/2 -translate-y-1/2 z-10">
                                                <div className="w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20">
                                                    <Check size={16} strokeWidth={3} />
                                                </div>
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-4 py-12">
                            <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center border border-slate-100">
                                <User size={32} className="opacity-20" />
                            </div>
                            <span className="text-[10px] font-bold uppercase tracking-widest">Nenhum operador disponível</span>
                        </div>
                    )}
                </div>

                {/* FOOTER */}
                <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex gap-4">
                    <button 
                        onClick={handleClose}
                        className="flex-1 py-3.5 rounded-lg border border-slate-200 bg-white text-slate-500 font-bold text-[10px] hover:bg-slate-100 hover:text-slate-900 transition-all uppercase tracking-widest active:scale-95"
                    >
                        Cancelar
                    </button>
                    <button 
                        onClick={handleConfirm}
                        disabled={!selectedOperatorId}
                        className="flex-1 py-3.5 rounded-lg bg-indigo-600 text-white font-bold text-[10px] hover:bg-indigo-500 transition-all uppercase tracking-widest shadow-lg shadow-indigo-600/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-95"
                    >
                        <span>Confirmar Designação</span>
                        <Check size={14} />
                    </button>
                </div>
            </div>
        </div>
    );
};
