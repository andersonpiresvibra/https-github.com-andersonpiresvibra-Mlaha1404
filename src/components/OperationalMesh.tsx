import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, Plane, Send, Search, Edit2, Trash2, Play, ClipboardList, Plus, Ban, AlertCircle, MoreVertical, Settings, ChevronDown, RefreshCw, Upload } from 'lucide-react';
import { MeshFlight, INITIAL_MESH_FLIGHTS } from '../data/operationalMesh';
import { FlightData, FlightStatus } from '../types';
import * as XLSX from 'xlsx';
import { ConfirmActionModal } from './modals/ConfirmActionModal';
import { AlertModal } from './modals/AlertModal';

interface OperationalMeshProps {
  onClose: () => void;
  onActivateMesh: (flights: FlightData[]) => void;
  isDarkMode: boolean;
  meshFlights: MeshFlight[];
  setMeshFlights: React.Dispatch<React.SetStateAction<MeshFlight[]>>;
  setFlights?: React.Dispatch<React.SetStateAction<FlightData[]>>;
  globalFlights: FlightData[];
}

type MeshField = keyof MeshFlight | 'actions';
type MeshShift = 'TODOS' | 'MANHA' | 'TARDE' | 'NOITE';

const isTimeInShift = (timeStr: string, shift: MeshShift) => {
  if (shift === 'TODOS' || !timeStr) return true;
  
  // Format should be HH:MM
  const parts = timeStr.split(':');
  if (parts.length < 2) return true;
  
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const totalMinutes = h * 60 + m;

  if (shift === 'MANHA') {
    // 05:00 to 15:00
    return totalMinutes >= 300 && totalMinutes < 900;
  }
  if (shift === 'TARDE') {
    // 14:00 to 00:00 (1440 mins)
    return totalMinutes >= 840 && totalMinutes <= 1440;
  }
  if (shift === 'NOITE') {
    // 21:00 to 06:00
    // Range 1 (21:00 to 23:59): 1260 to 1440
    // Range 2 (00:00 to 06:00): 0 to 360
    return (totalMinutes >= 1260 && totalMinutes <= 1440) || (totalMinutes >= 0 && totalMinutes < 360);
  }
  return true;
};

const formatImportTime = (val: string) => {
  if (!val) return '';
  const digits = val.replace(/[^0-9]/g, '');
  if (digits.length >= 4) {
    const hh = parseInt(digits.slice(0, 2), 10);
    const mm = parseInt(digits.slice(2, 4), 10);
    if (hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59) {
      return `${digits.slice(0, 2)}:${digits.slice(2, 4)}`;
    }
  } else if (val.includes(':')) {
     const [h, m] = val.split(':');
     if (!isNaN(Number(h)) && !isNaN(Number(m))) {
       const hh = Number(h);
       const mm = Number(m);
       if (hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59) {
           return `${hh.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}`;
       }
     }
  }
  return '?';
};

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

