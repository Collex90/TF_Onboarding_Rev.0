import React, { useState, useMemo } from 'react';
import { AppState, JobPosition, Application, SelectionStatus, StatusLabels, StatusColors, User, UserRole, Candidate } from '../types';
import { Plus, Search, Users, ChevronRight, MoreHorizontal, Briefcase, Sparkles, Loader2, X, ChevronUp, ChevronDown, ArrowLeft, Pencil } from 'lucide-react';
import { addJob, updateJob, updateApplicationStatus, generateId } from '../services/storage';
import { generateJobDetails, generateScorecardSchema } from '../services/ai';

interface RecruitmentViewProps {
    data: AppState;
    refreshData: () => void;
    currentUser: User | null;
    onUpload: (files: File[], jobId?: string) => void;
}

export const RecruitmentView: React.FC<RecruitmentViewProps> = ({ data, refreshData, currentUser, onUpload }) => {
    // State
    const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
    const [isJobModalOpen, setIsJobModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);
    
    // Form State
    const [jobForm, setJobForm] = useState<Partial<JobPosition>>({
        title: '', department: '', description: '', requirements: '', status: 'OPEN'
    });
    const [isGenerating, setIsGenerating] = useState(false);
    const [editingJobId, setEditingJobId] = useState<string | null>(null);

    // Derived Data
    const filteredJobs = useMemo(() => {
        let jobs = data.jobs;
        if (currentUser && currentUser.role === UserRole.TEAM) {
            jobs = jobs.filter(j => j.assignedTeamMembers?.includes(currentUser.uid || ''));
        }
        
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            jobs = jobs.filter(j => j.title.toLowerCase().includes(term) || j.department.toLowerCase().includes(term));
        }

        if (sortConfig) {
            jobs = [...jobs].sort((a: any, b: any) => {
                if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
                if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        
        return jobs;
    }, [data.jobs, searchTerm, sortConfig, currentUser]);

    const selectedJob = data.jobs.find(j => j.id === selectedJobId);
    
    const applicationsForJob = useMemo(() => {
        if (!selectedJobId) return [];
        return data.applications.filter(a => a.jobId === selectedJobId);
    }, [data.applications, selectedJobId]);

    // Handlers
    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const handleOpenJobModal = (job?: JobPosition) => {
        if (job) {
            setEditingJobId(job.id);
            setJobForm({ ...job });
        } else {
            setEditingJobId(null);
            setJobForm({ title: '', department: '', description: '', requirements: '', status: 'OPEN' });
        }
        setIsJobModalOpen(true);
    };

    const handleGenerateAI = async () => {
        if (!jobForm.title) return alert("Inserisci almeno un titolo.");
        setIsGenerating(true);
        try {
            const details = await generateJobDetails(jobForm.title, jobForm.department || '');
            const scorecard = await generateScorecardSchema(jobForm.title, details.description);
            
            setJobForm(prev => ({
                ...prev,
                description: details.description,
                requirements: details.requirements,
                scorecardSchema: scorecard
            }));
        } catch (e) {
            console.error(e);
            alert("Errore AI");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSaveJob = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!jobForm.title || !jobForm.description) return;

        const jobData = {
            ...jobForm,
            assignedTeamMembers: currentUser?.uid ? [currentUser.uid] : [], // Simplification
        } as JobPosition;

        if (editingJobId) {
            const existing = data.jobs.find(j => j.id === editingJobId);
            await updateJob({ ...existing, ...jobData } as JobPosition);
        } else {
            await addJob({
                id: generateId(),
                ...jobData,
                createdAt: Date.now()
            } as JobPosition);
        }
        setIsJobModalOpen(false);
        refreshData();
    };

    const handleDragStart = (e: React.DragEvent, appId: string) => {
        e.dataTransfer.setData('applicationId', appId);
    };

    const handleDrop = async (e: React.DragEvent, status: SelectionStatus) => {
        e.preventDefault();
        const appId = e.dataTransfer.getData('applicationId');
        if (appId) {
            await updateApplicationStatus(appId, status);
            refreshData();
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    // Components
    const SortHeader = ({ label, sortKey }: { label: string, sortKey: string }) => (
        <th className="p-4 font-semibold cursor-pointer hover:bg-gray-100 transition-colors group select-none text-left" onClick={() => handleSort(sortKey)}>
            <div className="flex items-center gap-1">
                {label}
                <div className="flex flex-col">
                    <ChevronUp size={10} className={sortConfig?.key === sortKey && sortConfig.direction === 'asc' ? 'text-indigo-600' : 'text-gray-300'} />
                    <ChevronDown size={10} className={sortConfig?.key === sortKey && sortConfig.direction === 'desc' ? 'text-indigo-600' : 'text-gray-300'} />
                </div>
            </div>
        </th>
    );

    const KanbanColumn = ({ status, title }: { status: SelectionStatus, title: string }) => {
        const apps = applicationsForJob.filter(a => a.status === status);
        
        return (
            <div 
                className="flex-1 min-w-[280px] bg-gray-50 rounded-xl flex flex-col max-h-full border border-gray-200"
                onDrop={(e) => handleDrop(e, status)}
                onDragOver={handleDragOver}
            >
                <div className={`p-3 border-b border-gray-200 font-bold text-sm flex justify-between items-center rounded-t-xl ${StatusColors[status]} bg-opacity-20`}>
                    <span className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${StatusColors[status].replace('bg-', 'bg-text-').split(' ')[0].replace('text-', 'bg-')}`}></span>
                        {title}
                    </span>
                    <span className="bg-white px-2 py-0.5 rounded-full text-xs border border-gray-200 text-gray-500">{apps.length}</span>
                </div>
                <div className="p-3 space-y-3 flex-1 overflow-y-auto custom-scrollbar">
                    {apps.map(app => {
                        const candidate = data.candidates.find(c => c.id === app.candidateId);
                        if (!candidate) return null;
                        return (
                            <div 
                                key={app.id} 
                                draggable 
                                onDragStart={(e) => handleDragStart(e, app.id)}
                                className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm hover:shadow-md cursor-grab active:cursor-grabbing transition-all group"
                            >
                                <div className="flex items-start gap-3 mb-2">
                                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold border border-gray-200 overflow-hidden shrink-0">
                                        {candidate.photo ? <img src={`data:image/jpeg;base64,${candidate.photo}`} className="w-full h-full object-cover"/> : candidate.fullName.charAt(0)}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="font-bold text-sm text-gray-900 truncate">{candidate.fullName}</p>
                                        <p className="text-xs text-gray-500 truncate">{candidate.currentRole || 'N/A'}</p>
                                    </div>
                                </div>
                                {app.aiScore && (
                                    <div className="flex items-center gap-1 mb-2">
                                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                            <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${app.aiScore}%` }}></div>
                                        </div>
                                        <span className="text-[10px] font-bold text-indigo-600">{app.aiScore}% Fit</span>
                                    </div>
                                )}
                                <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-50">
                                    <span className="text-[10px] text-gray-400">{new Date(app.updatedAt).toLocaleDateString()}</span>
                                    <button className="text-gray-300 hover:text-indigo-600"><MoreHorizontal size={14}/></button>
                                </div>
                            </div>
                        );
                    })}
                    {apps.length === 0 && (
                        <div className="text-center py-8 text-gray-400 border-2 border-dashed border-gray-200 rounded-lg text-xs">
                            Trascina qui
                        </div>
                    )}
                </div>
            </div>
        );
    };

    // Render Content
    if (selectedJob) {
        return (
            <div className="h-full flex flex-col bg-white">
                <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setSelectedJobId(null)} className="p-2 hover:bg-gray-200 rounded-lg text-gray-600 transition-colors">
                            <ArrowLeft size={20}/>
                        </button>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                                {selectedJob.title}
                                <span className={`text-xs px-2 py-0.5 rounded border ${selectedJob.status === 'OPEN' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                                    {selectedJob.status}
                                </span>
                            </h2>
                            <p className="text-sm text-gray-500">{selectedJob.department} • {applicationsForJob.length} Candidature</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => { 
                            const input = document.createElement('input'); 
                            input.type = 'file'; 
                            input.multiple = true; 
                            input.accept = '.pdf,image/*';
                            input.onchange = (e: any) => { if(e.target.files?.length) onUpload(Array.from(e.target.files), selectedJobId); };
                            input.click();
                        }} className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 text-gray-700">
                            <Plus size={16}/> Aggiungi Candidati
                        </button>
                        <button onClick={() => handleOpenJobModal(selectedJob)} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg border border-gray-200">
                            <Pencil size={20}/>
                        </button>
                    </div>
                </div>
                
                <div className="flex-1 overflow-x-auto overflow-y-hidden p-6 bg-white">
                   <div className="flex gap-4 h-full min-w-max">
                        {Object.values(SelectionStatus).map(status => (
                            <KanbanColumn key={status} status={status} title={StatusLabels[status]} />
                        ))}
                   </div>
                </div>
                
                {/* Re-use Modal for Editing */}
                {isJobModalOpen && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] backdrop-blur-sm p-4">
                        <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl m-4 flex flex-col max-h-[90vh]">
                             <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                                <h3 className="text-xl font-bold text-gray-900">Modifica Posizione</h3>
                                <button onClick={() => setIsJobModalOpen(false)}><X size={24} className="text-gray-400 hover:text-gray-600"/></button>
                            </div>
                             <form onSubmit={handleSaveJob} className="p-6 space-y-4 flex-1 overflow-y-auto">
                                <input value={jobForm.title} onChange={e=>setJobForm({...jobForm, title: e.target.value})} className="w-full border border-gray-300 p-2 rounded-lg" placeholder="Titolo"/>
                                <input value={jobForm.department} onChange={e=>setJobForm({...jobForm, department: e.target.value})} className="w-full border border-gray-300 p-2 rounded-lg" placeholder="Dipartimento"/>
                                <textarea value={jobForm.description} onChange={e=>setJobForm({...jobForm, description: e.target.value})} className="w-full border border-gray-300 p-2 rounded-lg h-32" placeholder="Descrizione"/>
                                <textarea value={jobForm.requirements} onChange={e=>setJobForm({...jobForm, requirements: e.target.value})} className="w-full border border-gray-300 p-2 rounded-lg h-32" placeholder="Requisiti"/>
                                <div className="flex justify-end gap-2 pt-2">
                                    <button type="button" onClick={() => setIsJobModalOpen(false)} className="px-4 py-2 border rounded-lg hover:bg-gray-50">Annulla</button>
                                    <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Salva</button>
                                </div>
                             </form>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="p-8 h-full overflow-y-auto">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Posizioni Aperte</h2>
                    <p className="text-gray-500">Gestisci le offerte di lavoro e il processo di selezione.</p>
                </div>
                <button onClick={() => handleOpenJobModal()} className="bg-indigo-600 text-white px-4 py-2.5 rounded-lg font-bold flex items-center gap-2 hover:bg-indigo-700 transition-colors shadow-sm">
                    <Plus size={20}/> Nuova Posizione
                </button>
            </div>

            <div className="flex gap-4 mb-6">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                    <input 
                        type="text" 
                        placeholder="Cerca posizioni..." 
                        className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredJobs.map(job => {
                    const appCount = data.applications.filter(a => a.jobId === job.id).length;
                    return (
                        <div key={job.id} onClick={() => setSelectedJobId(job.id)} className="bg-white rounded-xl border border-gray-200 p-6 cursor-pointer hover:shadow-lg hover:border-indigo-200 transition-all group">
                            <div className="flex justify-between items-start mb-4">
                                <div className="w-12 h-12 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                                    <Briefcase size={24}/>
                                </div>
                                <span className={`text-[10px] px-2 py-1 rounded font-bold border ${job.status === 'OPEN' ? 'bg-green-50 text-green-700 border-green-100' : 'bg-gray-100 text-gray-600'}`}>{job.status}</span>
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 mb-1 group-hover:text-indigo-600 transition-colors">{job.title}</h3>
                            <p className="text-sm text-gray-500 mb-4">{job.department}</p>
                            
                            <div className="flex items-center justify-between text-sm text-gray-500 pt-4 border-t border-gray-100">
                                <span className="flex items-center gap-2"><Users size={16}/> {appCount} Candidati</span>
                                <span className="flex items-center gap-1 text-xs">Vedi pipeline <ChevronRight size={14}/></span>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* ADD/EDIT JOB MODAL */}
            {isJobModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] backdrop-blur-sm p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="text-xl font-bold text-gray-900">{editingJobId ? 'Modifica Posizione' : 'Nuova Posizione'}</h3>
                            <button onClick={() => setIsJobModalOpen(false)}><X size={24} className="text-gray-400 hover:text-gray-600"/></button>
                        </div>
                        <form onSubmit={handleSaveJob} className="flex-1 overflow-y-auto p-6 space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-sm font-bold text-gray-700 mb-1">Titolo Posizione</label><input required value={jobForm.title} onChange={e => setJobForm({...jobForm, title: e.target.value})} className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" placeholder="es. Senior Developer"/></div>
                                <div><label className="block text-sm font-bold text-gray-700 mb-1">Dipartimento</label><input required value={jobForm.department} onChange={e => setJobForm({...jobForm, department: e.target.value})} className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" placeholder="es. Engineering"/></div>
                            </div>
                            
                            {!editingJobId && (
                                <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100 flex justify-between items-center">
                                    <div>
                                        <h4 className="text-sm font-bold text-indigo-900 flex items-center gap-2"><Sparkles size={14}/> Assistente AI</h4>
                                        <p className="text-xs text-indigo-700">Genera descrizione e requisiti dal titolo.</p>
                                    </div>
                                    <button type="button" onClick={handleGenerateAI} disabled={isGenerating || !jobForm.title} className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2">
                                        {isGenerating ? <Loader2 size={12} className="animate-spin"/> : <Sparkles size={12}/>} Genera
                                    </button>
                                </div>
                            )}

                            <div><label className="block text-sm font-bold text-gray-700 mb-1">Descrizione</label><textarea required value={jobForm.description} onChange={e => setJobForm({...jobForm, description: e.target.value})} className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 h-24" placeholder="Responsabilità..."/></div>
                            <div><label className="block text-sm font-bold text-gray-700 mb-1">Requisiti</label><textarea required value={jobForm.requirements} onChange={e => setJobForm({...jobForm, requirements: e.target.value})} className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 h-24" placeholder="- Skill 1..."/></div>
                            
                            <div><label className="block text-sm font-bold text-gray-700 mb-1">Stato</label><select value={jobForm.status} onChange={e => setJobForm({...jobForm, status: e.target.value as any})} className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"><option value="OPEN">APERTA</option><option value="CLOSED">CHIUSA</option><option value="SUSPENDED">SOSPESA</option></select></div>
                        </form>
                        <div className="p-4 border-t border-gray-100 flex justify-end gap-3">
                            <button onClick={() => setIsJobModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium">Annulla</button>
                            <button onClick={handleSaveJob} className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 shadow-sm">Salva</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};