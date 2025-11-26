import React, { useState, useMemo, useRef, useEffect } from 'react';
import { AppState, JobPosition, SelectionStatus, StatusLabels, StatusColors, User, UserRole, Application, Candidate, Comment, Attachment, ScorecardSchema } from '../types';
import { Plus, Search, MoreVertical, Trash2, Edit2, Users, Briefcase, ChevronRight, X, Save, Loader2, Sparkles, AlertCircle, MessageSquare, Paperclip, FileText, Send, Download, Table, Image, GripVertical, CheckCircle, Mail, Star, Phone, Maximize2, Minimize2 } from 'lucide-react';
import { addJob, updateJob, deleteJob, generateId, updateApplicationStatus, addCandidateComment, addCandidateAttachment, deleteCandidateAttachment, updateApplicationScorecard } from '../services/storage';
import { generateJobDetails, generateScorecardSchema } from '../services/ai';

interface RecruitmentViewProps {
    data: AppState;
    refreshData: () => void;
    currentUser: User | null;
    onUpload: (files: File[], jobId?: string) => void;
}

// Helper for file icons
const getFileIcon = (mimeType: string) => {
    if (mimeType.includes('pdf')) return <FileText size={16} className="text-red-500"/>;
    if (mimeType.includes('sheet') || mimeType.includes('excel')) return <Table size={16} className="text-green-600"/>;
    if (mimeType.includes('image')) return <Image size={16} className="text-purple-500"/>;
    return <FileText size={16} className="text-indigo-500"/>;
};

