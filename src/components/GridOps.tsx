
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FlightStatus, FlightData, FlightLog, LogType, OperatorProfile } from '../types';
import { MOCK_TEAM_PROFILES } from '../data/mockData'; // Importando perfis para designação

import { FlightDetailsModal } from './FlightDetailsModal';
import { StatusBadge } from './SharedStats';
import { OperatorCell } from './OperatorCell';
import { AirlineLogo } from './AirlineLogo';
import { Spinner } from './ui/Spinner';

import { 
  LayoutGrid, Clock, UserCheck, Droplet, CheckCircle, 
  ArrowUp, ArrowDown, ArrowUpDown, 
  MessageSquare, FileText, Plane, Pen, BusFront,
  PlaneLanding, ListOrdered, AlertTriangle, Play, Pause, XCircle, Plus, Anchor,
  MapPin, Eye, CheckCheck, X, Save, History, TimerOff, UserPlus, Building2, Bell, Zap,
  MessageCircle, MoreVertical, Search, Settings, Upload, RefreshCw, Network, Archive, Trash2
} from 'lucide-react';

type Tab = 'GERAL' | 'CHEGADA' | 'FILA' | 'DESIGNADOS' | 'ABASTECENDO' | 'FINALIZADO' | 'MALHA';
type SortDirection = 'asc' | 'desc' | null;
type MeshShift = 'TODOS' | 'MANHA' | 'TARDE' | 'NOITE';

const isTimeInShift = (timeStr: string, shift: MeshShift) => {
  if (shift === 'TODOS' || !timeStr) return true;
  const parts = timeStr.split(':');
  if (parts.length < 2) return true;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const totalMinutes = h * 60 + m;

  if (shift === 'MANHA') return totalMinutes >= 300 && totalMinutes < 900;
  if (shift === 'TARDE') return totalMinutes >= 840 && totalMinutes <= 1440;
  if (shift === 'NOITE') return (totalMinutes >= 1260 && totalMinutes <= 1440) || (totalMinutes >= 0 && totalMinutes < 360);
  return true;
};

interface SortConfig {
  key: keyof FlightData | null;
  direction: SortDirection;
}

interface ToastNotification {
    id: string;
    title: string;
    message: string;
    type: 'success' | 'info' | 'warning';
}

import { CreateFlightModal } from './CreateFlightModal';
import { DesigOpr } from './desigopr';
import { DelayJustificationModal } from './modals/DelayJustificationModal';
import { ObservationModal } from './modals/ObservationModal';
import { ConfirmActionModal } from './modals/ConfirmActionModal';
import { ImportModal } from './modals/ImportModal';
import { Vehicle } from '../types';

import { useTheme } from '../contexts/ThemeContext';
import { MeshFlight } from '../data/operationalMesh';

interface GridOpsProps {
    flights: FlightData[];
    onUpdateFlights: React.Dispatch<React.SetStateAction<FlightData[]>>;
    vehicles: Vehicle[];
    operators: OperatorProfile[];
    initialTab?: Tab;
    globalSearchTerm?: string;
    onUpdateSearch?: (term: string) => void;
    meshFlights?: MeshFlight[];
    setMeshFlights?: React.Dispatch<React.SetStateAction<MeshFlight[]>>;
    onOpenShiftOperators?: () => void;
    pendingAction?: 'CREATE' | 'IMPORT' | null;
    setPendingAction?: React.Dispatch<React.SetStateAction<'CREATE' | 'IMPORT' | null>>;
    ltName: string;
}

const parseTime = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return date;
};

// Função para calcular diferença em minutos entre uma hora (HH:MM) e o momento atual
const getMinutesDiff = (targetTimeStr: string) => {
    if (!targetTimeStr) return 0;
    const target = parseTime(targetTimeStr);
    const current = new Date();
    let diff = (target.getTime() - current.getTime()) / 60000;
    
    // Se a diferença for menor que -12 horas (ex: ETD 01:00 e agora 22:00), significa amanhã.
    if (diff < -720) {
        diff += 1440;
    } 
    // Se for maior que 12 horas (ex: ETD 23:00 e agora 01:00), significa ontem (atrasado)
    else if (diff > 720) {
        diff -= 1440;
    }
    
    return diff;
};
const ICAO_CITIES: Record<string, string> = {
  'SBGL': 'GALEÃO',
  'SBGR': 'GUARULHOS',
  'SBSP': 'CONGONHAS',
  'SBRJ': 'ST. DUMONT',
  'SBKP': 'VIRACOPOS',
  'SBNT': 'NATAL',
  'SBSV': 'SALVADOR',
  'SBPA': 'PTO ALEGRE',
  'SBCT': 'CURITIBA',
  'LPPT': 'LISBOA',
  'EDDF': 'FRANKFURT',
  'LIRF': 'FIUMICINO',
  'KMIA': 'MIAMI',
  'KATL': 'ATLANTA',
  'MPTO': 'TOCUMEN',
  'SCEL': 'SANTIAGO',
  'SUMU': 'MONTEVIDÉU',
  'SAEZ': 'EZEIZA',
};

const DELAY_REASONS = [
    "Atraso Chegada Aeronave (Late Arrival)",
    "Solicitação Cia Aérea (Abastecimento Parcial)",
    "Manutenção Equipamento Abastecimento",
    "Manutenção Aeronave (Mecânica)",
    "Indisponibilidade de Posição/Balizamento",
    "Restrição Meteorológica (Raios)",
    "Atraso Operacional (Equipe)",
    "Fluxo Lento / Pressão Hidrante Baixa"
];

