import React, { useState, useMemo, useEffect, useRef } from 'react';
import { AppState, OnboardingProcess, OnboardingTask, User, OnboardingPhase, OnboardingPhaseLabels, OnboardingStatus, OnboardingStatusLabels, OnboardingStatusColors, UserRole, Comment, Attachment } from '../types';
import { CheckCircle, Circle, Clock, Trash2, Search, Flag, Plus, Sparkles, Loader2, X, User as UserIcon, Calendar, ChevronRight, Filter, MessageSquare, Paperclip, FileText, Download, Send, Table, Image, GripVertical, AlertCircle, Upload } from 'lucide-react';
import { updateOnboardingTask, deleteOnboardingProcess, generateId, createOnboardingProcess, getAllUsers, updateOnboardingStatus, addOnboardingComment, addTaskComment, addTaskAttachment, deleteTaskAttachment } from '../services/storage';
import { generateOnboardingChecklist } from '../services/ai';
import { OnboardingSetupModal } from './OnboardingSetupModal';

interface OnboardingViewProps {
    data: AppState;
    refreshData: () => void;
    currentUser: User | null;
}

// Helper for file icons
const getFileIcon = (mimeType: string) => {
    if (mimeType.includes('pdf')) return <FileText size={16} className="text-red-500"/>;
    if (mimeType.includes('sheet') || mimeType.includes('excel')) return <Table size={16} className="text-green-600"/>;
    if (mimeType.includes('image')) return <Image size={16} className="text-purple-500"/>;
    return <FileText size={16} className="text-indigo-500"/>;
};