export const RecruitmentView: React.FC<RecruitmentViewProps> = ({ data, refreshData, currentUser, onUpload }) => {
    const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    
    // Job Modal
    const [isJobModalOpen, setIsJobModalOpen] = useState(false);
    const [editingJob, setEditingJob] = useState<JobPosition | null>(null);
    const [jobForm, setJobForm] = useState<Partial<JobPosition>>({ title: '', department: '', description: '', requirements: '', status: 'OPEN' });
    const [isGeneratingJob, setIsGeneratingJob] = useState(false);

    // Application View (Quick View)
    const [viewingApp, setViewingApp] = useState<(Application & { candidate: Candidate }) | null>(null);
    const [quickViewTab, setQuickViewTab] = useState<'info' | 'comments' | 'attachments'>('info');
    const [newComment, setNewComment] = useState('');
    const commentInputRef = useRef<HTMLTextAreaElement>(null);
    const attachmentInputRef = useRef<HTMLInputElement>(null);

    // Drag & Drop
    const [draggedAppId, setDraggedAppId] = useState<string | null>(null);

    // Filter Jobs
    const filteredJobs = useMemo(() => {
        let jobs = data.jobs;
        if (currentUser?.role === UserRole.TEAM) {
             jobs = jobs.filter(j => j.assignedTeamMembers?.includes(currentUser.uid || ''));
        }
        if (searchTerm) {
            jobs = jobs.filter(j => j.title.toLowerCase().includes(searchTerm.toLowerCase()));
        }
        return jobs;
    }, [data.jobs, searchTerm, currentUser]);

    // Set initial selected job
    useEffect(() => {
        if (!selectedJobId && filteredJobs.length > 0) {
            setSelectedJobId(filteredJobs[0].id);
        }
    }, [filteredJobs, selectedJobId]);

    const selectedJob = data.jobs.find(j => j.id === selectedJobId);
    
    // Get Applications for selected job
    const jobApplications = useMemo(() => {
        if (!selectedJobId) return [];
        return data.applications
            .filter(a => a.jobId === selectedJobId)
            .map(a => {
                const candidate = data.candidates.find(c => c.id === a.candidateId);
                return candidate ? { ...a, candidate } : null;
            })
            .filter(Boolean) as (Application & { candidate: Candidate })[];
    }, [selectedJobId, data.applications, data.candidates]);

    // Kanban Columns
    const columns = [
        SelectionStatus.TO_ANALYZE,
        SelectionStatus.SCREENING,
        SelectionStatus.FIRST_INTERVIEW,
        SelectionStatus.SECOND_INTERVIEW,
        SelectionStatus.OFFER,
        SelectionStatus.HIRED,
        SelectionStatus.REJECTED
    ];

    // --- JOB ACTIONS ---

    const handleOpenJobModal = (job?: JobPosition) => {
        if (job) {
            setEditingJob(job);
            setJobForm({ ...job });
        } else {
            setEditingJob(null);
            setJobForm({ title: '', department: '', description: '', requirements: '', status: 'OPEN' });
        }
        setIsJobModalOpen(true);
    };

    const handleJobSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!jobForm.title || !jobForm.department) return;

        const jobData = {
            ...jobForm,
            updatedAt: Date.now()
        } as any;

        if (editingJob) {
            await updateJob({ ...editingJob, ...jobData });
        } else {
            const newJob: JobPosition = {
                id: generateId(),
                title: jobData.title,
                department: jobData.department,
                description: jobData.description || '',
                requirements: jobData.requirements || '',
                status: jobData.status || 'OPEN',
                createdAt: Date.now(),
                assignedTeamMembers: currentUser ? [currentUser.uid!] : []
            };
            // Generate scorecard schema automatically if new
            try {
                const schema = await generateScorecardSchema(newJob.title, newJob.description, data.companyInfo);
                newJob.scorecardSchema = schema;
            } catch(e) {}

            await addJob(newJob);
            setSelectedJobId(newJob.id);
        }
        setIsJobModalOpen(false);
        refreshData();
    };

    const handleDeleteJob = async (id: string) => {
        if (confirm("Sei sicuro di voler eliminare questa posizione?")) {
            await deleteJob(id);
            if (selectedJobId === id) setSelectedJobId(null);
            refreshData();
        }
    };

    const handleGenerateJobAI = async () => {
        if (!jobForm.title) return alert("Inserisci almeno il titolo.");
        setIsGeneratingJob(true);
        try {
            const res = await generateJobDetails(jobForm.title, jobForm.department || 'Generale', data.companyInfo);
            setJobForm(prev => ({ ...prev, description: res.description, requirements: res.requirements }));
        } catch (e) {
            console.error(e);
            alert("Errore generazione AI");
        } finally {
            setIsGeneratingJob(false);
        }
    };

    // --- APP DRAG & DROP ---

    const handleDragStart = (e: React.DragEvent, appId: string) => {
        e.dataTransfer.setData('appId', appId);
        setDraggedAppId(appId);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const handleDrop = async (e: React.DragEvent, status: SelectionStatus) => {
        e.preventDefault();
        const appId = e.dataTransfer.getData('appId');
        if (appId) {
            await updateApplicationStatus(appId, status);
            refreshData();
        }
        setDraggedAppId(null);
    };

    // --- QUICK VIEW ACTIONS ---

    const handleAddComment = async () => {
        if (!viewingApp || !newComment.trim() || !currentUser) return;
        const comment: Comment = {
            id: generateId(),
            text: newComment,
            authorName: currentUser.name,
            authorAvatar: currentUser.avatar,
            createdAt: Date.now()
        };
        await addCandidateComment(viewingApp.candidateId, comment);
        
        // Optimistic update
        setViewingApp(prev => prev ? {
            ...prev,
            candidate: {
                ...prev.candidate,
                comments: [...(prev.candidate.comments || []), comment]
            }
        } : null);
        
        setNewComment('');
        refreshData();
    };

    const handleAttachmentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if(!viewingApp || !e.target.files?.length || !currentUser) return;
        const files: File[] = Array.from(e.target.files || []);
        
        for (const file of files) {
            const reader = new FileReader();
            reader.onload = async () => {
                const res = reader.result;
                if (typeof res === 'string') {
                    const base64 = res.split(',')[1];
                    const attachment: Attachment = {
                        id: generateId(),
                        name: file.name,
                        type: file.type,
                        dataBase64: base64,
                        uploadedBy: currentUser.name,
                        createdAt: Date.now()
                    };
                    await addCandidateAttachment(viewingApp.candidateId, attachment);
                    setViewingApp(prev => prev ? {
                        ...prev,
                        candidate: {
                            ...prev.candidate,
                            attachments: [...(prev.candidate.attachments || []), attachment]
                        }
                    } : null);
                }
            };
            reader.readAsDataURL(file);
        }
        setTimeout(refreshData, 1000);
        if(attachmentInputRef.current) attachmentInputRef.current.value = '';
    };

    const handleDeleteAttachment = async (attachmentId: string) => {
        if(!viewingApp || !confirm("Eliminare allegato?")) return;
        await deleteCandidateAttachment(viewingApp.candidateId, attachmentId);
        setViewingApp(prev => prev ? {
            ...prev,
            candidate: {
                ...prev.candidate,
                attachments: prev.candidate.attachments?.filter(a => a.id !== attachmentId)
            }
        } : null);
        refreshData();
    };

    return (
        <div className="flex h-full bg-gray-50">
            {/* Sidebar Jobs */}
            <div className="w-72 bg-white border-r border-gray-200 flex flex-col shrink-0">
                <div className="p-4 border-b border-gray-100">
                    <h2 className="text-xl font-bold text-gray-900 mb-4">Recruitment</h2>
                    <div className="relative mb-3">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16}/>
                        <input 
                            type="text" 
                            placeholder="Cerca posizione..." 
                            className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    {(currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.HR) && (
                        <button 
                            onClick={() => handleOpenJobModal()}
                            className="w-full bg-indigo-600 text-white py-2 rounded-lg text-sm font-bold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 shadow-sm"
                        >
                            <Plus size={16}/> Nuova Posizione
                        </button>
                    )}
                </div>
                <div className="flex-1 overflow-y-auto">
                    {filteredJobs.length === 0 ? (
                        <p className="text-center text-gray-400 text-sm py-8">Nessuna posizione.</p>
                    ) : (
                        filteredJobs.map(job => {
                            const count = data.applications.filter(a => a.jobId === job.id).length;
                            return (
                                <div 
                                    key={job.id}
                                    onClick={() => setSelectedJobId(job.id)}
                                    className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors ${selectedJobId === job.id ? 'bg-indigo-50 border-indigo-200' : ''}`}
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <h4 className="font-bold text-sm text-gray-900 truncate pr-2">{job.title}</h4>
                                        {job.status === 'OPEN' ? <span className="w-2 h-2 rounded-full bg-green-500 shrink-0 mt-1.5"/> : <span className="w-2 h-2 rounded-full bg-gray-400 shrink-0 mt-1.5"/>}
                                    </div>
                                    <p className="text-xs text-gray-500 mb-2 truncate">{job.department}</p>
                                    <div className="flex justify-between items-center text-xs text-gray-400">
                                        <span className="flex items-center gap-1"><Users size={12}/> {count} candidati</span>
                                        {(currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.HR) && (
                                            <div className="flex gap-1">
                                                <button onClick={(e) => { e.stopPropagation(); handleOpenJobModal(job); }} className="hover:text-indigo-600 p-1"><Edit2 size={12}/></button>
                                                <button onClick={(e) => { e.stopPropagation(); handleDeleteJob(job.id); }} className="hover:text-red-600 p-1"><Trash2 size={12}/></button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Kanban Board */}
            <div className="flex-1 flex flex-col h-full overflow-hidden">
                {selectedJob ? (
                    <>
                        <div className="p-6 border-b border-gray-200 bg-white flex justify-between items-center shrink-0">
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                                    {selectedJob.title}
                                    <span className={`text-xs px-2 py-1 rounded border ${selectedJob.status === 'OPEN' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-100 text-gray-600'}`}>{selectedJob.status}</span>
                                </h2>
                                <p className="text-sm text-gray-500 mt-1">{selectedJob.department} • {jobApplications.length} Applicazioni totali</p>
                            </div>
                            <div className="flex gap-2">
                                <label className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 cursor-pointer flex items-center gap-2 shadow-sm">
                                    <Plus size={16}/> Aggiungi Candidati
                                    <input 
                                        type="file" 
                                        multiple 
                                        accept=".pdf,image/*" 
                                        className="hidden" 
                                        onChange={(e) => {
                                            if (e.target.files?.length) {
                                                onUpload(Array.from(e.target.files), selectedJobId!);
                                                e.target.value = '';
                                            }
                                        }}
                                    />
                                </label>
                            </div>
                        </div>
                        
                        <div className="flex-1 overflow-x-auto overflow-y-hidden p-6 bg-gray-50">
                            <div className="flex h-full gap-4 min-w-max">
                                {columns.map(status => {
                                    const apps = jobApplications.filter(a => a.status === status);
                                    return (
                                        <div 
                                            key={status}
                                            onDragOver={handleDragOver}
                                            onDrop={(e) => handleDrop(e, status)}
                                            className="w-80 flex flex-col h-full bg-gray-100/50 rounded-xl border border-gray-200/60"
                                        >
                                            <div className={`p-3 border-b border-gray-200 rounded-t-xl font-bold text-xs uppercase flex justify-between items-center ${StatusColors[status].replace('text-', 'bg-').replace('border-', '')} bg-opacity-10`}>
                                                <span className={StatusColors[status].split(' ')[1]}>{StatusLabels[status]}</span>
                                                <span className="bg-white px-2 py-0.5 rounded-full text-gray-500 shadow-sm">{apps.length}</span>
                                            </div>
                                            <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
                                                {apps.map(app => (
                                                    <div 
                                                        key={app.id}
                                                        draggable
                                                        onDragStart={(e) => handleDragStart(e, app.id)}
                                                        onClick={() => setViewingApp(app)}
                                                        className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 cursor-pointer hover:shadow-md hover:border-indigo-200 transition-all group"
                                                    >
                                                        <div className="flex items-start gap-3 mb-3">
                                                            <div className="w-10 h-10 rounded-full bg-gray-100 border border-gray-200 overflow-hidden flex items-center justify-center shrink-0">
                                                                {app.candidate.photo ? <img src={`data:image/jpeg;base64,${app.candidate.photo}`} className="w-full h-full object-cover"/> : <span className="text-gray-600 font-bold">{app.candidate.fullName.charAt(0)}</span>}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <h4 className="font-bold text-gray-900 text-sm truncate">{app.candidate.fullName}</h4>
                                                                <p className="text-xs text-gray-500 truncate">{app.candidate.currentRole || 'Nessun ruolo'}</p>
                                                            </div>
                                                        </div>
                                                        
                                                        {app.aiScore && (
                                                            <div className="mb-2">
                                                                <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                                                                    <span>Match AI</span>
                                                                    <span className="font-bold text-indigo-600">{app.aiScore}%</span>
                                                                </div>
                                                                <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden">
                                                                    <div className={`h-full rounded-full ${app.aiScore > 75 ? 'bg-green-500' : app.aiScore > 50 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${app.aiScore}%` }}></div>
                                                                </div>
                                                            </div>
                                                        )}

                                                        <div className="flex items-center justify-between mt-2">
                                                            <div className="flex gap-1">
                                                                {app.candidate.skills.slice(0, 2).map((s, i) => (
                                                                    <span key={i} className="text-[10px] bg-gray-50 text-gray-600 px-1.5 py-0.5 rounded border border-gray-100 truncate max-w-[80px]">{s}</span>
                                                                ))}
                                                            </div>
                                                            {app.rating && <span className="flex items-center text-[10px] font-bold text-yellow-500"><Star size={10} fill="currentColor"/> {app.rating}</span>}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                        <Briefcase size={48} className="mb-4 opacity-20"/>
                        <p className="text-lg font-medium">Seleziona una posizione</p>
                    </div>
                )}
            </div>

            {/* CREATE/EDIT JOB MODAL */}
            {isJobModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[80] backdrop-blur-sm p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <h3 className="text-xl font-bold text-gray-900">{editingJob ? 'Modifica Posizione' : 'Nuova Posizione'}</h3>
                            <button onClick={() => setIsJobModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={24}/></button>
                        </div>
                        <form onSubmit={handleJobSubmit} className="p-6 space-y-5">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Titolo</label>
                                    <input required value={jobForm.title} onChange={e => setJobForm({...jobForm, title: e.target.value})} className="w-full p-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"/>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Dipartimento</label>
                                    <input required value={jobForm.department} onChange={e => setJobForm({...jobForm, department: e.target.value})} className="w-full p-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"/>
                                </div>
                            </div>
                            
                            <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100 flex items-center justify-between">
                                <div className="text-xs text-indigo-800">
                                    <strong className="block mb-1">AI Assistant</strong>
                                    Genera automaticamente descrizione e requisiti basati sul titolo.
                                </div>
                                <button type="button" onClick={handleGenerateJobAI} disabled={isGeneratingJob || !jobForm.title} className="bg-indigo-600 text-white px-3 py-1.5 rounded text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2">
                                    {isGeneratingJob ? <Loader2 size={12} className="animate-spin"/> : <Sparkles size={12}/>} Genera
                                </button>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Descrizione</label>
                                <textarea required rows={4} value={jobForm.description} onChange={e => setJobForm({...jobForm, description: e.target.value})} className="w-full p-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm"/>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Requisiti</label>
                                <textarea required rows={4} value={jobForm.requirements} onChange={e => setJobForm({...jobForm, requirements: e.target.value})} className="w-full p-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm"/>
                            </div>
                            
                            <div className="flex justify-end gap-3 pt-2">
                                <button type="button" onClick={() => setIsJobModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Annulla</button>
                                <button type="submit" className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 shadow-sm flex items-center gap-2"><Save size={16}/> Salva</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* APPLICATION QUICK VIEW */}
            {viewingApp && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-end z-[70] backdrop-blur-[2px]" onClick={() => setViewingApp(null)}>
                    <div className="bg-white h-full shadow-2xl flex flex-col animate-slide-left w-full max-w-2xl" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-gray-100 bg-gray-50 shrink-0">
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex items-center gap-4">
                                    <div className="w-16 h-16 rounded-full bg-white border border-gray-200 overflow-hidden shadow-sm flex items-center justify-center">
                                        {viewingApp.candidate.photo ? <img src={`data:image/jpeg;base64,${viewingApp.candidate.photo}`} className="w-full h-full object-cover"/> : <span className="text-2xl font-bold text-gray-600">{viewingApp.candidate.fullName.charAt(0)}</span>}
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-bold text-gray-900">{viewingApp.candidate.fullName}</h2>
                                        <div className="flex gap-2 mt-1">
                                            {viewingApp.candidate.email && <span className="text-xs text-gray-500 flex items-center gap-1"><Mail size={12}/> {viewingApp.candidate.email}</span>}
                                            {viewingApp.candidate.phone && <span className="text-xs text-gray-500 flex items-center gap-1"><Phone size={12}/> {viewingApp.candidate.phone}</span>}
                                        </div>
                                    </div>
                                </div>
                                <button onClick={() => setViewingApp(null)} className="text-gray-400 hover:text-gray-600"><X size={24}/></button>
                            </div>
                            
                            {/* Tabs */}
                            <div className="flex gap-6 text-sm font-medium border-t border-gray-200 pt-4 mt-4">
                                {[{id:'info', label:'Info'}, {id:'comments', label:`Note (${viewingApp.candidate.comments?.length || 0})`}, {id:'attachments', label:`Allegati (${viewingApp.candidate.attachments?.length || 0})`}].map(tab => (
                                    <button 
                                        key={tab.id}
                                        onClick={() => setQuickViewTab(tab.id as any)}
                                        className={`pb-2 border-b-2 transition-colors ${quickViewTab === tab.id ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 bg-white custom-scrollbar">
                            {quickViewTab === 'info' && (
                                <div className="space-y-6">
                                    {/* AI Insight */}
                                    {viewingApp.aiScore && (
                                        <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                                            <div className="flex items-center gap-2 mb-2">
                                                <Sparkles size={16} className="text-indigo-600"/>
                                                <h4 className="font-bold text-indigo-900">Analisi AI</h4>
                                                <span className="bg-white px-2 py-0.5 rounded text-xs font-bold text-indigo-700 border border-indigo-200 shadow-sm">{viewingApp.aiScore}% Match</span>
                                            </div>
                                            <p className="text-sm text-indigo-800 leading-relaxed italic">"{viewingApp.aiReasoning}"</p>
                                        </div>
                                    )}

                                    <div>
                                        <h4 className="text-xs font-bold text-gray-400 uppercase mb-3">Skills</h4>
                                        <div className="flex flex-wrap gap-2">
                                            {viewingApp.candidate.skills.map((s, i) => (
                                                <span key={i} className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium border border-gray-200">{s}</span>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <h4 className="text-xs font-bold text-gray-400 uppercase mb-3">Summary</h4>
                                        <p className="text-sm text-gray-700 leading-relaxed bg-gray-50 p-4 rounded-xl border border-gray-100 whitespace-pre-wrap">{viewingApp.candidate.summary}</p>
                                    </div>
                                </div>
                            )}

                            {quickViewTab === 'comments' && (
                                <div className="flex flex-col h-full">
                                    <div className="flex-1 space-y-4 mb-6">
                                        {!viewingApp.candidate.comments || viewingApp.candidate.comments.length === 0 ? (
                                            <p className="text-center text-gray-400 py-10 italic">Nessun commento.</p>
                                        ) : (
                                            viewingApp.candidate.comments.map(c => (
                                                <div key={c.id} className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                                                    <div className="flex justify-between items-center mb-1">
                                                        <span className="font-bold text-xs text-gray-900">{c.authorName}</span>
                                                        <span className="text-[10px] text-gray-400">{new Date(c.createdAt).toLocaleDateString()}</span>
                                                    </div>
                                                    <p className="text-sm text-gray-800">{c.text}</p>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                    <div className="relative border-t border-gray-100 pt-4 mt-auto">
                                        <textarea 
                                            ref={commentInputRef}
                                            value={newComment} 
                                            onChange={e => setNewComment(e.target.value)}
                                            placeholder="Scrivi una nota..." 
                                            className="w-full bg-white border border-gray-200 rounded-xl p-3 pr-12 text-sm outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                                            rows={3}
                                        />
                                        <button onClick={handleAddComment} disabled={!newComment.trim()} className="absolute right-3 bottom-3 p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                                            <Send size={16}/>
                                        </button>
                                    </div>
                                </div>
                            )}

                            {quickViewTab === 'attachments' && (
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center mb-2">
                                        <h4 className="text-xs font-bold text-gray-400 uppercase">File Allegati</h4>
                                        <input type="file" multiple ref={attachmentInputRef} className="hidden" onChange={handleAttachmentUpload}/>
                                        <button onClick={() => attachmentInputRef.current?.click()} className="text-xs bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg border border-indigo-200 hover:bg-indigo-100 font-bold flex items-center gap-1">
                                            <Paperclip size={12}/> Carica
                                        </button>
                                    </div>
                                    {!viewingApp.candidate.attachments || viewingApp.candidate.attachments.length === 0 ? (
                                        <p className="text-center text-gray-400 text-sm py-8 italic border-2 border-dashed border-gray-100 rounded-xl">Nessun file extra allegato.</p>
                                    ) : (
                                        <div className="grid grid-cols-2 gap-3">
                                            {viewingApp.candidate.attachments.map(file => (
                                                <div key={file.id} className="border border-gray-200 rounded-lg p-3 hover:shadow-sm bg-gray-50">
                                                    <div className="flex items-start justify-between mb-2">
                                                        <div className="p-2 bg-white rounded shadow-sm">
                                                            {getFileIcon(file.type)}
                                                        </div>
                                                        <div className="flex gap-1">
                                                            <a href={file.url || `data:${file.type};base64,${file.dataBase64}`} download={file.name} target="_blank" className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded"><Download size={16}/></a>
                                                            {(currentUser?.role === UserRole.ADMIN || file.uploadedBy === currentUser?.name) && (
                                                                <button 
                                                                    onClick={() => handleDeleteAttachment(file.id)}
                                                                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                                                                >
                                                                    <Trash2 size={16}/>
                                                                </button>
                                                            )}
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
        </div>
    );
};