const calculateLandingETA = (blockTime: string) => {
    const date = parseTime(blockTime);
    date.setMinutes(date.getMinutes() - 15);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

// Verifica se houve atraso REAL (Hora Finalização > ETD)
const checkIsDelayed = (flight: FlightData) => {
    if (!flight.endTime || !flight.etd) return false;
    const [h, m] = flight.etd.split(':').map(Number);
    const etdDate = new Date(flight.endTime); 
    etdDate.setHours(h, m, 0, 0);
    // Se EndTime for maior que ETD, houve atraso
    return flight.endTime.getTime() > etdDate.getTime();
};

const calculateTAB = (flight: FlightData) => {
    if (!flight.designationTime || !flight.endTime) return "--:--";
    const diffMs = flight.endTime.getTime() - flight.designationTime.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const hrs = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
};

const createNewLog = (type: LogType, message: string, author: string = 'GESTOR_MESA'): FlightLog => ({
    id: Date.now().toString(),
    timestamp: new Date(),
    type,
    message,
    author
});

export const GridOps: React.FC<GridOpsProps> = ({ 
    flights, 
    onUpdateFlights, 
    vehicles, 
    operators,
    initialTab = 'GERAL', 
    globalSearchTerm = '',
    onUpdateSearch,
    meshFlights = [],
    setMeshFlights,
    onOpenShiftOperators,
    pendingAction,
    setPendingAction,
    ltName
}) => {
  const { isDarkMode } = useTheme();
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const [activeShift, setActiveShift] = useState<MeshShift>('TODOS');
  
  useEffect(() => {
    // Simulate data fetching
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
      if (initialTab) {
          setActiveTab(initialTab);
      }
  }, [initialTab]);

  const [selectedFlight, setSelectedFlight] = useState<FlightData | null>(null);

  // Keep selectedFlight in sync with global flights
  useEffect(() => {
      if (selectedFlight) {
          const updated = flights.find(f => f.id === selectedFlight.id);
          if (updated && JSON.stringify(updated) !== JSON.stringify(selectedFlight)) {
              setSelectedFlight(updated);
          }
      }
  }, [flights, selectedFlight]);

  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: null, direction: null });
  
  // Estado para controlar visualização de finalizados na aba GERAL
  const [archivedIds, setArchivedIds] = useState<Set<string>>(new Set());
  
  // Modals e Toasts
  const [toasts, setToasts] = useState<ToastNotification[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [standbyModalFlightId, setStandbyModalFlightId] = useState<string | null>(null);
  const [standbyReason, setStandbyReason] = useState('');
  const [observationModalFlight, setObservationModalFlight] = useState<FlightData | null>(null);
  const [newObservation, setNewObservation] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  const [showOptionsDropdown, setShowOptionsDropdown] = useState(false);
  
  // NEW: Spreadsheet inline editing states
  const [focusedCell, setFocusedCell] = useState<{ rowId: string; col: string } | null>(null);
  const [editingCell, setEditingCell] = useState<{ rowId: string; col: string } | null>(null);
  const tableRef = useRef<HTMLTableElement>(null);

  useEffect(() => {
    if (focusedCell) {
      if (editingCell?.rowId === focusedCell.rowId && editingCell?.col === focusedCell.col) {
        const input = tableRef.current?.querySelector(`tr[data-rowid="${focusedCell.rowId}"] td[data-colkey="${focusedCell.col}"] input`) as HTMLInputElement;
        if (input && document.activeElement !== input) {
          input.focus();
        }
      } else {
        const cell = tableRef.current?.querySelector(`tr[data-rowid="${focusedCell.rowId}"] td[data-colkey="${focusedCell.col}"] div`) as HTMLDivElement;
        if (cell && document.activeElement !== cell) {
          cell.focus();
        }
      }
    }
  }, [focusedCell, editingCell]);

  const handleFieldChange = (id: string, field: keyof FlightData, value: string) => {
    onUpdateFlights(prev => prev.map(f => {
      if (f.id === id) {
        let newValue: any = value.toUpperCase();
        
        if (field === 'eta' || field === 'etd' || field === 'actualArrivalTime' || field === 'designationTime') {
          newValue = value.replace(/[^0-9]/g, '');
          if (newValue.length > 2) {
            newValue = `${newValue.slice(0, 2)}:${newValue.slice(2, 4)}`;
          }
          if (newValue.length > 5) newValue = newValue.slice(0, 5);
        } else if (field === 'fuelStatus' || field === 'volume' || field === 'maxFlowRate') {
          newValue = parseFloat(value) || 0;
        }

        const updatedFlight = { ...f, [field]: newValue };
        
        // Sincronização Bilateral com a Malha Base
        if (setMeshFlights) {
          setMeshFlights(prevMesh => prevMesh.map(m => {
            const flightIdBase = id.replace(/^mesh-\d+-/, ''); // Extract original mesh.id from flight id
            const isIdMatch = id === m.id || flightIdBase === m.id || flightIdBase === m.id.replace(/^mesh-\d+-/, '');
            
            const isFallbackMatch = !!(f.departureFlightNumber && m.departureFlightNumber && f.departureFlightNumber === m.departureFlightNumber);
            
            if (isIdMatch || isFallbackMatch) {
                return { ...m, [field]: newValue } as any;
            }
            return m;
          }));
        }

        return updatedFlight;
      }
      return f;
    }));
  };

  const handleKeyDown = (e: React.KeyboardEvent, rowId: string, colKey: string, rowIndex: number, colIndex: number) => {
    const isEditing = editingCell?.rowId === rowId && editingCell?.col === colKey;
    let targetTd = e.currentTarget as HTMLElement;
    if (targetTd.tagName !== 'TD') {
        targetTd = targetTd.closest('td') as HTMLElement;
    }
    const currentTr = targetTd?.parentElement as HTMLTableRowElement;
    if (!currentTr) return;
    const tbody = currentTr.parentElement as HTMLTableSectionElement;
    if (!tbody) return;

    const navigate = (newRowIndex: number, newColIndex: number, preferEditing = false, horizontalDirection: 1 | -1 | 0 = 0) => {
      let targetRow = Array.from(tbody.children).find(el => parseInt(el.getAttribute('data-rowindex') || '-1') === newRowIndex) as HTMLTableRowElement;
      
      let nextRowIndex = newRowIndex;
      let nextColIndex = newColIndex;

      if (horizontalDirection !== 0) {
          while (true) {
              if (!targetRow) break;
              let targetCell = Array.from(targetRow.children).find(el => parseInt(el.getAttribute('data-colindex') || '-1') === nextColIndex) as HTMLElement;
              
              if (!targetCell) {
                  if (horizontalDirection === 1) {
                      nextRowIndex += 1;
                      nextColIndex = 0;
                  } else {
                      nextRowIndex -= 1;
                      const prevRow = Array.from(tbody.children).find(el => parseInt(el.getAttribute('data-rowindex') || '-1') === nextRowIndex) as HTMLTableRowElement;
                      if (!prevRow) break;
                      nextColIndex = Array.from(prevRow.children)
                          .filter(c => c.hasAttribute('data-colindex'))
                          .map(c => parseInt(c.getAttribute('data-colindex')!))
                          .reduce((max, val) => Math.max(max, val), 0);
                  }
                  targetRow = Array.from(tbody.children).find(el => parseInt(el.getAttribute('data-rowindex') || '-1') === nextRowIndex) as HTMLTableRowElement;
                  continue;
              }

              if (targetCell.getAttribute('data-editable') === 'true') {
                  break;
              } else {
                  nextColIndex += horizontalDirection;
              }
          }
      }

      if (targetRow) {
        const targetCell = Array.from(targetRow.children).find(el => parseInt(el.getAttribute('data-colindex') || '-1') === nextColIndex) as HTMLElement;
        if (targetCell && (horizontalDirection !== 0 ? true : targetCell.getAttribute('data-editable') === 'true')) {
          const newRowId = targetCell.getAttribute('data-rowid');
          const newColKey = targetCell.getAttribute('data-colkey');
          if (newRowId && newColKey) {
            setFocusedCell({ rowId: newRowId, col: newColKey });
            if (preferEditing) {
              setEditingCell({ rowId: newRowId, col: newColKey });
            } else {
              setEditingCell(null);
            }
            setTimeout(() => {
                const innerEl = targetCell.querySelector('input') || targetCell.querySelector('div');
                if (innerEl) (innerEl as HTMLElement).focus();
                else targetCell.focus();
            }, 0);
          }
        }
      }
    };

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        navigate(rowIndex + 1, colIndex);
        break;
      case 'ArrowUp':
        e.preventDefault();
        navigate(rowIndex - 1, colIndex);
        break;
      case 'ArrowRight':
        if (!isEditing) {
          e.preventDefault();
          navigate(rowIndex, colIndex + 1, false, 1);
        } else {
          const input = e.target as HTMLInputElement;
          if (input && input.selectionStart === input.value.length) {
            e.preventDefault();
            navigate(rowIndex, colIndex + 1, false, 1);
            setEditingCell(null);
          }
        }
        break;
      case 'ArrowLeft':
        if (!isEditing) {
          e.preventDefault();
          navigate(rowIndex, colIndex - 1, false, -1);
        } else {
          const input = e.target as HTMLInputElement;
          if (input && input.selectionStart === 0) {
            e.preventDefault();
            navigate(rowIndex, colIndex - 1, false, -1);
            setEditingCell(null);
          }
        }
        break;
      case 'Enter':
        e.preventDefault();
        if (isEditing) {
          navigate(rowIndex, colIndex + 1, false, 1);
          setEditingCell(null);
        } else if (targetTd?.getAttribute('data-editable') === 'true') {
          setEditingCell({ rowId, col: colKey });
        } else {
          // If not editable, just move right like excel
          navigate(rowIndex, colIndex + 1, false, 1);
        }
        break;
      case 'Tab':
        e.preventDefault();
        setEditingCell(null);
        if (e.shiftKey) {
          navigate(rowIndex, colIndex - 1, false, -1);
        } else {
          navigate(rowIndex, colIndex + 1, false, 1);
        }
        break;
      case 'Escape':
        if (isEditing) {
          e.preventDefault();
          setEditingCell(null);
        }
        break;
      case 'Backspace':
      case 'Delete':
        if (!isEditing) {
          e.preventDefault();
          handleFieldChange(rowId, colKey as keyof FlightData, '');
        }
        break;
      default:
        if (!isEditing && !e.ctrlKey && !e.altKey && !e.metaKey && e.key.length === 1) {
          e.preventDefault();
          handleFieldChange(rowId, colKey as keyof FlightData, e.key.toUpperCase());
          setEditingCell({ rowId, col: colKey });
        }
        break;
    }
  };

  // Delay Justification Modal States
  const [delayModalFlightId, setDelayModalFlightId] = useState<string | null>(null);
  const [delayReasonCode, setDelayReasonCode] = useState('');
  const [delayReasonDetail, setDelayReasonDetail] = useState('');

  // Assign Operator Modal State
  const [assignModalFlight, setAssignModalFlight] = useState<FlightData | null>(null);
  const [assignSupportModalFlight, setAssignSupportModalFlight] = useState<FlightData | null>(null);
  const [selectedOperatorId, setSelectedOperatorId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number, left: number } | null>(null);
  const [cancelModalFlight, setCancelModalFlight] = useState<FlightData | null>(null);
  const [deleteModalFlight, setDeleteModalFlight] = useState<FlightData | null>(null);
  
  // New Confirmation Modals
  const [confirmStartModalFlight, setConfirmStartModalFlight] = useState<FlightData | null>(null);
  const [confirmRemoveOperatorFlight, setConfirmRemoveOperatorFlight] = useState<FlightData | null>(null);
  const [confirmFinishModalFlight, setConfirmFinishModalFlight] = useState<FlightData | null>(null);

  const logsEndRef = useRef<HTMLDivElement>(null);
  const actionMenuRef = useRef<HTMLDivElement>(null);
  const optionsMenuRef = useRef<HTMLDivElement>(null);

  const handleCreateFlight = (newFlight: FlightData) => {
    onUpdateFlights(prev => [newFlight, ...prev]);
    addToast('VOO CRIADO', `Voo ${newFlight.flightNumber} criado com sucesso.`, 'success');
    setIsCreateModalOpen(false);
  };

  // Notifications Logic
  const allNotifications = useMemo(() => {
      const msgs = flights.flatMap(f => (f.messages || []).map(m => ({ ...m, flight: f })));
      // Filtra mensagens que não são do gestor (mensagens recebidas)
      return msgs.filter(m => !m.isManager).sort((a,b) => b.timestamp.getTime() - a.timestamp.getTime());
  }, [flights]);

  // Auto-Update Logic (Usando o state setter global)
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (actionMenuRef.current && !actionMenuRef.current.contains(event.target as Node)) {
        setOpenMenuId(null);
      }
      if (optionsMenuRef.current && !optionsMenuRef.current.contains(event.target as Node)) {
        setShowOptionsDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
        onUpdateFlights(prevFlights => {
            return prevFlights.map(f => {
                const minutesToETD = getMinutesDiff(f.etd);
                // LÓGICA DE AUTOMATIZAÇÃO PARA FILA:
                // Só move para fila se NÃO tiver operador e estiver no prazo crítico
                if (f.status === FlightStatus.CHEGADA && minutesToETD < 60 && !f.operator && !f.isExcludedFromQueue) {
                    const newLog = createNewLog('SISTEMA', 'Voo movido para FILA automaticamente (ETD < 60min).', 'SISTEMA');
                    return { 
                        ...f, 
                        status: FlightStatus.FILA,
                        logs: [...(f.logs || []), newLog]
                    };
                }
                
                return f;
            });
        });
    }, 5000);
    return () => clearInterval(interval);
  }, [onUpdateFlights]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        if (observationModalFlight && newObservation.trim()) {
            handleSaveObservation();
        } else if (delayModalFlightId && delayReasonCode) {
            handleSubmitDelay();
        } else if (cancelModalFlight) {
            confirmCancelFlight();
        } else if (deleteModalFlight) {
            confirmDeleteFlight();
        } else if (confirmStartModalFlight) {
            handleConfirmStart();
        } else if (confirmFinishModalFlight) {
            handleConfirmFinish();
        } else if (confirmRemoveOperatorFlight) {
            handleConfirmRemoveOperator();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
      observationModalFlight, newObservation, 
      delayModalFlightId, delayReasonCode, 
      cancelModalFlight, confirmStartModalFlight, 
      confirmFinishModalFlight, confirmRemoveOperatorFlight,
      deleteModalFlight
  ]);

  const addToast = (title: string, message: string, type: 'success' | 'info' | 'warning' = 'info') => {
      const id = Date.now().toString();
      setToasts(prev => [...prev, { id, title, message, type }]);
      setTimeout(() => {
          setToasts(prev => prev.filter(t => t.id !== id));
      }, 5000);
  };

  const removeToast = (id: string) => {
      setToasts(prev => prev.filter(t => t.id !== id));
  };

  const visibleFlights = useMemo(() => flights.filter(f => !f.isHiddenFromGrid), [flights]);

  const shiftedFlights = useMemo(() => 
    visibleFlights.filter(f => isTimeInShift(f.etd, activeShift)), 
    [visibleFlights, activeShift]
  );

  const searchFilteredFlights = useMemo(() => {
    if (!globalSearchTerm) return shiftedFlights;
    const lowerTerms = globalSearchTerm.toLowerCase().trim().split(/\s+/);
    return shiftedFlights.filter(f => {
        const city = ICAO_CITIES[f.destination as string] || '';
        const allFields = [
            f.flightNumber, f.departureFlightNumber, f.airline, f.airlineCode, f.model, 
            f.registration, f.origin, f.destination, f.eta, f.etd, f.actualArrivalTime,
            f.positionId, f.positionType, f.pitId, f.operator,
            f.supportOperator, f.fleet, f.fleetType, f.vehicleType, 
            city,
            (f.airlineCode || '') + '-' + (f.flightNumber || ''),
            (f.airlineCode || '') + (f.flightNumber || ''),
            (f.airlineCode || '') + '-' + (f.departureFlightNumber || ''),
            (f.airlineCode || '') + (f.departureFlightNumber || '')
        ];
        const searchString = allFields
            .filter(Boolean)
            .map(val => String(val).toLowerCase())
            .join(' | ');
        
        return lowerTerms.every(term => searchString.includes(term));
    });
  }, [shiftedFlights, globalSearchTerm]);

  const stats = useMemo(() => ({
    total: searchFilteredFlights.filter(f => f.status !== FlightStatus.FINALIZADO && f.status !== FlightStatus.CANCELADO).length,
    chegada: searchFilteredFlights.filter(f => {
        const minutesToEta = getMinutesDiff(f.eta);
        return f.status === FlightStatus.CHEGADA && !(f.isOnGround && f.positionId) && minutesToEta <= 120;
    }).length,
    fila: searchFilteredFlights.filter(f => f.status === FlightStatus.FILA && !f.operator).length,
    designados: searchFilteredFlights.filter(f => f.status === FlightStatus.DESIGNADO).length,
    abastecendo: searchFilteredFlights.filter(f => f.status === FlightStatus.ABASTECENDO).length,
    finalizados: searchFilteredFlights.filter(f => f.status === FlightStatus.FINALIZADO || f.status === FlightStatus.CANCELADO).length,
  }), [searchFilteredFlights]);

  const tabs: { id: Tab; label: string; icon: React.ElementType; count?: number }[] = [
    { id: 'GERAL', label: 'MALHA GERAL', icon: LayoutGrid, count: stats.total },
    { id: 'CHEGADA', label: 'CHEGADA', icon: PlaneLanding, count: stats.chegada },
    { id: 'FILA', label: 'FILA', icon: ListOrdered, count: stats.fila },
    { id: 'DESIGNADOS', label: 'DESIGNADOS', icon: UserCheck, count: stats.designados },
    { id: 'ABASTECENDO', label: 'ABASTECENDO', icon: Droplet, count: stats.abastecendo },
    { id: 'FINALIZADO', label: 'FINALIZADOS', icon: CheckCircle, count: stats.finalizados },
  ];

  const filteredData = useMemo(() => {
    let base = searchFilteredFlights;
    
    switch (activeTab) {
      case 'CHEGADA': 
        base = searchFilteredFlights.filter(f => {
            const minutesToEta = getMinutesDiff(f.eta);
            return f.status === FlightStatus.CHEGADA && 
                   !(f.isOnGround && f.positionId) && 
                   minutesToEta <= 120;
        });
        break;
      case 'FILA': 
        base = searchFilteredFlights.filter(f => f.status === FlightStatus.FILA && !f.operator);
        break;
      case 'DESIGNADOS': base = searchFilteredFlights.filter(f => f.status === FlightStatus.DESIGNADO); break;
      case 'ABASTECENDO': base = searchFilteredFlights.filter(f => f.status === FlightStatus.ABASTECENDO); break;
      case 'FINALIZADO': base = searchFilteredFlights.filter(f => f.status === FlightStatus.FINALIZADO || f.status === FlightStatus.CANCELADO); break;
      case 'GERAL': 
        base = searchFilteredFlights.filter(f => {
            if (f.status === FlightStatus.FINALIZADO || f.status === FlightStatus.CANCELADO) {
                return false;
            }
            return true;
        });
        break;
      default: base = searchFilteredFlights;
    }

    return base;
  }, [activeTab, searchFilteredFlights, archivedIds]);

  const isStreamlinedView = ['FILA', 'DESIGNADOS', 'ABASTECENDO'].includes(activeTab);
  const isFinishedView = activeTab === 'FINALIZADO';

  const handleSort = (key: keyof FlightData) => {
    let direction: SortDirection = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    else if (sortConfig.key === key && sortConfig.direction === 'desc') direction = null;
    setSortConfig({ key: direction ? key : null, direction });
  };

  const renderEditableCell = (row: FlightData, colKey: keyof FlightData, value: string | number, className: string = "", rowIndex: number, colIndex: number, editable: boolean = true) => {
    const isFocused = focusedCell?.rowId === row.id && focusedCell?.col === colKey;
    const isEditing = editable && editingCell?.rowId === row.id && editingCell?.col === colKey;

    return (
      <td 
        data-rowid={row.id}
        data-colkey={colKey as string}
        data-rowindex={rowIndex}
        data-colindex={colIndex}
        data-editable={editable}
        className={`
          p-0 border-y border-l transition-all relative h-10 outline-none
          ${isDarkMode ? 'border-slate-700/50 bg-gradient-to-b from-slate-800/50 to-slate-900/80 group-hover:from-slate-700 group-hover:to-slate-800' : 'border-slate-200 bg-white group-hover:bg-slate-50'}
        `}
      >
        {isEditing ? (
          <input 
            type="text"
            autoFocus
            onFocus={(e) => e.target.select()}
            className={`absolute inset-0 w-full h-full text-center px-1 font-mono outline-none border-none text-[13px] uppercase font-bold text-inherit ${className} ${isDarkMode ? 'bg-slate-900 shadow-inner' : 'bg-white font-black text-slate-900'}`}
            value={value}
            onChange={(e) => handleFieldChange(row.id, colKey, e.target.value)}
            onBlur={() => setEditingCell(null)}
            onKeyDown={(e) => handleKeyDown(e, row.id, colKey as string, rowIndex, colIndex)}
          />
        ) : (
          <div 
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              if (isFocused) {
                if (editable) setEditingCell({ rowId: row.id, col: colKey });
              } else {
                setFocusedCell({ rowId: row.id, col: colKey });
                setEditingCell(null);
              }
            }}
            onKeyDown={(e) => handleKeyDown(e, row.id, colKey as string, rowIndex, colIndex)}
            className={`w-full h-full px-1 flex items-center ${colKey === 'airlineCode' ? 'justify-start ml-2' : 'justify-center'} font-mono text-[12px] select-none cursor-default outline-none ${isFocused ? 'ring-2 ring-indigo-500 ring-inset z-20 shadow-xl ' + (editable ? 'bg-indigo-600 text-white shadow-indigo-500/20' : 'bg-slate-500/10') : ''} ${className}`}
          >
            {colKey === 'airlineCode' ? (
              <AirlineLogo airlineCode={row.airlineCode} className={isFocused && editable && isDarkMode ? 'invert brightness-200 justify-start' : 'justify-start'} />
            ) : (
              value || '--'
            )}
          </div>
        )}
      </td>
    );
  };

  const sortedData = useMemo(() => {
    let data = [...filteredData];
    
    // Default sort by isPinned
    if (!sortConfig.key || !sortConfig.direction) {
        return data.sort((a, b) => {
            if (a.isPinned && !b.isPinned) return -1;
            if (!a.isPinned && b.isPinned) return 1;
            return 0;
        });
    }
    
    return data.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      
      const aValue = (a[sortConfig.key!] ?? '').toString();
      const bValue = (b[sortConfig.key!] ?? '').toString();
      return sortConfig.direction === 'asc' 
        ? aValue.localeCompare(bValue) 
        : bValue.localeCompare(aValue);
    });
  }, [filteredData, sortConfig]);

  // --- ACTIONS HANDLERS (ATUALIZANDO ESTADO GLOBAL) ---
  const handleMoveToQueue = (flight: FlightData, e: React.MouseEvent) => {
      e.stopPropagation();
      
      // TRAVA LÓGICA: Se tem operador, não pode ir para fila.
      if (flight.operator) {
          addToast('AÇÃO NEGADA', 'Voo com operador designado não pode ir para a fila.', 'warning');
          return;
      }

      const newLog = createNewLog('MANUAL', 'Voo movido para FILA manualmente.', 'GESTOR_MESA');
      onUpdateFlights(prev => prev.map(f => f.id === flight.id ? { 
          ...f, 
          status: FlightStatus.FILA,
          logs: [...(f.logs || []), newLog]
      } : f));
      addToast('VOO NA FILA', `Voo ${flight.flightNumber} adicionado à fila de prioridade.`, 'success');
  };

  const handleManualStart = (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const newLog = createNewLog('SISTEMA', 'Início de abastecimento confirmado.', 'GESTOR_MESA');
      onUpdateFlights(prev => prev.map(f => f.id === id ? { 
          ...f, 
          status: FlightStatus.ABASTECENDO, 
          startTime: new Date(),
          logs: [...(f.logs || []), newLog]
      } : f));
  };

  const handleManualFinish = (flight: FlightData, e: React.MouseEvent) => {
      e.stopPropagation();
      const minutesToETD = getMinutesDiff(flight.etd);
      if (minutesToETD < 0) {
          setDelayModalFlightId(flight.id);
          setDelayReasonCode('');
          setDelayReasonDetail('');
          return;
      }
      confirmFinish(flight.id, flight.flightNumber);
  };

  const handleCancelFlight = (flight: FlightData, e: React.MouseEvent) => {
      e.stopPropagation();
      setCancelModalFlight(flight);
      setOpenMenuId(null);
  };

  const handleDeleteFlight = (flight: FlightData, e: React.MouseEvent) => {
      e.stopPropagation();
      setDeleteModalFlight(flight);
      setOpenMenuId(null);
  };

  const confirmDeleteFlight = () => {
      if (!deleteModalFlight) return;
      onUpdateFlights(prev => prev.filter(f => f.id !== deleteModalFlight.id));
      addToast('VOO EXCLUÍDO', `Voo ${deleteModalFlight.flightNumber || deleteModalFlight.departureFlightNumber} foi removido do sistema.`, 'info');
      setDeleteModalFlight(null);
  };

  const confirmCancelFlight = () => {
      if (!cancelModalFlight) return;
      
      const newLog = createNewLog('MANUAL', 'Voo CANCELADO manualmente pelo gestor.', 'GESTOR_MESA');
      onUpdateFlights(prev => prev.map(f => f.id === cancelModalFlight.id ? { 
          ...f, 
          status: FlightStatus.CANCELADO,
          logs: [...(f.logs || []), newLog]
      } : f));
      
      addToast('VOO CANCELADO', `Voo ${cancelModalFlight.flightNumber} foi cancelado.`, 'info');
      setCancelModalFlight(null);
  };

  const handleReportCalco = (flight: FlightData, e: React.MouseEvent) => {
      e.stopPropagation();
      const newLog = createNewLog('MANUAL', 'Calço reportado manualmente pelo gestor.', 'GESTOR_MESA');
      onUpdateFlights(prev => prev.map(f => f.id === flight.id ? { 
          ...f, 
          isOnGround: true,
          logs: [...(f.logs || []), newLog]
      } : f));
      addToast('CALÇO REPORTADO', `Aeronave ${flight.registration} (Voo ${flight.flightNumber}) em calço.`, 'success');
      setOpenMenuId(null);
  };

  const confirmFinish = (id: string, flightNumber: string, delayJustification?: string) => {
      let newLog: FlightLog;
      if (delayJustification) {
          newLog = createNewLog('ATRASO', `Finalizado com ATRASO. Justificativa: ${delayJustification}`, 'GESTOR_MESA');
      } else {
          newLog = createNewLog('SISTEMA', 'Abastecimento finalizado no horário.', 'GESTOR_MESA');
      }
      onUpdateFlights(prev => prev.map(f => f.id === id ? { 
          ...f, 
          status: FlightStatus.FINALIZADO, 
          endTime: new Date(),
          delayJustification: delayJustification,
          logs: [...(f.logs || []), newLog]
      } : f));
      addToast(
          delayJustification ? 'ATRASO REGISTRADO' : 'OPERAÇÃO CONCLUÍDA', 
          `Voo ${flightNumber} finalizado${delayJustification ? ' com relatório de atraso' : ''}.`, 
          delayJustification ? 'warning' : 'success'
      );
      setDelayModalFlightId(null);
  };

  const handleSubmitDelay = () => {
      if (delayModalFlightId && delayReasonCode) {
          const flight = flights.find(f => f.id === delayModalFlightId);
          if (flight) {
              const justification = `${delayReasonCode}${delayReasonDetail ? ` - ${delayReasonDetail}` : ''}`;
              confirmFinish(delayModalFlightId, flight.flightNumber, justification);
          }
      }
  };
  
  const handleRemoveStandby = (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const newLog = createNewLog('MANUAL', 'Removido de Standby. Retomando prioridade.', 'GESTOR_MESA');
      onUpdateFlights(prev => prev.map(f => f.id === id ? { 
          ...f, 
          isStandby: false, 
          standbyReason: undefined,
          logs: [...(f.logs || []), newLog]
      } : f));
  };

  const handleConfirmVisual = (id: string, flightNumber: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setArchivedIds(prev => new Set(prev).add(id));
      
      const newLog = createNewLog('MANUAL', 'Voo arquivado da visão geral pelo gestor.', 'GESTOR_MESA');
      onUpdateFlights(prev => prev.map(f => f.id === id ? {
          ...f,
          isHiddenFromGrid: true,
          logs: [...(f.logs || []), newLog]
      } : f));
      
      addToast('ARQUIVADO', `Voo ${flightNumber} movido para histórico.`, 'info');
  };

  const handleClearFinished = () => {
      onUpdateFlights(prev => prev.map(f => 
          (f.status === FlightStatus.FINALIZADO || f.status === FlightStatus.CANCELADO) 
              ? { ...f, isHiddenFromGrid: true } 
              : f
      ));
      addToast('HISTÓRICO LIMPO', 'Voos finalizados e cancelados foram arquivados.', 'success');
  };

  const handlePinFlight = (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      onUpdateFlights(prev => prev.map(f => {
          if (f.id === id) {
              const newLog = createNewLog('MANUAL', f.isPinned ? 'Voo desfixado do topo pelo gestor.' : 'Voo fixado no topo pelo gestor.', 'GESTOR_MESA');
              return { ...f, isPinned: !f.isPinned, logs: [...(f.logs || []), newLog] };
          }
          return f;
      }));
      setOpenMenuId(null);
  };

  const handleReforco = (flight: FlightData, e: React.MouseEvent) => {
      e.stopPropagation();
      const newLog = createNewLog('MANUAL', 'Voo redirecionado para REFORÇO (Fila).', 'GESTOR_MESA');
      onUpdateFlights(prev => prev.map(f => f.id === flight.id ? { 
          ...f, 
          status: FlightStatus.FILA,
          operator: undefined,
          designationTime: undefined,
          logs: [...(f.logs || []), newLog]
      } : f));
      addToast('REFORÇO', `Voo ${flight.flightNumber} retornado para a fila.`, 'success');
      setOpenMenuId(null);
  };

  const handleConfirmStart = () => {
      if (!confirmStartModalFlight) return;
      handleManualStart(confirmStartModalFlight.id, { stopPropagation: () => {} } as React.MouseEvent);
      addToast('ABASTECIMENTO INICIADO', `Voo ${confirmStartModalFlight.flightNumber} em abastecimento.`, 'success');
      setConfirmStartModalFlight(null);
  };

  const handleConfirmRemoveOperator = () => {
      if (!confirmRemoveOperatorFlight) return;
      const newLog = createNewLog('MANUAL', 'Operador removido. Voo retornou para a fila.', 'GESTOR_MESA');
      onUpdateFlights(prev => prev.map(f => f.id === confirmRemoveOperatorFlight.id ? { 
          ...f, 
          status: FlightStatus.FILA,
          operator: undefined,
          designationTime: undefined,
          logs: [...(f.logs || []), newLog]
      } : f));
      addToast('OPERADOR REMOVIDO', `Operador removido do voo ${confirmRemoveOperatorFlight.flightNumber}.`, 'info');
      setConfirmRemoveOperatorFlight(null);
  };

  const handleConfirmFinish = () => {
      if (!confirmFinishModalFlight) return;
      handleManualFinish(confirmFinishModalFlight, { stopPropagation: () => {} } as React.MouseEvent);
      setConfirmFinishModalFlight(null);
  };

  // --- ASSIGNMENT LOGIC ---
  const openAssignModal = (flight: FlightData, e: React.MouseEvent) => {
      e.stopPropagation();
      setAssignModalFlight(flight);
      setSelectedOperatorId(null);
  };

  const confirmAssignment = (opId?: string) => {
      const idToUse = opId || selectedOperatorId;
      if (assignModalFlight && idToUse) {
          const operator = operators.find(op => op.id === idToUse);
          if (!operator) return;

          const newLog = createNewLog('MANUAL', `Operador ${operator.warName} designado manualmente por ${ltName}.`, 'GESTOR_MESA');
          
          // IMPORTANTE: Ao designar, o status vai para DESIGNADO, removendo automaticamente da FILA
          onUpdateFlights(prev => prev.map(f => f.id === assignModalFlight.id ? { 
              ...f, 
              status: FlightStatus.DESIGNADO, 
              operator: operator.warName,
              fleet: operator.assignedVehicle,
              fleetType: operator.fleetCapability as any,
              designationTime: new Date(),
              assignmentTime: new Date(),
              assignedByLt: ltName,
              logs: [...(f.logs || []), newLog]
          } : f));

          addToast('DESIGNADO', `Operador ${operator.warName} assumiu voo ${assignModalFlight.flightNumber}.`, 'success');
          setAssignModalFlight(null);
          setSelectedOperatorId(null);
      }
  };

  const confirmSupportAssignment = (opId?: string) => {
      const idToUse = opId || selectedOperatorId;
      if (assignSupportModalFlight && idToUse) {
          const operator = operators.find(op => op.id === idToUse);
          if (!operator) return;

          const newLog = createNewLog('MANUAL', `Op. Apoio ${operator.warName} designado manualmente.`, 'GESTOR_MESA');
          
          onUpdateFlights(prev => prev.map(f => f.id === assignSupportModalFlight.id ? { 
              ...f, 
              supportOperator: operator.warName,
              logs: [...(f.logs || []), newLog]
          } : f));

          addToast('APOIO DESIGNADO', `Operador ${operator.warName} assumiu como apoio no voo ${assignSupportModalFlight.flightNumber}.`, 'success');
          setAssignSupportModalFlight(null);
          setSelectedOperatorId(null);
      }
  };

  // Filters operators based on Vehicle Compatibility (SRV vs CTA)
  const getEligibleOperators = (flight: FlightData, isSupport: boolean = false) => {
      // Get all active missions to determine status
      const activeMissions = flights.filter(f => f.status !== 'FINALIZADO' && f.status !== 'CANCELADO');

      return operators.map(op => {
          // Find if operator has an active mission in ANOTHER flight
          const mission = activeMissions.find(m => 
              m.id !== flight.id && 
              (m.operator?.toLowerCase() === op.warName.toLowerCase() || m.supportOperator?.toLowerCase() === op.warName.toLowerCase())
          );
          
          let dynamicStatus = op.status;
          if (mission) {
              if (mission.status === 'ABASTECENDO') dynamicStatus = 'OCUPADO'; 
              else if (mission.status === 'DESIGNADO') dynamicStatus = 'DESIGNADO';
              else dynamicStatus = 'OCUPADO';
          }
          
          return { ...op, status: dynamicStatus };
      });
  };

  // OBSERVATION HANDLERS
  const handleOpenObservationModal = (flight: FlightData, e: React.MouseEvent) => {
    e.stopPropagation();
    setObservationModalFlight(flight);
    setNewObservation(''); 
    setOpenMenuId(null);
  };

  const handleSaveObservation = () => {
    if (observationModalFlight && newObservation.trim()) {
      const newLog = createNewLog('OBSERVACAO', newObservation.trim(), 'GESTOR_MESA');
      onUpdateFlights(prev => prev.map(f => 
        f.id === observationModalFlight.id 
          ? { ...f, logs: [...(f.logs || []), newLog] } 
          : f
      ));
      addToast('OBSERVAÇÃO REGISTRADA', `Nota adicionada ao voo ${observationModalFlight.flightNumber}.`, 'success');
      setObservationModalFlight(null);
      setNewObservation('');
    }
  };

  // --- HELPER RENDERS ---
  const getDynamicStatus = (f: FlightData) => {
    const minutesToETA = getMinutesDiff(f.eta);
    const minutesToETD = getMinutesDiff(f.etd);

    if (f.status === FlightStatus.FINALIZADO || f.status === FlightStatus.CANCELADO) {
        if (activeTab === 'FINALIZADO') {
            if (f.status === FlightStatus.CANCELADO) return { 
                label: 'CANCELADO', 
                color: isDarkMode ? 'text-red-400 bg-red-500/10 border-red-500/30' : 'text-red-600 bg-red-50 border-red-200' 
            };
            const hasSwap = f.logs.some(l => l.message.toLowerCase().includes('troca') || l.message.toLowerCase().includes('swap'));
            if (hasSwap) return { 
                label: 'COM TROCA', 
                color: isDarkMode ? 'text-purple-400 bg-purple-500/10 border-purple-500/30' : 'text-purple-600 bg-purple-50 border-purple-200' 
            };
            if (checkIsDelayed(f) || f.delayJustification) return { 
                label: 'COM ATRASO', 
                color: isDarkMode ? 'text-amber-500 bg-amber-500/10 border-amber-500/30' : 'text-amber-600 bg-amber-50 border-amber-200' 
            };
            return { 
                label: 'COM SUCESSO', 
                color: isDarkMode ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' : 'text-emerald-600 bg-emerald-50 border-emerald-200' 
            };
        }
        if (activeTab === 'GERAL' && f.status === FlightStatus.FINALIZADO) {
            return { 
                label: 'FINALIZADO', 
                color: isDarkMode ? 'text-emerald-300 bg-emerald-500/20 border-emerald-500' : 'text-emerald-700 bg-emerald-50 border-emerald-500' 
            };
        }
    }

    if (f.status === FlightStatus.CHEGADA) {
        if (f.isOnGround && f.positionId) return { 
            label: 'CALÇADA', 
            color: isDarkMode ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' : 'text-emerald-600 bg-emerald-50 border-emerald-200' 
        };
        if (f.isOnGround) return { 
            label: 'SOLO', 
            color: isDarkMode ? 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30' : 'text-indigo-600 bg-indigo-50 border-indigo-200' 
        };
        if (minutesToETA < 10) return { 
            label: 'APROXIMAÇÃO', 
            color: isDarkMode ? 'text-amber-400 bg-amber-500/10 border-amber-500/30' : 'text-amber-600 bg-amber-50 border-amber-200' 
        };
        const h = Math.floor(minutesToETA / 60);
        const m = Math.floor(minutesToETA % 60);
        return { 
            label: `${h}H ${m}M`, 
            color: isDarkMode ? 'text-slate-400 bg-slate-800/50 border-slate-700' : 'text-slate-600 bg-slate-100 border-slate-300' 
        };
    }

    if (f.status === FlightStatus.FILA) {
        if (f.isStandby) return { 
            label: 'STAND-BY', 
            color: isDarkMode ? 'text-slate-400 bg-slate-800 border-slate-600' : 'text-slate-600 bg-slate-100 border-slate-300' 
        };
        if (minutesToETD < 0) return { 
            label: 'ATRASADO', 
            color: isDarkMode ? 'text-red-500 bg-red-900/50 border-red-500' : 'text-red-700 bg-red-100 border-red-500' 
        };
        if (minutesToETD < 20) return { 
            label: '-20M CRÍTICO', 
            color: isDarkMode ? 'text-red-500 bg-red-500/20 border-red-500' : 'text-red-700 bg-red-50 border-red-500' 
        };
        if (minutesToETD < 25) return { 
            label: '-25M ALERTA', 
            color: isDarkMode ? 'text-amber-500 bg-amber-500/20 border-amber-500' : 'text-amber-700 bg-amber-50 border-amber-500' 
        };
        if (minutesToETD < 30) return { 
            label: '-30M', 
            color: isDarkMode ? 'text-amber-400 bg-amber-500/10 border-amber-400/50' : 'text-amber-600 bg-amber-50 border-amber-200' 
        };
        if (minutesToETD < 45) return { 
            label: '-45M', 
            color: isDarkMode ? 'text-yellow-200 bg-yellow-500/10 border-yellow-200/30' : 'text-yellow-700 bg-yellow-50 border-yellow-200' 
        };
        return { 
            label: '-1H', 
            color: isDarkMode ? 'text-slate-300 bg-slate-800 border-slate-600' : 'text-slate-600 bg-slate-100 border-slate-300' 
        };
    }

    if (f.status === FlightStatus.DESIGNADO) {
        const elapsed = f.designationTime ? (new Date().getTime() - f.designationTime.getTime()) / 60000 : 0;
        if (elapsed > 15) return { 
            label: 'AGUARDANDO', 
            color: isDarkMode ? 'text-amber-500 bg-amber-500/10 border-amber-500' : 'text-amber-600 bg-amber-50 border-amber-200' 
        };
        if (elapsed > 10) return { 
            label: 'ACOPLANDO', 
            color: isDarkMode ? 'text-blue-400 bg-blue-500/10 border-blue-400' : 'text-blue-600 bg-blue-50 border-blue-200' 
        };
        return { 
            label: 'A CAMINHO', 
            color: isDarkMode ? 'text-indigo-400 bg-indigo-500/10 border-indigo-400' : 'text-indigo-600 bg-indigo-50 border-indigo-200' 
        };
    }

    if (f.status === FlightStatus.ABASTECENDO) {
        const isDelayed = minutesToETD <= 0;
        const isPausado = (f.currentFlowRate ?? 0) === 0;
        // Finalizando se: faltam menos de 10 min OU se já passou de 90% do volume
        const isFinalizando = (minutesToETD < 10 && minutesToETD > 0) || (f.fuelStatus > 90);
        
        let label = 'ABASTECENDO';
        let color = isDarkMode ? 'text-blue-400 bg-blue-500/20 border-blue-500/30' : 'text-blue-600 bg-blue-50 border-blue-200';
        
        if (isPausado) {
            label = 'PAUSADO';
            color = isDarkMode ? 'text-amber-500 bg-amber-500/20 border-amber-500' : 'text-amber-600 bg-amber-50 border-amber-200';
        } else if (isFinalizando) {
            label = 'FINALIZANDO';
            color = isDarkMode ? 'text-blue-300 bg-blue-500/20 border-blue-300' : 'text-blue-700 bg-blue-50 border-blue-300';
        }
        
        if (isDelayed) {
            color = isDarkMode ? 'text-white bg-red-600 border-red-500' : 'text-white bg-red-700 border-red-600';
        }
        
        return { label, color };
    }

    return null;
  };

  const SortableHeader = ({ label, columnKey, className = "" }: { label: string, columnKey: keyof FlightData, className?: string }) => {
    const isActive = sortConfig.key === columnKey;
    return (
      <th 
        className={`px-1 py-1.5 sticky top-0 cursor-pointer select-none transition-all group z-50 first:rounded-l-[2px] last:rounded-r-[2px] grid-ops-header-th border-y ${isDarkMode ? 'bg-slate-950 border-slate-700/50 shadow-sm' : 'bg-[#2D8E48] border-[#29824a] text-white shadow-none'} ${className}`}
        onClick={() => handleSort(columnKey)}
      >
        <div className={`flex items-center gap-1 ${className.includes('text-center') ? 'justify-center' : 'justify-start'}`}>
          <span className={`font-black text-[9px] uppercase tracking-wider transition-colors ${isActive ? (isDarkMode ? 'text-emerald-400' : 'text-slate-100') : (isDarkMode ? 'text-white' : 'text-white')}`}>
            {label}
          </span>
          <div className="flex items-center justify-center transition-all">
            {isActive ? (
                sortConfig.direction === 'asc' ? <ArrowUp size={10} className={isDarkMode ? "text-emerald-500" : "text-slate-100"} /> : <ArrowDown size={10} className={isDarkMode ? "text-emerald-500" : "text-slate-100"} />
            ) : <ArrowUpDown size={8} className={isDarkMode ? "text-white/20 group-hover:text-white/60" : "text-slate-200 group-hover:text-white"} />}
          </div>
        </div>
      </th>
    );
  };

  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const [optionsPortalTarget, setOptionsPortalTarget] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setPortalTarget(document.getElementById('subheader-portal-target'));
    setOptionsPortalTarget(document.getElementById('header-options-portal-target'));
  }, []);

  useEffect(() => {
      if (pendingAction === 'CREATE') {
          setIsCreateModalOpen(true);
          if (setPendingAction) setPendingAction(null);
      } else if (pendingAction === 'IMPORT') {
          setIsImportModalOpen(true);
          if (setPendingAction) setPendingAction(null);
      }
  }, [pendingAction, setPendingAction]);

  if (isLoading) {
    return (
      <div className={`w-full h-full flex items-center justify-center ${isDarkMode ? 'bg-slate-950' : 'bg-slate-50'}`}>
        <Spinner size={48} text="Sincronizando Malha..." />
      </div>
    );
  }

  const optionsDropdownContent = (
    <div className="relative" ref={optionsMenuRef}>
        <button 
            onClick={() => setShowOptionsDropdown(!showOptionsDropdown)}
            className={`flex items-center gap-2 px-6 py-2 rounded-md border border-[#FEDC00] transition-all font-bold uppercase tracking-wider text-[11px] bg-[#FEDC00] text-[#4e4141] hover:bg-[#e5c600] shadow-sm`}
        >
            <span>Opções</span>
            <Settings size={14} />
        </button>

        {showOptionsDropdown && (
            <div className={`absolute right-0 top-11 w-56 ${isDarkMode ? 'bg-slate-900 border-emerald-500/30 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)]' : 'bg-white border-emerald-500/30 shadow-xl'} border rounded-xl z-[100] overflow-hidden animate-in fade-in slide-in-from-top-2`}>
                <div className="p-1.5 space-y-0.5">
                    <div className="px-3 py-2 border-b border-white/5 mb-1">
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Ações da Malha</span>
                    </div>
                    <button 
                        onClick={() => {
                            if (onUpdateFlights && meshFlights) {
                                onUpdateFlights(prev => {
                                    // Manter voos existentes que já foram processados
                                    const existingIds = new Set(prev.map(f => f.id));
                                    const newFlights = meshFlights.map(m => {
                                        if (existingIds.has(m.id)) return prev.find(f => f.id === m.id)!;
                                        return {
                                            id: m.id,
                                            flightNumber: '--',
                                            departureFlightNumber: m.departureFlightNumber,
                                            airline: m.airline,
                                            airlineCode: m.airlineCode,
                                            model: m.model || '',
                                            registration: m.registration || '',
                                            origin: '',
                                            destination: m.destination,
                                            eta: m.eta || '--:--',
                                            etd: m.etd,
                                            actualArrivalTime: m.actualArrivalTime,
                                            positionId: m.positionId || '',
                                            status: FlightStatus.CHEGADA,
                                            logs: []
                                        };
                                    });
                                    return newFlights as any[]; // Type cast handled by external context
                                });
                                addToast('SINCRONIZAÇÃO', 'Voos da Malha Base sincronizados!', 'success');
                            }
                            setShowOptionsDropdown(false);
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${isDarkMode ? 'text-slate-300 hover:bg-emerald-500/10 hover:text-emerald-400' : 'text-slate-600 hover:bg-emerald-50 hover:text-emerald-600'}`}
                    >
                        <RefreshCw size={14} />
                        Sincronizar Dados
                    </button>
                    <button 
                        onClick={() => {
                            handleClearFinished();
                            setShowOptionsDropdown(false);
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${isDarkMode ? 'text-slate-300 hover:bg-red-500/10 hover:text-red-400' : 'text-slate-600 hover:bg-red-50 hover:text-red-400'}`}
                    >
                        <Archive size={14} />
                        Arquivar Finalizados
                    </button>
                    <button 
                        onClick={() => {
                            // Limpar toda a malha operacional
                            onUpdateFlights([]);
                            addToast('MALHA GERAL', 'Toda a malha operacional foi removida.', 'warning');
                            setShowOptionsDropdown(false);
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${isDarkMode ? 'text-red-400 hover:bg-red-500/10 hover:text-red-300' : 'text-red-600 hover:bg-red-50 hover:text-red-700'}`}
                    >
                        <Trash2 size={14} />
                        Limpar Malha Geral
                    </button>
                </div>
            </div>
        )}
    </div>
  );

  const subheaderContent = (
      <div className={`px-6 h-16 shrink-0 flex items-center justify-between border-b ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-[#3CA317] border-transparent text-white'} z-[60] w-full`}>
        <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
                <div>
                  <h2 className="text-sm font-black text-white tracking-tighter uppercase leading-none">Malha Geral</h2>
                </div>
            </div>

            <div className="flex items-center gap-2 ml-6 bg-black/20 p-1 rounded border border-white/10 w-[270px] h-10">
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

            <div className="relative w-[180px] h-9 ml-6">
                <div className={`absolute inset-0 bg-white shadow-sm border ${isDarkMode ? 'border-slate-700' : 'border-white/20'} rounded flex items-center transition-all`}>
                    <Search size={14} className="shrink-0 text-slate-800 ml-3" />
                    <input 
                        type="text" 
                        placeholder="Pesquise..." 
                        className="bg-transparent border-none outline-none text-[10px] text-slate-900 placeholder:text-slate-500 font-mono uppercase w-full px-3 transition-all h-full rounded"
                        value={globalSearchTerm}
                        onChange={(e) => onUpdateSearch && onUpdateSearch(e.target.value)}
                    />
                    {globalSearchTerm && (
                        <button 
                            onClick={() => onUpdateSearch && onUpdateSearch('')}
                            className="p-1.5 mr-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
                        >
                            <X size={12} />
                        </button>
                    )}
                </div>
            </div>
        </div>

        {optionsDropdownContent}
      </div>
  );

  return (
    <div className={`w-full h-full flex flex-col ${isDarkMode ? 'bg-slate-950' : 'bg-slate-50'} overflow-hidden selection:bg-emerald-500/30 font-sans relative`}>
      
      {/* HEADER E TABS */}
      {portalTarget ? createPortal(subheaderContent, portalTarget) : subheaderContent}
      <div className={`h-12 shrink-0 flex border-b ${isDarkMode ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'} z-30 overflow-hidden`}>
        <nav className="flex w-full">
                {tabs.map((tab) => {
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            data-active={isActive ? "true" : "false"}
                            className={`
                                table-tab-btn
                                flex-1 h-full px-2 text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 border-r ${isDarkMode ? 'border-slate-950/20' : 'border-slate-200'} last:border-r-0
                                ${isActive 
                                    ? (isDarkMode ? 'bg-slate-950 text-emerald-400 border-b-2 border-emerald-500' : 'bg-[#329858] text-white border-b-0')
                                    : (isDarkMode ? 'text-slate-500 hover:bg-slate-800 hover:text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900')}
                            `}
                        >
                            {tab.label}
                            {tab.count !== undefined && (
                                <span className={`flex items-center justify-center px-1.5 min-w-[18px] h-4 text-[9px] font-black rounded-sm ${isActive ? (isDarkMode ? 'bg-emerald-500 text-slate-950' : 'bg-white text-[#2D8E48]') : (isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500')}`}>
                                    {tab.count}
                                </span>
                            )}
                        </button>
                    );
                })}
            </nav>
          </div>

      {/* GRID CONTAINER */}
      <div className={`flex-1 min-w-0 overflow-hidden relative ${isDarkMode ? 'bg-slate-950' : 'bg-slate-50'} pt-2`}>
            <div className="w-full h-full overflow-auto min-w-0 custom-scrollbar relative">
              <table ref={tableRef} className="w-full text-left border-separate border-spacing-x-0 border-spacing-y-1 px-2 grid-ops-table -mt-1">
                  <thead className="grid-ops-thead relative z-50">
                      <tr id="grid-header-container" className="h-10">
                    {/* LAYOUT CONDICIONAL DE COLUNAS */}
                    {activeTab === 'FILA' ? (
                        <>
                            <SortableHeader label="COMP." columnKey="airlineCode" className="text-center w-20" />
                            <SortableHeader label="V.SAÍDA" columnKey="departureFlightNumber" className="text-center" />
                            <SortableHeader label="ICAO" columnKey="destination" className="text-center" />
                            <SortableHeader label="CID" columnKey="destination" className="text-center w-12" />
                            <SortableHeader label="PREFIXO" columnKey="registration" className="text-center w-16" />
                            <SortableHeader label="POS" columnKey="positionId" className="text-center w-12" />
                            <SortableHeader label="ETD" columnKey="etd" className="text-center w-16" />
                            <SortableHeader label="CALÇO" columnKey="actualArrivalTime" className="text-center w-16" />
                            <SortableHeader label="ETA" columnKey="eta" className="text-center w-16" />
                            <SortableHeader label="OPERADOR" columnKey="operator" className="text-left pl-2 w-28" />
                            <SortableHeader label="FROTA" columnKey="fleet" className="text-center w-16" />
                            <SortableHeader label="FRT.TIPO" columnKey="fleet" className="text-center w-16" />
                        </>
                    ) : isStreamlinedView ? (
                        <>
                            <SortableHeader label="COMP." columnKey="airlineCode" className="text-center w-[10%]" />
                            <SortableHeader label="V.SAÍDA" columnKey="departureFlightNumber" className="text-center w-[10%]" />
                            <SortableHeader label="ICAO" columnKey="destination" className="text-center w-[10%]" />
                            <SortableHeader label="CID" columnKey="destination" className={`text-center ${activeTab === 'DESIGNADOS' ? 'w-[15%]' : 'w-12'}`} />
                            <SortableHeader label="PREFIXO" columnKey="registration" className="text-center w-[10%]" />
                            <SortableHeader label="POS" columnKey="positionId" className={`text-center ${activeTab === 'DESIGNADOS' ? 'w-[10%]' : 'w-12'}`} />
                            <SortableHeader label="CALÇO" columnKey="actualArrivalTime" className="text-center w-16" />
                            <SortableHeader label="ETD" columnKey="etd" className="text-center w-[10%]" />
                            <SortableHeader label="OPERADOR" columnKey="operator" className={`${activeTab === 'DESIGNADOS' ? 'text-left pl-2 w-[15%]' : 'text-left pl-2 w-[20%]'}`} />
                            <SortableHeader label="FROTA" columnKey="fleet" className="text-center w-[5%]" />
                            <SortableHeader label="FRT.TIPO" columnKey="fleet" className="text-center w-[5%]" />
                            {activeTab === 'DESIGNADOS' && (
                                <>
                                    <SortableHeader label="HR.D" columnKey="assignmentTime" className="text-center w-16" />
                                    <SortableHeader label="LT" columnKey="assignedByLt" className="text-left pl-2 w-28" />
                                </>
                            )}
                            {activeTab === 'ABASTECENDO' && (
                                <SortableHeader label="VAZÃO" columnKey="maxFlowRate" className="text-center" />
                            )}
                        </>
                    ) : isFinishedView ? (
                        <>
                            <SortableHeader label="COMP." columnKey="airlineCode" className="text-center w-20" />
                            <SortableHeader label="PREFIXO" columnKey="registration" className="text-center" />
                            <SortableHeader label="V.SAÍDA" columnKey="departureFlightNumber" className="text-center" />
                            <SortableHeader label="ICAO" columnKey="destination" className="text-center" />
                            <SortableHeader label="CID" columnKey="destination" className="text-center w-12" />
                            <SortableHeader label="POS" columnKey="positionId" className="text-center w-12" />
                            <SortableHeader label="CALÇO" columnKey="actualArrivalTime" className="text-center w-16" />
                            <SortableHeader label="ETD" columnKey="etd" className="text-center w-16" />
                            <SortableHeader label="OPERADOR" columnKey="operator" className="text-left pl-2 w-28" />
                            <SortableHeader label="FROTA" columnKey="fleet" className="text-center w-16" />
                            <SortableHeader label="FRT.TIPO" columnKey="fleet" className="text-center w-16" />
                            <th className={`px-1 py-1 sticky top-0 text-center z-50 grid-ops-header-th border-y ${isDarkMode ? 'bg-slate-950 border-slate-700/50 shadow-sm' : 'bg-[#2D8E48] border-[#29824a] text-white shadow-none'}`}>
                                <div className="flex items-center justify-center gap-1.5">
                                    <span className={`font-black text-[9px] uppercase tracking-wider ${isDarkMode ? 'text-white' : 'text-white'}`}>
                                        TAB
                                    </span>
                                </div>
                            </th>
                            <SortableHeader label="VAZÃO" columnKey="maxFlowRate" className="text-center" />
                        </>
                    ) : (
                        <>
                            <SortableHeader label="COMP." columnKey="airlineCode" className="text-center w-20" />
                            <SortableHeader label="PREFIXO" columnKey="registration" className="text-center" />
                            <SortableHeader label="MODELO" columnKey="model" className="text-center" />
                            <SortableHeader label="V.CHEG" columnKey="flightNumber" className="text-center" />
                            <SortableHeader label="ETA" columnKey="eta" className="text-center" />
                            <SortableHeader label="V.SAÍDA" columnKey="departureFlightNumber" className="text-center" />
                            <SortableHeader label="ICAO" columnKey="destination" className="text-center" />
                            <SortableHeader label="CID" columnKey="destination" className="text-center w-12" />
                            <SortableHeader label="POS" columnKey="positionId" className="text-center w-12" />
                            <SortableHeader label="CALÇO" columnKey="actualArrivalTime" className="text-center w-16" />
                            <SortableHeader label="ETD" columnKey="etd" className="text-center w-16" />
                            <SortableHeader label="OPERADOR" columnKey="operator" className="text-left pl-2 w-28" />
                            <SortableHeader label="FROTA" columnKey="fleet" className="text-center w-16" />
                            <SortableHeader label="FRT.TIPO" columnKey="fleet" className="text-center w-16" />
                            {activeTab === 'GERAL' && (
                                <SortableHeader label="VAZÃO" columnKey="maxFlowRate" className="text-center" />
                            )}
                        </>
                    )}
                      
                      {activeTab === 'DESIGNADOS' ? (
                        <SortableHeader label="STATUS" columnKey="status" className="text-center w-36" />
                      ) : (
                        <SortableHeader label="STATUS" columnKey="status" className="text-center w-24" />
                      )}

                      <th className={`px-1 py-1 sticky top-0 text-center z-50 grid-ops-header-th border-y ${isDarkMode ? 'bg-slate-950 border-slate-700/50 shadow-sm' : 'bg-[#2D8E48] border-[#29824a] text-white shadow-none'} last:rounded-r-[4px] group ${activeTab === 'DESIGNADOS' ? 'w-12' : ''}`}>
                        <div className="flex items-center justify-center gap-1.5">
                          <span className={`font-black text-[9px] uppercase tracking-wider ${isDarkMode ? 'text-white' : 'text-white'}`}>
                            AÇÕES
                          </span>
                        </div>
                      </th>
                  </tr>
              </thead>
              <tbody className="text-[11px] font-bold">
                  {sortedData.map((row, rowIndex) => {
                      const dynamicStatus = getDynamicStatus(row);
                      return (
                      <tr 
                          key={row.id} 
                          data-rowindex={rowIndex}
                          onClick={() => setSelectedFlight(row)}
                          className={`h-10 cursor-pointer transition-all active:scale-[0.99] group shadow-sm rounded-[4px] ${isDarkMode ? '' : 'hover:bg-slate-50'}`}
                      >
                          {/* AIRLINE */}
                          {renderEditableCell(row, 'airlineCode', row.airlineCode, "justify-start text-left first:rounded-l-[4px]", rowIndex, 0, false)}

                          {/* RENDERIZAÇÃO CONDICIONAL DAS CÉLULAS */}
                          {activeTab === 'FILA' ? (
                            <>
                                {/* FLIGHT OUT */}
                                {renderEditableCell(row, 'departureFlightNumber', row.departureFlightNumber || '', "text-center font-mono tracking-tighter", rowIndex, 1)}

                                {/* ICAO */}
                                {renderEditableCell(row, 'destination', row.destination, "text-center font-mono text-emerald-500 font-bold text-[10px]", rowIndex, 2, false)}

                                {/* CITY */}
                                <td className={`px-1 border-y border-l ${isDarkMode ? 'border-slate-700/50 bg-gradient-to-b from-slate-800/50 to-slate-900/80 group-hover:from-slate-700 group-hover:to-slate-800' : 'border-slate-200 bg-white group-hover:bg-slate-50'} transition-all text-center font-black text-[9px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'} uppercase tracking-tight`}>
                                    {ICAO_CITIES[row.destination] || 'EXTERIOR'}
                                </td>

                                {/* REGISTRATION */}
                                {renderEditableCell(row, 'registration', row.registration, "text-center font-mono text-emerald-500 tracking-tighter uppercase", rowIndex, 3)}

                                {/* POSITION */}
                                {renderEditableCell(row, 'positionId', row.positionId, "text-center font-mono text-[12px]", rowIndex, 4)}

                                {/* ETD */}
                                {renderEditableCell(row, 'etd', row.etd, "text-center font-mono text-emerald-400", rowIndex, 6)}

                                {/* CALÇO (ATA) */}
                                {renderEditableCell(row, 'actualArrivalTime', row.actualArrivalTime || '', "text-center font-mono font-black", rowIndex, 5)}

                                {/* ETA */}
                                {renderEditableCell(row, 'eta', row.eta || '', "text-center font-mono text-emerald-400 font-black tracking-widest", rowIndex, 99)}

                                {/* OPERATOR (WITH ASSIGN BUTTON) */}
                                <td className={`px-2 border-y border-l ${isDarkMode ? 'border-slate-700/50 bg-gradient-to-b from-slate-800/50 to-slate-900/80 group-hover:from-slate-700 group-hover:to-slate-800' : 'border-slate-200 bg-white group-hover:bg-slate-50'} transition-all text-left align-middle w-[100px] max-w-[100px] overflow-hidden`}>
                                    {row.operator ? (
                                        <div className="flex items-center justify-start w-full">
                                            <OperatorCell operatorName={row.operator} />
                                        </div>
                                    ) : (
                                        <button 
                                            onClick={(e) => openAssignModal(row, e)}
                                            className="inline-flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white px-2 py-1.5 rounded shadow-lg shadow-indigo-600/20 transition-all active:scale-95 w-full mx-auto"
                                        >
                                            <UserPlus size={12} />
                                            <span className="text-[9px] font-black uppercase tracking-widest whitespace-nowrap">Designar</span>
                                        </button>
                                    )}
                                </td>

                                {/* FLEET */}
                                {renderEditableCell(row, 'fleet', row.fleet || '', "text-center font-mono text-[10px]", rowIndex, 7, false)}

                                {/* FLEET TYPE */}
                                {renderEditableCell(row, 'fleetType', row.fleetType || '', "text-center font-mono text-[10px]", rowIndex, 8, false)}
                            </>
                          ) : isStreamlinedView ? (
                            <>
                                {/* FLIGHT OUT */}
                                {renderEditableCell(row, 'departureFlightNumber', row.departureFlightNumber || '', "text-center font-mono tracking-tighter", rowIndex, 1)}

                                {/* ICAO */}
                                {renderEditableCell(row, 'destination', row.destination, "text-center font-mono text-emerald-500 font-bold text-[10px]", rowIndex, 2, false)}

                                {/* CITY (Not directly editable, derived from destination) */}
                                <td className={`px-1 border-y border-l ${isDarkMode ? 'border-slate-700/50 bg-gradient-to-b from-slate-800/50 to-slate-900/80 group-hover:from-slate-700 group-hover:to-slate-800' : 'border-slate-200 bg-white group-hover:bg-slate-50'} transition-all text-center font-black text-[9px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'} uppercase tracking-tight`}>
                                    {ICAO_CITIES[row.destination] || 'EXTERIOR'}
                                </td>

                                {/* REGISTRATION */}
                                {renderEditableCell(row, 'registration', row.registration, "text-center font-mono text-emerald-500 tracking-tighter uppercase", rowIndex, 3)}

                                {/* POSITION */}
                                {renderEditableCell(row, 'positionId', row.positionId, "text-center font-mono text-[12px]", rowIndex, 4)}

                                {/* CALÇO (ATA) */}
                                {renderEditableCell(row, 'actualArrivalTime', row.actualArrivalTime || '', "text-center font-mono font-black", rowIndex, 5)}

                                {/* ETD */}
                                {renderEditableCell(row, 'etd', row.etd, "text-center font-mono text-emerald-400", rowIndex, 6)}

                                {/* OPERATOR (WITH ASSIGN BUTTON) */}
                                <td className={`px-2 border-y border-l ${isDarkMode ? 'border-slate-700/50 bg-gradient-to-b from-slate-800/50 to-slate-900/80 group-hover:from-slate-700 group-hover:to-slate-800' : 'border-slate-200 bg-white group-hover:bg-slate-50'} transition-all text-left align-middle ${activeTab === 'DESIGNADOS' ? 'w-[96px] max-w-[96px]' : 'w-[100px] max-w-[100px]'} overflow-hidden`}>
                                    {row.operator ? (
                                        <div className="flex items-center justify-start w-full">
                                            <OperatorCell operatorName={row.operator} />
                                        </div>
                                    ) : (
                                        <button 
                                            onClick={(e) => openAssignModal(row, e)}
                                            className="inline-flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white px-2 py-1.5 rounded shadow-lg shadow-indigo-600/20 transition-all active:scale-95 w-full mx-auto"
                                        >
                                            <UserPlus size={12} />
                                            <span className="text-[9px] font-black uppercase tracking-widest whitespace-nowrap">Designar</span>
                                        </button>
                                    )}
                                </td>

                                {/* FLEET */}
                                {renderEditableCell(row, 'fleet', row.fleet || '', "text-center font-mono text-[10px]", rowIndex, 7, false)}

                                {/* FLEET TYPE */}
                                {renderEditableCell(row, 'fleetType', row.fleetType || '', "text-center font-mono text-[10px]", rowIndex, 8, false)}

                                {activeTab === 'DESIGNADOS' && (
                                    <>
                                        {/* HR.D */}
                                        {renderEditableCell(
                                            row, 
                                            'assignmentTime' as any, 
                                            row.assignmentTime ? new Date(row.assignmentTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false }).replace(':', 'H') : '--', 
                                            "text-center font-mono text-emerald-400 tracking-tighter", 
                                            rowIndex, 
                                            9, 
                                            false
                                        )}
                                        {/* LT */}
                                        <td className={`px-2 border-y border-l ${isDarkMode ? 'border-slate-700/50 bg-gradient-to-b from-slate-800/50 to-slate-900/80 group-hover:from-slate-700 group-hover:to-slate-800' : 'border-slate-200 bg-white group-hover:bg-slate-50'} transition-all text-left font-black text-[9px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'} uppercase tracking-tight w-[112px] max-w-[112px] overflow-hidden truncate`}>
                                            {row.assignedByLt || '--'}
                                        </td>
                                    </>
                                )}

                                {/* VAZÃO (Apenas ABASTECENDO) */}
                                {activeTab === 'ABASTECENDO' && renderEditableCell(row, 'maxFlowRate', row.maxFlowRate || 0, "text-center font-mono text-emerald-400 tracking-tight", rowIndex, activeTab === 'DESIGNADOS' ? 11 : 9, false)}
                            </>
                          ) : isFinishedView ? (
                            <>
                                {/* REGISTRATION */}
                                {renderEditableCell(row, 'registration', row.registration, "text-center font-mono text-emerald-500 tracking-tighter uppercase", rowIndex, 1)}

                                {/* FLIGHT OUT */}
                                {renderEditableCell(row, 'departureFlightNumber', row.departureFlightNumber || '', "text-center font-mono tracking-tighter", rowIndex, 2)}

                                {/* ICAO */}
                                {renderEditableCell(row, 'destination', row.destination, "text-center font-mono text-emerald-500 font-bold text-[10px]", rowIndex, 3, false)}

                                {/* CITY */}
                                <td className={`px-2 border-y border-l ${isDarkMode ? 'border-slate-700/50 bg-gradient-to-b from-slate-800/50 to-slate-900/80 group-hover:from-slate-700 group-hover:to-slate-800' : 'border-slate-200 bg-white group-hover:bg-slate-50'} transition-all text-center font-black text-[9px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'} uppercase tracking-tight`}>
                                    {ICAO_CITIES[row.destination] || 'EXTERIOR'}
                                </td>

                                {/* POSITION */}
                                {renderEditableCell(row, 'positionId', row.positionId, "text-center font-mono text-[12px]", rowIndex, 4)}

                                {/* CALÇO (ATA) */}
                                {renderEditableCell(row, 'actualArrivalTime', row.actualArrivalTime || '', "text-center font-mono font-black", rowIndex, 5)}

                                {/* ETD */}
                                {renderEditableCell(row, 'etd', row.etd, "text-center font-mono text-emerald-400", rowIndex, 6)}
                                
                                {/* OPERATOR (WITH ASSIGN BUTTON & MESSAGE DOT) */}
                                <td className={`px-2 border-y border-l ${isDarkMode ? 'border-slate-700/50 bg-gradient-to-b from-slate-800/50 to-slate-900/80 group-hover:from-slate-700 group-hover:to-slate-800' : 'border-slate-200 bg-white group-hover:bg-slate-50'} transition-all text-left align-middle w-[100px] max-w-[100px] overflow-hidden truncate`}>
                                    {row.operator ? (
                                        <div className="flex items-center justify-start w-full">
                                            <OperatorCell operatorName={row.operator} />
                                        </div>
                                    ) : <span className={`${isDarkMode ? 'text-slate-700' : 'text-slate-400'} italic uppercase text-[9px] pl-2`}>--</span>}
                                </td>

                                {/* FLEET */}
                                {renderEditableCell(row, 'fleet', row.fleet || '', "text-center font-mono text-[10px]", rowIndex, 7, false)}

                                {/* FLEET TYPE */}
                                {renderEditableCell(row, 'fleetType', row.fleetType || '', "text-center font-mono text-[10px]", rowIndex, 8, false)}

                                {/* TAB (Exclusivo Finalizados) - Not directly editable as it's calculated */}
                                <td className={`px-2 border-y border-l ${isDarkMode ? 'border-slate-700/50 bg-gradient-to-b from-slate-800/50 to-slate-900/80 group-hover:from-slate-700 group-hover:to-slate-800' : 'border-slate-200 bg-white group-hover:bg-slate-50'} transition-all text-center font-mono ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                                    {calculateTAB(row)}
                                </td>

                                {/* VAZÃO (Exclusivo Finalizados) */}
                                {renderEditableCell(row, 'maxFlowRate', row.maxFlowRate || 0, "text-center font-mono text-emerald-400 tracking-tight", rowIndex, 10, false)}
                            </>
                          ) : (
                            <>
                                {/* REGISTRATION */}
                                {renderEditableCell(row, 'registration', row.registration, "text-center font-mono text-emerald-500 tracking-tighter uppercase", rowIndex, 1)}

                                {/* MODEL */}
                                {renderEditableCell(row, 'model', row.model, "text-center font-mono text-[10px] font-bold", rowIndex, 2, false)}

                                {/* FLIGHT IN */}
                                {renderEditableCell(row, 'flightNumber', row.flightNumber, "text-center font-mono tracking-tighter", rowIndex, 3)}

                                {/* ETA (POUSO ESTIMADO) - Derived from eta, but maybe let them edit eta */}
                                {renderEditableCell(row, 'eta', row.eta, "text-center font-mono", rowIndex, 4)}

                                {/* FLIGHT OUT */}
                                {renderEditableCell(row, 'departureFlightNumber', row.departureFlightNumber || '', "text-center font-mono tracking-tighter", rowIndex, 5)}

                                {/* ICAO */}
                                {renderEditableCell(row, 'destination', row.destination, "text-center font-mono text-emerald-500 font-bold text-[10px]", rowIndex, 6, false)}

                                {/* CITY */}
                                <td className={`px-2 border-y border-l ${isDarkMode ? 'border-slate-700/50 bg-gradient-to-b from-slate-800/50 to-slate-900/80 group-hover:from-slate-700 group-hover:to-slate-800' : 'border-slate-200 bg-white group-hover:bg-slate-50'} transition-all text-center font-black text-[9px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'} uppercase tracking-tight`}>
                                    {ICAO_CITIES[row.destination] || 'EXTERIOR'}
                                </td>

                                {/* POSITION */}
                                {renderEditableCell(row, 'positionId', row.positionId, "text-center font-mono text-[12px]", rowIndex, 7)}

                                {/* CALÇO (ATA) */}
                                {renderEditableCell(row, 'actualArrivalTime', row.actualArrivalTime || '', "text-center font-mono font-black", rowIndex, 8)}

                                {/* ETD */}
                                {renderEditableCell(row, 'etd', row.etd, "text-center font-mono text-emerald-400", rowIndex, 9)}

                                {/* OPERATOR (WITH ASSIGN BUTTON) */}
                                <td className={`px-2 border-y border-l ${isDarkMode ? 'border-slate-700/50 bg-gradient-to-b from-slate-800/50 to-slate-900/80 group-hover:from-slate-700 group-hover:to-slate-800' : 'border-slate-200 bg-white group-hover:bg-slate-50'} transition-all text-left align-middle w-[100px] max-w-[100px] overflow-hidden`}>
                                    {row.operator ? (
                                        <div className="flex items-center justify-start w-full">
                                            <OperatorCell operatorName={row.operator} />
                                        </div>
                                    ) : (
                                        <button 
                                            onClick={(e) => openAssignModal(row, e)}
                                            className="inline-flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white px-2 py-1.5 rounded shadow-lg shadow-indigo-600/20 transition-all active:scale-95 w-full mx-auto"
                                        >
                                            <UserPlus size={12} />
                                            <span className="text-[9px] font-black uppercase tracking-widest whitespace-nowrap">Designar</span>
                                        </button>
                                    )}
                                </td>

                                {/* FLEET */}
                                {renderEditableCell(row, 'fleet', row.fleet || '', "text-center font-mono text-[10px]", rowIndex, 10, false)}

                                {/* FLEET TYPE */}
                                {renderEditableCell(row, 'fleetType', row.fleetType || '', "text-center font-mono text-[10px]", rowIndex, 11, false)}

                                {/* VAZÃO (Apenas GERAL) */}
                                {activeTab === 'GERAL' && renderEditableCell(row, 'maxFlowRate', row.maxFlowRate || 0, "text-center font-mono text-emerald-400 tracking-tight", rowIndex, 12, false)}
                            </>
                          )}
                          
                          {/* STATUS (PILL DESIGN RESTORED) - MOVED OUTSIDE CONDITIONAL */}
                          <td className={`px-1.5 text-center border-y border-l ${isDarkMode ? 'border-slate-700/50 bg-gradient-to-b from-slate-800/50 to-slate-900/80 group-hover:from-slate-700 group-hover:to-slate-800' : 'border-slate-200 bg-white group-hover:bg-slate-50'} transition-all`}>
                              {dynamicStatus ? (
                                  <div className={`flex items-center justify-center w-full h-[28px] px-2 rounded text-[9px] font-black uppercase tracking-[0.1em] border ${dynamicStatus.color}`}>
                                      {dynamicStatus.label}
                                  </div>
                              ) : (
                                  <StatusBadge status={row.status} isDarkMode={isDarkMode} />
                              )}
                              {row.isStandby && (
                                  <span className="block text-[7px] text-amber-500 uppercase mt-1 text-center font-bold tracking-widest">{row.standbyReason}</span>
                              )}
                          </td>
                          
                          <td className={`px-1.5 text-center last:rounded-r-[4px] border-y border-l border-r ${isDarkMode ? 'border-slate-700/50 bg-gradient-to-b from-slate-800/50 to-slate-900/80 group-hover:from-slate-700 group-hover:to-slate-800' : 'border-slate-200 bg-white group-hover:bg-slate-50'} transition-all`}>
                              <div className="relative">
                                  <>
                                      <button onClick={(e) => { 
                                          e.stopPropagation(); 
                                          if (openMenuId === row.id) {
                                              setOpenMenuId(null);
                                          } else {
                                              const rect = e.currentTarget.getBoundingClientRect();
                                              setMenuPosition({ top: rect.bottom, left: rect.right - 224 });
                                              setOpenMenuId(row.id);
                                          }
                                      }} className="p-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-all btn-action-menu shadow-lg shadow-indigo-600/20 active:scale-95">
                                          <MoreVertical size={16} />
                                      </button>

                                          {openMenuId === row.id && menuPosition && createPortal(
                                              <div 
                                                  ref={actionMenuRef} 
                                                  style={{ top: menuPosition.top, left: menuPosition.left }}
                                                  className={`fixed mt-1 w-56 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} border rounded-md shadow-2xl z-[9999] overflow-hidden animate-in fade-in slide-in-from-top-2`}
                                              >
                                                  <div className={`p-2 border-b ${isDarkMode ? 'border-slate-800 bg-slate-950/50' : 'border-slate-100 bg-slate-50/50'}`}>
                                                      <p className={`text-[10px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'} font-bold uppercase tracking-wider`}>Ações - Voo {row.flightNumber}</p>
                                                  </div>
                                                  <div className="flex flex-col text-xs p-1">
                                                      {(() => {
                                                          const btnClass = `w-full text-left px-3 py-2 ${isDarkMode ? 'text-slate-300 hover:bg-slate-800 hover:text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'} rounded flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed`;
                                                          const cancelBtnClass = "w-full text-left px-3 py-2 text-red-400 hover:bg-red-500/10 hover:text-red-300 rounded flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
                                                          const separator = <div className={`h-px ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'} my-1`} />;

                                                          const obsBtn = (
                                                              <button onClick={(e) => handleOpenObservationModal(row, e)} className={btnClass}>
                                                                  <Pen size={14} /> Observações
                                                              </button>
                                                          );

                                                          const cancelBtn = (
                                                              <button onClick={(e) => handleCancelFlight(row, e)} className={cancelBtnClass}>
                                                                  <XCircle size={14} /> Cancelar Voo
                                                              </button>
                                                          );

                                                          const delBtn = (
                                                              <button onClick={(e) => handleDeleteFlight(row, e)} className={cancelBtnClass}>
                                                                  <XCircle size={14} /> Excluir Voo
                                                              </button>
                                                          );

                                                          const pinBtn = (
                                                              <button onClick={(e) => handlePinFlight(row.id, e)} className={btnClass}>
                                                                  <Anchor size={14} /> {row.isPinned ? 'Desfixar do topo' : 'Fixar no topo'}
                                                              </button>
                                                          );

                                                          const moveToQueueBtn = (
                                                              <button onClick={(e) => handleMoveToQueue(row, e)} className={btnClass} disabled={!!row.operator}>
                                                                  <ListOrdered size={14} /> Mover para Fila
                                                              </button>
                                                          );

                                                          if (activeTab === 'GERAL') {
                                                              return (
                                                                  <>
                                                                      {moveToQueueBtn}
                                                                      {pinBtn}
                                                                      <button 
                                                                          onClick={(e) => { handleConfirmVisual(row.id, row.flightNumber, e); setOpenMenuId(null); }} 
                                                                          className={btnClass} 
                                                                          disabled={row.status !== FlightStatus.FINALIZADO && row.status !== FlightStatus.CANCELADO}
                                                                      >
                                                                          <CheckCheck size={14} /> Limpar da Lista
                                                                      </button>
                                                                      {cancelBtn}
                                                                      {obsBtn}
                                                                  </>
                                                              );
                                                          }

                                                          if (activeTab === 'CHEGADA') {
                                                              return (
                                                                  <>
                                                                      {moveToQueueBtn}
                                                                      {pinBtn}
                                                                      {cancelBtn}
                                                                      {obsBtn}
                                                                  </>
                                                              );
                                                          }

                                                          if (activeTab === 'FILA') {
                                                              return (
                                                                  <>
                                                                      {pinBtn}
                                                                      {cancelBtn}
                                                                      {delBtn}
                                                                      {obsBtn}
                                                                  </>
                                                              );
                                                          }

                                                          if (activeTab === 'DESIGNADOS') {
                                                              return (
                                                                  <>
                                                                      <button onClick={(e) => { e.stopPropagation(); setConfirmStartModalFlight(row); setOpenMenuId(null); }} className="w-full text-left px-3 py-2 text-slate-300 hover:bg-blue-600 hover:text-white hover:shadow-[0_0_15px_rgba(37,99,235,0.5)] hover:scale-105 active:scale-95 rounded flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                                                                          <Play size={14} /> Abastecendo
                                                                      </button>
                                                                      <button onClick={(e) => { e.stopPropagation(); setConfirmRemoveOperatorFlight(row); setOpenMenuId(null); }} className={btnClass}>
                                                                          <UserCheck size={14} /> Cancelar Designação
                                                                      </button>
                                                                      {obsBtn}
                                                                      {cancelBtn}
                                                                  </>
                                                              );
                                                          }

                                                          if (activeTab === 'ABASTECENDO') {
                                                              return (
                                                                  <>
                                                                      {pinBtn}
                                                                      <button onClick={(e) => { e.stopPropagation(); setConfirmFinishModalFlight(row); setOpenMenuId(null); }} className="w-full text-left px-3 py-2 text-slate-300 hover:bg-emerald-600 hover:text-white hover:shadow-[0_0_15px_rgba(16,185,129,0.5)] hover:scale-105 active:scale-95 rounded flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                                                                          <CheckCircle size={14} /> Finalizar
                                                                      </button>
                                                                      {obsBtn}
                                                                  </>
                                                              );
                                                          }

                                                          if (activeTab === 'FINALIZADO') {
                                                              return (
                                                                  <>
                                                                      <button onClick={(e) => handleReforco(row, e)} className={btnClass}>
                                                                          <History size={14} /> Reforço
                                                                      </button>
                                                                      {obsBtn}
                                                                  </>
                                                              );
                                                          }

                                                          return null;
                                                      })()}
                                                  </div>
                                              </div>
                                          , document.body)}
                                  </>
                              </div>
                          </td>
                      </tr>
                  )})}
              </tbody>
          </table>
        </div>
      </div>

      {/* TOAST NOTIFICATION CONTAINER */}
      <div className="absolute bottom-6 right-6 z-[60] flex flex-col gap-2 pointer-events-none">
          {toasts.map(toast => (
              <div 
                  key={toast.id}
                  className={`pointer-events-auto min-w-[300px] bg-slate-900 border-l-4 p-4 rounded-md shadow-2xl animate-in slide-in-from-right duration-300 flex items-start gap-3 ${
                      toast.type === 'success' ? 'border-emerald-500' :
                      toast.type === 'info' ? 'border-blue-500' :
                      'border-amber-500'
                  }`}
              >
                  <div className={`p-1.5 rounded-full shrink-0 ${
                      toast.type === 'success' ? 'bg-emerald-500/20 text-emerald-500' :
                      toast.type === 'info' ? 'bg-blue-500/20 text-blue-500' :
                      'bg-amber-500/20 text-amber-500'
                  }`}>
                      {toast.type === 'success' ? <CheckCircle size={16} /> : <Eye size={16} />}
                  </div>
                  <div className="flex-1">
                      <h4 className={`text-xs font-black uppercase tracking-widest mb-1 ${
                          toast.type === 'success' ? 'text-emerald-500' :
                          toast.type === 'info' ? 'text-blue-500' :
                          'text-amber-500'
                      }`}>
                          {toast.title}
                      </h4>
                      <p className="text-[11px] text-slate-300 leading-tight">{toast.message}</p>
                  </div>
                  <button onClick={() => removeToast(toast.id)} className="text-slate-500 hover:text-white transition-colors">
                      <X size={14} />
                  </button>
              </div>
          ))}
      </div>

      {selectedFlight && (
        <FlightDetailsModal 
          flight={selectedFlight} 
          onClose={() => setSelectedFlight(null)} 
          onUpdate={(updatedFlight) => onUpdateFlights(prev => prev.map(f => f.id === updatedFlight.id ? updatedFlight : f))}
          vehicles={vehicles}
          operators={getEligibleOperators(selectedFlight)}
          onOpenAssignSupport={(flight) => setAssignSupportModalFlight(flight)}
        />
      )}


      {/* Observation Modal */}
      {observationModalFlight && (
        <ObservationModal
          flight={observationModalFlight}
          newObservation={newObservation}
          setNewObservation={setNewObservation}
          onSave={handleSaveObservation}
          onClose={() => setObservationModalFlight(null)}
        />
      )}

      {/* MODAL DE DESIGNAÇÃO DE OPERADOR */}
      <DesigOpr 
          isOpen={!!assignModalFlight}
          onClose={() => { setAssignModalFlight(null); setSelectedOperatorId(null); }}
          flight={assignModalFlight}
          operators={assignModalFlight ? getEligibleOperators(assignModalFlight, false) : []}
          onConfirm={(operatorId) => {
              confirmAssignment(operatorId);
          }}
      />

      {/* MODAL DE DESIGNAÇÃO DE APOIO */}
      <DesigOpr 
          isOpen={!!assignSupportModalFlight}
          onClose={() => { setAssignSupportModalFlight(null); setSelectedOperatorId(null); }}
          flight={assignSupportModalFlight}
          operators={assignSupportModalFlight ? getEligibleOperators(assignSupportModalFlight, true) : []}
          onConfirm={(operatorId) => {
              confirmSupportAssignment(operatorId);
          }}
      />

      {/* MODAL DE JUSTIFICATIVA DE ATRASO (SLA COMPLIANCE) */}
      {delayModalFlightId && (
        <DelayJustificationModal
          delayReasonCode={delayReasonCode}
          setDelayReasonCode={setDelayReasonCode}
          delayReasonDetail={delayReasonDetail}
          setDelayReasonDetail={setDelayReasonDetail}
          onSubmit={handleSubmitDelay}
          onClose={() => setDelayModalFlightId(null)}
        />
      )}

      {/* CREATE FLIGHT MODAL */}
      {isCreateModalOpen && (
        <CreateFlightModal 
          onClose={() => setIsCreateModalOpen(false)}
          onCreate={handleCreateFlight}
        />
      )}

      {/* IMPORT MODAL */}
      {isImportModalOpen && (
        <ImportModal
          isDarkMode={isDarkMode}
          onClose={() => setIsImportModalOpen(false)}
          onImport={(file) => {
            setIsLoading(true);
            setIsImportModalOpen(false);
            setTimeout(() => {
                setIsLoading(false);
                addToast(`Arquivo ${file.name} importado com sucesso!`, 'success');
            }, 1500);
          }}
        />
      )}

      {/* CANCEL FLIGHT CONFIRMATION MODAL */}
      {cancelModalFlight && (
        <ConfirmActionModal
          type="cancel"
          flightNumber={cancelModalFlight.flightNumber}
          registration={cancelModalFlight.registration}
          onConfirm={confirmCancelFlight}
          onClose={() => setCancelModalFlight(null)}
        />
      )}

      {/* DELETE FLIGHT CONFIRMATION MODAL */}
      {deleteModalFlight && (
        <ConfirmActionModal
          type="delete"
          flightNumber={deleteModalFlight.flightNumber}
          registration={deleteModalFlight.registration}
          onConfirm={confirmDeleteFlight}
          onClose={() => setDeleteModalFlight(null)}
        />
      )}

      {/* CONFIRM START MODAL */}
      {confirmStartModalFlight && (
        <ConfirmActionModal
          type="start"
          flightNumber={confirmStartModalFlight.flightNumber}
          onConfirm={handleConfirmStart}
          onClose={() => setConfirmStartModalFlight(null)}
        />
      )}

      {/* CONFIRM REMOVE OPERATOR MODAL */}
      {confirmRemoveOperatorFlight && (
        <ConfirmActionModal
          type="remove"
          flightNumber={confirmRemoveOperatorFlight.flightNumber}
          onConfirm={handleConfirmRemoveOperator}
          onClose={() => setConfirmRemoveOperatorFlight(null)}
        />
      )}

      {/* CONFIRM FINISH MODAL */}
      {confirmFinishModalFlight && (
        <ConfirmActionModal
          type="finish"
          flightNumber={confirmFinishModalFlight.flightNumber}
          onConfirm={handleConfirmFinish}
          onClose={() => setConfirmFinishModalFlight(null)}
        />
      )}
    </div>
  );
};
