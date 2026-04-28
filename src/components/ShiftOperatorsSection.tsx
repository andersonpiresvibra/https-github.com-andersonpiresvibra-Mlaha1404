import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { OperatorProfile } from '../types';
import { X, Plus, Trash2, BusFront, User, ArrowLeft, Upload, UserPlus } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

interface ShiftOperatorsSectionProps {
    onClose: () => void;
    operators: OperatorProfile[];
    onUpdateOperators: (operators: OperatorProfile[]) => void;
    onOpenCreateModal?: () => void;
    onOpenImportModal?: () => void;
}

export const ShiftOperatorsSection: React.FC<ShiftOperatorsSectionProps> = ({ onClose, operators, onUpdateOperators, onOpenCreateModal, onOpenImportModal }) => {
    const { isDarkMode } = useTheme();
    const [nameInput, setNameInput] = useState('');
    const [fleetInput, setFleetInput] = useState('');
    const [fleetTypeInput, setFleetTypeInput] = useState<'SRV' | 'CTA' | ''>('');
    const [activeTab, setActiveTab] = useState<'GERAL' | 'SRV' | 'CTA'>('GERAL');

    const [showOptionsDropdown, setShowOptionsDropdown] = useState(false);
    const optionsMenuRef = useRef<HTMLDivElement>(null);

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

    const handleAdd = () => {
        if (!nameInput.trim() || !fleetInput.trim() || !fleetTypeInput) return;

        const newOperator: OperatorProfile = {
            id: `op_${Date.now()}`,
            fullName: nameInput,
            warName: nameInput,
            companyId: '',
            gruId: '',
            vestNumber: '',
            photoUrl: '',
            status: 'DISPONÍVEL',
            category: 'AERODROMO',
            lastPosition: '',
            assignedVehicle: fleetInput || undefined,
            fleetCapability: fleetTypeInput || undefined,
            shift: { cycle: 'GERAL', start: '00:00', end: '23:59' },
            airlines: [],
            ratings: { speed: 5, safety: 5, airlineSpecific: {} },
            expertise: { servidor: 50, cta: 50 },
            stats: { flightsWeekly: 0, flightsMonthly: 0, volumeWeekly: 0, volumeMonthly: 0 }
        };

        onUpdateOperators([...operators, newOperator]);
        setNameInput('');
        setFleetInput('');
        setFleetTypeInput('');
    };

    const handleRemove = (id: string) => {
        onUpdateOperators(operators.filter(op => op.id !== id));
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

    const srvOperators = operators.filter(op => op.fleetCapability !== 'CTA');
    const ctaOperators = operators.filter(op => op.fleetCapability === 'CTA');

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
        <div className={`px-6 h-16 shrink-0 flex items-center justify-between border-b ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-[#2C864C] border-white/10'} z-[60] w-full`}>
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

            <div className="flex items-center gap-3">
                <div className="w-56">
                    <input 
                        type="text"
                        value={nameInput}
                        onChange={e => setNameInput(e.target.value)}
                        placeholder="OPERADOR"
                        className={`w-full border text-sm px-4 py-[5px] h-[33px] rounded-lg font-mono outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all uppercase ${
                            isDarkMode 
                            ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-500' 
                            : 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400'
                        }`}
                    />
                </div>
                <div className="w-20">
                    <input 
                        type="text"
                        value={fleetInput}
                        onChange={e => setFleetInput(e.target.value)}
                        placeholder="FROTA"
                        className={`w-full border text-sm px-3 py-[5px] h-[33px] rounded-lg font-mono outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all uppercase text-center ${
                            isDarkMode 
                            ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-500' 
                            : 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400'
                        }`}
                    />
                </div>
                <div className="w-32 flex gap-1">
                    {['SRV', 'CTA'].map((type) => (
                        <button
                            key={type}
                            type="button"
                            onClick={() => setFleetTypeInput(type as 'SRV' | 'CTA')}
                            className={`flex-1 text-[11px] font-bold rounded-lg border transition-all h-[33px] ${
                                fleetTypeInput === type 
                                ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm' 
                                : isDarkMode
                                    ? 'bg-slate-800 border-slate-700 text-slate-400 hover:border-emerald-500/50 hover:text-emerald-400'
                                    : 'bg-white border-slate-300 text-slate-500 hover:border-emerald-300 hover:text-emerald-600'
                            }`}
                        >
                            {type}
                        </button>
                    ))}
                </div>
                <button 
                    onClick={handleAdd}
                    disabled={!nameInput.trim() || !fleetInput.trim() || !fleetTypeInput}
                    className="h-[33px] px-4 bg-[#FEDC00] hover:bg-[#e5c600] disabled:opacity-40 disabled:cursor-not-allowed text-[#4e4141] rounded-lg font-bold text-[11px] uppercase tracking-wider transition-colors flex items-center gap-2"
                >
                    <Plus size={16} /> Adicionar
                </button>
            </div>
        </div>
    );

    const optionsDropdownContent = (
        <div className="relative z-[100]" ref={optionsMenuRef}>
            <button 
                onClick={() => setShowOptionsDropdown(!showOptionsDropdown)}
                className={`flex items-center gap-2 px-6 py-2 rounded-md border border-[#FEDC00] transition-all font-bold uppercase tracking-wider text-[11px] bg-[#FEDC00] text-[#4e4141] hover:bg-[#e5c600] shadow-sm btn-options-subheader`}
            >
                <span>Opções</span>
            </button>

            {showOptionsDropdown && (
                <div className={`absolute right-0 top-10 w-56 ${isDarkMode ? 'bg-slate-900 border-emerald-500/30' : 'bg-white border-emerald-500/30'} border-[0.5px] rounded-2xl shadow-2xl z-[100] overflow-hidden animate-in fade-in slide-in-from-top-2`}>
                    <div className="p-2 space-y-1">
                        <button 
                            onClick={() => {
                                if (onOpenCreateModal) onOpenCreateModal();
                                setShowOptionsDropdown(false);
                            }}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all ${isDarkMode ? 'text-slate-300 hover:bg-indigo-500/10 hover:text-indigo-400' : 'text-slate-600 hover:bg-indigo-50 hover:text-indigo-600'}`}
                        >
                            <Plus size={16} />
                            Criar Voo
                        </button>
                        <button 
                            onClick={() => {
                                if (onOpenImportModal) onOpenImportModal();
                                setShowOptionsDropdown(false);
                            }}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all ${isDarkMode ? 'text-slate-300 hover:bg-emerald-500/10 hover:text-emerald-400' : 'text-slate-600 hover:bg-emerald-50 hover:text-emerald-600'}`}
                        >
                            <Upload size={16} />
                            Importar
                        </button>
                        <button 
                            disabled
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all ${isDarkMode ? 'text-slate-600 bg-slate-800/50' : 'text-slate-400 bg-slate-100'} cursor-not-allowed`}
                        >
                            <UserPlus size={16} />
                            Operadores do Turno
                        </button>
                    </div>
                </div>
            )}
        </div>
    );

    return (
        <div className={`w-full h-full flex flex-col ${isDarkMode ? 'bg-slate-950' : 'bg-slate-50'} animate-in fade-in duration-200`}>
            {portalTarget ? createPortal(headerContent, portalTarget) : headerContent}
            {optionsPortalTarget ? createPortal(optionsDropdownContent, optionsPortalTarget) : null}

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
                            {operators.length}
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

            <div className="flex-1 overflow-y-auto p-6 pt-4">
                <div className="w-full">
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-2 content-start">
                        {activeTab === 'GERAL' && (
                            operators.length > 0 ? operators.map(renderOperatorCard) : (
                                <div className="col-span-full text-center py-8 text-slate-400 font-bold uppercase tracking-widest text-xs">
                                    Nenhum operador
                                </div>
                            )
                        )}
                        {activeTab === 'SRV' && (
                            srvOperators.length > 0 ? srvOperators.map(renderOperatorCard) : (
                                <div className="col-span-full text-center py-8 text-slate-400 font-bold uppercase tracking-widest text-xs">
                                    Nenhum operador SRV
                                </div>
                            )
                        )}
                        {activeTab === 'CTA' && (
                            ctaOperators.length > 0 ? ctaOperators.map(renderOperatorCard) : (
                                <div className="col-span-full text-center py-8 text-slate-400 font-bold uppercase tracking-widest text-xs">
                                    Nenhum operador CTA
                                </div>
                            )
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
