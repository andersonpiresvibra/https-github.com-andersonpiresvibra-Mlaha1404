import React, { useState, useRef, useEffect } from 'react';
import { X, Save, Plane, Send, Search, Edit2, Trash2, Play, ClipboardList, Plus, Ban, AlertCircle, MoreVertical } from 'lucide-react';
import { MeshFlight, INITIAL_MESH_FLIGHTS } from '../data/operationalMesh';
import { FlightData, FlightStatus } from '../types';

interface OperationalMeshProps {
  onClose: () => void;
  onActivateMesh: (flights: FlightData[]) => void;
  isDarkMode: boolean;
  meshFlights: MeshFlight[];
  setMeshFlights: React.Dispatch<React.SetStateAction<MeshFlight[]>>;
}

type MeshField = keyof MeshFlight | 'actions';

const COLUMNS: { key: MeshField; label: string; width: string; isVariable: boolean }[] = [
  { key: 'airline', label: 'Cia', width: 'w-24', isVariable: false },
  { key: 'departureFlightNumber', label: 'Voo', width: 'w-24', isVariable: false },
  { key: 'destination', label: 'Destino', width: 'w-24', isVariable: false },
  { key: 'etd', label: 'ETD', width: 'w-20', isVariable: false },
  { key: 'registration', label: 'Prefixo', width: 'w-28', isVariable: true },
  { key: 'model', label: 'Modelo', width: 'w-24', isVariable: true },
  { key: 'eta', label: 'ETA', width: 'w-24', isVariable: true },
  { key: 'positionId', label: 'Posição', width: 'w-20', isVariable: true },
  { key: 'actualArrivalTime', label: 'Calço', width: 'w-24', isVariable: true },
  { key: 'actions', label: 'Ações', width: 'w-14', isVariable: false },
];