export const OperationalMesh: React.FC<OperationalMeshProps> = ({ onClose, onActivateMesh, isDarkMode, meshFlights, setMeshFlights, setFlights, globalFlights }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeShift, setActiveShift] = useState<MeshShift>('TODOS');
  const [focusedCell, setFocusedCell] = useState<{ row: number; col: number } | null>(null);
  const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const [flightActionMenu, setFlightActionMenu] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number, left: number } | null>(null);
  const actionMenuRef = useRef<HTMLDivElement>(null);
  const [showOptionsDropdown, setShowOptionsDropdown] = useState(false);
  const [showClearMeshModal, setShowClearMeshModal] = useState(false);
  const optionsMenuRef = useRef<HTMLDivElement>(null);

  const [alertState, setAlertState] = useState<{isOpen: boolean; title: string; message: React.ReactNode}>({isOpen: false, title: '', message: ''});
  const [syncConfirmState, setSyncConfirmState] = useState<{isOpen: boolean; message: string; unsynced: MeshFlight[]}>({isOpen: false, message: '', unsynced: []});

  const handleFieldChange = (id: string, field: MeshField, value: string) => {
    if (field === 'actions') return;

    let newValue: any = value.toUpperCase();
    if (field === 'etd' || field === 'eta' || field === 'actualArrivalTime') {
      newValue = value.replace(/[^0-9]/g, '');
      if (newValue.length > 2) {
        newValue = `${newValue.slice(0, 2)}:${newValue.slice(2, 4)}`;
      }
      if (newValue.length > 5) newValue = newValue.slice(0, 5);
    }
    
    setMeshFlights(prev => prev.map(flight => 
      flight.id === id ? { ...flight, [field]: newValue } : flight
    ));

    if (setFlights) {
      setFlights(prevFlights => prevFlights.map(f => {
        const flightIdBase = f.id.replace(/^mesh-\d+-/, ''); // Extract original mesh.id from flight id
        const isIdMatch = f.id === id || flightIdBase === id || flightIdBase === id.replace(/^mesh-\d+-/, '');
        
        // We evaluate fallback match by looking if the flight currently exactly matches this same old Mesh value.
        // It's safer to attempt matching using isIdMatch first.
        let isFallbackMatch = false;
        const m = meshFlights.find(mf => mf.id === id); // Still attempting to find it from closure if id fails
        if (!isIdMatch && m) {
          isFallbackMatch = !!(f.departureFlightNumber && m.departureFlightNumber && f.departureFlightNumber === m.departureFlightNumber);
        }

        if (isIdMatch || isFallbackMatch) {
            let updated = { ...f, [field]: newValue } as any;
            return updated;
        }
        return f;
      }));
    }
  };

  const handleAddFlight = () => {
    const newFlight: MeshFlight = {
      id: `new-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
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

  const isFlightSynced = (mesh: MeshFlight) => {
    return globalFlights.some(f => {
        // Ignorar voos que já foram finalizados, cancelados ou arquivados (histórico)
        // Isso permite que o mesmo voo seja importado novamente no dia seguinte
        const isFinishedOrArchived = f.status === 'FINALIZADO' || f.status === 'CANCELADO' || f.isHiddenFromGrid;
        if (isFinishedOrArchived) return false;

        const fIdBase = f.id.replace(/^mesh-\d+-/, ''); // Extract original mesh.id from f.id
        const isIdMatch = f.id === mesh.id || fIdBase === mesh.id;
        if (isIdMatch) return true;
        
        // Checking by properties
        const depMatch = f.departureFlightNumber && mesh.departureFlightNumber && 
            f.departureFlightNumber.toUpperCase() === mesh.departureFlightNumber.toUpperCase();
        const destMatch = f.destination && mesh.destination && 
            f.destination.toUpperCase() === mesh.destination.toUpperCase();
        const etdMatch = f.etd === mesh.etd;
        
        return depMatch && destMatch && etdMatch;
    });
  };

  const handleActivate = () => {
    const activeFlights = meshFlights.filter(f => !f.disabled);
    const unsyncedFlights = activeFlights.filter(f => !isFlightSynced(f));

    if (unsyncedFlights.length === 0) {
        setAlertState({isOpen: true, title: 'Malha Sincronizada', message: 'A malha geral já está sincronizada. Todos os voos ativos da malha base já estão presentes na malha geral.'});
        return;
    }

    // Validation for unsynced flights
    const incompleteFlight = unsyncedFlights.find(f => 
      !f.airline || !f.departureFlightNumber || !f.destination || !f.etd
    );

    if (incompleteFlight) {
        setAlertState({isOpen: true, title: 'Dados Incompletos', message: 'Por favor, preencha os dados básicos (Cia, Voo, Destino e ETD) dos voos pendentes antes de sincronizar.'});
        return;
    }

    const duplicatedFlight = unsyncedFlights.find(mesh => 
       meshFlights.some(f => 
          f.id !== mesh.id && 
          f.departureFlightNumber === mesh.departureFlightNumber && 
          f.etd === mesh.etd &&
          f.departureFlightNumber !== '' && 
          f.etd !== ''
       )
    );

    if (duplicatedFlight) {
        setAlertState({isOpen: true, title: 'Voos Duplicados', message: 'Há voos duplicados na malha base marcados em vermelho. Remova a duplicação antes de enviar para a malha geral.'});
        return;
    }

    if (unsyncedFlights.length < activeFlights.length) {
        setSyncConfirmState({isOpen: true, message: `Alguns voos já estão sincronizados na Malha Geral. Deseja enviar apenas os ${unsyncedFlights.length} voos pendentes?`, unsynced: unsyncedFlights});
        return;
    }

    executeSync(unsyncedFlights);
  };

  const executeSync = (flightsToSync: MeshFlight[]) => {
    const newFlights: FlightData[] = flightsToSync.map(mesh => ({
      id: `mesh-${Date.now()}-${mesh.id}`,
      airline: mesh.airline,
      airlineCode: mesh.airlineCode || mesh.airline.substring(0, 3) || 'G3',
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
      actualArrivalTime: mesh.actualArrivalTime || ''
    }));

    onActivateMesh(newFlights);
    setAlertState({isOpen: true, title: 'Sincronização Concluída', message: `Sincronização concluída! ${newFlights.length} voos enviados para a malha geral.`});
    setTimeout(() => {
        onClose();
    }, 2000);
  };

  const filteredFlights = meshFlights.filter(f => {
    const matchesSearch = f.departureFlightNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.destination.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.airline.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.airlineCode.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesShift = isTimeInShift(f.etd, activeShift);
    
    return matchesSearch && matchesShift;
  }).sort((a, b) => {
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
        if (isEditing) {
          setFocusedCell({ row: rowIndex, col: Math.min(COLUMNS.length - 1, colIndex + 1) });
          setEditingCell(null);
        } else if (COLUMNS[colIndex].isVariable) {
          setEditingCell({ row: rowIndex, col: colIndex });
        } else {
          setFocusedCell({ row: rowIndex, col: Math.min(COLUMNS.length - 1, colIndex + 1) });
        }
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
      if (flightActionMenu && !(e.target as Element).closest('.actions-container') && !actionMenuRef.current?.contains(e.target as Node)) {
        setFlightActionMenu(null);
      }
      if (showOptionsDropdown && !optionsMenuRef.current?.contains(e.target as Node)) {
        setShowOptionsDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [flightActionMenu, showOptionsDropdown]);

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

  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setPortalTarget(document.getElementById('subheader-portal-target'));
  }, []);

  const headerContent = (
    <div className={`px-6 h-16 shrink-0 flex items-center justify-between border-b ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-[#3CA317] border-transparent text-white'} z-[60] w-full shadow-sm`}>
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3">
          <div>
            <h2 className="text-sm font-black text-white tracking-tighter uppercase leading-none">Malha Base</h2>
            <div className="flex items-center gap-4 mt-1">
              <p className="text-[10px] font-bold text-emerald-100/70 uppercase tracking-wider">
              {filteredFlights.length} de {meshFlights.length} registros • Modo Planilha
            </p>
              <div className="h-3 w-px bg-white/20"></div>
              <div className="flex items-center gap-2 bg-black/20 p-1 rounded border border-white/10 w-[270px] h-10">
                {(['TODOS', 'MANHA', 'TARDE', 'NOITE'] as MeshShift[]).map(shift => (
                  <button
                    key={shift}
                    onClick={() => setActiveShift(shift)}
                    className={`px-3 py-1.5 rounded text-[9px] font-black uppercase tracking-widest transition-all h-full ${activeShift === shift ? 'bg-emerald-500 text-slate-950 flex-1' : 'text-emerald-100/50 hover:text-white flex-1'}`}
                  >
                    {shift}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative w-64 h-9">
          <div className="absolute inset-0 bg-white/10 border border-white/20 rounded-md flex items-center transition-all focus-within:bg-white/20 focus-within:border-white/40">
            <Search size={14} className="shrink-0 text-emerald-100 ml-3" />
            <input 
              type="text" 
              placeholder="Pesquise..." 
              className="bg-transparent border-none outline-none text-[10px] text-white placeholder:text-emerald-100/50 font-mono uppercase w-full px-3 transition-all h-full"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="relative" ref={optionsMenuRef}>
          <button 
            onClick={() => setShowOptionsDropdown(!showOptionsDropdown)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md transition-all font-bold uppercase tracking-wider text-[11px] ${showOptionsDropdown ? 'bg-[#e5c600] shadow-inner' : 'bg-[#FEDC00] hover:bg-[#e5c600] shadow-sm'} text-[#4e4141] active:scale-95 border border-[#FEDC00]`}
          >
            <Settings size={14} />
            <span>Opções</span>
            <ChevronDown size={14} className={`transition-transform duration-200 ${showOptionsDropdown ? 'rotate-180' : ''}`} />
          </button>

          {showOptionsDropdown && (
            <div className={`absolute right-0 top-full mt-2 w-56 ${isDarkMode ? 'bg-slate-900 border-white/10 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)]' : 'bg-white border-slate-200 shadow-xl'} border rounded-xl z-[100] overflow-hidden animate-in fade-in slide-in-from-top-2`}>
              <div className="p-1.5 space-y-0.5">
                <div className="px-3 py-2 border-b border-white/5 mb-1">
                  <span className={`text-[9px] font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Ações da Malha Base</span>
                </div>

                <button 
                  onClick={() => {
                    handleAddFlight();
                    setShowOptionsDropdown(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${isDarkMode ? 'text-slate-300 hover:bg-white/10 hover:text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
                >
                  <Plus size={14} />
                  Adicionar Voo
                </button>

                <label className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${isDarkMode ? 'text-slate-300 hover:bg-blue-500/10 hover:text-blue-400' : 'text-slate-600 hover:bg-blue-50 hover:text-blue-600'}`}>
                  <Upload size={14} />
                  Import. voos
                  <input 
                    type="file" 
                    accept=".csv, .xlsx, .xls"
                    className="hidden" 
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        const file = e.target.files[0];
                        
                        const handleNewFlights = (newFlights: MeshFlight[]) => {
                          if (newFlights.length > 0) {
                            setMeshFlights(prev => {
                              const nonDuplicates = newFlights.filter(nf => {
                                return !prev.some(pf => 
                                  pf.departureFlightNumber === nf.departureFlightNumber && 
                                  pf.etd === nf.etd
                                );
                              });
                              const ignoredCount = newFlights.length - nonDuplicates.length;
                              const messageContent = (
                                <>
                                  Arquivo "{file.name}" foi carregado com sucesso!
                                  <br/><br/>
                                  "{ignoredCount}" ignorados (por duplicidade).
                                  <br/>
                                  {nonDuplicates.length} importados.
                                </>
                              );
                              setTimeout(() => setAlertState({isOpen: true, title: 'Importação Concluída', message: messageContent}), 100);
                              return [...nonDuplicates, ...prev];
                            });
                          }
                        };

                        if (file.name.endsWith('.csv')) {
                          const reader = new FileReader();
                          reader.onload = (evt) => {
                            const text = evt.target?.result as string;
                            const lines = text.split(/\r?\n/);
                            const newFlights: MeshFlight[] = [];
                            lines.forEach((line, index) => {
                              if (!line.trim()) return;
                              const cols = line.split(/[;,]/).map(c => c.trim().replace(/^["']|["']$/g, ''));
                              if (index === 0 && (cols[0].toLowerCase().includes('cia') || cols[0].toLowerCase().includes('airline'))) return;
                              if (cols.length >= 4) {
                                newFlights.push({
                                  id: `imp-${Date.now()}-${index}`,
                                  airline: cols[0] || 'G3',
                                  airlineCode: cols[0] || 'GOL',
                                  departureFlightNumber: cols[1] || '',
                                  destination: cols[2] || '',
                                  etd: formatImportTime(cols[3] || ''),
                                  registration: cols[4] || '',
                                  model: cols[5] || '',
                                  eta: formatImportTime(cols[6] || ''),
                                  positionId: cols[7] || '',
                                  actualArrivalTime: formatImportTime(cols[8] || ''),
                                  isNew: true
                                });
                              }
                            });
                            handleNewFlights(newFlights);
                          };
                          reader.readAsText(file);
                        } else {
                          const reader = new FileReader();
                          reader.onload = (evt) => {
                            const arrayBuffer = evt.target?.result as ArrayBuffer;
                            const workbook = XLSX.read(arrayBuffer, { type: 'array' });
                            const sheetName = workbook.SheetNames[0];
                            const sheet = workbook.Sheets[sheetName];
                            const jsonData = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });
                            
                            const newFlights: MeshFlight[] = [];
                            jsonData.forEach((row, index) => {
                              if (!row || row.length === 0) return;
                              if (index === 0 && row[0] && (String(row[0]).toLowerCase().includes('cia') || String(row[0]).toLowerCase().includes('airline'))) return;
                              
                              const cols = row.map(cell => cell != null ? String(cell) : '');
                              if (cols.length >= 4) {
                                newFlights.push({
                                  id: `imp-${Date.now()}-${index}`,
                                  airline: cols[0] || 'G3',
                                  airlineCode: cols[0] || 'GOL',
                                  departureFlightNumber: cols[1] || '',
                                  destination: cols[2] || '',
                                  etd: formatImportTime(cols[3] || ''),
                                  registration: cols[4] || '',
                                  model: cols[5] || '',
                                  eta: formatImportTime(cols[6] || ''),
                                  positionId: cols[7] || '',
                                  actualArrivalTime: formatImportTime(cols[8] || ''),
                                  isNew: true
                                });
                              }
                            });
                            handleNewFlights(newFlights);
                          };
                          reader.readAsArrayBuffer(file);
                        }
                      }
                      // Reset input value to allow importing the same file again
                      e.target.value = '';
                      setShowOptionsDropdown(false);
                    }} 
                  />
                </label>

                <button 
                  onClick={() => {
                    handleActivate();
                    setShowOptionsDropdown(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${isDarkMode ? 'text-slate-300 hover:bg-[#FEDC00]/20 hover:text-[#FEDC00]' : 'text-slate-600 hover:bg-[#FEDC00]/20 hover:text-slate-900'}`}
                >
                  <RefreshCw size={14} />
                  Sincronizar Malha
                </button>

                <div className={`my-1 border-b ${isDarkMode ? 'border-white/5' : 'border-slate-100'}`} />

                <button 
                  onClick={() => {
                    setShowClearMeshModal(true);
                    setShowOptionsDropdown(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${isDarkMode ? 'text-red-400 hover:bg-red-500/10 hover:text-red-300' : 'text-red-600 hover:bg-red-50 hover:text-red-700'}`}
                >
                  <Trash2 size={14} />
                  Limpar Malha Base
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="w-full h-full flex flex-col animate-in fade-in" onKeyDown={(e) => {
      if (e.key === 'Escape') handleClose();
    }}>
      <div className={`flex-1 overflow-hidden flex flex-col ${isDarkMode ? 'bg-slate-950' : 'bg-slate-50'}`}>
        
        {/* Header */}
        {portalTarget ? createPortal(headerContent, portalTarget) : headerContent}

        {/* Spreadsheet Area */}
        <div className={`flex-1 min-w-0 overflow-auto ${isDarkMode ? 'bg-slate-950' : 'bg-white'}`}>
          <table ref={tableRef} className="w-full border-collapse table-fixed select-none min-w-[800px]">
            <thead>
                <tr className={`${isDarkMode ? 'bg-slate-800/90 text-slate-400' : 'bg-slate-800 text-slate-200'}`}>
                {COLUMNS.map((col, idx) => (
                    <th 
                      key={col.key} 
                      className={`
                        ${col.width} px-2 py-2 text-[10px] font-black uppercase tracking-widest border ${isDarkMode ? 'border-slate-700' : 'border-slate-700/50'} text-center
                        ${col.isVariable ? (isDarkMode ? 'bg-emerald-950/10 text-emerald-400' : 'bg-emerald-500/10 text-white') : ''}
                      `}
                    >
                      {col.label}
                    </th>
                ))}
              </tr>
            </thead>
              <tbody className={isDarkMode ? 'bg-slate-950' : 'bg-slate-100'}>
              {filteredFlights.map((flight, rIdx) => {
                const isSynced = isFlightSynced(flight);
                const hasFormatError = flight.etd === '?' || flight.eta === '?' || flight.actualArrivalTime === '?';
                const isDuplicated = meshFlights.some(f => 
                  f.id !== flight.id && 
                  f.departureFlightNumber === flight.departureFlightNumber && 
                  f.etd === flight.etd &&
                  f.departureFlightNumber !== '' && 
                  f.etd !== '' &&
                  f.etd !== '?'
                );
                const isReady = flight.airline && flight.departureFlightNumber && flight.destination && flight.etd && flight.etd !== '?';
                return (
                <React.Fragment key={flight.id}>
                <tr 
                  data-row={rIdx}
                  className={`
                    group transition-all h-8
                    ${isDuplicated || hasFormatError ? 'bg-red-900/40 text-red-100 font-bold' : (!isSynced ? (isReady ? (isDarkMode ? 'bg-indigo-900/40 text-indigo-100 font-bold' : 'bg-indigo-100 font-bold') : (isDarkMode ? 'bg-yellow-900/40' : 'bg-yellow-100 font-bold')) : (rIdx % 2 === 0 ? (isDarkMode ? 'bg-slate-900' : 'bg-white') : (isDarkMode ? 'bg-slate-950' : 'bg-slate-100')))}
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
                          className={`p-0 border ${isDarkMode ? 'border-slate-800' : 'border-slate-700/30'} relative h-8 text-center pointer-events-auto actions-container`}
                        >
                          <div className="flex items-center justify-center w-full h-full">
                            <button 
                              onClick={(e) => {
                                  e.stopPropagation();
                                  if (flightActionMenu === flight.id) {
                                      setFlightActionMenu(null);
                                  } else {
                                      const rect = e.currentTarget.getBoundingClientRect();
                                      setMenuPosition({ top: rect.bottom, left: rect.right - 144 });
                                      setFlightActionMenu(flight.id);
                                  }
                              }}
                              className="p-1 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-sm active:scale-95"
                            >
                              <MoreVertical size={14} />
                            </button>
                          </div>

                          {flightActionMenu === flight.id && menuPosition && createPortal(
                            <div 
                                ref={actionMenuRef}
                                style={{ top: menuPosition.top + 4, left: menuPosition.left }}
                                className="fixed w-36 bg-slate-900 rounded-lg shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] border border-slate-700/50 z-[9999] flex flex-col overflow-hidden ring-1 ring-black/10 animate-in fade-in zoom-in-95 duration-200"
                            >
                                <div className="px-3 py-2 bg-slate-800/50 border-b border-slate-700/50 flex flex-col gap-0.5">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider text-left">Ações - Voo {flight.departureFlightNumber || 'NOVO'}</span>
                                </div>
                                <button 
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleToggleDisable(flight.id);
                                    }}
                                    className="w-full px-3 py-2.5 text-[10px] font-bold uppercase flex items-center gap-2 hover:bg-slate-800 text-slate-300 border-b border-slate-700/50 transition-colors text-left"
                                >
                                    <Ban size={12} className={flight.disabled ? 'text-emerald-500' : 'text-slate-400'} />
                                    {flight.disabled ? 'Ativar Voo' : 'Inativar Voo'}
                                </button>
                                <button 
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        if (flight.isNew && (!flight.airline || !flight.departureFlightNumber || !flight.destination || !flight.etd)) {
                                          alert('Preencha os dados básicos antes de enviar.');
                                          return;
                                        }

                                        const isDuplicated = meshFlights.some(f => 
                                          f.id !== flight.id && 
                                          f.departureFlightNumber === flight.departureFlightNumber && 
                                          f.etd === flight.etd &&
                                          f.departureFlightNumber !== '' && 
                                          f.etd !== ''
                                        );
                                        
                                        if (isDuplicated) {
                                            alert('Este voo está duplicado na malha base. Corrija a duplicação antes de enviar.');
                                            return;
                                        }

                                        const newFlightData: FlightData = {
                                          id: `mesh-${Date.now()}-${flight.id}`,
                                          airline: flight.airline,
                                          airlineCode: flight.airlineCode || flight.airline.substring(0, 3) || 'G3',
                                          registration: flight.registration.toUpperCase(),
                                          model: flight.model.toUpperCase(),
                                          flightNumber: '', 
                                          eta: flight.eta,
                                          departureFlightNumber: flight.departureFlightNumber.toUpperCase(),
                                          destination: flight.destination.toUpperCase(),
                                          positionId: flight.positionId,
                                          etd: flight.etd,
                                          origin: 'SBGL', 
                                          fuelStatus: 0,
                                          status: FlightStatus.CHEGADA,
                                          logs: [{
                                            id: Date.now().toString(),
                                            timestamp: new Date(),
                                            type: 'SISTEMA',
                                            message: 'Voo avulso enviado da malha base.',
                                            author: 'SISTEMA'
                                          }],
                                          messages: [],
                                          actualArrivalTime: flight.actualArrivalTime
                                        };
                                        onActivateMesh([newFlightData]);
                                        setFlightActionMenu(null);
                                        setAlertState({isOpen: true, title: 'Sucesso', message: `Voo ${flight.departureFlightNumber || newFlightData.registration} enviado para a Malha Operacional!`});
                                    }}
                                    className="w-full px-3 py-2.5 text-[10px] font-bold uppercase flex items-center gap-2 hover:bg-emerald-900/30 text-emerald-400 border-b border-slate-700/50 transition-colors text-left"
                                >
                                    <Send size={12} />
                                    Enviar p/ Malha Geral
                                </button>
                                <button 
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleDeleteFlight(flight.id);
                                    }}
                                    className="w-full px-3 py-2.5 text-[10px] font-bold uppercase flex items-center gap-2 hover:bg-red-900/40 text-red-500 transition-colors text-left"
                                >
                                    <Trash2 size={12} />
                                    Excluir
                                </button>
                            </div>
                          , document.body)}
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
                          p-0 border ${isDarkMode ? 'border-slate-800' : 'border-slate-700/30'} relative transition-all h-8
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
                              absolute inset-0 w-full h-full px-3 bg-transparent border-none outline-none font-mono text-[13px] uppercase font-bold
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
                {isDuplicated && (
                  <tr className="bg-red-500/10 border-b border-red-500/20">
                    <td colSpan={COLUMNS.length} className="px-3 py-1 text-[10px] text-red-500 font-bold uppercase tracking-widest text-center">
                      <div className="flex items-center justify-center gap-2">
                        <AlertCircle size={12} />
                        Atenção: Voo Duplicado na Malha Base. Não será enviado para a malha geral.
                      </div>
                    </td>
                  </tr>
                )}
                {hasFormatError && (
                  <tr className="bg-orange-500/10 border-b border-orange-500/20">
                    <td colSpan={COLUMNS.length} className="px-3 py-1 text-[10px] text-orange-500 font-bold uppercase tracking-widest text-center">
                      <div className="flex items-center justify-center gap-2">
                        <AlertCircle size={12} />
                        Atenção: Erro de formatação de hora. Corrija as células com "?" antes de enviar.
                      </div>
                    </td>
                  </tr>
                )}
                </React.Fragment>
                );
              })}
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
      
      {showClearMeshModal && (
        <ConfirmActionModal
          type="clearMesh"
          onConfirm={() => {
            setMeshFlights([]);
            setShowClearMeshModal(false);
          }}
          onClose={() => setShowClearMeshModal(false)}
        />
      )}

      {alertState.isOpen && (
          <AlertModal 
              isOpen={alertState.isOpen}
              title={alertState.title}
              message={alertState.message}
              onClose={() => setAlertState(prev => ({...prev, isOpen: false}))}
          />
      )}

      {syncConfirmState.isOpen && (
          <ConfirmActionModal 
              type="syncPartial"
              message={syncConfirmState.message}
              onConfirm={() => {
                  setSyncConfirmState(prev => ({...prev, isOpen: false}));
                  executeSync(syncConfirmState.unsynced);
              }}
              onClose={() => setSyncConfirmState(prev => ({...prev, isOpen: false}))}
          />
      )}
    </div>
  );
};

