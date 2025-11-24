
import React from 'react';
import { AppState, SelectionStatus, StatusLabels, StatusColors, UserRole } from '../types';
import { Users, Briefcase, FileText, TrendingUp, Activity, Percent, BrainCircuit, Flag, CheckCircle } from 'lucide-react';
import { auth } from '../services/firebase';

interface DashboardViewProps {
    data: AppState;
    onNavigate: (tab: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ data, onNavigate }) => {
    // Current User
    const currentUserRole = auth?.currentUser ? (data.jobs.length > 0 ? UserRole.ADMIN : UserRole.HR) : UserRole.HR; // Simplified logic, ideally pass user prop

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
    const cancelledOnboarding = data.onboarding.filter(o => o.status === 'CANCELLED').length;
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
        colorClass: StatusColors[status]
    }));

    const maxCount = Math.max(...funnelData.map(d => d.count)) || 1;

    // Recent Activity (Mocked logic based on timestamps would go here, using simple list for now)
    const recentCandidates = [...data.candidates].sort((a, b) => b.createdAt - a.createdAt).slice(0, 5);

    return (
        <div className="p-8 h-full overflow-y-auto">
            <div className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
                <p className="text-gray-500">Panoramica delle performance di recruitment.</p>
            </div>
            
            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer" onClick={() => onNavigate('candidates')}>
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg"><Users size={24}/></div>
                    </div>
                    <h3 className="text-3xl font-bold text-gray-900 mb-1">{totalCandidates}</h3>
                    <p className="text-gray-500 text-sm">Candidati Totali</p>
                </div>

                <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer" onClick={() => onNavigate('recruitment')}>
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-blue-50 text-blue-600 rounded-lg"><Briefcase size={24}/></div>
                    </div>
                    <h3 className="text-3xl font-bold text-gray-900 mb-1">{activeJobs}</h3>
                    <p className="text-gray-500 text-sm">Posizioni Aperte</p>
                </div>

                <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-green-50 text-green-600 rounded-lg"><Percent size={24}/></div>
                    </div>
                    <h3 className="text-3xl font-bold text-gray-900 mb-1">{conversionRate}%</h3>
                    <p className="text-gray-500 text-sm">Tasso di Assunzione</p>
                </div>

                <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-purple-50 text-purple-600 rounded-lg"><BrainCircuit size={24}/></div>
                    </div>
                    <h3 className="text-3xl font-bold text-gray-900 mb-1">{avgAiScore}</h3>
                    <p className="text-gray-500 text-sm">Media Fit Score AI</p>
                </div>
            </div>

            {/* Charts Area */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* FUNNEL */}
                <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                    <h3 className="font-bold text-gray-900 mb-6 flex items-center gap-2">
                        <TrendingUp size={20} className="text-indigo-600"/> Recruitment Funnel
                    </h3>
                    <div className="space-y-5">
                        {funnelData.map((item, i) => {
                            // Extract background color from tailwind class string for inline style safety or use standard colors
                            let barColor = '#e5e7eb';
                            if (item.colorClass.includes('indigo')) barColor = '#6366f1';
                            else if (item.colorClass.includes('blue')) barColor = '#3b82f6';
                            else if (item.colorClass.includes('purple')) barColor = '#a855f7';
                            else if (item.colorClass.includes('yellow')) barColor = '#eab308';
                            else if (item.colorClass.includes('green')) barColor = '#22c55e';
                            else if (item.colorClass.includes('red')) barColor = '#ef4444';
                            else if (item.colorClass.includes('gray')) barColor = '#9ca3af';

                            return (
                                <div key={i} className="relative group">
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="font-medium text-gray-700">{item.label}</span>
                                        <span className="font-bold text-gray-900">{item.count}</span>
                                    </div>
                                    <div className="h-3 w-full bg-gray-100 rounded-full overflow-hidden">
                                        <div 
                                            className="h-full rounded-full transition-all duration-1000 ease-out" 
                                            style={{ width: `${(item.count / maxCount) * 100}%`, backgroundColor: barColor }}
                                        ></div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
                
                {/* ONBOARDING STATUS (Admin/HR Only) */}
                <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex flex-col">
                     <h3 className="font-bold text-gray-900 mb-6 flex items-center gap-2">
                        <Flag size={20} className="text-indigo-600"/> Stato Onboarding
                    </h3>
                    <div className="flex-1 flex flex-col justify-center space-y-4">
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <span className="text-sm font-medium text-gray-600">Da Iniziare</span>
                            <span className="font-bold text-gray-900">{toStartOnboarding}</span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                            <span className="text-sm font-medium text-blue-700">In Corso</span>
                            <span className="font-bold text-blue-900">{inProgressOnboarding}</span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                            <span className="text-sm font-medium text-green-700">Completati</span>
                            <span className="font-bold text-green-900">{completedOnboarding}</span>
                        </div>
                         <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                            <span className="text-sm font-medium text-red-700">Annullati</span>
                            <span className="font-bold text-red-900">{cancelledOnboarding}</span>
                        </div>
                    </div>
                    <div className="mt-6 pt-4 border-t border-gray-100 text-center">
                        <p className="text-xs text-gray-500 mb-2">Totale processi attivi o storici</p>
                        <span className="text-2xl font-bold text-gray-900">{totalOnboarding}</span>
                    </div>
                </div>
            </div>
            
            {/* RECENT ACTIVITY */}
            <div className="mt-8 bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                 <h3 className="font-bold text-gray-900 mb-6 flex items-center gap-2">
                    <Activity size={20} className="text-indigo-600"/> Ultimi Candidati Inseriti
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {recentCandidates.length === 0 && <p className="text-gray-400 text-sm italic col-span-3 text-center py-4">Nessuna attività recente.</p>}
                    {recentCandidates.map(c => (
                        <div key={c.id} className="flex items-center gap-3 p-4 hover:bg-gray-50 rounded-lg transition-colors border border-gray-100">
                            <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden shrink-0">
                                {c.photo ? (
                                    <img src={`data:image/jpeg;base64,${c.photo}`} alt="" className="w-full h-full object-cover"/>
                                ) : (
                                    <span className="text-sm font-bold text-gray-600">{c.fullName.charAt(0)}</span>
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-gray-900 truncate">{c.fullName}</p>
                                <p className="text-xs text-gray-500 truncate mb-1">Inserito il {new Date(c.createdAt).toLocaleDateString()}</p>
                                <div className="flex gap-1">
                                    {c.skills.slice(0, 2).map((s, i) => <span key={i} className="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">{s}</span>)}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