export const OperationalMesh: React.FC<OperationalMeshProps> = ({ onClose, onActivateMesh, isDarkMode, meshFlights, setMeshFlights }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [focusedCell, setFocusedCell] = useState<{ row: number; col: number } | null>(null);
  const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const [flightActionMenu, setFlightActionMenu] = useState<string | null>(null);

  const handleFieldChange = (id: string, field: MeshField, value: string) => {
    if (field === 'actions') return;
    setMeshFlights(prev => prev.map(flight => 
      flight.id === id ? { ...flight, [field]: value } : flight
    ));
  };

  const handleAddFlight = () => {
    const newFlight: MeshFlight = {
      id: `new-${Date.now()}`,
      airline: '',
      airlineCode: '',
      departureFlightNumber: '',
      destination: '',
      etd: '',
      registration: '',
      eta: '',
      positionId: '',
      actualArrivalTime: '',
      model: '',
      isNew: true
    };
    setMeshFlights(prev => [newFlight, ...prev]);
    setFocusedCell({ row: 0, col: 0 });
  };

  const handleDeleteFlight = (id: string) => {
    setMeshFlights(prev => prev.filter(f => f.id !== id));
    setFocusedCell(null);
    setFlightActionMenu(null);
  };

  const handleToggleDisable = (id: string) => {
    setMeshFlights(prev => prev.map(f => 
      f.id === id ? { ...f, disabled: !f.disabled } : f
    ));
    setFlightActionMenu(null);
  };

  const handleActivate = () => {
    // Validation for new/incomplete flights
    const incompleteFlight = meshFlights.find(f => 
      f.isNew && (!f.airline || !f.departureFlightNumber || !f.destination || !f.etd)
    );

    if (incompleteFlight) {
        alert('Por favor, preencha os dados básicos do voo (Cia, Voo, Destino e ETD) antes de sincronizar.');
        return;
    }

    const activeFlights = meshFlights.filter(f => !f.disabled);

    const newFlights: FlightData[] = activeFlights.map(mesh => ({
      id: `mesh-${Date.now()}-${mesh.id}`,
      airline: mesh.airline,
      airlineCode: mesh.airlineCode,
      registration: mesh.registration.toUpperCase(),
      model: mesh.model.toUpperCase(),
      flightNumber: '', 
      eta: mesh.eta,
      departureFlightNumber: mesh.departureFlightNumber.toUpperCase(),
      destination: mesh.destination.toUpperCase(),
      positionId: mesh.positionId,
      etd: mesh.etd,
      origin: 'SBGL', 
      fuelStatus: 0,
      status: FlightStatus.CHEGADA,
      logs: [{
        id: Date.now().toString(),
        timestamp: new Date(),
        type: 'SISTEMA',
        message: 'Voo carregado da malha operacional.',
        author: 'SISTEMA'
      }],
      messages: [],
      actualArrivalTime: mesh.actualArrivalTime
    }));

    onActivateMesh(newFlights);
    onClose();
  };

  const filteredFlights = meshFlights.filter(f => 
    f.departureFlightNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    f.destination.toLowerCase().includes(searchTerm.toLowerCase()) ||
    f.airline.toLowerCase().includes(searchTerm.toLowerCase()) ||
    f.airlineCode.toLowerCase().includes(searchTerm.toLowerCase())
  ).sort((a, b) => {
    if (a.isNew && !b.isNew) return -1;
    if (!a.isNew && b.isNew) return 1;
    return (a.etd || '').localeCompare(b.etd || '');
  });

  const handleKeyDown = (e: React.KeyboardEvent, rowIndex: number, colIndex: number) => {
    const isEditing = editingCell?.row === rowIndex && editingCell?.col === colIndex;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusedCell({ row: Math.min(filteredFlights.length - 1, rowIndex + 1), col: colIndex });
        setEditingCell(null);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedCell({ row: Math.max(0, rowIndex - 1), col: colIndex });
        setEditingCell(null);
        break;
      case 'ArrowRight':
        if (!isEditing) {
          e.preventDefault();
          setFocusedCell({ row: rowIndex, col: Math.min(COLUMNS.length - 1, colIndex + 1) });
        } else {
          const input = e.target as HTMLInputElement;
          if (input.selectionStart === input.value.length) {
            e.preventDefault();
            setFocusedCell({ row: rowIndex, col: Math.min(COLUMNS.length - 1, colIndex + 1) });
            setEditingCell(null);
          }
        }
        break;
      case 'ArrowLeft':
        if (!isEditing) {
          e.preventDefault();
          setFocusedCell({ row: rowIndex, col: Math.max(0, colIndex - 1) });
        } else {
          const input = e.target as HTMLInputElement;
          if (input.selectionStart === 0) {
            e.preventDefault();
            setFocusedCell({ row: rowIndex, col: Math.max(0, colIndex - 1) });
            setEditingCell(null);
          }
        }
        break;
      case 'Enter':
        e.preventDefault();
        setFocusedCell({ row: rowIndex, col: Math.min(COLUMNS.length - 1, colIndex + 1) });
        setEditingCell(null);
        break;
      case 'Tab':
        e.preventDefault();
        setEditingCell(null);
        if (e.shiftKey) {
          if (colIndex > 0) {
            setFocusedCell({ row: rowIndex, col: colIndex - 1 });
          } else if (rowIndex > 0) {
            setFocusedCell({ row: rowIndex - 1, col: COLUMNS.length - 1 });
          }
        } else {
          if (colIndex < COLUMNS.length - 1) {
            setFocusedCell({ row: rowIndex, col: colIndex + 1 });
          } else if (rowIndex < filteredFlights.length - 1) {
            setFocusedCell({ row: rowIndex + 1, col: 0 });
          }
        }
        break;
      case 'Escape':
        if (editingCell) {
          e.preventDefault();
          setEditingCell(null);
        }
        break;
      case 'Backspace':
      case 'Delete':
        if (!isEditing) {
          e.preventDefault();
          handleFieldChange(filteredFlights[rowIndex].id, COLUMNS[colIndex].key, '');
        }
        break;
      default:
        // Handle alphanumeric direct entry like Excel
        if (!isEditing && !e.ctrlKey && !e.altKey && !e.metaKey && e.key.length === 1) {
          e.preventDefault();
          handleFieldChange(filteredFlights[rowIndex].id, COLUMNS[colIndex].key, e.key);
          setEditingCell({ row: rowIndex, col: colIndex });
        }
        break;
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (flightActionMenu && !(e.target as Element).closest('.actions-container')) {
        setFlightActionMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [flightActionMenu]);

  useEffect(() => {
    if (focusedCell) {
      if (editingCell?.row === focusedCell.row && editingCell?.col === focusedCell.col) {
        const input = tableRef.current?.querySelector(`tr[data-row="${focusedCell.row}"] td[data-col="${focusedCell.col}"] input`) as HTMLInputElement;
        if (input && document.activeElement !== input) {
          input.focus();
          input.select();
        }
      } else {
        // Focus the cell div to enable keyboard nav without showing a cursor
        const cell = tableRef.current?.querySelector(`tr[data-row="${focusedCell.row}"] td[data-col="${focusedCell.col}"] div`) as HTMLDivElement;
        if (cell && document.activeElement !== cell) {
          cell.focus();
        }
      }
    }
  }, [focusedCell, editingCell]);

  const handleClose = () => {
    const incompleteFlight = meshFlights.find(f => 
      f.isNew && (!f.airline || !f.departureFlightNumber || !f.destination || !f.etd)
    );

    if (incompleteFlight) {
        alert('Por favor, preencha os dados básicos do voo novo ou exclua a linha antes de sair.');
        return;
    }
    onClose();
  };

  return (
    <div className="w-full h-full flex flex-col animate-in fade-in" onKeyDown={(e) => {
      if (e.key === 'Escape') handleClose();
    }}>
      <div className={`flex-1 overflow-hidden flex flex-col ${isDarkMode ? 'bg-slate-950' : 'bg-slate-50'}`}>
        
        {/* Header */}
        <div className={`px-6 h-16 shrink-0 flex items-center justify-between border-b ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-[#2C864C] border-white/10'} z-[60] w-full shadow-sm`}>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <div>
                <h2 className="text-sm font-black text-white tracking-tighter uppercase leading-none">Malha Base</h2>
                <p className="text-[10px] mt-1 font-bold text-emerald-100/70 uppercase tracking-wider">
                  {meshFlights.length} registros • Modo Planilha
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative w-64 h-9">
              <div className="absolute inset-0 bg-white/10 border border-white/20 rounded-md flex items-center transition-all focus-within:bg-white/20 focus-within:border-white/40">
                <Search size={14} className="shrink-0 text-emerald-100 ml-3" />
                <input 
                  type="text" 
                  placeholder="PESQUISAR..." 
                  className="bg-transparent border-none outline-none text-[10px] text-white placeholder:text-emerald-100/50 font-mono uppercase w-full px-3 transition-all h-full"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <button 
              onClick={handleAddFlight}
              className={`flex items-center gap-2 px-4 py-2 rounded-md border border-white/20 transition-all font-bold uppercase tracking-wider text-[11px] bg-white/10 text-white hover:bg-white/20 shadow-sm active:scale-95`}
            >
              <Plus size={14} />
              <span>Adicionar Voo</span>
            </button>

            <button 
              onClick={handleActivate}
              className={`flex items-center gap-2 px-6 py-2 rounded-md border border-[#FEDC00] transition-all font-bold uppercase tracking-wider text-[11px] bg-[#FEDC00] text-[#4e4141] hover:bg-[#e5c600] shadow-sm active:scale-95`}
            >
              <Send size={14} />
              <span>Sincronizar</span>
            </button>

            <button 
              onClick={handleClose} 
              className={`flex items-center justify-center w-9 h-9 rounded-md border transition-all ${isDarkMode ? 'border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-white' : 'border-slate-300 text-slate-500 hover:bg-slate-100 hover:text-slate-900'}`}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Spreadsheet Area */}
        <div className="flex-1 overflow-auto bg-white dark:bg-slate-900">
          <table ref={tableRef} className="w-full border-collapse table-fixed select-none">
            <thead>
                <tr className={`${isDarkMode ? 'bg-slate-800/90 text-slate-400' : 'bg-slate-800 text-slate-200'}`}>
                {COLUMNS.map((col, idx) => (
                    <th 
                      key={col.key} 
                      className={`
                        ${col.width} px-2 py-2 text-[10px] font-black uppercase tracking-widest border ${isDarkMode ? 'border-slate-700' : 'border-slate-600'} text-center
                        ${col.isVariable ? (isDarkMode ? 'bg-emerald-950/10 text-emerald-400' : 'bg-emerald-500/10 text-white') : ''}
                      `}
                    >
                      {col.label}
                    </th>
                ))}
              </tr>
            </thead>
            <tbody className={isDarkMode ? 'bg-slate-950' : 'bg-slate-100'}>
              {filteredFlights.map((flight, rIdx) => (
                <tr 
                  key={flight.id} 
                  data-row={rIdx}
                  className={`
                    group transition-all h-8
                    ${flight.isNew ? (isDarkMode ? 'bg-yellow-900/40' : 'bg-yellow-100 font-bold') : (rIdx % 2 === 0 ? (isDarkMode ? 'bg-slate-900' : 'bg-white') : (isDarkMode ? 'bg-slate-950' : 'bg-slate-100'))}
                    ${flight.disabled ? 'opacity-50' : 'hover:bg-indigo-600/30'}
                  `}
                >
                  {COLUMNS.map((col, cIdx) => {
                    const isCellFocused = focusedCell?.row === rIdx && focusedCell?.col === cIdx;
                    const isCellEditing = editingCell?.row === rIdx && editingCell?.col === cIdx;
                    
                    if (col.key === 'actions') {
                      return (
                        <td 
                          key={`${flight.id}-actions`}
                          className={`p-0 border ${isDarkMode ? 'border-slate-800' : 'border-slate-300'} relative h-8 text-center pointer-events-auto actions-container`}
                        >
                          <div className="flex items-center justify-center w-full h-full">
                            <button 
                              onClick={(e) => {
                                  e.stopPropagation();
                                  setFlightActionMenu(flightActionMenu === flight.id ? null : flight.id);
                              }}
                              className="p-1 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-sm active:scale-95"
                            >
                              <MoreVertical size={14} />
                            </button>
                          </div>

                          {flightActionMenu === flight.id && (
                            <div className="absolute right-0 top-[110%] w-36 bg-slate-900 rounded-lg shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] border border-slate-700/50 z-[2000] flex flex-col overflow-hidden ring-1 ring-black/10 animate-in fade-in zoom-in-95 duration-200">
                                <div className="px-3 py-2 bg-slate-800/50 border-b border-slate-700/50 flex flex-col gap-0.5">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Ações - Voo {flight.departureFlightNumber || 'NOVO'}</span>
                                </div>
                                <button 
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleToggleDisable(flight.id);
                                    }}
                                    className="w-full px-3 py-2.5 text-[10px] font-bold uppercase flex items-center gap-2 hover:bg-slate-800 text-slate-300 border-b border-slate-700/50 transition-colors"
                                >
                                    <Ban size={12} className={flight.disabled ? 'text-emerald-500' : 'text-slate-400'} />
                                    {flight.disabled ? 'Ativar Voo' : 'Inativar Voo'}
                                </button>
                                <button 
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleDeleteFlight(flight.id);
                                    }}
                                    className="w-full px-3 py-2.5 text-[10px] font-bold uppercase flex items-center gap-2 hover:bg-red-900/40 text-red-500 transition-colors"
                                >
                                    <Trash2 size={12} />
                                    Cancelar Voo
                                </button>
                            </div>
                          )}
                        </td>
                      );
                    }

                    return (
                      <td 
                        key={`${flight.id}-${col.key}`} 
                        data-col={cIdx}
                        onClick={() => {
                          if (flight.disabled) return;
                          if (isCellFocused) {
                            setEditingCell({ row: rIdx, col: cIdx });
                          } else {
                            setFocusedCell({ row: rIdx, col: cIdx });
                            setEditingCell(null);
                          }
                        }}
                        className={`
                          p-0 border ${isDarkMode ? 'border-slate-800' : 'border-slate-300'} relative transition-all h-8
                          ${col.isVariable ? (isDarkMode ? 'bg-emerald-500/5' : 'bg-emerald-50/5') : ''}
                          ${isCellFocused ? 'ring-2 ring-indigo-500 ring-inset z-20 shadow-xl' : ''}
                          ${isCellFocused && !isCellEditing ? 'bg-indigo-600 text-white shadow-indigo-500/20' : ''}
                          ${isCellFocused && isCellEditing ? (isDarkMode ? 'bg-slate-900 shadow-inner' : 'bg-white font-black text-slate-900') : ''}
                        `}
                      >
                        {isCellEditing ? (
                          <input 
                            type="text"
                            autoFocus
                            value={flight[col.key as keyof MeshFlight] || ''}
                            onChange={(e) => handleFieldChange(flight.id, col.key, e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, rIdx, cIdx)}
                            onBlur={() => setEditingCell(null)}
                            className={`
                              w-full h-full px-3 bg-transparent border-none outline-none font-mono text-[13px] uppercase font-bold
                              ${isDarkMode ? 'text-slate-200' : 'text-slate-900'}
                              ${col.key === 'airline' ? 'text-left' : 'text-center'}
                            `}
                          />
                        ) : (
                          <div 
                            tabIndex={0}
                            onKeyDown={(e) => handleKeyDown(e, rIdx, cIdx)}
                            className={`
                              w-full h-full px-3 flex items-center font-mono text-[12px] uppercase font-bold select-none cursor-default outline-none
                              ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}
                              ${isCellFocused ? 'text-white' : ''}
                              ${flight.disabled ? (isDarkMode ? 'text-slate-500/30' : 'text-slate-400/50') : 'group-hover:text-white'}
                              ${col.key === 'airline' ? 'justify-start text-left' : 'justify-center text-center'}
                              ${!col.isVariable && !isCellFocused ? (isDarkMode ? 'text-indigo-400' : 'text-indigo-700') : ''}
                            `}
                          >
                            {flight[col.key as keyof MeshFlight] || '-'}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {filteredFlights.length === 0 && (
            <div className="flex flex-col items-center justify-center p-20 text-slate-500">
               <Search size={48} className="opacity-10 mb-4" />
               <p className="text-xs font-bold uppercase tracking-widest opacity-40">Nenhum registro encontrado</p>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className={`h-8 px-6 border-t flex items-center justify-between text-[9px] font-bold uppercase tracking-widest ${isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-500' : 'bg-white border-slate-200 text-slate-400'}`}>
          <div className="flex gap-4">
            <span>Linhas: {filteredFlights.length}</span>
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
              Colunas Editáveis
            </span>
          </div>
          <div>Dica: 1 clique seleciona, 2 cliques editam. Setas navegam, Enter pula para a direita.</div>
        </div>
      </div>
    </div>
  );
};

