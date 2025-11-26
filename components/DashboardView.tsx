import React from 'react';
import { AppState, SelectionStatus, StatusLabels, StatusColors, UserRole, User } from '../types';
import { Users, Briefcase, TrendingUp, Activity, Percent, BrainCircuit, Flag, ArrowUpRight, Clock } from 'lucide-react';

interface DashboardViewProps {
    data: AppState;
    onNavigate: (tab: string) => void;
    currentUser: User | null;
}

// Simple SVG Circle Chart for KPI
const MiniDonut = ({ percentage, color }: { percentage: number, color: string }) => {
    const radius = 16;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;

    return (
        <div className="relative w-12 h-12 flex items-center justify-center">
            <svg className="transform -rotate-90 w-full h-full">
                <circle cx="24" cy="24" r={radius} stroke="#e5e7eb" strokeWidth="4" fill="none" />
                <circle cx="24" cy="24" r={radius} stroke={color} strokeWidth="4" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round" fill="none" className="transition-all duration-1000 ease-out" />
            </svg>
            <span className="absolute text-[10px] font-bold text-gray-600">{percentage}%</span>
        </div>
    );
};

export const DashboardView: React.FC<DashboardViewProps> = ({ data, onNavigate, currentUser }) => {
    // Current User Context
    const userName = currentUser?.name?.split(' ')[0] || 'Recruiter';

    // KPI Calculations
    const totalCandidates = data.candidates.length;
    const activeJobs = data.jobs.filter(j => j.status === 'OPEN').length;
    const totalApplications = data.applications.length;
    
    const hiredCount = data.applications.filter(a => a.status === SelectionStatus.HIRED).length;
    const conversionRate = totalApplications > 0 ? Math.round((hiredCount / totalApplications) * 100) : 0;
    const avgAiScore = Math.round(
        data.applications.filter(a => a.aiScore).reduce((acc, curr) => acc + (curr.aiScore || 0), 0) / 
        (data.applications.filter(a => a.aiScore).length || 1)
    );

    // Onboarding Stats
    const totalOnboarding = data.onboarding.length;
    const completedOnboarding = data.onboarding.filter(o => o.status === 'COMPLETED').length;
    const inProgressOnboarding = data.onboarding.filter(o => o.status === 'IN_PROGRESS').length;
    const toStartOnboarding = data.onboarding.filter(o => o.status === 'TO_START').length;

    // Funnel Data
    const funnelOrder = [
        SelectionStatus.TO_ANALYZE,
        SelectionStatus.SCREENING,
        SelectionStatus.FIRST_INTERVIEW,
        SelectionStatus.SECOND_INTERVIEW,
        SelectionStatus.OFFER,
        SelectionStatus.HIRED
    ];

    const funnelData = funnelOrder.map(status => ({
        label: StatusLabels[status],
        count: data.applications.filter(a => a.status === status).length,
        color: status === SelectionStatus.HIRED ? '#10b981' : '#6366f1' // Emerald for hired, Indigo for others
    }));

    const maxCount = Math.max(...funnelData.map(d => d.count)) || 1;

    // Recent Activity
    const recentCandidates = [...data.candidates].sort((a, b) => b.createdAt - a.createdAt).slice(0, 4);

    return (
        <div className="h-full overflow-y-auto custom-scrollbar">
            {/* ARTISTIC HEADER */}
            <div className="bg-abstract-header h-64 w-full relative flex items-end p-8">
                <div className="absolute inset-0 bg-gradient-to-t from-stone-900/60 to-transparent"></div>
                <div className="relative z-10 text-white w-full max-w-5xl mx-auto mb-4 animate-in slide-in-from-bottom-2">
                    <p className="text-emerald-300 font-bold uppercase tracking-widest text-xs mb-2">Overview</p>
                    <h1 className="text-4xl md:text-5xl font-serif font-bold mb-2">Benvenuto, {userName}.</h1>
                    <p className="text-white/80 font-light max-w-xl text-lg">Hai <span className="font-bold text-white">{activeJobs} posizioni aperte</span> e <span className="font-bold text-white">{totalCandidates} nuovi candidati</span> da analizzare questa settimana.</p>
                </div>
            </div>

            <div className="p-8 max-w-6xl mx-auto -mt-16 relative z-20 space-y-8">
                
                {/* KPI GRID - GLASS CARDS */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="glass-card p-5 rounded-2xl hover:-translate-y-1 transition-transform duration-300 cursor-pointer group" onClick={() => onNavigate('candidates')}>
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-xl group-hover:bg-emerald-600 group-hover:text-white transition-colors shadow-sm"><Users size={22}/></div>
                            <ArrowUpRight size={18} className="text-stone-400"/>
                        </div>
                        <div className="flex items-end gap-3">
                            <div>
                                <h3 className="text-3xl font-bold text-stone-800">{totalCandidates}</h3>
                                <p className="text-stone-500 text-xs font-medium uppercase tracking-wide">Candidati Totali</p>
                            </div>
                        </div>
                    </div>

                    <div className="glass-card p-5 rounded-2xl hover:-translate-y-1 transition-transform duration-300 cursor-pointer group" onClick={() => onNavigate('recruitment')}>
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-2.5 bg-blue-100 text-blue-700 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-colors shadow-sm"><Briefcase size={22}/></div>
                            <div className="bg-blue-50 text-blue-700 text-[10px] font-bold px-2 py-1 rounded-full">{activeJobs} Attive</div>
                        </div>
                        <div>
                            <h3 className="text-3xl font-bold text-stone-800">{data.applications.length}</h3>
                            <p className="text-stone-500 text-xs font-medium uppercase tracking-wide">Candidature Totali</p>
                        </div>
                    </div>

                    <div className="glass-card p-5 rounded-2xl flex items-center justify-between">
                        <div>
                            <div className="p-2.5 bg-teal-100 text-teal-700 rounded-xl w-fit mb-3 shadow-sm"><Percent size={22}/></div>
                            <h3 className="text-3xl font-bold text-stone-800">{conversionRate}%</h3>
                            <p className="text-stone-500 text-xs font-medium uppercase tracking-wide">Tasso Assunzione</p>
                        </div>
                        <div className="bg-white/50 rounded-full p-1">
                            <MiniDonut percentage={conversionRate} color="#0d9488" />
                        </div>
                    </div>

                    <div className="glass-card p-5 rounded-2xl flex items-center justify-between">
                        <div>
                            <div className="p-2.5 bg-purple-100 text-purple-700 rounded-xl w-fit mb-3 shadow-sm"><BrainCircuit size={22}/></div>
                            <h3 className="text-3xl font-bold text-stone-800">{avgAiScore}</h3>
                            <p className="text-stone-500 text-xs font-medium uppercase tracking-wide">Media Fit AI</p>
                        </div>
                        <div className="bg-white/50 rounded-full p-1">
                            <MiniDonut percentage={avgAiScore} color="#9333ea" />
                        </div>
                    </div>
                </div>

                {/* CHARTS SECTION */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* FUNNEL */}
                    <div className="lg:col-span-2 glass-card p-8 rounded-2xl shadow-glow">
                        <div className="flex items-center justify-between mb-8">
                            <h3 className="font-serif text-xl font-bold text-stone-800 flex items-center gap-2">
                                <TrendingUp size={20} className="text-emerald-600"/> Pipeline Funnel
                            </h3>
                            <span className="text-xs font-medium text-stone-400 bg-white/60 px-3 py-1 rounded-full border border-white">Ultimi 30 giorni</span>
                        </div>
                        <div className="space-y-6">
                            {funnelData.map((item, i) => (
                                <div key={i} className="group">
                                    <div className="flex justify-between text-sm mb-2 items-center">
                                        <span className="font-medium text-stone-600 group-hover:text-stone-900 transition-colors">{item.label}</span>
                                        <span className="font-bold text-stone-800 bg-white/50 px-2 py-0.5 rounded shadow-sm">{item.count}</span>
                                    </div>
                                    <div className="h-2.5 w-full bg-stone-100 rounded-full overflow-hidden shadow-inner">
                                        <div 
                                            className="h-full rounded-full transition-all duration-1000 ease-out relative overflow-hidden" 
                                            style={{ width: `${(item.count / maxCount) * 100}%`, backgroundColor: item.color }}
                                        >
                                            <div className="absolute inset-0 bg-white/20 animate-[shimmer_2s_infinite]"></div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    
                    {/* ONBOARDING STATUS */}
                    <div className="glass-card p-8 rounded-2xl flex flex-col relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-400/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
                        <h3 className="font-serif text-xl font-bold text-stone-800 mb-6 flex items-center gap-2 relative z-10">
                            <Flag size={20} className="text-emerald-600"/> Onboarding
                        </h3>
                        
                        <div className="flex-1 flex flex-col justify-center gap-4 relative z-10">
                            <div className="flex items-center justify-between p-4 bg-white/60 rounded-xl border border-white shadow-sm hover:shadow-md transition-all">
                                <div className="flex items-center gap-3">
                                    <div className="w-2 h-2 rounded-full bg-stone-400"></div>
                                    <span className="text-sm font-semibold text-stone-600">Da Iniziare</span>
                                </div>
                                <span className="font-bold text-stone-900 text-lg">{toStartOnboarding}</span>
                            </div>
                            <div className="flex items-center justify-between p-4 bg-white/60 rounded-xl border border-white shadow-sm hover:shadow-md transition-all">
                                <div className="flex items-center gap-3">
                                    <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                                    <span className="text-sm font-semibold text-stone-600">In Corso</span>
                                </div>
                                <span className="font-bold text-blue-700 text-lg">{inProgressOnboarding}</span>
                            </div>
                            <div className="flex items-center justify-between p-4 bg-emerald-50/50 rounded-xl border border-emerald-100 shadow-sm hover:shadow-md transition-all">
                                <div className="flex items-center gap-3">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                                    <span className="text-sm font-semibold text-emerald-800">Completati</span>
                                </div>
                                <span className="font-bold text-emerald-700 text-lg">{completedOnboarding}</span>
                            </div>
                        </div>
                        
                        <div className="mt-8 pt-4 border-t border-stone-200 text-center">
                            <p className="text-xs text-stone-400 uppercase tracking-wider mb-1">Totale Processi</p>
                            <span className="text-3xl font-serif font-bold text-stone-800">{totalOnboarding}</span>
                        </div>
                    </div>
                </div>
                
                {/* RECENT ACTIVITY */}
                <div className="glass-card p-8 rounded-2xl mb-10">
                     <h3 className="font-serif text-xl font-bold text-stone-800 mb-6 flex items-center gap-2">
                        <Activity size={20} className="text-emerald-600"/> Attività Recente
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {recentCandidates.length === 0 && <p className="text-stone-400 text-sm italic col-span-4 text-center py-8">Nessuna attività recente.</p>}
                        {recentCandidates.map(c => (
                            <div key={c.id} className="flex flex-col p-4 bg-white/50 rounded-xl border border-white shadow-sm hover:shadow-md hover:-translate-y-1 transition-all">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-stone-100 to-stone-200 flex items-center justify-center overflow-hidden shrink-0 shadow-inner border border-white">
                                        {c.photo ? (
                                            <img src={`data:image/jpeg;base64,${c.photo}`} alt="" className="w-full h-full object-cover"/>
                                        ) : (
                                            <span className="text-sm font-bold text-stone-500 font-serif">{c.fullName.charAt(0)}</span>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-stone-900 truncate">{c.fullName}</p>
                                        <p className="text-[10px] text-stone-500 flex items-center gap-1"><Clock size={10}/> {new Date(c.createdAt).toLocaleDateString()}</p>
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-1 mt-auto">
                                    {c.skills.slice(0, 2).map((s, i) => <span key={i} className="text-[9px] bg-white border border-stone-200 px-1.5 py-0.5 rounded text-stone-600">{s}</span>)}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};