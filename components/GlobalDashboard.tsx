
import React from 'react';
import { User, AppState, SelectionStatus } from '../types';
import { Users, Euro, Briefcase, Calendar, CheckCircle, ArrowRight, ShieldCheck, Building2 } from 'lucide-react';

interface GlobalDashboardProps {
    user: User | null;
    data: AppState;
    onNavigateApp: (app: 'recruitment' | 'fluxo' | 'human') => void;
}

export const GlobalDashboard: React.FC<GlobalDashboardProps> = ({ user, data, onNavigateApp }) => {
    
    // Stats for Recruitment
    const candidatesCount = data.candidates.length;
    const activeJobs = data.jobs.filter(j => j.status === 'OPEN').length;
    
    // Mock Stats for Fluxo
    const pendingExpenses = 5;
    const totalExpensesAmount = "1.250€";

    // Mock Stats for Human
    const activeEmployees = 42;
    const safetyDeadlines = 2;

    return (
        <div className="h-full overflow-y-auto bg-stone-50 p-8 custom-scrollbar">
            <header className="mb-10">
                <h1 className="text-3xl font-serif font-bold text-stone-900 mb-2">Benvenuto, {user?.name.split(' ')[0]}.</h1>
                <p className="text-stone-500">Ecco una panoramica di tutte le tue applicazioni aziendali.</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                {/* RECRUITMENT CARD */}
                <div onClick={() => onNavigateApp('recruitment')} className="bg-white p-6 rounded-2xl shadow-sm border border-emerald-100 hover:shadow-lg hover:border-emerald-300 transition-all cursor-pointer group relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-bl-full -mr-10 -mt-10 transition-transform group-hover:scale-110"></div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-3 bg-emerald-100 text-emerald-700 rounded-xl"><Briefcase size={24}/></div>
                            <h3 className="font-bold text-xl text-stone-800">Recruitment</h3>
                        </div>
                        <div className="space-y-3 mb-6">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-stone-500">Posizioni Aperte</span>
                                <span className="font-bold text-stone-900 bg-stone-100 px-2 py-0.5 rounded">{activeJobs}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-stone-500">Candidati Totali</span>
                                <span className="font-bold text-stone-900 bg-stone-100 px-2 py-0.5 rounded">{candidatesCount}</span>
                            </div>
                        </div>
                        <div className="flex items-center text-emerald-600 font-bold text-sm group-hover:translate-x-2 transition-transform">
                            Accedi <ArrowRight size={16} className="ml-1"/>
                        </div>
                    </div>
                </div>

                {/* FLUXO CARD */}
                <div onClick={() => onNavigateApp('fluxo')} className="bg-white p-6 rounded-2xl shadow-sm border border-violet-100 hover:shadow-lg hover:border-violet-300 transition-all cursor-pointer group relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-violet-50 rounded-bl-full -mr-10 -mt-10 transition-transform group-hover:scale-110"></div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-3 bg-violet-100 text-violet-700 rounded-xl"><Euro size={24}/></div>
                            <h3 className="font-bold text-xl text-stone-800">Fluxo</h3>
                        </div>
                        <div className="space-y-3 mb-6">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-stone-500">Da Approvare</span>
                                <span className="font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-100">{pendingExpenses}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-stone-500">Totale Mese</span>
                                <span className="font-bold text-stone-900 bg-stone-100 px-2 py-0.5 rounded">{totalExpensesAmount}</span>
                            </div>
                        </div>
                        <div className="flex items-center text-violet-600 font-bold text-sm group-hover:translate-x-2 transition-transform">
                            Accedi <ArrowRight size={16} className="ml-1"/>
                        </div>
                    </div>
                </div>

                {/* HUMAN CARD */}
                <div onClick={() => onNavigateApp('human')} className="bg-white p-6 rounded-2xl shadow-sm border border-blue-100 hover:shadow-lg hover:border-blue-300 transition-all cursor-pointer group relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-bl-full -mr-10 -mt-10 transition-transform group-hover:scale-110"></div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-3 bg-blue-100 text-blue-700 rounded-xl"><Users size={24}/></div>
                            <h3 className="font-bold text-xl text-stone-800">Human</h3>
                        </div>
                        <div className="space-y-3 mb-6">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-stone-500">Dipendenti Attivi</span>
                                <span className="font-bold text-stone-900 bg-stone-100 px-2 py-0.5 rounded">{activeEmployees}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-stone-500">Scadenze Sicurezza</span>
                                <span className="font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-100">{safetyDeadlines}</span>
                            </div>
                        </div>
                        <div className="flex items-center text-blue-600 font-bold text-sm group-hover:translate-x-2 transition-transform">
                            Accedi <ArrowRight size={16} className="ml-1"/>
                        </div>
                    </div>
                </div>
            </div>

            {/* WIDGETS SECTION */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* AGENDA */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100">
                    <h3 className="font-serif text-lg font-bold text-stone-800 mb-4 flex items-center gap-2">
                        <Calendar className="text-stone-400" size={20}/> Agenda (Prossimi 7 giorni)
                    </h3>
                    <div className="space-y-3">
                        <div className="flex items-center gap-4 p-3 hover:bg-stone-50 rounded-xl transition-colors border-l-4 border-emerald-400 bg-stone-50/50">
                            <div className="text-center w-12">
                                <div className="text-xs font-bold text-stone-400 uppercase">Dom</div>
                                <div className="text-xl font-bold text-stone-800">12</div>
                            </div>
                            <div>
                                <h4 className="font-bold text-stone-800 text-sm">Colloquio con Marco Rossi</h4>
                                <p className="text-xs text-stone-500">Senior Frontend Developer • 10:00</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4 p-3 hover:bg-stone-50 rounded-xl transition-colors border-l-4 border-blue-400 bg-stone-50/50">
                            <div className="text-center w-12">
                                <div className="text-xs font-bold text-stone-400 uppercase">Lun</div>
                                <div className="text-xl font-bold text-stone-800">13</div>
                            </div>
                            <div>
                                <h4 className="font-bold text-stone-800 text-sm">Onboarding: Giulia Bianchi</h4>
                                <p className="text-xs text-stone-500">Primo Giorno • 09:00</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4 p-3 hover:bg-stone-50 rounded-xl transition-colors border-l-4 border-amber-400 bg-stone-50/50">
                            <div className="text-center w-12">
                                <div className="text-xs font-bold text-stone-400 uppercase">Mar</div>
                                <div className="text-xl font-bold text-stone-800">14</div>
                            </div>
                            <div>
                                <h4 className="font-bold text-stone-800 text-sm">Scadenza Visite Mediche</h4>
                                <p className="text-xs text-stone-500">Reparto IT • Tutto il giorno</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* TASKS */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100">
                    <h3 className="font-serif text-lg font-bold text-stone-800 mb-4 flex items-center gap-2">
                        <CheckCircle className="text-stone-400" size={20}/> Attività in Scadenza
                    </h3>
                    <div className="space-y-2">
                        <div className="flex items-center gap-3 p-3 bg-stone-50 rounded-lg">
                            <div className="w-5 h-5 rounded-full border-2 border-stone-300"></div>
                            <span className="text-sm font-medium text-stone-700 flex-1">Approvare nota spese #492 (Mario R.)</span>
                            <span className="text-[10px] bg-violet-100 text-violet-700 px-2 py-0.5 rounded font-bold">Fluxo</span>
                        </div>
                        <div className="flex items-center gap-3 p-3 bg-stone-50 rounded-lg">
                            <div className="w-5 h-5 rounded-full border-2 border-stone-300"></div>
                            <span className="text-sm font-medium text-stone-700 flex-1">Inviare offerta a Luca Verdi</span>
                            <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-bold">Recruitment</span>
                        </div>
                        <div className="flex items-center gap-3 p-3 bg-stone-50 rounded-lg">
                            <div className="w-5 h-5 rounded-full border-2 border-stone-300"></div>
                            <span className="text-sm font-medium text-stone-700 flex-1">Prenotare corso sicurezza</span>
                            <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-bold">Human</span>
                        </div>
                        <button className="w-full text-center text-xs font-bold text-stone-400 hover:text-stone-600 mt-2 py-2 border-t border-stone-100">Vedi tutte</button>
                    </div>
                </div>
            </div>
        </div>
    );
};
