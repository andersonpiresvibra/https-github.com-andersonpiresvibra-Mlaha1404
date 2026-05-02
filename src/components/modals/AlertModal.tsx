import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { AlertCircle, X } from 'lucide-react';

interface AlertModalProps {
    isOpen: boolean;
    title: string;
    message: React.ReactNode;
    onClose: () => void;
}

export const AlertModal: React.FC<AlertModalProps> = ({ isOpen, title, message, onClose }) => {
    const { isDarkMode } = useTheme();

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className={`${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'} border rounded-2xl shadow-2xl w-full max-w-md overflow-hidden relative`}>
                <button 
                    onClick={onClose}
                    className={`absolute top-4 right-4 p-2 rounded-full transition-colors ${isDarkMode ? 'text-slate-400 hover:bg-slate-800 hover:text-white' : 'text-slate-500 hover:bg-slate-100'}`}
                >
                    <X size={20} />
                </button>
                    
                <div className={`px-6 py-8 flex flex-col items-center text-center border-b ${isDarkMode ? 'border-slate-800 bg-red-900/10' : 'border-slate-100 bg-red-50/50'}`}>
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6 border bg-amber-500/10 border-amber-500/20">
                        <AlertCircle size={32} className="text-amber-500" />
                    </div>
                    <h3 className={`font-black uppercase tracking-tight text-xl mb-3 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                        {title}
                    </h3>
                    <p className={`text-sm font-medium leading-relaxed max-w-[280px] ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                        {message}
                    </p>
                </div>

                <div className={`p-4 flex gap-3 ${isDarkMode ? 'bg-slate-950/50' : 'bg-slate-50'}`}>
                    <button 
                        onClick={onClose}
                        className="flex-1 py-3 px-4 rounded-xl text-xs font-bold uppercase tracking-wider transition-all bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg"
                    >
                        Entendido
                    </button>
                </div>
            </div>
        </div>
    );
};