export const OnboardingView: React.FC<OnboardingViewProps> = ({ data, refreshData, currentUser }) => {
    const [selectedProcessId, setSelectedProcessId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<OnboardingStatus[]>([]);
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    
    // Process Tabs
    const [processTab, setProcessTab] = useState<'timeline' | 'comments'>('timeline');
    const [newProcessComment, setNewProcessComment] = useState('');

    // Task QuickView
    const [viewingTask, setViewingTask] = useState<OnboardingTask | null>(null);
    const [taskTab, setTaskTab] = useState<'info' | 'comments' | 'attachments'>('info');
    const [newTaskComment, setNewTaskComment] = useState('');
    const attachmentInputRef = useRef<HTMLInputElement>(null);
    const commentInputRef = useRef<HTMLTextAreaElement>(null);
    const processCommentInputRef = useRef<HTMLTextAreaElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Assignee Logic
    const [allUsers, setAllUsers] = useState<User[]>([]);
    
    // Manual Creation State (Replaced by SetupModal)
    const [isSetupModalOpen, setIsSetupModalOpen] = useState(false);

    useEffect(() => {
        getAllUsers().then(setAllUsers);
        // Autofocus search on mount if no process selected
        if (!selectedProcessId) {
            searchInputRef.current?.focus();
        }
    }, [selectedProcessId]);

    // AUTO-FOCUS ON PROCESS COMMENTS TAB
    useEffect(() => {
        if (processTab === 'comments' && processCommentInputRef.current) {
            setTimeout(() => {
                processCommentInputRef.current?.focus();
            }, 100);
        }
    }, [processTab]);

    // AUTO-FOCUS ON TASK COMMENTS TAB
    useEffect(() => {
        if (taskTab === 'comments' && commentInputRef.current) {
            setTimeout(() => {
                commentInputRef.current?.focus();
            }, 100);
        }
    }, [taskTab]);

    const activeUsers = useMemo(() => allUsers.filter(u => !u.isDeleted), [allUsers]);

    const processes = useMemo(() => {
        let list = data.onboarding;
        
        // RBAC: Team members only see assigned processes OR processes where they have a task
        if (currentUser?.role === UserRole.TEAM) {
             list = list.filter(p => {
                 // Check if user is assigned to any task
                 const hasAssignedTask = p.tasks.some(t => t.assigneeId === currentUser.uid);
                 // Or if user is relevant to the job (e.g. Hiring Manager) - assuming job.assignedTeamMembers logic from Recruitment
                 const job = data.jobs.find(j => j.id === p.jobId);
                 const isJobTeam = job?.assignedTeamMembers?.includes(currentUser.uid || '');
                 return hasAssignedTask || isJobTeam;
             });
        }

        if (searchTerm) {
            list = list.filter(p => {
                const c = data.candidates.find(x => x.id === p.candidateId);
                const j = data.jobs.find(x => x.id === p.jobId);
                const term = searchTerm.toLowerCase();
                return (c?.fullName.toLowerCase().includes(term) || j?.title.toLowerCase().includes(term));
            });
        }
        
        if (statusFilter.length > 0) {
            list = list.filter(p => statusFilter.includes(p.status));
        }

        return list.sort((a, b) => b.startDate - a.startDate);
    }, [data.onboarding, data.candidates, data.jobs, searchTerm, statusFilter, currentUser]);

    const selectedProcess = processes.find(p => p.id === selectedProcessId);
    // Allow null candidate/job to handle "Orphaned" processes
    const selectedCandidate = selectedProcess ? data.candidates.find(c => c.id === selectedProcess.candidateId) : null;
    const selectedJob = selectedProcess ? data.jobs.find(j => j.id === selectedProcess.jobId) : null;

    const toggleTask = async (taskId: string, currentStatus: boolean) => {
        if (!selectedProcess) return;
        const newStatus = !currentStatus;
        const newTasks = selectedProcess.tasks.map(t => t.id === taskId ? { ...t, isCompleted: newStatus } : t);
        const allCompleted = newTasks.every(t => t.isCompleted);
        await updateOnboardingTask(selectedProcess.id, newTasks, allCompleted);
        
        if (viewingTask && viewingTask.id === taskId) {
            setViewingTask({ ...viewingTask, isCompleted: newStatus });
        }
        refreshData();
    };

    const handleTaskFieldUpdate = async (taskId: string, field: keyof OnboardingTask, value: any) => {
        if (!selectedProcess) return;
        const newTasks = selectedProcess.tasks.map(t => t.id === taskId ? { ...t, [field]: value } : t);
        await updateOnboardingTask(selectedProcess.id, newTasks, false);
        
        if (viewingTask && viewingTask.id === taskId) {
            setViewingTask({ ...viewingTask, [field]: value });
        }
        refreshData();
    };

    const handleDeleteProcess = async (id: string) => {
        if(confirm("Eliminare questo processo?")) {
            await deleteOnboardingProcess(id);
            if(selectedProcessId === id) setSelectedProcessId(null);
            refreshData();
        }
    };

    const handleAddProcessComment = async () => {
        if(!selectedProcessId || !newProcessComment.trim() || !currentUser) return;
        await addOnboardingComment(selectedProcessId, {
            id: generateId(),
            text: newProcessComment,
            authorName: currentUser.name,
            authorAvatar: currentUser.avatar,
            createdAt: Date.now()
        });
        setNewProcessComment('');
        refreshData();
        // Keep focus
        setTimeout(() => processCommentInputRef.current?.focus(), 100);
    };

    const handleProcessCommentKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            handleAddProcessComment();
        }
    };

    const handleAddTaskComment = async () => {
        if(!selectedProcess || !viewingTask || !newTaskComment.trim() || !currentUser) return;
        const comment = {
            id: generateId(),
            text: newTaskComment,
            authorName: currentUser.name,
            authorAvatar: currentUser.avatar,
            createdAt: Date.now()
        };
        await addTaskComment(selectedProcess.id, viewingTask.id, comment, selectedProcess.tasks);
        setNewTaskComment('');
        setViewingTask(prev => prev ? { ...prev, comments: [...(prev.comments || []), comment] } : null);
        refreshData();
        // Keep focus
        setTimeout(() => commentInputRef.current?.focus(), 100);
    };

    const handleAttachmentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if(!selectedProcess || !viewingTask || !e.target.files?.length || !currentUser) return;
        
        // Fix: Explicitly cast Array.from result to File[] to avoid 'unknown' type error
        const files: File[] = Array.from(e.target.files || []);
        
        for (const file of files) {
            const reader = new FileReader();
            reader.onload = async () => {
                const res = reader.result as string;
                const base64 = res.split(',')[1];
                const attachment: Attachment = {
                    id: generateId(),
                    name: file.name,
                    type: file.type,
                    dataBase64: base64,
                    uploadedBy: currentUser.name,
                    createdAt: Date.now()
                };
                await addTaskAttachment(selectedProcess.id, viewingTask.id, attachment, selectedProcess.tasks);
                // Update local view state immediately
                setViewingTask(prev => prev ? { ...prev, attachments: [...(prev.attachments || []), attachment] } : null);
            };
            reader.readAsDataURL(file);
        }
        
        // Refresh with a delay for upload to complete
        setTimeout(refreshData, 1500);
        if(attachmentInputRef.current) attachmentInputRef.current.value = '';
    };

    const handleDeleteAttachment = async (attachmentId: string) => {
        if(!selectedProcess || !viewingTask || !confirm("Eliminare allegato?")) return;
        await deleteTaskAttachment(selectedProcess.id, viewingTask.id, attachmentId, selectedProcess.tasks);
        setViewingTask(prev => prev ? { ...prev, attachments: prev.attachments?.filter(a => a.id !== attachmentId) } : null);
        refreshData();
    };

    const handleStatusChange = async (newStatus: string) => {
        if(!selectedProcessId) return;
        await updateOnboardingStatus(selectedProcessId, newStatus as OnboardingStatus);
        refreshData();
    };

    // Calculate progress for a process
    const getProgress = (p: OnboardingProcess) => {
        if (p.tasks.length === 0) return 0;
        const completed = p.tasks.filter(t => t.isCompleted).length;
        return Math.round((completed / p.tasks.length) * 100);
    };

    return (
        <div className="flex h-full bg-gray-50">
            {/* ... Sidebar ... */}
            <div className="w-80 bg-white border-r border-gray-200 flex flex-col h-full shrink-0">
                <div className="p-4 border-b border-gray-100">
                    <h2 className="text-xl font-bold text-gray-900 mb-4">Onboarding</h2>
                    <div className="relative mb-3">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16}/>
                        <input 
                            ref={searchInputRef}
                            type="text" 
                            placeholder="Cerca dipendente..." 
                            className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="flex justify-between items-center">
                        <button onClick={() => setIsFilterOpen(!isFilterOpen)} className="text-xs font-medium text-gray-500 hover:text-indigo-600 flex items-center gap-1">
                            <Filter size={12}/> Filtri
                        </button>
                        {(currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.HR) && (
                            <button onClick={() => setIsSetupModalOpen(true)} className="text-xs bg-indigo-600 text-white px-2 py-1.5 rounded font-bold hover:bg-indigo-700 transition-colors flex items-center gap-1">
                                <Plus size={12}/> Nuovo
                            </button>
                        )}
                    </div>
                    
                    {/* Filter Dropdown */}
                    {isFilterOpen && (
                        <div className="mt-2 p-2 bg-gray-50 rounded border border-gray-200 flex flex-wrap gap-2 animate-in slide-in-from-top-2">
                            {Object.keys(OnboardingStatusLabels).map(key => {
                                const s = key as OnboardingStatus;
                                return (
                                    <button 
                                        key={s}
                                        onClick={() => setStatusFilter(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])}
                                        className={`text-[10px] px-2 py-1 rounded border ${statusFilter.includes(s) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-300'}`}
                                    >
                                        {OnboardingStatusLabels[s]}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto">
                    {processes.length === 0 ? (
                        <div className="p-8 text-center text-gray-400 text-sm">Nessun processo trovato.</div>
                    ) : (
                        processes.map(process => {
                            const c = data.candidates.find(x => x.id === process.candidateId);
                            const j = data.jobs.find(x => x.id === process.jobId);
                            const progress = getProgress(process);
                            const isOrphan = !c || !j;
                            
                            return (
                                <div 
                                    key={process.id}
                                    onClick={() => setSelectedProcessId(process.id)}
                                    className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors ${selectedProcessId === process.id ? 'bg-indigo-50 border-indigo-200' : ''}`}
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <h4 className={`font-bold text-sm truncate ${isOrphan ? 'text-red-500' : 'text-gray-900'}`}>{c?.fullName || 'Sconosciuto (Dati Mancanti)'}</h4>
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded border ${OnboardingStatusColors[process.status]}`}>
                                            {OnboardingStatusLabels[process.status]}
                                        </span>
                                    </div>
                                    <p className="text-xs text-gray-500 mb-2 truncate">{j?.title || 'Posizione Sconosciuta'}</p>
                                    
                                    <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden mb-2">
                                        <div className="bg-indigo-600 h-full transition-all duration-500" style={{ width: `${progress}%` }}></div>
                                    </div>
                                    <div className="flex justify-between text-[10px] text-gray-400">
                                        <span>{progress}% completato</span>
                                        <span>{new Date(process.startDate).toLocaleDateString()}</span>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* MAIN CONTENT */}
            <div className="flex-1 flex flex-col h-full overflow-hidden bg-gray-50">
                {selectedProcess ? (
                    <>
                        {/* HEADER */}
                        <div className="bg-white border-b border-gray-200 p-6 flex justify-between items-start shrink-0">
                            <div>
                                <h2 className={`text-2xl font-bold flex items-center gap-3 ${!selectedCandidate ? 'text-red-600' : 'text-gray-900'}`}>
                                    {selectedCandidate ? selectedCandidate.fullName : <span className="flex items-center gap-2"><AlertCircle size={24}/> Candidato Eliminato</span>}
                                    {selectedJob && (
                                        <span className="text-sm font-normal text-gray-500 bg-gray-100 px-2 py-1 rounded-lg">
                                            {selectedJob.title}
                                        </span>
                                    )}
                                </h2>
                                <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                                    <span className="flex items-center gap-1"><Calendar size={14}/> Inizio: {new Date(selectedProcess.startDate).toLocaleDateString()}</span>
                                    {selectedCandidate?.email && <span className="flex items-center gap-1"><UserIcon size={14}/> {selectedCandidate.email}</span>}
                                    <select 
                                        value={selectedProcess.status}
                                        onChange={(e) => handleStatusChange(e.target.value)}
                                        className={`text-xs font-bold px-2 py-1 rounded border outline-none cursor-pointer ${OnboardingStatusColors[selectedProcess.status]}`}
                                    >
                                        {Object.keys(OnboardingStatusLabels).map(key => (
                                            <option key={key} value={key}>{OnboardingStatusLabels[key as OnboardingStatus]}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                {(currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.HR) && (
                                    <button 
                                        onClick={() => handleDeleteProcess(selectedProcess.id)} 
                                        className="text-gray-400 hover:text-red-600 p-2 rounded-lg hover:bg-red-50 transition-colors"
                                        title="Elimina Processo"
                                    >
                                        <Trash2 size={20}/>
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* TABS */}
                        <div className="bg-white border-b border-gray-200 px-6 flex gap-6 text-sm font-medium">
                            <button 
                                onClick={() => setProcessTab('timeline')}
                                className={`py-3 border-b-2 transition-colors flex items-center gap-2 ${processTab === 'timeline' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                            >
                                <Flag size={16}/> Timeline Attività
                            </button>
                            <button 
                                onClick={() => setProcessTab('comments')}
                                className={`py-3 border-b-2 transition-colors flex items-center gap-2 ${processTab === 'comments' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                            >
                                <MessageSquare size={16}/> Note & Commenti
                            </button>
                        </div>

                        {/* TAB CONTENT */}
                        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                            {processTab === 'timeline' ? (
                                <div className="max-w-4xl mx-auto space-y-8 pb-10">
                                    {[OnboardingPhase.PRE_BOARDING, OnboardingPhase.DAY_1, OnboardingPhase.WEEK_1, OnboardingPhase.MONTH_1].map(phase => {
                                        const tasks = selectedProcess.tasks.filter(t => t.phase === phase);
                                        const label = (selectedProcess.phaseConfig && selectedProcess.phaseConfig[phase]) || OnboardingPhaseLabels[phase];
                                        
                                        if (tasks.length === 0) return null;

                                        return (
                                            <div key={phase} className="relative pl-8 border-l-2 border-indigo-100 last:border-0">
                                                <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-indigo-600 ring-4 ring-indigo-50"></div>
                                                <h3 className="font-bold text-lg text-gray-900 mb-4 -mt-1">{label}</h3>
                                                
                                                <div className="space-y-3">
                                                    {tasks.map(task => {
                                                        const assignee = allUsers.find(u => u.uid === task.assigneeId);
                                                        return (
                                                            <div 
                                                                key={task.id} 
                                                                className={`bg-white p-4 rounded-xl border transition-all hover:shadow-md cursor-pointer group ${task.isCompleted ? 'border-green-200 bg-green-50/30' : 'border-gray-200'}`}
                                                                onClick={() => { setViewingTask(task); setTaskTab('info'); }}
                                                            >
                                                                <div className="flex items-start gap-3">
                                                                    <button 
                                                                        onClick={(e) => { e.stopPropagation(); toggleTask(task.id, task.isCompleted); }}
                                                                        className={`mt-1 shrink-0 transition-colors ${task.isCompleted ? 'text-green-600' : 'text-gray-300 hover:text-indigo-600'}`}
                                                                    >
                                                                        {task.isCompleted ? <CheckCircle size={20}/> : <Circle size={20}/>}
                                                                    </button>
                                                                    <div className="flex-1 min-w-0">
                                                                        <p className={`font-medium text-gray-900 ${task.isCompleted ? 'line-through text-gray-500' : ''}`}>{task.description}</p>
                                                                        <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                                                                            <span className="bg-gray-100 px-2 py-0.5 rounded font-bold">{task.department}</span>
                                                                            {assignee && (
                                                                                <span className="flex items-center gap-1">
                                                                                    <div className="w-4 h-4 rounded-full bg-indigo-100 flex items-center justify-center text-[8px] font-bold text-indigo-700">
                                                                                        {assignee.name.charAt(0)}
                                                                                    </div>
                                                                                    {assignee.name}
                                                                                </span>
                                                                            )}
                                                                            {task.dueDate && (
                                                                                <span className={`flex items-center gap-1 ${!task.isCompleted && task.dueDate < Date.now() ? 'text-red-500 font-bold' : ''}`}>
                                                                                    <Calendar size={12}/> {new Date(task.dueDate).toLocaleDateString()}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                    <ChevronRight size={16} className="text-gray-300 group-hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-all"/>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="flex flex-col h-full max-w-3xl mx-auto">
                                    <div className="flex-1 space-y-4 mb-4">
                                        {!selectedProcess.comments || selectedProcess.comments.length === 0 ? (
                                            <div className="text-center text-gray-400 py-10 italic">Nessun commento generale sul processo.</div>
                                        ) : (
                                            selectedProcess.comments.map(c => (
                                                <div key={c.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                                                    <div className="flex justify-between items-center mb-2">
                                                        <span className="font-bold text-sm text-gray-900">{c.authorName}</span>
                                                        <span className="text-xs text-gray-400">{new Date(c.createdAt).toLocaleDateString()}</span>
                                                    </div>
                                                    <p className="text-sm text-gray-900 whitespace-pre-wrap">{c.text}</p>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                    <div className="mt-auto pt-4 border-t border-gray-200">
                                        <div className="relative">
                                            <textarea 
                                                ref={processCommentInputRef}
                                                className="w-full bg-white border border-gray-200 rounded-xl p-3 pr-12 text-sm text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none resize-none shadow-sm"
                                                rows={3}
                                                placeholder="Scrivi un commento generale..."
                                                value={newProcessComment}
                                                onChange={e => setNewProcessComment(e.target.value)}
                                                onKeyDown={handleProcessCommentKeyDown}
                                            />
                                            <button 
                                                onClick={handleAddProcessComment}
                                                disabled={!newProcessComment.trim()}
                                                className="absolute right-3 bottom-3 p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm"
                                            >
                                                <Send size={16}/>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                        <Flag size={48} className="mb-4 opacity-20"/>
                        <p className="text-lg font-medium">Seleziona un processo di onboarding</p>
                    </div>
                )}
            </div>

            {/* TASK QUICK VIEW OVERLAY */}
            {viewingTask && selectedProcess && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-end z-[70] backdrop-blur-[2px]" onClick={() => setViewingTask(null)}>
                    <div className="bg-white h-full shadow-2xl flex flex-col animate-slide-left transition-all duration-300 w-full max-w-2xl" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-gray-100 bg-gray-50 flex justify-between items-start">
                             <div>
                                <h3 className="text-xl font-bold text-gray-900 mb-2">{viewingTask.description}</h3>
                                <div className="flex items-center gap-3 text-sm">
                                    <span className="bg-white border border-gray-200 px-2 py-0.5 rounded text-gray-600 font-medium">{viewingTask.department}</span>
                                    <span className="text-gray-500">{OnboardingPhaseLabels[viewingTask.phase]}</span>
                                </div>
                            </div>
                            <button onClick={() => setViewingTask(null)} className="text-gray-400 hover:text-gray-600"><X size={24}/></button>
                        </div>

                        {/* TABS */}
                        <div className="flex border-b border-gray-200 px-6 gap-6">
                             {[{id:'info', label:'Dettagli'}, {id:'comments', label:`Commenti (${viewingTask.comments?.length || 0})`}, {id:'attachments', label:`Allegati (${viewingTask.attachments?.length || 0})`}].map(tab => (
                                <button 
                                    key={tab.id} 
                                    onClick={() => setTaskTab(tab.id as any)}
                                    className={`py-3 text-sm font-bold border-b-2 transition-colors ${taskTab === tab.id ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
                                >
                                    {tab.label}
                                </button>
                             ))}
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 bg-white custom-scrollbar">
                            {taskTab === 'info' && (
                                <div className="space-y-6">
                                     <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-4">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Stato</label>
                                            <button 
                                                onClick={() => toggleTask(viewingTask.id, viewingTask.isCompleted)}
                                                className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg font-bold border ${viewingTask.isCompleted ? 'bg-green-50 text-green-700 border-green-200' : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-300'}`}
                                            >
                                                {viewingTask.isCompleted ? <><CheckCircle size={16}/> Completato</> : <><Circle size={16}/> Da Completare</>}
                                            </button>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Assegnatario</label>
                                            <select 
                                                value={viewingTask.assigneeId || ''}
                                                onChange={(e) => handleTaskFieldUpdate(viewingTask.id, 'assigneeId', e.target.value || undefined)}
                                                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-indigo-500"
                                            >
                                                <option value="">-- Nessuno --</option>
                                                {activeUsers.map(u => <option key={u.uid} value={u.uid}>{u.name}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Scadenza</label>
                                            <input 
                                                type="date"
                                                value={viewingTask.dueDate ? new Date(viewingTask.dueDate).toISOString().split('T')[0] : ''}
                                                onChange={(e) => handleTaskFieldUpdate(viewingTask.id, 'dueDate', e.target.value ? new Date(e.target.value).getTime() : undefined)}
                                                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-indigo-500"
                                            />
                                        </div>
                                     </div>
                                </div>
                            )}

                            {taskTab === 'comments' && (
                                <div className="flex flex-col h-full">
                                    <div className="flex-1 space-y-4 mb-4">
                                        {!viewingTask.comments || viewingTask.comments.length === 0 ? (
                                            <div className="text-center text-gray-400 py-8 italic">Nessun commento su questo task.</div>
                                        ) : (
                                            viewingTask.comments.map(c => (
                                                <div key={c.id} className="bg-gray-50 p-3 rounded-xl rounded-tl-none border border-gray-100 ml-2">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <span className="text-xs font-bold text-gray-900">{c.authorName}</span>
                                                        <span className="text-[10px] text-gray-400">{new Date(c.createdAt).toLocaleDateString()}</span>
                                                    </div>
                                                    <p className="text-sm text-gray-900 whitespace-pre-wrap">{c.text}</p>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                    <div className="relative mt-auto pt-4 border-t border-gray-100">
                                        <textarea 
                                            ref={commentInputRef}
                                            className="w-full bg-white border border-gray-200 rounded-xl p-3 pr-12 text-sm text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                                            rows={3}
                                            placeholder="Scrivi un commento..."
                                            value={newTaskComment}
                                            onChange={e => setNewTaskComment(e.target.value)}
                                            onKeyDown={(e) => { if(e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); handleAddTaskComment(); }}}
                                        />
                                        <button 
                                            onClick={handleAddTaskComment}
                                            disabled={!newTaskComment.trim()}
                                            className="absolute right-3 bottom-3 p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                                        >
                                            <Send size={16}/>
                                        </button>
                                    </div>
                                </div>
                            )}

                            {taskTab === 'attachments' && (
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center mb-2">
                                        <h4 className="text-xs font-bold text-gray-400 uppercase">File Allegati</h4>
                                        <input type="file" multiple ref={attachmentInputRef} className="hidden" onChange={handleAttachmentUpload}/>
                                        <button onClick={() => attachmentInputRef.current?.click()} className="text-xs bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg border border-indigo-200 hover:bg-indigo-100 font-bold flex items-center gap-1">
                                            <Upload size={12}/> Carica
                                        </button>
                                    </div>
                                    {!viewingTask.attachments || viewingTask.attachments.length === 0 ? (
                                        <div className="text-center text-gray-400 py-8 italic border-2 border-dashed border-gray-100 rounded-xl">Nessun file allegato.</div>
                                    ) : (
                                        <div className="grid grid-cols-2 gap-3">
                                            {viewingTask.attachments.map(file => (
                                                <div key={file.id} className="border border-gray-200 rounded-lg p-3 hover:shadow-sm bg-gray-50">
                                                    <div className="flex items-start justify-between mb-2">
                                                        <div className="p-2 bg-white rounded shadow-sm">
                                                            {getFileIcon(file.type)}
                                                        </div>
                                                        <div className="flex gap-1">
                                                            <a href={file.url || `data:${file.type};base64,${file.dataBase64}`} download={file.name} target="_blank" className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded"><Download size={16}/></a>
                                                            <button onClick={() => handleDeleteAttachment(file.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 size={16}/></button>
                                                        </div>
                                                    </div>
                                                    <p className="text-xs font-bold text-gray-900 truncate mb-1" title={file.name}>{file.name}</p>
                                                    <div className="flex justify-between text-[10px] text-gray-500">
                                                        <span>{new Date(file.createdAt).toLocaleDateString()}</span>
                                                        <span>{file.uploadedBy}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* SETUP MODAL */}
            {isSetupModalOpen && (
                 <OnboardingSetupModal 
                    isOpen={isSetupModalOpen}
                    onClose={() => setIsSetupModalOpen(false)}
                    candidate={data.candidates[0] || { id: 'dummy', fullName: 'Nuovo Processo', email: '', skills: [], summary: '', status: 'CANDIDATE', createdAt: 0 }} // Dummy if generic
                    job={data.jobs[0] || { id: 'dummy', title: 'Generico', department: '', description: '', requirements: '', status: 'OPEN', createdAt: 0 }}
                    onProcessCreated={() => { setIsSetupModalOpen(false); refreshData(); }}
                />
            )}
        </div>
    );
};