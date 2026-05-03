import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { OperatorProfile, FlightData } from '../types';
import { X, Plus, Trash2, BusFront, User, ArrowLeft, Upload, UserPlus, AlertCircle, Check, Pause, Play, Search } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

interface ShiftOperatorsSectionProps {
    onClose: () => void;
    operators: OperatorProfile[];
    onUpdateOperators: (operators: OperatorProfile[]) => void;
    onOpenCreateModal?: () => void;
    onOpenImportModal?: () => void;
    flights?: FlightData[];
    onUpdateFlights?: (flights: FlightData[]) => void;
}

export const ShiftOperatorsSection: React.FC<ShiftOperatorsSectionProps> = ({ onClose, operators, onUpdateOperators, onOpenCreateModal, onOpenImportModal, flights, onUpdateFlights }) => {
    const { isDarkMode } = useTheme();
    const [activeTab, setActiveTab] = useState<'GERAL' | 'SRV' | 'CTA'>('GERAL');
    const [drafts, setDrafts] = useState<number[]>([]);
    const [searchTerm, setSearchTerm] = useState('');

    const [showOptionsDropdown, setShowOptionsDropdown] = useState(false);
    const optionsMenuRef = useRef<HTMLDivElement>(null);

    const [replaceOperatorModal, setReplaceOperatorModal] = useState<{ isOpen: boolean, operatorId: string, assignedFlights: FlightData[] }>({ isOpen: false, operatorId: '', assignedFlights: [] });
    const [replacementOperatorId, setReplacementOperatorId] = useState<string>('');

    const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
    const [optionsPortalTarget, setOptionsPortalTarget] = useState<HTMLElement | null>(null);
    useEffect(() => {
        setPortalTarget(document.getElementById('subheader-portal-target'));
        setOptionsPortalTarget(document.getElementById('header-options-portal-target'));
    }, []);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (optionsMenuRef.current && !optionsMenuRef.current.contains(event.target as Node)) {
                setShowOptionsDropdown(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    const computeDuration = (pausedAt?: string, resumedAt?: string) => {
        if (!pausedAt || !resumedAt) return '-';
        const [h1, m1] = pausedAt.split(':').map(Number);
        const [h2, m2] = resumedAt.split(':').map(Number);
        let diffMins = (h2 * 60 + m2) - (h1 * 60 + m1);
        if (diffMins < 0) diffMins += 24 * 60;
        const hours = Math.floor(diffMins / 60);
        const mins = diffMins % 60;
        return `${hours.toString()}:${mins.toString().padStart(2,'0')}`;
    };

    const handleTogglePause = (id: string) => {
        const op = operators.find(o => o.id === id);
        if (!op) return;

        if (op.status !== 'INTERVALO' && flights) {
            const isBusy = flights.some(f => 
                (f.status !== 'FINALIZADO' && f.status !== 'CANCELADO') && 
                (f.operator === op.warName || f.supportOperator === op.warName)
            );
            if (isBusy) {
                alert(`O operador ${op.warName} não pode entrar em pausa pois está em atendimento.`);
                return;
            }
        }

        const now = new Date();
        const timeString = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false });
        
        onUpdateOperators(operators.map(o => {
            if (o.id === id) {
                if (o.status === 'INTERVALO') {
                    return { ...o, status: 'DISPONÍVEL', resumedAt: timeString };
                } else {
                    return { ...o, status: 'INTERVALO', pausedAt: timeString, resumedAt: undefined };
                }
            }
            return o;
        }));
    };

    const handleRemove = (id: string) => {
        const op = operators.find(o => o.id === id);
        if (!op) return;

        if (flights && onUpdateFlights) {
            const assignedFlights = flights.filter(f => 
                (f.status === 'DESIGNADO' || f.status === 'ABASTECENDO') && 
                (f.operator === op.warName || f.supportOperator === op.warName)
            );

            if (assignedFlights.length > 0) {
                setReplaceOperatorModal({ isOpen: true, operatorId: id, assignedFlights });
                return;
            }
        }
        
        onUpdateOperators(operators.filter(o => o.id !== id));
    };

    const confirmReplacementAndRemove = () => {
        if (!replaceOperatorModal.operatorId) return;

        const opToRemove = operators.find(o => o.id === replaceOperatorModal.operatorId);
        const replacementOp = operators.find(o => o.id === replacementOperatorId);

        if (flights && onUpdateFlights && opToRemove) {
            onUpdateFlights(flights.map(f => {
                const isAssigned = f.operator === opToRemove.warName;
                const isSupport = f.supportOperator === opToRemove.warName;
                
                if (isAssigned || isSupport) {
                    const newStatus = (!replacementOp && isAssigned && f.status === 'DESIGNADO') ? 'FILA' : f.status;
                    return {
                        ...f,
                        operator: isAssigned ? (replacementOp?.warName || undefined) : f.operator,
                        supportOperator: isSupport ? (replacementOp?.warName || undefined) : f.supportOperator,
                        fleet: isAssigned && replacementOp ? replacementOp.assignedVehicle : f.fleet,
                        vehicleType: isAssigned && replacementOp ? replacementOp.fleetCapability : f.vehicleType,
                        status: newStatus
                    } as FlightData;
                }
                return f;
            }));
        }

        onUpdateOperators(operators.filter(o => o.id !== replaceOperatorModal.operatorId));
        setReplaceOperatorModal({ isOpen: false, operatorId: '', assignedFlights: [] });
        setReplacementOperatorId('');
    };

    const handleUpdateOperator = (id: string, field: keyof OperatorProfile, value: any) => {
        onUpdateOperators(operators.map(op => {
            if (op.id === id) {
                const updated = { ...op, [field]: value };
                // Se removeu a frota, limpa o tipo também
                if (field === 'assignedVehicle' && !value) {
                    updated.fleetCapability = undefined;
                }
                // Se adicionou frota e não tinha tipo, define SRV como padrão
                if (field === 'assignedVehicle' && value && !op.fleetCapability) {
                    updated.fleetCapability = 'SRV';
                }
                return updated;
            }
            return op;
        }));
    };

    const filteredOperators = operators.filter(op => {
        if (!searchTerm) return true;
        const lowerTerm = searchTerm.toLowerCase();
        return (
            op.warName.toLowerCase().includes(lowerTerm) ||
            (op.assignedVehicle && op.assignedVehicle.toLowerCase().includes(lowerTerm)) ||
            (op.fleetCapability && op.fleetCapability.toLowerCase().includes(lowerTerm))
        );
    });

    const srvOperators = filteredOperators.filter(op => op.fleetCapability !== 'CTA');
    const ctaOperators = filteredOperators.filter(op => op.fleetCapability === 'CTA');

    const renderOperatorRow = (op: OperatorProfile) => {
        const isCTA = op.fleetCapability === 'CTA';
        const isPaused = op.status === 'INTERVALO';
        const isBusy = (!isPaused && flights) ? flights.some(f => 
            (f.status !== 'FINALIZADO' && f.status !== 'CANCELADO') && 
            (f.operator === op.warName || f.supportOperator === op.warName)
        ) : false;
        
        const pauseDuration = (op.pausedAt && op.resumedAt) ? computeDuration(op.pausedAt, op.resumedAt) : '-';
        const bgClass = isPaused 
            ? (isDarkMode ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-100/50 border-slate-200 opacity-60')
            : isCTA 
                ? (isDarkMode ? 'bg-yellow-950/10 border-yellow-900/20' : 'bg-yellow-50/50 border-yellow-200/50')
                : (isDarkMode ? 'bg-emerald-950/10 border-emerald-900/20' : 'bg-emerald-50/50 border-emerald-200/50');
        
        return (
            <div key={op.id} className={`flex items-center gap-4 py-2 px-4 border-b transition-colors group ${bgClass} ${isDarkMode ? 'border-slate-800/50 hover:bg-slate-800/80' : 'border-slate-200/50 hover:bg-slate-50'}`}>
                <div className="w-56 flex items-center gap-4 shrink-0">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs border shrink-0 shadow-sm ${
                        isCTA 
                        ? (isDarkMode ? 'bg-yellow-900/50 text-yellow-400 border-yellow-800' : 'bg-white text-yellow-700 border-yellow-400')
                        : (isDarkMode ? 'bg-emerald-900/50 text-emerald-400 border-emerald-800' : 'bg-white text-emerald-700 border-emerald-400')
                    }`}>
                        {op.warName.charAt(0)}
                    </div>
                    <div className={`font-bold text-sm uppercase tracking-tight truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                        {op.warName}
                    </div>
                </div>
                
                <div className="w-32 flex gap-1 justify-center shrink-0">
                    {['SRV', 'CTA'].map((type) => (
                        <button
                            key={type}
                            onClick={() => handleUpdateOperator(op.id, 'fleetCapability', type)}
                            className={`flex-1 text-[10px] font-bold rounded border py-1.5 transition-all shadow-sm ${
                                op.fleetCapability === type 
                                ? (type === 'CTA' ? 'bg-yellow-600 border-yellow-600 text-white' : 'bg-emerald-600 border-emerald-600 text-white')
                                : isDarkMode
                                    ? 'bg-slate-800/50 border-slate-700 text-slate-500 hover:text-white'
                                    : 'bg-white border-slate-300 text-slate-400 hover:text-slate-700'
                            }`}
                        >
                            {type}
                        </button>
                    ))}
                </div>

                <div className="w-16 shrink-0">
                    <input 
                        type="text"
                        value={op.assignedVehicle || ''}
                        onChange={(e) => handleUpdateOperator(op.id, 'assignedVehicle', e.target.value.toUpperCase())}
                        placeholder="FROTA"
                        className={`w-full border text-xs px-2 py-1.5 rounded-md font-mono font-bold outline-none focus:ring-2 text-center uppercase shadow-sm ${
                            isCTA ? 'focus:ring-yellow-500/20 focus:border-yellow-500' : 'focus:ring-emerald-500/20 focus:border-emerald-500'
                        } ${
                            isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                        } ${isPaused ? 'opacity-50 pointer-events-none' : ''}`}
                        disabled={isPaused}
                    />
                </div>

                <div className="w-20 shrink-0 text-center font-mono font-bold text-xs text-slate-500">{op.pausedAt || '-'}</div>
                <div className="w-20 shrink-0 text-center font-mono font-bold text-xs text-slate-500">{op.resumedAt || '-'}</div>
                <div className="w-16 shrink-0 text-center font-mono font-bold text-xs text-slate-500" title="Tempo de pausa">{pauseDuration}</div>

                <div className="flex items-center justify-end w-24 shrink-0 gap-1">
                    <button 
                        onClick={() => handleTogglePause(op.id)}
                        disabled={isBusy}
                        className={`p-2 rounded transition-colors ${
                            isPaused 
                            ? (isDarkMode ? 'text-emerald-400 hover:bg-emerald-500/20' : 'text-emerald-500 hover:bg-emerald-100')
                            : (isBusy 
                                ? (isDarkMode ? 'text-slate-600 cursor-not-allowed' : 'text-slate-300 cursor-not-allowed') 
                                : (isDarkMode ? 'text-amber-500 hover:bg-amber-500/20' : 'text-amber-500 hover:bg-amber-100'))
                        }`}
                        title={isBusy ? "Operador em atendimento. Não é possível pausar." : (isPaused ? "Retornar operador" : "Pausar operador")}
                    >
                        {isPaused ? <Play size={16} /> : <Pause size={16} />}
                    </button>
                    <button 
                        onClick={() => handleRemove(op.id)}
                        className={`p-2 rounded transition-colors ${
                            isDarkMode ? 'text-slate-500 hover:text-red-400 hover:bg-red-500/10' : 'text-slate-400 hover:text-red-500 hover:bg-red-50'
                        }`}
                        title="Remover Operador"
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
                <div className="flex-1"></div>
            </div>
        );
    };

    const DraftOperatorRow = ({ id, onRemove }: { id: number, onRemove: (id: number) => void }) => {
        const [name, setName] = useState('');
        const [fleet, setFleet] = useState('');
        const [fleetType, setFleetType] = useState<'SRV'|'CTA'|''>('');

        const handleSave = () => {
            if (!name.trim() || !fleet.trim() || !fleetType) return;
            const newOperator: OperatorProfile = {
                id: `op_${Date.now()}_${Math.random()}`,
                fullName: name.toUpperCase(),
                warName: name.toUpperCase(),
                companyId: '',
                gruId: '',
                vestNumber: '',
                photoUrl: '',
                status: 'DISPONÍVEL',
                category: 'AERODROMO',
                lastPosition: '',
                assignedVehicle: fleet.toUpperCase(),
                fleetCapability: fleetType,
                shift: { cycle: 'GERAL', start: '00:00', end: '23:59' },
                airlines: [],
                ratings: { speed: 5, safety: 5, airlineSpecific: {} },
                expertise: { servidor: 50, cta: 50 },
                stats: { flightsWeekly: 0, flightsMonthly: 0, volumeWeekly: 0, volumeMonthly: 0 }
            };
            onUpdateOperators([...operators, newOperator]);
            onRemove(id);
        };

        const handleKeyDown = (e: React.KeyboardEvent) => {
            if (e.key === 'Enter') {
                handleSave();
            }
        };

        return (
            <div className={`flex items-center gap-4 py-2 px-4 border-b transition-colors ${isDarkMode ? 'border-slate-800 bg-slate-900/30' : 'border-slate-200 bg-slate-50/50'}`}>
                <div className="w-56 flex items-center gap-4 shrink-0">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                        <User size={14} className={isDarkMode ? 'text-slate-500' : 'text-slate-400'} />
                    </div>
                    <input 
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value.toUpperCase())}
                        onKeyDown={handleKeyDown}
                        placeholder="NOVO OPERADOR"
                        className={`flex-1 min-w-0 border text-xs px-3 py-1.5 rounded-md font-mono font-bold outline-none focus:ring-2 focus:ring-emerald-500/20 uppercase shadow-sm ${
                            isDarkMode ? 'bg-slate-950 border-slate-700 text-white placeholder:text-slate-600' : 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400'
                        }`}
                    />
                </div>
                
                <div className="w-32 flex gap-1 justify-center shrink-0">
                    {['SRV', 'CTA'].map((type) => (
                        <button
                            key={type}
                            onClick={() => setFleetType(type as 'SRV'|'CTA')}
                            className={`flex-1 text-[10px] font-bold rounded border py-1.5 transition-all shadow-sm ${
                                fleetType === type 
                                ? (type === 'CTA' ? 'bg-yellow-600 border-yellow-600 text-white' : 'bg-emerald-600 border-emerald-600 text-white')
                                : isDarkMode
                                    ? 'bg-slate-800/50 border-slate-700 text-slate-500 hover:text-white'
                                    : 'bg-white border-slate-300 text-slate-400 hover:text-slate-700'
                            }`}
                        >
                            {type}
                        </button>
                    ))}
                </div>

                <div className="w-16 shrink-0">
                    <input 
                        type="text"
                        value={fleet}
                        onChange={(e) => setFleet(e.target.value.toUpperCase())}
                        onKeyDown={handleKeyDown}
                        placeholder="FROTA"
                        className={`w-full border text-xs px-2 py-1.5 rounded-md font-mono font-bold outline-none focus:ring-2 text-center uppercase shadow-sm ${
                            isDarkMode ? 'bg-slate-950 border-slate-700 text-white placeholder:text-slate-600' : 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400'
                        }`}
                    />
                </div>

                <div className="w-20 shrink-0 text-center font-mono font-bold text-xs text-slate-500">-</div>
                <div className="w-20 shrink-0 text-center font-mono font-bold text-xs text-slate-500">-</div>
                <div className="w-16 shrink-0 text-center font-mono font-bold text-xs text-slate-500">-</div>

                <div className="flex items-center gap-1 w-24 justify-end shrink-0">
                    <button 
                        onClick={handleSave}
                        disabled={!name.trim() || !fleet.trim() || !fleetType}
                        className="p-2 rounded bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50 transition-colors shadow-sm"
                        title="Salvar"
                    >
                        <Check size={16} />
                    </button>
                    {drafts.length > 1 && (
                        <button 
                            onClick={() => onRemove(id)}
                            className={`p-2 rounded transition-colors ${
                                isDarkMode ? 'text-slate-500 hover:text-red-400 hover:bg-red-500/10' : 'text-slate-400 hover:text-red-500 hover:bg-red-50'
                            }`}
                            title="Remover linha"
                        >
                            <Trash2 size={16} />
                        </button>
                    )}
                </div>
                <div className="flex-1"></div>
            </div>
        )
    };

    const renderOperatorCard = (op: OperatorProfile) => {
        const isCTA = op.fleetCapability === 'CTA';
        
        const bgClass = isCTA 
            ? (isDarkMode ? 'bg-yellow-950/20 border-yellow-900/50 hover:border-yellow-500/50' : 'bg-yellow-100 border-yellow-300 hover:border-yellow-400')
            : (isDarkMode ? 'bg-emerald-950/20 border-emerald-900/50 hover:border-emerald-500/50' : 'bg-emerald-100 border-emerald-300 hover:border-emerald-400');

        return (
            <div key={op.id} className={`flex items-center justify-between pl-2 py-1.5 h-[42px] w-full rounded-lg border transition-colors group shadow-sm ${bgClass}`}>
                <div className="flex items-center gap-2 overflow-hidden">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] border shrink-0 ${
                        isCTA 
                        ? (isDarkMode ? 'bg-yellow-900/50 text-yellow-400 border-yellow-800' : 'bg-white text-yellow-700 border-yellow-400')
                        : (isDarkMode ? 'bg-emerald-900/50 text-emerald-400 border-emerald-800' : 'bg-white text-emerald-700 border-emerald-400')
                    }`}>
                        {op.warName.charAt(0)}
                    </div>
                    <div className={`font-bold text-xs uppercase tracking-tight truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                        {op.warName}
                    </div>
                </div>
                
                <div className="flex items-center gap-1.5 shrink-0 pr-1">
                    <div className="relative w-16">
                        <input 
                            type="text"
                            value={op.assignedVehicle || ''}
                            onChange={(e) => handleUpdateOperator(op.id, 'assignedVehicle', e.target.value.toUpperCase())}
                            placeholder="FROTA"
                            className={`w-full pl-[6px] py-[3px] text-[10px] font-mono font-bold rounded shadow-sm focus:ring-2 outline-none uppercase text-center transition-all ${
                                isCTA
                                ? 'focus:ring-yellow-500/20 focus:border-yellow-500'
                                : 'focus:ring-emerald-500/20 focus:border-emerald-500'
                            } ${
                                isDarkMode 
                                ? 'bg-slate-800/80 border-slate-700 text-white placeholder:text-slate-500' 
                                : 'bg-white border-slate-200 text-slate-700 placeholder:text-slate-400'
                            }`}
                        />
                    </div>
                    {op.assignedVehicle && (
                        <button
                            onClick={() => handleUpdateOperator(op.id, 'fleetCapability', isCTA ? 'SRV' : 'CTA')}
                            className={`text-[9px] font-black px-1.5 py-0.5 rounded border shadow-sm transition-colors shrink-0 ${
                                isCTA 
                                ? isDarkMode 
                                    ? 'bg-yellow-900/50 border-yellow-700/50 text-yellow-400 hover:bg-yellow-800'
                                    : 'bg-yellow-200 border-yellow-400 text-yellow-800 hover:bg-yellow-300' 
                                : isDarkMode
                                    ? 'bg-emerald-900/50 border-emerald-700/50 text-emerald-400 hover:bg-emerald-800'
                                    : 'bg-emerald-200 border-emerald-400 text-emerald-800 hover:bg-emerald-300'
                            }`}
                            title="Clique para alternar entre SRV e CTA"
                        >
                            {op.fleetCapability || 'SRV'}
                        </button>
                    )}
                    <button 
                        onClick={() => handleRemove(op.id)}
                        className={`p-1 rounded transition-colors shrink-0 ml-0.5 ${
                            isDarkMode 
                            ? 'text-slate-500 hover:text-red-400 hover:bg-red-500/10' 
                            : 'text-slate-400 hover:text-red-500 hover:bg-red-50'
                        }`}
                    >
                        <Trash2 size={12} />
                    </button>
                </div>
            </div>
        );
    };

    const headerContent = (
        <div className={`px-6 h-16 shrink-0 flex items-center justify-between border-b ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-[#3CA317] border-transparent text-white'} z-[60] w-full`}>
            <div className="flex items-center gap-6">
                <button 
                    onClick={onClose} 
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md font-bold text-[11px] uppercase tracking-wider transition-colors ${
                        isDarkMode 
                        ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' 
                        : 'bg-white/20 hover:bg-white/30 text-white'
                    }`}
                >
                    <ArrowLeft size={14} />
                    Voltar
                </button>
                <div className="flex items-center gap-3 ml-2 border-l pl-4 border-white/20 dark:border-slate-700">
                    <div>
                        <h2 className="text-sm font-black text-white tracking-tighter uppercase leading-none">
                            Operadores do Turno
                        </h2>
                    </div>
                </div>
            </div>

            <div className="flex-1 flex justify-end mr-4">
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border w-64 transition-all ${
                    isDarkMode 
                    ? 'bg-slate-900 border-slate-700 text-slate-300 focus-within:border-emerald-500/50 focus-within:ring-1 focus-within:ring-emerald-500/50' 
                    : 'bg-white/20 border-white/20 text-white focus-within:bg-white/30'
                }`}>
                    <Search size={14} className="opacity-50 shrink-0" />
                    <input 
                        type="text" 
                        placeholder="Buscar operador, frota..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="bg-transparent border-none outline-none text-xs font-bold uppercase w-full placeholder:text-inherit placeholder:opacity-50"
                    />
                    {searchTerm && (
                        <button onClick={() => setSearchTerm('')} className="opacity-50 hover:opacity-100 transition-opacity">
                            <X size={14} />
                        </button>
                    )}
                </div>
            </div>

            <div className="flex items-center gap-3">
            </div>
        </div>
    );

    return (
        <div className={`w-full h-full flex flex-col ${isDarkMode ? 'bg-slate-950' : 'bg-slate-50'} animate-in fade-in duration-200`}>
            {portalTarget ? createPortal(headerContent, portalTarget) : headerContent}

            {replaceOperatorModal.isOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className={`${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'} border rounded-2xl shadow-2xl w-full max-w-md overflow-hidden`}>
                        <div className={`px-6 py-4 border-b flex items-center gap-3 ${isDarkMode ? 'border-slate-800 bg-red-900/20' : 'border-slate-100 bg-red-50'}`}>
                            <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
                                <AlertCircle size={20} className="text-red-500" />
                            </div>
                            <div>
                                <h3 className={`font-black uppercase tracking-tight text-lg leading-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                                    Operador Designado
                                </h3>
                                <p className={`text-xs font-medium mt-0.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                                    A ação não pode ser permitida. Este operador está em atendimento.
                                </p>
                            </div>
                        </div>
                        
                        <div className="p-6 space-y-6">
                            <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                                <h4 className={`text-xs font-bold uppercase tracking-wider mb-3 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                                    Voos Impactados ({replaceOperatorModal.assignedFlights.length})
                                </h4>
                                <div className="space-y-2 max-h-32 overflow-y-auto pr-2 custom-scrollbar">
                                    {replaceOperatorModal.assignedFlights.map(f => (
                                        <div key={f.id} className={`flex items-center justify-between text-sm p-2 rounded-lg ${isDarkMode ? 'bg-slate-900' : 'bg-white'}`}>
                                            <div className="flex items-center gap-2">
                                                <span className={`font-black ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{f.airlineCode} {f.flightNumber}</span>
                                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${f.status === 'ABASTECENDO' ? 'bg-blue-500/20 text-blue-400' : 'bg-emerald-500/20 text-emerald-500'}`}>{f.status}</span>
                                            </div>
                                            <span className={`font-mono text-xs font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>ETD {f.etd}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <h4 className={`text-xs font-bold uppercase tracking-wider mb-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                                    Propor Substituição
                                </h4>
                                <select 
                                    value={replacementOperatorId}
                                    onChange={e => setReplacementOperatorId(e.target.value)}
                                    className={`w-full border px-4 py-3 rounded-xl font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all ${
                                        isDarkMode 
                                        ? 'bg-slate-800 border-slate-700 text-white' 
                                        : 'bg-white border-slate-300 text-slate-900'
                                    }`}
                                >
                                    <option value="">Nenhuma (Devolver voos para fila)</option>
                                    {operators.filter(o => o.id !== replaceOperatorModal.operatorId && o.assignedVehicle).map(op => (
                                        <option key={op.id} value={op.id}>{op.warName} - {op.assignedVehicle} ({op.fleetCapability || 'SRV'})</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className={`px-6 py-4 border-t flex justify-end gap-3 ${isDarkMode ? 'border-slate-800 bg-slate-900' : 'border-slate-100 bg-slate-50'}`}>
                            <button
                                onClick={() => {
                                    setReplaceOperatorModal({ isOpen: false, operatorId: '', assignedFlights: [] });
                                    setReplacementOperatorId('');
                                }}
                                className={`px-5 py-2.5 rounded-xl font-bold uppercase tracking-wider text-xs transition-colors ${
                                    isDarkMode 
                                    ? 'hover:bg-slate-800 text-slate-300' 
                                    : 'hover:bg-slate-200 text-slate-600'
                                }`}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={confirmReplacementAndRemove}
                                className="px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold uppercase tracking-wider text-xs shadow-lg shadow-red-500/20 transition-colors"
                            >
                                Substituir e Remover
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className={`w-full shrink-0 border-b ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                <div className="flex w-full px-6">
                    <button
                        onClick={() => setActiveTab('GERAL')}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 border-b-2 transition-colors ${
                            activeTab === 'GERAL'
                            ? (isDarkMode ? 'border-indigo-500 text-indigo-400' : 'border-indigo-600 text-indigo-700')
                            : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                        }`}
                    >
                        <div className={`w-2 h-2 rounded-full ${activeTab === 'GERAL' ? 'bg-indigo-500' : 'bg-slate-400'}`}></div>
                        <span className="font-bold uppercase tracking-wider text-sm">Todos (Geral)</span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-md ml-2 ${
                            activeTab === 'GERAL'
                            ? (isDarkMode ? 'bg-indigo-900/50 text-indigo-400' : 'bg-indigo-100 text-indigo-700')
                            : (isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500')
                        }`}>
                            {filteredOperators.length}
                        </span>
                    </button>
                    <button
                        onClick={() => setActiveTab('SRV')}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 border-b-2 transition-colors ${
                            activeTab === 'SRV'
                            ? (isDarkMode ? 'border-emerald-500 text-emerald-400' : 'border-emerald-600 text-emerald-700')
                            : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                        }`}
                    >
                        <div className={`w-2 h-2 rounded-full ${activeTab === 'SRV' ? 'bg-emerald-500' : 'bg-slate-400'}`}></div>
                        <span className="font-bold uppercase tracking-wider text-sm">Servidores (SRV)</span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-md ml-2 ${
                            activeTab === 'SRV'
                            ? (isDarkMode ? 'bg-emerald-900/50 text-emerald-400' : 'bg-emerald-100 text-emerald-700')
                            : (isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500')
                        }`}>
                            {srvOperators.length}
                        </span>
                    </button>
                    <button
                        onClick={() => setActiveTab('CTA')}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 border-b-2 transition-colors ${
                            activeTab === 'CTA'
                            ? (isDarkMode ? 'border-yellow-500 text-yellow-400' : 'border-yellow-600 text-yellow-700')
                            : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                        }`}
                    >
                        <div className={`w-2 h-2 rounded-full ${activeTab === 'CTA' ? 'bg-yellow-500' : 'bg-slate-400'}`}></div>
                        <span className="font-bold uppercase tracking-wider text-sm">Caminhões Tanque (CTA)</span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-md ml-2 ${
                            activeTab === 'CTA'
                            ? (isDarkMode ? 'bg-yellow-900/50 text-yellow-400' : 'bg-yellow-100 text-yellow-700')
                            : (isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500')
                        }`}>
                            {ctaOperators.length}
                        </span>
                    </button>
                </div>
            </div>

            <div className={`flex-1 overflow-y-auto ${activeTab === 'GERAL' ? 'p-0' : 'p-6 pt-4'}`}>
                <div className="w-full h-full flex flex-col">
                    {activeTab === 'GERAL' && (
                        <div className="w-full flex-1 flex flex-col min-h-0 bg-transparent">
                            <div className={`flex items-center gap-4 py-2 px-4 shadow-[0_4px_10px_rgba(0,0,0,0.05)] border-b text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-500'}`}>
                                <div className="w-56 px-11 shrink-0">OPERADOR</div>
                                <div className="w-32 shrink-0 text-center">TIPO EQUIP.</div>
                                <div className="w-16 shrink-0 text-center">FROTA</div>
                                <div className="w-20 shrink-0 text-center">PAUSA</div>
                                <div className="w-20 shrink-0 text-center">RETORNO</div>
                                <div className="w-16 shrink-0 text-center">TEMPO</div>
                                <div className="w-24 shrink-0 text-right pr-[5px]">AÇÕES</div>
                                <div className="flex-1"></div>
                            </div>
                            
                            <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 custom-scrollbar">
                                {filteredOperators.map(op => renderOperatorRow(op))}
                                {drafts.map(id => (
                                    <DraftOperatorRow 
                                        key={id} 
                                        id={id} 
                                        onRemove={(removeId) => setDrafts(prev => prev.filter(d => d !== removeId))} 
                                    />
                                ))}

                                <div className={`py-3 px-4 flex justify-start border-t ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
                                    <button 
                                        onClick={() => setDrafts([...drafts, Date.now()])}
                                        className={`flex items-center justify-center px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all shadow-sm active:scale-95 border ${
                                            isDarkMode 
                                            ? 'bg-[#FEDC00] text-[#4e4141] border-[#FEDC00] hover:bg-[#e5c600]' 
                                            : 'bg-[#FEDC00] text-[#4e4141] border-[#FEDC00] hover:bg-[#e5c600]'
                                        }`}
                                    >
                                        + OPERADOR/FROTA
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {(activeTab === 'SRV' || activeTab === 'CTA') && (
                        <div className="flex flex-wrap gap-2 content-start w-full">
                            {activeTab === 'SRV' && (
                                srvOperators.length > 0 ? srvOperators.map(op => (
                                    <div key={op.id} className="w-full sm:w-[240px]">
                                        {renderOperatorCard(op)}
                                    </div>
                                )) : (
                                    <div className="w-full text-center py-8 text-slate-400 font-bold uppercase tracking-widest text-xs">
                                        Nenhum operador SRV
                                    </div>
                                )
                            )}
                            {activeTab === 'CTA' && (
                                ctaOperators.length > 0 ? ctaOperators.map(op => (
                                    <div key={op.id} className="w-full sm:w-[240px]">
                                        {renderOperatorCard(op)}
                                    </div>
                                )) : (
                                    <div className="w-full text-center py-8 text-slate-400 font-bold uppercase tracking-widest text-xs">
                                        Nenhum operador CTA
                                    </div>
                                )
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
