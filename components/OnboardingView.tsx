
import React, { useState, useMemo, useEffect } from 'react';
import { AppState, OnboardingProcess, OnboardingTask, User, OnboardingPhase, OnboardingPhaseLabels } from '../types';
import { CheckCircle, Circle, Clock, Trash2, Search, Flag, Plus, Sparkles, Loader2, X, User as UserIcon, Calendar, ChevronRight } from 'lucide-react';
import { updateOnboardingTask, deleteOnboardingProcess, generateId, createOnboardingProcess, getAllUsers } from '../services/storage';
import { generateOnboardingChecklist } from '../services/ai';
import { OnboardingSetupModal } from './OnboardingSetupModal';

interface OnboardingViewProps {
    data: AppState;
    refreshData: () => void;
    currentUser: User | null;
}

export const OnboardingView: React.FC<OnboardingViewProps> = ({ data, refreshData, currentUser }) => {
    const [selectedProcessId, setSelectedProcessId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    
    // Assignee Logic
    const [allUsers, setAllUsers] = useState<User[]>([]);
    
    // Manual Creation State (Replaced by SetupModal)
    const [isSetupModalOpen, setIsSetupModalOpen] = useState(false);
    const [tempCandidateId, setTempCandidateId] = useState('');
    const [tempJobId, setTempJobId] = useState('');

    useEffect(() => {
        getAllUsers().then(setAllUsers);
    }, []);

    const processes = useMemo(() => {
        let list = data.onboarding;
        if (searchTerm) {
            list = list.filter(p => {
                const c = data.candidates.find(x => x.id === p.candidateId);
                const j = data.jobs.find(x => x.id === p.jobId);
                const term = searchTerm.toLowerCase();
                return (c?.fullName.toLowerCase().includes(term) || j?.title.toLowerCase().includes(term));
            });
        }
        return list.sort((a, b) => b.startDate - a.startDate);
    }, [data.onboarding, data.candidates, data.jobs, searchTerm]);

    const selectedProcess = processes.find(p => p.id === selectedProcessId);
    const selectedCandidate = selectedProcess ? data.candidates.find(c => c.id === selectedProcess.candidateId) : null;
    const selectedJob = selectedProcess ? data.jobs.find(j => j.id === selectedProcess.jobId) : null;

    const toggleTask = async (taskId: string, currentStatus: boolean) => {
        if (!selectedProcess) return;
        const newTasks = selectedProcess.tasks.map(t => t.id === taskId ? { ...t, isCompleted: !currentStatus } : t);
        const allCompleted = newTasks.every(t => t.isCompleted);
        await updateOnboardingTask(selectedProcess.id, newTasks, allCompleted);
        refreshData();
    };

    const handleAssignTask = async (taskId: string, userId: string) => {
        if (!selectedProcess) return;
        const newTasks = selectedProcess.tasks.map(t => t.id === taskId ? { ...t, assigneeId: userId } : t);
        await updateOnboardingTask(selectedProcess.id, newTasks, false);
        refreshData();
    };

    const handleDelete = async (id: string) => {
        if (confirm("Sei sicuro di voler eliminare questo processo di onboarding?")) {
            await deleteOnboardingProcess(id);
            if (selectedProcessId === id) setSelectedProcessId(null);
            refreshData();
        }
    };

    // Candidates eligible for onboarding (Hired but no process)
    const eligibleCandidates = useMemo(() => {
        const hiredApps = data.applications.filter(a => a.status === 'ASSUNTO');
        return hiredApps.filter(app => !data.onboarding.some(o => o.candidateId === app.candidateId && o.jobId === app.jobId));
    }, [data.applications, data.onboarding]);

    // TIMELINE ORDER
    const phaseOrder = [OnboardingPhase.PRE_BOARDING, OnboardingPhase.DAY_1, OnboardingPhase.WEEK_1, OnboardingPhase.MONTH_1];

    // Helper to get selected candidate/job for modal
    const getModalData = () => {
        if(!tempCandidateId || !tempJobId) return null;
        const c = data.candidates.find(x => x.id === tempCandidateId);
        const j = data.jobs.find(x => x.id === tempJobId);
        if(!c || !j) return null;
        return { c, j };
    };

    const modalData = getModalData();

    // Helper to get phase label (Custom or Default)
    const getPhaseLabel = (phase: OnboardingPhase, process: OnboardingProcess) => {
        if (process.phaseConfig && process.phaseConfig[phase]) {
            return process.phaseConfig[phase];
        }
        return OnboardingPhaseLabels[phase];
    };

    return (
        <div className="h-full flex bg-gray-50">
            {/* LEFT SIDEBAR LIST */}
            <div className="w-80 bg-white border-r border-gray-200 flex flex-col h-full shrink-0">
                <div className="p-4 border-b border-gray-200">
                    <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-3">
                        <Flag className="text-indigo-600"/> Onboarding
                    </h2>
                    <div className="relative mb-3">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={14} />
                        <input 
                            type="text" 
                            placeholder="Cerca..." 
                            className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    
                    {/* Simplified creation trigger */}
                    {eligibleCandidates.length > 0 && (
                        <div className="mb-2">
                             <select 
                                className="w-full p-2 bg-indigo-50 border border-indigo-100 rounded-lg text-sm text-indigo-700 outline-none focus:ring-2 focus:ring-indigo-500"
                                value=""
                                onChange={(e) => {
                                    const [cId, jId] = e.target.value.split('|');
                                    setTempCandidateId(cId);
                                    setTempJobId(jId);
                                    setIsSetupModalOpen(true);
                                }}
                            >
                                <option value="">+ Nuovo Onboarding</option>
                                {eligibleCandidates.map(app => {
                                    const c = data.candidates.find(x => x.id === app.candidateId);
                                    const j = data.jobs.find(x => x.id === app.jobId);
                                    return <option key={app.id} value={`${app.candidateId}|${app.jobId}`}>{c?.fullName} - {j?.title}</option>;
                                })}
                            </select>
                        </div>
                    )}
                </div>
                
                <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
                    {processes.length === 0 ? (
                        <p className="text-center text-gray-400 text-sm py-4">Nessun processo attivo.</p>
                    ) : (
                        processes.map(p => {
                            const c = data.candidates.find(x => x.id === p.candidateId);
                            const j = data.jobs.find(x => x.id === p.jobId);
                            const completed = p.tasks.filter(t => t.isCompleted).length;
                            const total = p.tasks.length;
                            const progress = total > 0 ? (completed / total) * 100 : 0;
                            const isSelected = selectedProcessId === p.id;

                            return (
                                <div 
                                    key={p.id} 
                                    onClick={() => setSelectedProcessId(p.id)}
                                    className={`p-3 rounded-lg border cursor-pointer transition-all ${isSelected ? 'bg-indigo-50 border-indigo-200 shadow-sm' : 'bg-white border-gray-100 hover:border-gray-200'}`}
                                >
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden shrink-0 border border-gray-200">
                                            {c?.photo ? (
                                                <img src={`data:image/jpeg;base64,${c.photo}`} className="w-full h-full object-cover"/>
                                            ) : (
                                                // SAFE CHARAT ACCESS
                                                c?.fullName ? c.fullName.charAt(0) : '?'
                                            )}
                                        </div>
                                        <div className="min-w-0">
                                            <h4 className="font-bold text-gray-900 text-sm truncate">{c?.fullName || 'Candidato Sconosciuto'}</h4>
                                            <p className="text-xs text-gray-500 truncate">{j?.title || 'Posizione Sconosciuta'}</p>
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="flex justify-between text-[10px] text-gray-500 font-medium">
                                            <span>{completed}/{total} Task</span>
                                            <span>{Math.round(progress)}%</span>
                                        </div>
                                        <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
                                            <div className="h-full bg-indigo-500 transition-all duration-500" style={{ width: `${progress}%` }}></div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* MAIN CONTENT AREA */}
            <div className="flex-1 overflow-hidden flex flex-col">
                {selectedProcess && selectedCandidate && selectedJob ? (
                    <>
                        {/* HEADER */}
                        <div className="p-6 bg-white border-b border-gray-200 flex justify-between items-start shadow-sm z-10">
                            <div className="flex items-center gap-4">
                                <div className="w-16 h-16 rounded-full bg-gray-100 overflow-hidden border-2 border-white shadow-md flex items-center justify-center">
                                    {selectedCandidate.photo ? (
                                        <img src={`data:image/jpeg;base64,${selectedCandidate.photo}`} className="w-full h-full object-cover"/>
                                    ) : (
                                        <span className="font-bold text-2xl text-gray-400">
                                            {selectedCandidate.fullName ? selectedCandidate.fullName.charAt(0) : '?'}
                                        </span>
                                    )}
                                </div>
                                <div>
                                    <h1 className="text-2xl font-bold text-gray-900">{selectedCandidate.fullName}</h1>
                                    <p className="text-gray-500 flex items-center gap-2">
                                        {selectedJob.title} <span className="w-1 h-1 bg-gray-300 rounded-full"></span> {selectedJob.department}
                                    </p>
                                    <div className="flex items-center gap-2 mt-2">
                                        <span className={`text-xs px-2 py-0.5 rounded font-bold border ${selectedProcess.status === 'COMPLETED' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-blue-100 text-blue-700 border-blue-200'}`}>
                                            {selectedProcess.status === 'COMPLETED' ? 'COMPLETATO' : 'IN CORSO'}
                                        </span>
                                        <span className="text-xs text-gray-400 flex items-center gap-1"><Clock size={12}/> Iniziato il {new Date(selectedProcess.startDate).toLocaleDateString()}</span>
                                    </div>
                                </div>
                            </div>
                            <button onClick={() => handleDelete(selectedProcess.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Elimina Processo">
                                <Trash2 size={20}/>
                            </button>
                        </div>

                        {/* TIMELINE VIEW */}
                        <div className="flex-1 overflow-y-auto p-8 bg-gray-50 custom-scrollbar">
                            <div className="max-w-4xl mx-auto relative">
                                {/* Vertical Line */}
                                <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200 hidden md:block"></div>

                                {phaseOrder.map((phase, index) => {
                                    const phaseTasks = selectedProcess.tasks.filter(t => t.phase === phase);
                                    if (phaseTasks.length === 0) return null;

                                    return (
                                        <div key={phase} className="mb-8 relative md:pl-12 animate-in slide-in-from-bottom-2">
                                            {/* Phase Marker */}
                                            <div className="absolute left-0 top-0 w-8 h-8 rounded-full bg-white border-2 border-indigo-500 flex items-center justify-center z-10 shadow-sm hidden md:flex">
                                                <span className="text-indigo-600 font-bold text-xs">{index + 1}</span>
                                            </div>

                                            {/* Phase Header - USING CUSTOM LABELS */}
                                            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                                                {getPhaseLabel(phase, selectedProcess)}
                                                <span className="text-xs font-normal text-gray-500 bg-white px-2 py-0.5 rounded border border-gray-200">
                                                    {phaseTasks.filter(t => t.isCompleted).length}/{phaseTasks.length}
                                                </span>
                                            </h3>

                                            {/* Tasks List */}
                                            <div className="space-y-3">
                                                {phaseTasks.map(task => {
                                                    const assignee = allUsers.find(u => u.uid === task.assigneeId);
                                                    
                                                    // Due Date logic
                                                    const isOverdue = task.dueDate && Date.now() > task.dueDate && !task.isCompleted;
                                                    const isToday = task.dueDate && new Date().toDateString() === new Date(task.dueDate).toDateString();

                                                    return (
                                                        <div key={task.id} className={`bg-white rounded-xl border p-4 flex items-center gap-4 transition-all shadow-sm ${task.isCompleted ? 'border-gray-200 opacity-75' : isOverdue ? 'border-red-300' : 'border-gray-200 hover:border-indigo-300 hover:shadow-md'}`}>
                                                            <button 
                                                                onClick={() => toggleTask(task.id, task.isCompleted)}
                                                                className={`w-6 h-6 rounded-full border flex items-center justify-center transition-all shrink-0 ${task.isCompleted ? 'bg-green-500 border-green-500 text-white' : 'bg-white border-gray-300 text-transparent hover:border-green-400'}`}
                                                            >
                                                                <CheckCircle size={16} className={task.isCompleted ? 'scale-100' : 'scale-0'}/>
                                                            </button>
                                                            
                                                            <div className="flex-1 min-w-0">
                                                                <p className={`text-sm font-medium truncate ${task.isCompleted ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                                                                    {task.description}
                                                                </p>
                                                                <div className="flex gap-3 mt-1">
                                                                    <p className="text-xs text-gray-400 flex items-center gap-2">
                                                                        <span className="bg-gray-100 text-gray-600 px-1.5 rounded uppercase font-bold text-[10px]">{task.department}</span>
                                                                    </p>
                                                                    {task.dueDate && (
                                                                         <span className={`text-[10px] flex items-center gap-1 font-medium px-1.5 rounded ${isOverdue ? 'bg-red-50 text-red-600' : isToday ? 'bg-orange-50 text-orange-600' : 'bg-gray-50 text-gray-500'}`}>
                                                                             <Calendar size={10}/> 
                                                                             {new Date(task.dueDate).toLocaleDateString()}
                                                                             {isOverdue && !task.isCompleted && " (Scaduto)"}
                                                                         </span>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            {/* Assignee Selector */}
                                                            <div className="relative group shrink-0">
                                                                <div className="flex items-center gap-2 cursor-pointer p-1.5 hover:bg-gray-50 rounded-lg border border-transparent hover:border-gray-200 transition-all">
                                                                    {assignee ? (
                                                                        <>
                                                                            <div className="w-6 h-6 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center text-[10px] font-bold text-indigo-700 overflow-hidden">
                                                                                {assignee.avatar ? <img src={assignee.avatar} className="w-full h-full object-cover"/> : assignee.name.charAt(0)}
                                                                            </div>
                                                                            <span className="text-xs text-gray-600 max-w-[80px] truncate hidden sm:block">{assignee.name}</span>
                                                                        </>
                                                                    ) : (
                                                                        <div className="flex items-center gap-1 text-gray-400">
                                                                            <div className="w-6 h-6 rounded-full border border-dashed border-gray-300 flex items-center justify-center">
                                                                                <UserIcon size={12}/>
                                                                            </div>
                                                                            <span className="text-xs hidden sm:block">Assegna</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                
                                                                {/* Dropdown on Hover */}
                                                                <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 shadow-xl rounded-lg z-20 hidden group-hover:block max-h-48 overflow-y-auto custom-scrollbar">
                                                                    <div className="p-2">
                                                                        <div className="text-[10px] font-bold text-gray-400 uppercase mb-2 px-2">Seleziona Responsabile</div>
                                                                        {allUsers.map(u => (
                                                                            <div 
                                                                                key={u.uid} 
                                                                                onClick={() => handleAssignTask(task.id, u.uid || '')}
                                                                                className="flex items-center gap-2 p-2 hover:bg-indigo-50 rounded-md cursor-pointer"
                                                                            >
                                                                                <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center text-[10px] overflow-hidden border">
                                                                                    {u.avatar ? <img src={u.avatar} className="w-full h-full object-cover"/> : u.name.charAt(0)}
                                                                                </div>
                                                                                <span className="text-xs text-gray-800 truncate">{u.name}</span>
                                                                                {task.assigneeId === u.uid && <CheckCircle size={12} className="text-indigo-600 ml-auto"/>}
                                                                            </div>
                                                                        ))}
                                                                        <div 
                                                                            onClick={() => handleAssignTask(task.id, '')}
                                                                            className="text-xs text-red-500 p-2 hover:bg-red-50 rounded-md cursor-pointer border-t border-gray-100 mt-1"
                                                                        >
                                                                            Rimuovi assegnazione
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400">
                        <Flag size={48} className="mb-4 opacity-20"/>
                        <p className="text-lg font-medium">Seleziona un processo di onboarding</p>
                        {eligibleCandidates.length === 0 && <p className="text-sm mt-2 text-gray-400">Nessun candidato assunto in attesa.</p>}
                    </div>
                )}
            </div>

            {/* SHARED SETUP MODAL */}
            {isSetupModalOpen && modalData && (
                <OnboardingSetupModal 
                    isOpen={isSetupModalOpen}
                    onClose={() => setIsSetupModalOpen(false)}
                    candidate={modalData.c}
                    job={modalData.j}
                    onProcessCreated={() => {
                        refreshData();
                        setIsSetupModalOpen(false);
                        // Auto-select the newly created process? 
                        // Simplified: user can click it in list.
                    }}
                />
            )}
        </div>
    );
};
