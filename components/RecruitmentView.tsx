
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { AppState, JobPosition, SelectionStatus, StatusLabels, StatusColors, Candidate, Application, User, Comment, UserRole, EmailTemplate, ScorecardSchema, ScorecardCategory, ScorecardTemplate, Attachment } from '../types';
import { Plus, ChevronRight, Sparkles, BrainCircuit, Search, GripVertical, UploadCloud, X, Loader2, CheckCircle, AlertTriangle, FileText, Star, Flag, Calendar, Download, Phone, Briefcase, MessageSquare, Clock, Send, Building, Banknote, Maximize2, Minimize2, Eye, ZoomIn, ZoomOut, Mail, LayoutGrid, Kanban, UserPlus, ArrowRight, CheckSquare, Square, ChevronUp, ChevronDown, Edit, Shield, Users, Trash2, Copy, BarChart2, ListChecks, Ruler, Circle, Save, Filter, Settings, Paperclip, Upload, Table, Image, ExternalLink, Info, RefreshCw, PieChart, TrendingUp, Check, ArrowLeft, ChevronDown as ChevronDownIcon } from 'lucide-react';
import { addJob, createApplication, updateApplicationStatus, updateApplicationAiScore, generateId, addCandidate, updateApplicationMetadata, addCandidateComment, updateCandidate, updateJob, getAllUsers, getEmailTemplates, updateApplicationScorecard, saveScorecardTemplate, getScorecardTemplates, deleteScorecardTemplate, updateScorecardTemplate, addCandidateAttachment, deleteCandidateAttachment, deleteJob } from '../services/storage';
import { evaluateFit, generateJobDetails, generateScorecardSchema } from '../services/ai';

interface RecruitmentViewProps {
    data: AppState;
    refreshData: () => void;
    currentUser: User | null;
    onUpload: (files: File[], jobId?: string) => void;
}

const getFileIcon = (mimeType: string) => {
    if (mimeType.includes('pdf')) return <FileText size={16} className="text-red-500"/>;
    if (mimeType.includes('sheet') || mimeType.includes('excel')) return <Table size={16} className="text-emerald-600"/>;
    if (mimeType.includes('image')) return <Image size={16} className="text-purple-500"/>;
    return <FileText size={16} className="text-stone-500"/>;
};

const JOB_STATUS_CONFIG: Record<string, { label: string, color: string, dot: string }> = {
    'OPEN': { label: 'APERTA', color: 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100', dot: 'bg-green-500' },
    'SUSPENDED': { label: 'SOSPESA', color: 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100', dot: 'bg-orange-500' },
    'COMPLETED': { label: 'COMPLETATA', color: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100', dot: 'bg-blue-500' },
    'CLOSED': { label: 'CHIUSA', color: 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100', dot: 'bg-stone-500' }
};

// Helper per calcolare il punteggio basandosi SOLO sullo schema attuale (ignorando item cancellati)
const calculateSafeScore = (app: Application, schema?: ScorecardSchema): number => {
    if (!schema || !app.scorecardResults) return 0;
    return schema.categories.reduce((acc, cat) => {
        return acc + cat.items.reduce((iAcc, item) => {
            return iAcc + (app.scorecardResults?.[item.id] || 0);
        }, 0);
    }, 0);
};

export const RecruitmentView: React.FC<RecruitmentViewProps> = ({ data, refreshData, currentUser, onUpload }) => {
    const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
    const [isJobModalOpen, setIsJobModalOpen] = useState(false);
    const [viewingJobInfoId, setViewingJobInfoId] = useState<string | null>(null);
    const [editingJobId, setEditingJobId] = useState<string | null>(null);
    const [evaluatingId, setEvaluatingId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [viewMode, setViewMode] = useState<'kanban' | 'grid'>('kanban');
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);
    const [isAssociateModalOpen, setIsAssociateModalOpen] = useState(false);
    const [associateSearch, setAssociateSearch] = useState('');
    const [selectedAssociateIds, setSelectedAssociateIds] = useState<Set<string>>(new Set());
    const [isAssociating, setIsAssociating] = useState(false);
    const [draggedAppId, setDraggedAppId] = useState<string | null>(null);
    const [pendingRejection, setPendingRejection] = useState<{ appId: string, status: SelectionStatus } | null>(null);
    const [rejectionReason, setRejectionReason] = useState('Soft Skill');
    const [rejectionNotes, setRejectionNotes] = useState('');
    const [viewingApp, setViewingApp] = useState<{ app: Application, candidate: Candidate } | null>(null);
    const [quickViewTab, setQuickViewTab] = useState<'info' | 'processes' | 'comments' | 'scorecard' | 'attachments'>('info');
    const [newComment, setNewComment] = useState('');
    const [isPhotoZoomed, setIsPhotoZoomed] = useState(false);

    const [jobToDeleteId, setJobToDeleteId] = useState<string | null>(null);
    const [isDeletingJob, setIsDeletingJob] = useState(false);
    
    const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
    const [emailTemplates] = useState<EmailTemplate[]>(getEmailTemplates());
    const [selectedTemplateId, setSelectedTemplateId] = useState<string>(emailTemplates[0]?.id || '');
    const [emailSubject, setEmailSubject] = useState('');
    const [emailBody, setEmailBody] = useState('');
    
    const [jobForm, setJobForm] = useState<{ title: string, department: string, description: string, requirements: string, status: any, scorecardSchema?: ScorecardSchema }>({ title: '', department: '', description: '', requirements: '', status: 'OPEN', scorecardSchema: undefined });
    const [isGeneratingJob, setIsGeneratingJob] = useState(false);
    const [isGeneratingScorecard, setIsGeneratingScorecard] = useState(false);
    const [availableUsers, setAvailableUsers] = useState<User[]>([]);
    const [assignedTeamMembers, setAssignedTeamMembers] = useState<string[]>([]);
    
    const [processingJobs, setProcessingJobs] = useState<Set<string>>(new Set());
    const [isRecalculating, setIsRecalculating] = useState(false);

    // --- WIZARD STATE ---
    const [creationStep, setCreationStep] = useState(1); // 1: Info, 2: Scorecard, 3: Candidates
    const [magicPrompt, setMagicPrompt] = useState('');
    const [wizardSelectedCandidateIds, setWizardSelectedCandidateIds] = useState<Set<string>>(new Set());
    const [wizardFiles, setWizardFiles] = useState<File[]>([]);
    const wizardFileInputRef = useRef<HTMLInputElement>(null);

    const [isSaveTemplateModalOpen, setIsSaveTemplateModalOpen] = useState(false);
    const [isLoadTemplateModalOpen, setIsLoadTemplateModalOpen] = useState(false);
    const [templateName, setTemplateName] = useState('');
    const [templates, setTemplates] = useState<ScorecardTemplate[]>([]);
    
    const [isTemplateManagerOpen, setIsTemplateManagerOpen] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<ScorecardTemplate | null>(null);
    const [isTemplateEditorOpen, setIsTemplateEditorOpen] = useState(false);

    const [isComparisonModalOpen, setIsComparisonModalOpen] = useState(false);
    const [matrixSelectedCandidateIds, setMatrixSelectedCandidateIds] = useState<Set<string>>(new Set());
    const [isMatrixCandidateFilterOpen, setIsMatrixCandidateFilterOpen] = useState(false);
    const [matrixStatusFilter, setMatrixStatusFilter] = useState<SelectionStatus[]>([]);

    const [dragOverColumn, setDragOverColumn] = useState<SelectionStatus | null>(null);

    const [isJobStatusDropdownOpen, setIsJobStatusDropdownOpen] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const attachmentInputRef = useRef<HTMLInputElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const isMounted = useRef(true);

    const jobInfoTarget = useMemo(() => {
        if (!viewingJobInfoId) return null;
        return data.jobs.find(j => j.id === viewingJobInfoId);
    }, [viewingJobInfoId, data.jobs]);

    useEffect(() => {
        isMounted.current = true;
        if (!selectedJobId && !isJobModalOpen) {
            searchInputRef.current?.focus();
        }
        return () => { isMounted.current = false; };
    }, [selectedJobId, isJobModalOpen]);

    useEffect(() => {
        if (!viewingApp) { setIsPhotoZoomed(false); }
    }, [viewingApp]);

    useEffect(() => {
        if (isAssociateModalOpen) { setSelectedAssociateIds(new Set()); setAssociateSearch(''); }
    }, [isAssociateModalOpen]);

    useEffect(() => {
        if (isJobModalOpen && (currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.HR)) {
            getAllUsers().then(setAvailableUsers);
        }
    }, [isJobModalOpen, currentUser]);

    useEffect(() => {
        if (isTemplateManagerOpen || isLoadTemplateModalOpen) {
            getScorecardTemplates().then(setTemplates);
        }
    }, [isTemplateManagerOpen, isLoadTemplateModalOpen]);

    const openCreateJobModal = () => {
        setEditingJobId(null);
        setJobForm({ title: '', department: '', description: '', requirements: '', status: 'OPEN', scorecardSchema: undefined });
        setAssignedTeamMembers([]);
        setCreationStep(1); // Reset step
        setMagicPrompt('');
        setWizardSelectedCandidateIds(new Set());
        setWizardFiles([]);
        setIsJobModalOpen(true);
    };

    const openEditJobModal = (job: JobPosition) => {
        setEditingJobId(job.id);
        setJobForm({ 
            title: job.title, 
            department: job.department, 
            description: job.description, 
            requirements: job.requirements,
            status: job.status,
            scorecardSchema: job.scorecardSchema
        });
        setAssignedTeamMembers(job.assignedTeamMembers || []);
        setCreationStep(1);
        setIsJobModalOpen(true);
    };

    const handleMagicFill = async () => {
        if (!magicPrompt.trim()) return;
        setIsGeneratingJob(true);
        try {
            // Heuristics: Treat prompt as title or title + dept
            // We use the prompt as "Title" initially to contextually guide the AI
            let title: string = magicPrompt;
            let dept: string = "Generale";
            
            // Simple split heuristic if user uses format "Role per Dept"
            if (magicPrompt.toLowerCase().includes(' per ')) {
                const parts = magicPrompt.split(/ per /i);
                if (parts.length >= 2) {
                    title = parts[0].trim();
                    dept = parts[1].trim();
                }
            }

            setJobForm(prev => ({ ...prev, title, department: dept }));
            
            // Call AI
            const details = await generateJobDetails(title, dept, data.companyInfo) as { description: string, requirements: string };
            setJobForm(prev => ({ 
                ...prev, 
                title, 
                department: dept,
                description: details.description, 
                requirements: details.requirements 
            }));
        } catch (e: any) {
            alert("Errore generazione AI. Riprova.");
        } finally {
            setIsGeneratingJob(false);
        }
    };

    const handleSaveJob = async () => {
        // e.preventDefault(); // Called from button, not form submit
        const commonData = { ...jobForm, assignedTeamMembers: assignedTeamMembers };
        
        try {
            let targetJobId: string | null = editingJobId;

            if (editingJobId) {
                const oldJob = data.jobs.find(j => j.id === editingJobId);
                const updatedJob: JobPosition = { ...oldJob!, ...commonData };
                
                await updateJob(updatedJob);
                if (oldJob && (oldJob.description !== jobForm.description || oldJob.title !== jobForm.title)) {
                    runBackgroundFitUpdate(editingJobId, updatedJob);
                }
            } else {
                targetJobId = generateId();
                const newJob: JobPosition = { id: targetJobId, ...commonData, createdAt: Date.now() };
                await addJob(newJob);
            }

            // --- STEP 3: HANDLE CANDIDATES (ONLY FOR NEW OR EDIT) ---
            if (targetJobId) {
                const finalJobId = targetJobId as string; // Capture explicitly for closures

                // 1. Upload Files
                if (wizardFiles.length > 0) {
                    onUpload(wizardFiles, finalJobId);
                }

                // 2. Associate Existing Candidates
                if (wizardSelectedCandidateIds.size > 0) {
                    const promises = Array.from(wizardSelectedCandidateIds).map(async (candidateId) => {
                        const candidate = data.candidates.find(c => c.id === candidateId);
                        // Only add if not already applied
                        const exists = data.applications.some(a => a.candidateId === candidateId && a.jobId === finalJobId);
                        if (!exists) {
                            let aiScore: number | undefined;
                            let aiReasoning: string | undefined;
                            if (candidate) {
                                try {
                                    const job = editingJobId ? data.jobs.find(j => j.id === editingJobId) : { ...commonData, id: finalJobId } as JobPosition;
                                    const fit = await evaluateFit(candidate, job!, data.companyInfo);
                                    aiScore = fit.score;
                                    aiReasoning = fit.reasoning;
                                } catch(e){}
                            }
                            const app: Application = {
                                id: generateId(),
                                candidateId,
                                jobId: finalJobId,
                                status: SelectionStatus.TO_ANALYZE,
                                aiScore,
                                aiReasoning,
                                updatedAt: Date.now()
                            };
                            return createApplication(app);
                        }
                    });
                    await Promise.all(promises);
                }
            }

            setIsJobModalOpen(false); 
            refreshData();
        } catch (err: any) {
            console.error("Error saving job:", err);
            alert("Errore durante il salvataggio.");
        }
    };

    const promptDeleteJob = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        e.preventDefault();
        setJobToDeleteId(id);
    };

    const confirmDeleteJob = async () => {
        if (!jobToDeleteId) return;
        setIsDeletingJob(true);
        try {
            await deleteJob(jobToDeleteId);
            if (selectedJobId === jobToDeleteId) setSelectedJobId(null);
            refreshData();
            setJobToDeleteId(null);
        } catch (e) {
            console.error(e);
            alert("Errore durante l'eliminazione");
        } finally {
            setIsDeletingJob(false);
        }
    };

    const handleAddCategory = () => { setJobForm(prev => ({ ...prev, scorecardSchema: { categories: [ ...(prev.scorecardSchema?.categories || []), { id: generateId(), name: 'Nuova Categoria', items: [] } ] } })); };
    const handleDeleteCategory = (catId: string) => { setJobForm(prev => ({ ...prev, scorecardSchema: { categories: (prev.scorecardSchema?.categories || []).filter(c => c.id !== catId) } })); };
    const handleUpdateCategoryName = (catId: string, newName: string) => { setJobForm(prev => ({ ...prev, scorecardSchema: { categories: (prev.scorecardSchema?.categories || []).map(c => c.id === catId ? { ...c, name: newName } : c) } })); };
    const handleAddItem = (catId: string) => { setJobForm(prev => ({ ...prev, scorecardSchema: { categories: (prev.scorecardSchema?.categories || []).map(c => c.id === catId ? { ...c, items: [...c.items, { id: generateId(), label: 'Nuova Voce' }] } : c) } })); };
    const handleDeleteItem = (catId: string, itemId: string) => { setJobForm(prev => ({ ...prev, scorecardSchema: { categories: (prev.scorecardSchema?.categories || []).map(c => c.id === catId ? { ...c, items: c.items.filter(i => i.id !== itemId) } : c) } })); };
    const handleUpdateItemLabel = (catId: string, itemId: string, newLabel: string) => { setJobForm(prev => ({ ...prev, scorecardSchema: { categories: (prev.scorecardSchema?.categories || []).map(c => c.id === catId ? { ...c, items: c.items.map(i => i.id === itemId ? { ...i, label: newLabel } : i) } : c) } })); };

    const runBackgroundFitUpdate = async (jobId: string, updatedJob: JobPosition) => {
        setProcessingJobs(prev => new Set(prev).add(jobId));
        const jobApps = data.applications.filter(a => a.jobId === jobId);
        
        for (const app of jobApps) {
            if (!isMounted.current) break; 
            
            const candidate = data.candidates.find(c => c.id === app.candidateId);
            if (candidate) {
                try {
                    const fit = await evaluateFit(candidate, updatedJob, data.companyInfo);
                    await updateApplicationAiScore(app.id, fit.score, fit.reasoning);
                } catch (e) {
                    console.error(`[AI Background] Failed for app ${app.id}`, e);
                }
            }
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        if (isMounted.current) {
            setProcessingJobs(prev => {
                const next = new Set(prev);
                next.delete(jobId);
                return next;
            });
            refreshData(); 
        }
    };

    const handleGenerateJobAI = async () => { 
        if (!jobForm.title || !jobForm.department) { alert("Inserisci Titolo e Dipartimento."); return; } 
        setIsGeneratingJob(true); 
        try { 
            const details = await generateJobDetails(jobForm.title, jobForm.department, data.companyInfo); 
            setJobForm(prev => ({ ...prev, description: details.description, requirements: details.requirements })); 
        } catch (e: any) { alert("Errore AI: impossibile generare dettagli."); } finally { setIsGeneratingJob(false); } 
    };

    const handleGenerateScorecardAI = async () => { 
        if (!jobForm.title || !jobForm.description) { alert("Inserisci Titolo e Descrizione prima di generare la scheda."); return; } 
        setIsGeneratingScorecard(true); 
        try { 
            const schema = await generateScorecardSchema(jobForm.title, jobForm.description, data.companyInfo); 
            setJobForm(prev => ({ ...prev, scorecardSchema: schema })); 
        } catch(e: any) { alert("Errore AI Scorecard."); } finally { setIsGeneratingScorecard(false); } 
    };

    const handleOpenSaveTemplate = () => { if (!jobForm.scorecardSchema?.categories.length) { alert("La scheda è vuota. Aggiungi categorie prima di salvare."); return; } setTemplateName(''); setIsSaveTemplateModalOpen(true); };
    const handleConfirmSaveTemplate = async () => { if (!templateName.trim() || !jobForm.scorecardSchema) return; await saveScorecardTemplate(templateName, jobForm.scorecardSchema); setIsSaveTemplateModalOpen(false); };
    const handleOpenLoadTemplate = async () => { const tmpls = await getScorecardTemplates(); setTemplates(tmpls); setIsLoadTemplateModalOpen(true); };
    
    const handleLoadTemplate = (template: ScorecardTemplate) => { 
        setJobForm(prev => ({ ...prev, scorecardSchema: template.schema })); 
        setIsLoadTemplateModalOpen(false); 
    };
    
    const handleDeleteTemplate = async (id: string) => { if (confirm("Eliminare questo modello definitivamente?")) { await deleteScorecardTemplate(id); setTemplates(prev => prev.filter(t => t.id !== id)); } };

    const openNewTemplate = () => {
        setEditingTemplate({ id: generateId(), name: 'Nuovo Modello', schema: { categories: [] }, createdAt: Date.now() });
        setIsTemplateEditorOpen(true);
    };
    const openEditTemplate = (t: ScorecardTemplate) => { setEditingTemplate({ ...t }); setIsTemplateEditorOpen(true); };
    const saveEditedTemplate = async () => {
        if (!editingTemplate || !editingTemplate.name) return;
        if (templates.find(t => t.id === editingTemplate.id)) { await updateScorecardTemplate(editingTemplate); } else { await saveScorecardTemplate(editingTemplate.name, editingTemplate.schema); }
        getScorecardTemplates().then(setTemplates);
        setIsTemplateEditorOpen(false);
    };
    
    const handleTemplateAddCategory = () => { setEditingTemplate(prev => prev ? { ...prev, schema: { categories: [...prev.schema.categories, { id: generateId(), name: 'Nuova Categoria', items: [] }] } } : null); };
    const handleTemplateDeleteCategory = (id: string) => { setEditingTemplate(prev => prev ? { ...prev, schema: { categories: prev.schema.categories.filter(c => c.id !== id) } } : null); };
    const handleTemplateUpdateCategory = (id: string, name: string) => { setEditingTemplate(prev => prev ? { ...prev, schema: { categories: prev.schema.categories.map(c => c.id === id ? { ...c, name } : c) } } : null); };
    const handleTemplateAddItem = (catId: string) => { setEditingTemplate(prev => prev ? { ...prev, schema: { categories: prev.schema.categories.map(c => c.id === catId ? { ...c, items: [...c.items, { id: generateId(), label: 'Nuova Voce' }] } : c) } } : null); };
    const handleTemplateDeleteItem = (catId: string, itemId: string) => { setEditingTemplate(prev => prev ? { ...prev, schema: { categories: prev.schema.categories.map(c => c.id === catId ? { ...c, items: c.items.filter(i => i.id !== itemId) } : c) } } : null); };
    const handleTemplateUpdateItem = (catId: string, itemId: string, label: string) => { setEditingTemplate(prev => prev ? { ...prev, schema: { categories: prev.schema.categories.map(c => c.id === catId ? { ...c, items: c.items.map(i => i.id === itemId ? { ...i, label } : i) } : c) } } : null); };


    const handleBatchAddToPipeline = async () => { 
        if (!selectedJobId || selectedAssociateIds.size === 0) return; 
        const currentJobId = selectedJobId; // Capture specifically for closure
        setIsAssociating(true); 
        try { 
            const job = data.jobs.find(j => j.id === currentJobId); 
            if (!job) return; 
            const promises = Array.from(selectedAssociateIds).map(async (candidateId: string) => { 
                const candidate = data.candidates.find(c => c.id === candidateId); 
                let aiScore: number | undefined; 
                let aiReasoning: string | undefined; 
                if (candidate) { 
                    try { 
                        const fit = await evaluateFit(candidate, job, data.companyInfo); 
                        aiScore = fit.score; 
                        aiReasoning = fit.reasoning; 
                    } catch (e) { console.error(e); } 
                } 
                const app: Application = { id: generateId(), candidateId, jobId: currentJobId, status: SelectionStatus.TO_ANALYZE, aiScore, aiReasoning, updatedAt: Date.now() }; 
                return createApplication(app); 
            }); 
            await Promise.all(promises); 
            refreshData(); 
            setIsAssociateModalOpen(false); 
            setSelectedAssociateIds(new Set()); 
        } catch(e: any) { console.error(e); } finally { setIsAssociating(false); } 
    };
    
    const toggleCandidateSelection = (candidateId: string) => { const newSet = new Set(selectedAssociateIds); if (newSet.has(candidateId)) { newSet.delete(candidateId); } else { newSet.add(candidateId); } setSelectedAssociateIds(newSet); };
    
    const handleEvaluate = async (appId: string, candidateId: string) => { 
        if (!selectedJobId) return; 
        const job = data.jobs.find(j => j.id === selectedJobId); 
        const candidate = data.candidates.find(c => c.id === candidateId); 
        if (!job || !candidate) return; 
        setEvaluatingId(appId); 
        try { 
            const result = await evaluateFit(candidate, job, data.companyInfo); 
            updateApplicationAiScore(appId, result.score, result.reasoning); 
            if (viewingApp && viewingApp.app.id === appId) {
                setViewingApp(prev => prev ? { ...prev, app: { ...prev.app, aiScore: result.score, aiReasoning: result.reasoning } } : null);
            }
            refreshData(); 
        } catch (e: any) { alert("Errore valutazione AI: " + (e.message || String(e))); } finally { setEvaluatingId(null); } 
    };

    const handleRecalculateSingleFit = async () => {
        if (!viewingApp) return;
        handleEvaluate(viewingApp.app.id, viewingApp.candidate.id);
    };
    
    const handleDragStart = (e: React.DragEvent, appId: string) => { setDraggedAppId(appId); e.dataTransfer.effectAllowed = 'move'; };
    const handleDragOver = (e: React.DragEvent, status: SelectionStatus) => { 
        e.preventDefault(); 
        e.dataTransfer.dropEffect = 'move'; 
        if (dragOverColumn !== status) setDragOverColumn(status);
    };
    const handleDragLeave = (e: React.DragEvent) => {
    };
    const handleDrop = (e: React.DragEvent, status: SelectionStatus) => { 
        e.preventDefault(); 
        setDragOverColumn(null);
        if (draggedAppId) { 
            if (status === SelectionStatus.REJECTED) { 
                setPendingRejection({ appId: draggedAppId, status }); 
            } else { 
                updateApplicationStatus(draggedAppId, status); 
                refreshData(); 
            } 
            setDraggedAppId(null); 
        } 
    };

    const confirmRejection = () => { if (pendingRejection) { updateApplicationStatus(pendingRejection.appId, pendingRejection.status, rejectionReason, rejectionNotes); refreshData(); setPendingRejection(null); setRejectionReason('Soft Skill'); setRejectionNotes(''); if (viewingApp?.app.id === pendingRejection.appId) { setViewingApp(null); } } };
    const cancelRejection = () => { setPendingRejection(null); setRejectionReason('Soft Skill'); setRejectionNotes(''); };
    
    const openQuickView = (app: Application, candidate: Candidate) => { 
        setViewingApp({ app, candidate }); 
        setQuickViewTab('info'); 
        setIsPhotoZoomed(false); 
    };
    
    const handleOpenCV = () => {
        if (!viewingApp) return;

        if (viewingApp.candidate.cvUrl) {
            window.open(viewingApp.candidate.cvUrl, '_blank');
            return;
        }

        if (viewingApp.candidate.cvFileBase64 && viewingApp.candidate.cvMimeType) {
            try {
                const byteCharacters = atob(viewingApp.candidate.cvFileBase64 || '');
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                const blob = new Blob([byteArray], { type: viewingApp.candidate.cvMimeType });
                const url = URL.createObjectURL(blob);
                window.open(url, '_blank');
            } catch (e) {
                console.error("Error opening base64 CV:", e);
                alert("Impossibile aprire il file locale.");
            }
        }
    };

    const handleRatingChange = (rating: number) => { if (viewingApp) { updateApplicationMetadata(viewingApp.app.id, { rating }); setViewingApp(prev => prev ? { ...prev, app: { ...prev.app, rating } } : null); refreshData(); } };
    const handleInlineRatingChange = (appId: string, rating: number) => { updateApplicationMetadata(appId, { rating }); refreshData(); };
    const handleInlinePriorityChange = (appId: string, priority: 'LOW' | 'MEDIUM' | 'HIGH') => { updateApplicationMetadata(appId, { priority }); refreshData(); };
    const handleInlineStatusChange = (appId: string, newStatus: SelectionStatus) => { if (newStatus === SelectionStatus.REJECTED) { setPendingRejection({ appId, status: newStatus }); } else { updateApplicationStatus(appId, newStatus); refreshData(); } };
    const handlePriorityChange = (priority: 'LOW' | 'MEDIUM' | 'HIGH') => { if (viewingApp) { updateApplicationMetadata(viewingApp.app.id, { priority }); setViewingApp(prev => prev ? { ...prev, app: { ...prev.app, priority } } : null); refreshData(); } };
    const handleStatusChange = (newStatus: SelectionStatus) => { if (!viewingApp) return; if (newStatus === SelectionStatus.REJECTED) { setViewingApp(null); setPendingRejection({ appId: viewingApp.app.id, status: newStatus }); } else { updateApplicationStatus(viewingApp.app.id, newStatus); setViewingApp(prev => prev ? { ...prev, app: { ...prev.app, status: newStatus } } : null); refreshData(); } };
    const handleCandidateUpdate = async (field: keyof Candidate, value: any) => { if (!viewingApp) return; const updatedCandidate = { ...viewingApp.candidate, [field]: value }; setViewingApp(prev => prev ? { ...prev, candidate: updatedCandidate } : null); await updateCandidate(updatedCandidate); refreshData(); };
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files && e.target.files.length > 0 && selectedJobId) { onUpload(Array.from(e.target.files) as File[], selectedJobId); if (fileInputRef.current) fileInputRef.current.value = ''; } };
    const handleSort = (key: string) => { let direction: 'asc' | 'desc' = 'asc'; if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') { direction = 'desc'; } setSortConfig({ key, direction }); };

    const handleAddComment = async () => {
        if (!viewingApp || !newComment.trim() || !currentUser) return;
        const comment: Comment = { id: generateId(), text: newComment, authorName: currentUser.name, authorAvatar: currentUser.avatar, createdAt: Date.now() };
        await addCandidateComment(viewingApp.candidate.id, comment);
        setViewingApp(prev => prev ? { ...prev, candidate: { ...prev.candidate, comments: [...(prev.candidate.comments || []), comment] } } : null);
        setNewComment('');
        refreshData();
    };

    const handleCommentKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            handleAddComment();
        }
    };

    const handleAttachmentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if(!viewingApp || !e.target.files?.length || !currentUser) return;
        const files: File[] = Array.from(e.target.files);
        
        for (const file of files) {
            const reader = new FileReader();
            reader.onload = async () => {
                const base64 = (reader.result as string).split(',')[1];
                const attachment: Attachment = {
                    id: generateId(),
                    name: file.name,
                    type: file.type,
                    dataBase64: base64,
                    uploadedBy: currentUser.name,
                    createdAt: Date.now()
                };
                await addCandidateAttachment(viewingApp.candidate.id, attachment);
                setViewingApp(prev => prev ? { ...prev, candidate: { ...prev.candidate, attachments: [...(prev.candidate.attachments || []), attachment] } } : null);
            };
            reader.readAsDataURL(file);
        }
        
        setTimeout(refreshData, 1000);
        if(attachmentInputRef.current) attachmentInputRef.current.value = '';
    };

    const handleDeleteAttachment = async (attachmentId: string) => {
        if(!viewingApp || !confirm("Eliminare allegato?")) return;
        await deleteCandidateAttachment(viewingApp.candidate.id, attachmentId);
        setViewingApp(prev => prev ? { ...prev, candidate: { ...prev.candidate, attachments: prev.candidate.attachments?.filter(a => a.id !== attachmentId) } } : null);
        refreshData();
    };

    const handleScorecardVote = async (itemId: string, score: number) => {
        if (!viewingApp) return;
        const currentResults = viewingApp.app.scorecardResults || {};
        const newResults = { ...currentResults, [itemId]: score };
        await updateApplicationScorecard(viewingApp.app.id, newResults);
        setViewingApp(prev => prev ? { ...prev, app: { ...prev.app, scorecardResults: newResults } } : null);
        refreshData();
    };

    const openEmailModal = () => { if (!viewingApp) return; const tmpl = emailTemplates[0]; setSelectedTemplateId(tmpl.id); updateEmailContent(tmpl.id); setIsEmailModalOpen(true); };
    const updateEmailContent = (tmplId: string) => { const tmpl = emailTemplates.find(t => t.id === tmplId); if (!tmpl || !viewingApp) return; const job = data.jobs.find(j => j.id === viewingApp.app.jobId); const candidateName = viewingApp.candidate.fullName; const jobTitle = job?.title || 'Posizione'; let subj = tmpl.subject.replace('{candidateName}', candidateName).replace('{jobTitle}', jobTitle); let body = tmpl.body.replace('{candidateName}', candidateName).replace('{jobTitle}', jobTitle); setEmailSubject(subj); setEmailBody(body); };
    const handleTemplateChange = (id: string) => { setSelectedTemplateId(id); updateEmailContent(id); };
    const handleSendEmail = () => { if (!viewingApp) return; const mailtoLink = `mailto:${viewingApp.candidate.email}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`; window.location.href = mailtoLink; setIsEmailModalOpen(false); };

    const filteredJobs = useMemo(() => { let jobs = data.jobs; if (currentUser?.role === UserRole.TEAM) { jobs = jobs.filter(job => job.assignedTeamMembers?.includes(currentUser.uid || '')); } if (!searchTerm) return jobs; const lowerTerm = searchTerm.toLowerCase(); return jobs.filter(job => { if (job.title.toLowerCase().includes(lowerTerm) || job.department.toLowerCase().includes(lowerTerm)) return true; const jobApps = data.applications.filter(a => a.jobId === job.id); return jobApps.some(app => { const candidate = data.candidates.find(c => c.id === app.candidateId); return candidate && (candidate.fullName.toLowerCase().includes(lowerTerm) || candidate.email.toLowerCase().includes(lowerTerm) || candidate.skills.some(s => s.toLowerCase().includes(lowerTerm))); }); }); }, [data.jobs, data.applications, data.candidates, searchTerm, currentUser]);
    const selectedJob = filteredJobs.find(j => j.id === selectedJobId);
    
    const applicationsForJob = useMemo(() => { 
        const apps = data.applications.filter(a => a.jobId === selectedJobId); 
        let filtered = apps; 
        if (searchTerm) { 
            const lowerTerm = searchTerm.toLowerCase(); 
            filtered = apps.filter(app => { 
                const candidate = data.candidates.find(c => c.id === app.candidateId); 
                return candidate && ( candidate.fullName.toLowerCase().includes(lowerTerm) || candidate.email.toLowerCase().includes(lowerTerm) || candidate.skills.some(s => s.toLowerCase().includes(lowerTerm)) || candidate.summary.toLowerCase().includes(lowerTerm) ); 
            }); 
        } 
        if (sortConfig) { 
            return [...filtered].sort((a, b) => { 
                const cA = data.candidates.find(c => c.id === a.candidateId); 
                const cB = data.candidates.find(c => c.id === b.candidateId); 
                if (!cA || !cB) return 0; 
                let valA: any, valB: any; 
                switch (sortConfig.key) { 
                    case 'candidate': valA = cA.fullName.toLowerCase(); valB = cB.fullName.toLowerCase(); break; 
                    case 'age': valA = cA.age || 0; valB = cB.age || 0; break; 
                    case 'rating': valA = a.rating || 0; valB = b.rating || 0; break; 
                    case 'priority': const pMap = { 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1 }; valA = pMap[a.priority || 'LOW'] || 0; valB = pMap[b.priority || 'LOW'] || 0; break; 
                    case 'status': valA = StatusLabels[a.status]; valB = StatusLabels[b.status]; break; 
                    case 'aiScore': valA = a.aiScore || 0; valB = b.aiScore || 0; break; 
                    case 'score': 
                        valA = calculateSafeScore(a, selectedJob?.scorecardSchema);
                        valB = calculateSafeScore(b, selectedJob?.scorecardSchema);
                        break;
                    default: return 0; 
                } 
                if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1; 
                if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1; 
                return 0; 
            }); 
        } 
        return filtered; 
    }, [data.applications, selectedJobId, searchTerm, data.candidates, sortConfig, selectedJob]); 
    
    const availableCandidatesForWizard = useMemo(() => { 
        const term = associateSearch.toLowerCase(); 
        return data.candidates.filter(c => { 
            if (term && !c.fullName.toLowerCase().includes(term) && !c.email.toLowerCase().includes(term)) return false; 
            return true; 
        }); 
    }, [data.candidates, associateSearch]);
    
    const SortHeader = ({ label, sortKey }: { label: string, sortKey: string }) => ( <th className="p-4 font-semibold cursor-pointer hover:bg-stone-100 transition-colors group select-none text-stone-600" onClick={() => handleSort(sortKey)}> <div className="flex items-center gap-1">{label}<div className="flex flex-col"><ChevronUp size={10} className={sortConfig?.key === sortKey && sortConfig.direction === 'asc' ? 'text-emerald-600' : 'text-stone-300'} /><ChevronDown size={10} className={sortConfig?.key === sortKey && sortConfig.direction === 'desc' ? 'text-emerald-600' : 'text-stone-300'} /></div></div> </th> );
    
    const RadarChart = ({ candidates, schema }: { candidates: { name: string, color: string, results: Record<string,number> }[], schema: ScorecardSchema }) => {
        if (!schema || candidates.length === 0) return null;
        
        const size = 300;
        const center = size / 2;
        const radius = 120;
        const categories = schema.categories;
        const angleStep = (Math.PI * 2) / categories.length;
        
        const getPoint = (value: number, index: number): { x: number, y: number } => {
            const angle = index * angleStep - Math.PI / 2;
            const r = (value / 5) * radius;
            const x = center + r * Math.cos(angle);
            const y = center + r * Math.sin(angle);
            return { x, y };
        };

        return (
            <svg width={size} height={size} className="mx-auto">
                {[1, 2, 3, 4, 5].map(level => (
                    <polygon 
                        key={level}
                        points={categories.map((_, i) => {
                            const { x, y } = getPoint(level, i);
                            return `${x},${y}`;
                        }).join(' ')}
                        fill="none"
                        stroke="#e5e7eb"
                        strokeWidth="1"
                    />
                ))}
                {categories.map((cat, i) => {
                    const { x, y } = getPoint(5, i);
                    return (
                        <g key={cat.id}>
                            <line x1={center} y1={center} x2={x} y2={y} stroke="#e5e7eb" strokeWidth="1" />
                            <text x={x} y={y} textAnchor="middle" dominantBaseline="middle" className="text-[10px] fill-stone-500 uppercase font-bold" transform={`translate(${x > center ? 10 : -10}, ${y > center ? 10 : -10})`}>{cat.name}</text>
                        </g>
                    )
                })}
                {candidates.map((cand, idx) => {
                    const points = categories.map((cat, i) => {
                        const itemIds = cat.items.map(it => it.id);
                        const scores = itemIds.map(id => Number(cand.results[id] || 0)).filter(s => s > 0);
                        const avg = scores.length > 0 ? scores.reduce((a: number, b: number) => a + b, 0) / scores.length : 0;
                        const { x, y } = getPoint(avg, i);
                        return `${x},${y}`;
                    }).join(' ');

                    return (
                        <polygon 
                            key={idx}
                            points={points}
                            fill={cand.color}
                            fillOpacity="0.2"
                            stroke={cand.color}
                            strokeWidth="2"
                        />
                    );
                })}
            </svg>
        );
    };

    const matrixCandidates = useMemo(() => {
        let apps = applicationsForJob.filter(a => a.scorecardResults && Object.keys(a.scorecardResults).length > 0);
        if (matrixSelectedCandidateIds.size > 0) {
            apps = apps.filter(a => matrixSelectedCandidateIds.has(a.candidateId));
        }
        if (matrixStatusFilter.length > 0) {
            apps = apps.filter(a => matrixStatusFilter.includes(a.status));
        }
        return apps;
    }, [applicationsForJob, matrixSelectedCandidateIds, matrixStatusFilter]);


    const renderColumn = (status: SelectionStatus) => {
        const priorityVal = { 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1 };
        const appsInStatus = applicationsForJob.filter(a => a.status === status).sort((a, b) => { const ratingDiff = (b.rating || 0) - (a.rating || 0); if (ratingDiff !== 0) return ratingDiff; const pA = priorityVal[a.priority || 'LOW'] || 0; const pB = priorityVal[b.priority || 'LOW'] || 0; const priorityDiff = pB - pA; if (priorityDiff !== 0) return priorityDiff; return b.updatedAt - a.updatedAt; });
        const isRejectedCol = status === SelectionStatus.REJECTED;
        const isDragOver = dragOverColumn === status;

        return (
            <div 
                className={`min-w-[320px] w-[320px] max-w-[320px] rounded-2xl p-4 flex flex-col gap-3 h-full max-h-[calc(100vh-200px)] transition-all duration-300 backdrop-blur-sm border ${isRejectedCol ? 'bg-red-50/50 border-red-100' : 'bg-white/40 border-stone-200'} ${isDragOver ? 'bg-emerald-100/60 border-emerald-300 ring-2 ring-emerald-200 shadow-md' : ''}`} 
                onDragOver={(e) => handleDragOver(e, status)} 
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, status)}
            >
                <div className="flex items-center justify-between mb-2 shrink-0">
                    <h4 className={`font-semibold text-sm uppercase tracking-wider ${isRejectedCol ? 'text-red-700' : 'text-stone-600'}`}>{StatusLabels[status]}</h4>
                    <span className={`text-xs px-2 py-1 rounded-full ${isRejectedCol ? 'bg-red-100 text-red-700' : 'bg-stone-200 text-stone-600'}`}>{appsInStatus.length}</span>
                </div>
                <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
                    {appsInStatus.map((app: Application) => {
                        const candidate = data.candidates.find(c => c.id === app.candidateId);
                        if (!candidate) return null;
                        const isDragging = draggedAppId === app.id;
                        const priorityColor = app.priority === 'HIGH' ? 'bg-red-100 text-red-800 border-red-200' : app.priority === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' : app.priority === 'LOW' ? 'bg-blue-100 text-blue-800 border-blue-200' : null;
                        const totalScore = calculateSafeScore(app, selectedJob?.scorecardSchema);
                        const maxScore = selectedJob?.scorecardSchema ? selectedJob.scorecardSchema.categories.reduce((acc, cat) => acc + cat.items.length * 5, 0) : 0;

                        return (
                            <div key={app.id} draggable onDragStart={(e) => handleDragStart(e, app.id)} onClick={() => openQuickView(app, candidate)} className={`glass-card bg-white p-4 rounded-xl shadow-sm border border-stone-100 hover:shadow-lg transition-all cursor-pointer active:cursor-grabbing relative group ${isDragging ? 'opacity-50 scale-95 ring-2 ring-emerald-400' : ''}`}>
                                {priorityColor && <div className={`absolute top-2 right-2 text-[10px] font-bold px-1.5 py-0.5 rounded border ${priorityColor}`}>{app.priority}</div>}
                                <div className="flex justify-between items-start mb-2 pr-8"><div className="flex items-center gap-2 min-w-0"><GripVertical size={14} className="text-stone-300 shrink-0" /><div className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center shrink-0 overflow-hidden border border-stone-200 hover:ring-2 hover:ring-emerald-200 transition-all" onClick={(e) => { e.stopPropagation(); setViewingApp({ app, candidate }); setIsPhotoZoomed(true); }}>{candidate.photo ? <img src={`data:image/jpeg;base64,${candidate.photo}`} className="w-full h-full object-cover" /> : <span className="text-xs font-bold text-emerald-600">{candidate.fullName.charAt(0)}</span>}</div><h5 className="font-bold text-stone-800 truncate text-sm font-serif">{candidate.fullName}</h5></div></div>
                                <div className="flex items-center gap-2 mb-2 text-xs text-stone-500 pl-6">{candidate.age && <span className="flex items-center gap-1 bg-stone-100 px-1.5 py-0.5 rounded"><Calendar size={10}/> {candidate.age}</span>}{app.rating && <span className="flex items-center gap-1 text-amber-500 font-medium"><Star size={10} fill="currentColor" /> {app.rating}</span>}</div>
                                <p className="text-xs text-stone-500 mb-3 line-clamp-2 break-words whitespace-normal pl-6 italic">{candidate.summary}</p>
                                <div className="pl-6 flex flex-wrap gap-2">
                                    {app.aiScore !== undefined && <div className={`text-[10px] font-bold px-2 py-1 rounded-md flex items-center gap-1 shrink-0 border ${(app.aiScore || 0) >= 80 ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : (app.aiScore || 0) >= 50 ? 'bg-yellow-50 text-yellow-700 border-yellow-100' : 'bg-red-50 text-red-700 border-red-100'}`}><BrainCircuit size={10} /> {app.aiScore}% Fit</div>}
                                    {totalScore > 0 && <div className="text-[10px] font-bold px-2 py-1 rounded-md flex items-center gap-1 shrink-0 border bg-indigo-50 text-indigo-700 border-indigo-100"><Ruler size={10}/> {totalScore}/{maxScore}</div>}
                                </div>
                                <div className="flex flex-col gap-2 mt-2 pl-6">{app.status === SelectionStatus.TO_ANALYZE && !app.aiScore && (<button onClick={(e) => { e.stopPropagation(); handleEvaluate(app.id, candidate.id); }} disabled={!!evaluatingId} className="w-full py-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-xs rounded-lg font-bold flex items-center justify-center gap-1 hover:opacity-90 disabled:opacity-50 cursor-pointer shadow-sm">{evaluatingId === app.id ? 'Analisi...' : <><Sparkles size={12} /> Valuta Fit AI</>}</button>)}</div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    if (!selectedJobId) {
        return (
            <div className="p-8 h-full overflow-y-auto bg-stone-50/50">
                <div className="flex justify-between items-start mb-8 gap-4 flex-wrap">
                    <div><h2 className="text-3xl font-bold text-stone-800 font-serif">Posizioni Aperte</h2><p className="text-stone-500 mt-1">Seleziona una posizione per gestire la pipeline.</p></div>
                    <div className="flex items-center gap-3 flex-1 max-w-xl justify-end">
                        <div className="relative flex-1 max-w-md group"><Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-stone-400 group-hover:text-emerald-500 transition-colors" size={18} /><input ref={searchInputRef} type="text" placeholder="Cerca posizioni o candidati..." className="w-full pl-10 pr-4 py-2.5 bg-white border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none shadow-sm transition-all text-stone-800" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>
                        {(currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.HR) && (
                            <>
                                <button onClick={() => setIsTemplateManagerOpen(true)} className="bg-white border border-stone-200 text-stone-700 hover:bg-stone-50 hover:text-emerald-700 px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-sm shrink-0 font-medium transition-colors"><ListChecks size={20}/> Libreria</button>
                                <button onClick={openCreateJobModal} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-lg shadow-emerald-200 shrink-0 font-bold transition-all"><Plus size={20} /> Nuova</button>
                            </>
                        )}
                    </div>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pb-10">
                    {filteredJobs.map(job => {
                        const jobApps = data.applications.filter(a => a.jobId === job.id);
                        const activeCount = jobApps.filter(a => a.status !== SelectionStatus.HIRED && a.status !== SelectionStatus.REJECTED).length;
                        const hiredCount = jobApps.filter(a => a.status === SelectionStatus.HIRED).length;
                        const rejectedCount = jobApps.filter(a => a.status === SelectionStatus.REJECTED).length;
                        const isAssigned = job.assignedTeamMembers?.includes(currentUser?.uid || '');
                        const isProcessing = processingJobs.has(job.id);

                        return (
                            <div key={job.id} onClick={() => setSelectedJobId(job.id)} className="glass-card bg-white/70 p-6 rounded-2xl hover:shadow-xl hover:-translate-y-1 border border-white/50 cursor-pointer transition-all group flex flex-col relative">
                                {currentUser?.role === UserRole.TEAM && isAssigned && (<div className="absolute top-0 right-0 rounded-bl-xl rounded-tr-2xl text-[10px] bg-indigo-50 text-indigo-600 px-3 py-1 font-bold flex items-center gap-1 border-b border-l border-indigo-100"><Shield size={10}/> ASSEGNATO</div>)}
                                <div className="flex justify-between items-start mb-2 pr-20"><h3 className="text-xl font-bold text-stone-800 group-hover:text-emerald-700 transition-colors font-serif">{job.title}</h3><span className={`text-xs px-2 py-1 rounded-full font-medium ${job.status === 'OPEN' ? 'bg-green-100 text-green-800' : job.status === 'COMPLETED' ? 'bg-blue-100 text-blue-800' : 'bg-stone-100 text-stone-700'}`}>{job.status}</span></div>
                                <p className="text-stone-500 text-sm mb-4 font-medium">{job.department}</p>
                                
                                {isProcessing && (
                                    <div className="flex items-center gap-2 text-xs text-indigo-600 font-bold bg-indigo-50 p-2 rounded-lg mb-2 animate-pulse border border-indigo-100 w-fit">
                                        <Loader2 size={12} className="animate-spin"/> Analisi AI in corso (Background)...
                                    </div>
                                )}

                                <div className="mt-auto flex justify-between items-center text-sm pt-4 border-t border-white/60"><div className="flex gap-4 text-xs"><span className="font-bold text-stone-700">{activeCount} <span className="text-stone-400 font-normal">Attivi</span></span><span className="font-bold text-emerald-700">{hiredCount} <span className="text-stone-400 font-normal">Assunti</span></span><span className="font-bold text-red-700">{rejectedCount} <span className="text-stone-400 font-normal">Scartati</span></span></div>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); setViewingJobInfoId(job.id); }}
                                        className="p-1.5 text-stone-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                        title="Info Posizione"
                                    >
                                        <Info size={16}/>
                                    </button>

                                    {(currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.HR) && (
                                        <>
                                            <button onClick={(e) => { e.stopPropagation(); openEditJobModal(job); }} className="p-1.5 text-stone-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"><Edit size={16}/></button>
                                            <button onClick={(e) => promptDeleteJob(e, job.id)} className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors ml-1 z-20 relative"><Trash2 size={16}/></button>
                                        </>
                                    )}
                                    <span className="flex items-center gap-1 text-emerald-600 font-bold ml-2 group-hover:translate-x-1 transition-transform">Gestisci <ChevronRight size={16} /></span>
                                </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
                
                {/* --- FULL SCREEN WIZARD MODAL FOR JOB CREATION --- */}
                {isJobModalOpen && (
                    <div className="fixed inset-0 bg-stone-50 z-[100] flex flex-col animate-in slide-in-from-bottom-4">
                        {/* MAGIC HEADER REVISED */}
                        <div className="h-72 bg-stone-900 relative flex flex-col justify-end shadow-xl overflow-hidden">
                            {/* Abstract Background Image & Overlay */}
                            <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop')] bg-cover bg-center opacity-40"></div>
                            <div className="absolute inset-0 bg-gradient-to-t from-stone-900 via-stone-900/60 to-transparent"></div>
                            
                            <button onClick={() => setIsJobModalOpen(false)} className="absolute top-6 right-6 text-white/50 hover:text-white transition-colors p-2 rounded-full hover:bg-white/10 z-50"><X size={24}/></button>
                            
                            <div className="max-w-4xl mx-auto w-full relative z-10 px-8 pb-8 space-y-4">
                                <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-widest mb-1">
                                    <Briefcase size={14}/> {editingJobId ? 'Modifica Posizione' : 'Nuova Posizione'}
                                </div>
                                
                                <div className="relative">
                                    <label className="text-emerald-400 font-bold uppercase tracking-widest text-xs mb-2 block">Di cosa hai bisogno?</label>
                                    <textarea 
                                        value={magicPrompt} 
                                        onChange={e => setMagicPrompt(e.target.value)} 
                                        placeholder="Descrivi il ruolo (es. Senior React Developer per team Engineering...)"
                                        className="w-full bg-transparent text-white text-2xl md:text-4xl font-serif font-bold placeholder:text-white/40 outline-none border-b border-white/10 focus:border-emerald-500 transition-colors resize-none overflow-hidden h-auto min-h-[60px] pb-2"
                                        rows={1}
                                        style={{ height: 'auto' }}
                                        onInput={(e: any) => {
                                            e.target.style.height = "auto";
                                            e.target.style.height = e.target.scrollHeight + "px";
                                        }}
                                    />
                                    <div className="mt-4 flex">
                                        <button 
                                            onClick={handleMagicFill}
                                            disabled={isGeneratingJob || !magicPrompt.trim()}
                                            className="bg-emerald-500 text-white px-5 py-2 rounded-full text-sm font-bold shadow-lg hover:bg-emerald-400 transition-all flex items-center gap-2 disabled:opacity-50 disabled:scale-95 hover:scale-105"
                                        >
                                            {isGeneratingJob ? <Loader2 size={16} className="animate-spin"/> : <Sparkles size={16}/>}
                                            Genera con AI
                                        </button>
                                    </div>
                                </div>
                                
                                <div className="flex gap-4 pt-6 border-t border-white/10 mt-6">
                                    {[1, 2, 3].map(step => (
                                        <div key={step} onClick={() => setCreationStep(step)} className={`flex items-center gap-2 cursor-pointer transition-all ${creationStep === step ? 'opacity-100' : 'opacity-40 hover:opacity-70'}`}>
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${creationStep === step ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/50' : 'bg-white/20 text-white'}`}>{step}</div>
                                            <span className="text-white text-sm font-medium tracking-wide">{step === 1 ? 'Dettagli' : step === 2 ? 'Valutazione' : 'Candidati'}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* WIZARD CONTENT */}
                        <div className="flex-1 overflow-y-auto bg-stone-50">
                            <div className="max-w-4xl mx-auto p-8 pb-32">
                                {/* STEP 1: JOB DETAILS */}
                                {creationStep === 1 && (
                                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-200">
                                                <h3 className="text-lg font-bold text-stone-800 mb-4 flex items-center gap-2"><FileText size={20} className="text-emerald-600"/> Informazioni Base</h3>
                                                <div className="space-y-4">
                                                    <div><label className="block text-xs font-bold text-stone-500 uppercase mb-1">Titolo</label><input value={jobForm.title} onChange={e => setJobForm({...jobForm, title: e.target.value})} className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-medium" placeholder="Es. Marketing Manager" /></div>
                                                    <div><label className="block text-xs font-bold text-stone-500 uppercase mb-1">Dipartimento</label><input value={jobForm.department} onChange={e => setJobForm({...jobForm, department: e.target.value})} className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-medium" placeholder="Es. Marketing" /></div>
                                                    {editingJobId && (<div><label className="block text-xs font-bold text-stone-500 uppercase mb-1">Stato</label><select value={jobForm.status} onChange={e => setJobForm({...jobForm, status: e.target.value})} className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl outline-none"><option value="OPEN">APERTA</option><option value="CLOSED">CHIUSA</option></select></div>)}
                                                </div>
                                            </div>
                                            
                                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-200">
                                                <h3 className="text-lg font-bold text-stone-800 mb-4 flex items-center gap-2"><Users size={20} className="text-emerald-600"/> Team di Selezione</h3>
                                                <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar p-1">
                                                    {availableUsers.map(u => {
                                                        const isSelected = assignedTeamMembers.includes(u.uid!);
                                                        return (
                                                            <div 
                                                                key={u.uid} 
                                                                onClick={() => setAssignedTeamMembers(prev => prev.includes(u.uid!) ? prev.filter(id => id !== u.uid) : [...prev, u.uid!])} 
                                                                className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border ${isSelected ? 'bg-emerald-50 border-emerald-500 ring-1 ring-emerald-500 shadow-sm' : 'bg-stone-50 border-stone-100 hover:border-emerald-300'}`}
                                                            >
                                                                <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${isSelected ? 'bg-emerald-600 border-emerald-600' : 'bg-white border-stone-300'}`}>
                                                                    {isSelected && <Check size={12} className="text-white"/>}
                                                                </div>
                                                                <div className="flex-1">
                                                                    <p className={`text-sm font-bold ${isSelected ? 'text-emerald-900' : 'text-stone-900'}`}>{u.name}</p>
                                                                    <p className="text-xs text-stone-500">{u.role}</p>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-200">
                                            <h3 className="text-lg font-bold text-stone-800 mb-4 flex items-center gap-2"><ListChecks size={20} className="text-emerald-600"/> Dettagli Ruolo</h3>
                                            <div className="space-y-6">
                                                <div className="flex-1 flex flex-col"><label className="block text-xs font-bold text-stone-500 uppercase mb-1">Descrizione</label><textarea value={jobForm.description} onChange={e => setJobForm({...jobForm, description: e.target.value})} className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none resize-none flex-1 min-h-[150px]" placeholder="Descrizione del ruolo..." /></div>
                                                <div className="flex-1 flex flex-col"><label className="block text-xs font-bold text-stone-500 uppercase mb-1">Requisiti</label><textarea value={jobForm.requirements} onChange={e => setJobForm({...jobForm, requirements: e.target.value})} className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none resize-none flex-1 min-h-[150px]" placeholder="Requisiti richiesti..." /></div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* STEP 2: SCORECARD */}
                                {creationStep === 2 && (
                                    <div className="bg-white p-8 rounded-2xl shadow-sm border border-stone-200 animate-in fade-in slide-in-from-right-4">
                                        <div className="flex justify-between items-center mb-6 border-b border-stone-100 pb-4">
                                            <div><h3 className="text-xl font-bold text-stone-900">Scheda di Valutazione</h3><p className="text-stone-500 text-sm">Definisci i criteri per valutare i candidati durante i colloqui.</p></div>
                                            <div className="flex gap-2">
                                                <button type="button" onClick={handleOpenSaveTemplate} className="text-xs font-bold text-stone-600 hover:bg-stone-50 px-3 py-2 rounded-lg border border-stone-200 flex items-center gap-2 transition-colors"><Save size={14}/> Salva come Modello</button>
                                                <button type="button" onClick={handleOpenLoadTemplate} className="text-xs font-bold bg-stone-50 text-stone-600 border border-stone-200 hover:bg-stone-100 px-3 py-2 rounded-lg flex items-center gap-2 transition-colors"><Download size={14}/> Carica Modello</button>
                                                <button type="button" onClick={handleGenerateScorecardAI} disabled={isGeneratingScorecard} className="text-xs font-bold text-indigo-600 hover:bg-indigo-50 px-3 py-2 rounded-lg border border-indigo-100 flex items-center gap-2 transition-colors disabled:opacity-50 shadow-sm">{isGeneratingScorecard ? <Loader2 size={14} className="animate-spin"/> : <Sparkles size={14}/>} Genera con AI</button>
                                            </div>
                                        </div>
                                        
                                        <div className="space-y-6">
                                            {(!jobForm.scorecardSchema?.categories || jobForm.scorecardSchema.categories.length === 0) && (
                                                <div className="text-center py-12 border-2 border-dashed border-stone-200 rounded-xl bg-stone-50">
                                                    <ListChecks size={48} className="mx-auto text-stone-300 mb-3"/>
                                                    <p className="text-stone-500 font-medium">Nessuna categoria presente.</p>
                                                    <button onClick={handleAddCategory} className="mt-4 text-emerald-600 font-bold hover:underline">Inizia aggiungendo una categoria</button>
                                                </div>
                                            )}
                                            
                                            {/* VERTICAL LIST VIEW FOR SCORECARD */}
                                            <div className="space-y-6">
                                                {jobForm.scorecardSchema?.categories.map(cat => (
                                                    <div key={cat.id} className="border border-stone-200 rounded-xl overflow-hidden bg-white shadow-sm">
                                                        {/* Category Header */}
                                                        <div className="bg-stone-50 p-4 border-b border-stone-100 flex items-center justify-between">
                                                            <div className="flex-1">
                                                                <input 
                                                                    value={cat.name} 
                                                                    onChange={(e) => handleUpdateCategoryName(cat.id, e.target.value)} 
                                                                    className="font-bold text-lg text-stone-900 bg-transparent border-b border-transparent hover:border-stone-300 focus:border-emerald-500 outline-none w-full transition-colors" 
                                                                    placeholder="Nome Categoria" 
                                                                />
                                                            </div>
                                                            <button onClick={() => handleDeleteCategory(cat.id)} className="text-stone-400 hover:text-red-500 p-2 hover:bg-red-50 rounded transition-colors"><Trash2 size={18}/></button>
                                                        </div>
                                                        
                                                        {/* Items List */}
                                                        <div className="p-4 space-y-3">
                                                            {cat.items.map(item => (
                                                                <div key={item.id} className="flex items-center gap-3">
                                                                    <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full shrink-0"></div>
                                                                    <div className="flex-1">
                                                                        <input 
                                                                            value={item.label} 
                                                                            onChange={(e) => handleUpdateItemLabel(cat.id, item.id, e.target.value)} 
                                                                            className="w-full text-sm bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-100 text-stone-700"
                                                                            placeholder="Descrizione criterio..." 
                                                                        />
                                                                    </div>
                                                                    <button onClick={() => handleDeleteItem(cat.id, item.id)} className="text-stone-300 hover:text-red-500 p-1"><X size={16}/></button>
                                                                </div>
                                                            ))}
                                                            
                                                            <button onClick={() => handleAddItem(cat.id)} className="text-xs text-emerald-600 font-bold hover:bg-emerald-50 px-3 py-2 rounded-lg flex items-center gap-1 transition-colors mt-2">
                                                                <Plus size={14}/> Aggiungi Criterio
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                                
                                                <button onClick={handleAddCategory} className="w-full py-4 border-2 border-dashed border-stone-300 rounded-xl text-stone-400 hover:text-emerald-600 hover:border-emerald-400 hover:bg-white transition-all font-bold flex items-center justify-center gap-2">
                                                    <Plus size={20}/> Aggiungi Nuova Categoria
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* STEP 3: CANDIDATES */}
                                {creationStep === 3 && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in slide-in-from-right-4">
                                        {/* IMPORT CV AREA */}
                                        <div className="bg-white p-8 rounded-2xl shadow-sm border border-stone-200 flex flex-col">
                                            <h3 className="text-xl font-bold text-stone-900 mb-2 flex items-center gap-2"><UploadCloud size={24} className="text-emerald-600"/> Importa CV</h3>
                                            <p className="text-stone-500 text-sm mb-6">Carica i CV dei candidati per questa posizione. L'AI estrarrà automaticamente i dati.</p>
                                            
                                            <div 
                                                className="flex-1 border-2 border-dashed border-stone-300 rounded-xl bg-stone-50 flex flex-col items-center justify-center p-8 hover:bg-emerald-50/30 hover:border-emerald-400 transition-all cursor-pointer relative"
                                                onClick={() => wizardFileInputRef.current?.click()}
                                            >
                                                <input 
                                                    type="file" 
                                                    multiple 
                                                    accept=".pdf,image/*" 
                                                    className="hidden" 
                                                    ref={wizardFileInputRef} 
                                                    onChange={(e) => {
                                                        if (e.target.files) {
                                                            setWizardFiles(prev => [...prev, ...Array.from(e.target.files!)]);
                                                        }
                                                    }}
                                                />
                                                <UploadCloud size={48} className="text-stone-300 mb-4"/>
                                                <p className="font-bold text-stone-700">Clicca per caricare i file</p>
                                                <p className="text-xs text-stone-400 mt-2">Supporta PDF e Immagini</p>
                                            </div>

                                            {wizardFiles.length > 0 && (
                                                <div className="mt-4 space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                                                    {wizardFiles.map((f, i) => (
                                                        <div key={i} className="flex justify-between items-center p-3 bg-stone-50 rounded-lg border border-stone-100">
                                                            <div className="flex items-center gap-2 overflow-hidden">
                                                                <FileText size={16} className="text-stone-400 shrink-0"/>
                                                                <span className="text-sm font-medium text-stone-700 truncate">{f.name}</span>
                                                            </div>
                                                            <button onClick={() => setWizardFiles(prev => prev.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-600"><X size={16}/></button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {/* ASSOCIATE EXISTING */}
                                        <div className="bg-white p-8 rounded-2xl shadow-sm border border-stone-200 flex flex-col h-[500px]">
                                            <div className="mb-6">
                                                <h3 className="text-xl font-bold text-stone-900 mb-2 flex items-center gap-2"><Users size={24} className="text-indigo-600"/> Associa dal Database</h3>
                                                <div className="relative mt-4">
                                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-stone-400" size={18}/>
                                                    <input 
                                                        type="text" 
                                                        placeholder="Cerca candidato..." 
                                                        className="w-full pl-10 pr-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                                                        value={associateSearch}
                                                        onChange={e => setAssociateSearch(e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                            
                                            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 border border-stone-100 rounded-xl p-2 bg-stone-50/30">
                                                {availableCandidatesForWizard.length === 0 ? <p className="text-center text-stone-400 py-10 italic">Nessun candidato trovato.</p> : availableCandidatesForWizard.map(c => (
                                                    <div 
                                                        key={c.id} 
                                                        onClick={() => { const next = new Set(wizardSelectedCandidateIds); if(next.has(c.id)) next.delete(c.id); else next.add(c.id); setWizardSelectedCandidateIds(next); }} 
                                                        className={`flex items-center gap-3 p-3 bg-white border rounded-xl cursor-pointer transition-all hover:shadow-sm ${wizardSelectedCandidateIds.has(c.id) ? 'border-indigo-500 ring-1 ring-indigo-500 bg-indigo-50' : 'border-stone-200'}`}
                                                    >
                                                        <div className={`w-5 h-5 rounded border flex items-center justify-center ${wizardSelectedCandidateIds.has(c.id) ? 'bg-indigo-600 border-indigo-600' : 'border-stone-300 bg-white'}`}>{wizardSelectedCandidateIds.has(c.id) && <CheckSquare size={14} className="text-white" />}</div>
                                                        <div className="w-8 h-8 rounded-full bg-stone-100 overflow-hidden border border-stone-200">{c.photo ? <img src={`data:image/jpeg;base64,${c.photo}`} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center font-bold text-stone-500 text-xs">{c.fullName.charAt(0)}</div>}</div>
                                                        <div><p className="font-bold text-sm text-stone-900">{c.fullName}</p><p className="text-xs text-stone-500">{c.skills.slice(0,3).join(', ')}</p></div>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="mt-4 text-right text-xs font-bold text-indigo-600">{wizardSelectedCandidateIds.size} Selezionati</div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* FOOTER */}
                        <div className="bg-white border-t border-stone-200 p-6 flex justify-between items-center shadow-lg-up relative z-20">
                            <button 
                                onClick={() => creationStep > 1 ? setCreationStep(creationStep - 1) : setIsJobModalOpen(false)} 
                                className="px-6 py-3 text-stone-600 hover:bg-stone-100 rounded-xl font-bold flex items-center gap-2 transition-colors"
                            >
                                {creationStep > 1 ? <ArrowLeft size={18}/> : null}
                                {creationStep > 1 ? 'Indietro' : 'Annulla'}
                            </button>
                            
                            <div className="flex gap-4">
                                {creationStep < 3 ? (
                                    <button 
                                        onClick={() => setCreationStep(creationStep + 1)}
                                        disabled={!jobForm.title} 
                                        className="px-8 py-3 bg-stone-900 text-white rounded-xl font-bold hover:bg-emerald-600 transition-all flex items-center gap-2 shadow-lg disabled:opacity-50"
                                    >
                                        Avanti <ArrowRight size={18}/>
                                    </button>
                                ) : (
                                    <button 
                                        onClick={handleSaveJob}
                                        disabled={isRecalculating}
                                        className="px-8 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all flex items-center gap-2 shadow-lg shadow-emerald-200"
                                    >
                                        <CheckCircle size={20}/>
                                        {editingJobId ? 'Aggiorna Posizione' : 'Crea Posizione'}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )}
                
                {/* ... Template Manager Modals (Same as before) ... */}
                {/* Save Template Modal */}
                {isSaveTemplateModalOpen && (
                    <div className="fixed inset-0 bg-stone-900/40 flex items-center justify-center z-[110] backdrop-blur-sm">
                        <div className="bg-white p-6 rounded-2xl shadow-2xl w-full max-w-sm animate-in zoom-in-95">
                            <h3 className="font-bold text-stone-900 mb-4 font-serif text-lg">Salva come Modello</h3>
                            <input autoFocus value={templateName} onChange={e => setTemplateName(e.target.value)} className="w-full border border-stone-300 rounded-lg p-2.5 mb-4 text-sm outline-none focus:ring-2 focus:ring-emerald-500 bg-stone-50 focus:bg-white" placeholder="Nome del modello..." />
                            <div className="flex justify-end gap-2">
                                <button onClick={() => setIsSaveTemplateModalOpen(false)} className="px-4 py-2 text-stone-600 hover:bg-stone-100 rounded-xl text-sm font-medium">Annulla</button>
                                <button onClick={handleConfirmSaveTemplate} disabled={!templateName} className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 disabled:opacity-50">Salva</button>
                            </div>
                        </div>
                    </div>
                )}
                {/* Load Template Modal */}
                {isLoadTemplateModalOpen && (
                    <div className="fixed inset-0 bg-stone-900/40 flex items-center justify-center z-[110] backdrop-blur-sm">
                        <div className="bg-white p-6 rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col animate-in zoom-in-95">
                            <h3 className="font-bold text-stone-900 mb-4 font-serif text-lg">Carica Modello</h3>
                            <div className="flex-1 overflow-y-auto space-y-2 mb-4 custom-scrollbar">
                                {templates.length === 0 ? <p className="text-stone-400 text-center py-4 italic">Nessun modello salvato.</p> : templates.map(t => (
                                    <div key={t.id} onClick={() => handleLoadTemplate(t)} className="p-3 border border-stone-200 rounded-lg hover:bg-emerald-50 hover:border-emerald-200 cursor-pointer transition-colors group">
                                        <div className="font-bold text-stone-800">{t.name}</div>
                                        <div className="text-xs text-stone-500">{t.schema.categories.length} categorie</div>
                                    </div>
                                ))}
                            </div>
                            <button onClick={() => setIsLoadTemplateModalOpen(false)} className="w-full py-2 bg-stone-100 text-stone-600 rounded-xl text-sm hover:bg-stone-200 font-medium">Chiudi</button>
                        </div>
                    </div>
                )}

                {/* DELETE JOB MODAL */}
                {jobToDeleteId && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-stone-900/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setJobToDeleteId(null)}>
                        <div className="glass-card bg-white/95 rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4 border border-stone-200" onClick={e => e.stopPropagation()}>
                            <div className="flex flex-col items-center text-center">
                                <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mb-4 text-red-600 border border-red-100 shadow-sm">
                                    <Trash2 size={24} />
                                </div>
                                <h3 className="text-lg font-bold text-stone-900 mb-2 font-serif">Elimina Posizione</h3>
                                <p className="text-sm text-stone-500 mb-6">
                                    Sei sicuro di voler eliminare questa posizione? Verrà spostata nel cestino.
                                </p>
                                <div className="flex gap-3 w-full">
                                    <button onClick={() => setJobToDeleteId(null)} disabled={isDeletingJob} className="flex-1 px-4 py-2 bg-stone-100 text-stone-700 rounded-xl font-medium hover:bg-stone-200 transition-colors disabled:opacity-50">Annulla</button>
                                    <button onClick={confirmDeleteJob} disabled={isDeletingJob} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 shadow-lg shadow-red-200 transition-colors flex items-center justify-center gap-2 disabled:opacity-50">{isDeletingJob ? <Loader2 size={16} className="animate-spin"/> : 'Elimina'}</button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* JOB INFO QUICK VIEW */}
                {viewingJobInfoId && jobInfoTarget && (
                    <div className="fixed inset-0 bg-stone-900/30 flex items-center justify-end z-[60] backdrop-blur-[2px]" onClick={() => { setViewingJobInfoId(null); setIsJobStatusDropdownOpen(false); }}>
                        <div className="bg-white/95 h-full shadow-2xl flex flex-col animate-slide-left transition-all duration-300 w-full max-w-lg border-l border-white" onClick={e => e.stopPropagation()}>
                            <div className="p-6 border-b border-stone-100 bg-stone-50/80 flex justify-between items-start shrink-0 relative z-50">
                                <div>
                                    <h3 className="text-2xl font-bold text-stone-900 mb-2 font-serif">{jobInfoTarget.title}</h3>
                                    <div className="flex items-center gap-3 text-sm">
                                        <span className="bg-white border border-stone-200 px-2 py-0.5 rounded text-stone-600 font-medium shadow-sm">{jobInfoTarget.department}</span>
                                        
                                        {(currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.HR) ? (
                                            <div className="relative">
                                                <button 
                                                    onClick={() => setIsJobStatusDropdownOpen(!isJobStatusDropdownOpen)}
                                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full font-bold text-xs border transition-all duration-200 shadow-sm ${JOB_STATUS_CONFIG[jobInfoTarget.status]?.color || 'bg-stone-100 border-stone-200 text-stone-700'}`}
                                                >
                                                    <span className={`w-2 h-2 rounded-full ${JOB_STATUS_CONFIG[jobInfoTarget.status]?.dot || 'bg-stone-400'}`}></span>
                                                    {JOB_STATUS_CONFIG[jobInfoTarget.status]?.label || jobInfoTarget.status}
                                                    <ChevronDownIcon size={12} className={`transition-transform duration-200 ${isJobStatusDropdownOpen ? 'rotate-180' : ''}`}/>
                                                </button>

                                                {isJobStatusDropdownOpen && (
                                                    <div className="absolute top-full left-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-stone-100 overflow-hidden animate-in slide-in-from-top-2 z-[100]">
                                                        <div className="p-1">
                                                            {Object.entries(JOB_STATUS_CONFIG).map(([key, config]) => (
                                                                <button
                                                                    key={key}
                                                                    onClick={async () => {
                                                                        await updateJob({ ...jobInfoTarget, status: key as any });
                                                                        refreshData();
                                                                        setIsJobStatusDropdownOpen(false);
                                                                    }}
                                                                    className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-stone-50 transition-colors ${jobInfoTarget.status === key ? 'bg-stone-50 text-stone-900' : 'text-stone-600'}`}
                                                                >
                                                                    <span className={`w-2 h-2 rounded-full ${config.dot}`}></span>
                                                                    {config.label}
                                                                    {jobInfoTarget.status === key && <Check size={14} className="ml-auto text-emerald-600"/>}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <span className={`text-xs px-3 py-1.5 rounded-full font-bold flex items-center gap-2 border ${JOB_STATUS_CONFIG[jobInfoTarget.status]?.color || 'bg-stone-100 border-stone-200 text-stone-700'}`}>
                                                <span className={`w-2 h-2 rounded-full ${JOB_STATUS_CONFIG[jobInfoTarget.status]?.dot || 'bg-stone-400'}`}></span>
                                                {JOB_STATUS_CONFIG[jobInfoTarget.status]?.label || jobInfoTarget.status}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <button onClick={() => { setViewingJobInfoId(null); setIsJobStatusDropdownOpen(false); }} className="text-stone-400 hover:text-stone-600"><X size={24}/></button>
                            </div>
                            
                            {(currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.HR) && (
                                <div className="px-6 pt-4">
                                    <button 
                                        onClick={() => { setViewingJobInfoId(null); setIsJobStatusDropdownOpen(false); openEditJobModal(jobInfoTarget); }}
                                        className="w-full flex items-center justify-center gap-2 py-2 bg-indigo-50 text-indigo-700 rounded-lg font-bold border border-indigo-100 hover:bg-indigo-100 transition-colors"
                                    >
                                        <Edit size={16} /> Modifica Dati Posizione
                                    </button>
                                </div>
                            )}

                            <div className="flex-1 overflow-y-auto p-6 bg-white custom-scrollbar space-y-6">
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-blue-50 p-3 rounded-xl border border-blue-100">
                                        <span className="text-xs font-bold text-blue-700 uppercase">Totale Candidati</span>
                                        <div className="text-2xl font-bold text-blue-900 mt-1">
                                            {data.applications.filter(a => a.jobId === jobInfoTarget.id).length}
                                        </div>
                                    </div>
                                    <div className="bg-green-50 p-3 rounded-xl border border-green-100">
                                        <span className="text-xs font-bold text-green-700 uppercase">Assunti</span>
                                        <div className="text-2xl font-bold text-green-900 mt-1">
                                            {data.applications.filter(a => a.jobId === jobInfoTarget.id && a.status === SelectionStatus.HIRED).length}
                                        </div>
                                    </div>
                                    <div className="bg-purple-50 p-3 rounded-xl border border-purple-100">
                                        <span className="text-xs font-bold text-purple-700 uppercase">Media Fit AI</span>
                                        <div className="text-2xl font-bold text-purple-900 mt-1 flex items-center gap-1">
                                            <BrainCircuit size={18}/>
                                            {Math.round(
                                                data.applications.filter(a => a.jobId === jobInfoTarget.id && a.aiScore).reduce((acc, curr) => acc + (curr.aiScore || 0), 0) / 
                                                (data.applications.filter(a => a.jobId === jobInfoTarget.id && a.aiScore).length || 1)
                                            )}%
                                        </div>
                                    </div>
                                    <div className="bg-yellow-50 p-3 rounded-xl border border-yellow-100">
                                        <span className="text-xs font-bold text-yellow-700 uppercase">Media Score</span>
                                        <div className="text-2xl font-bold text-yellow-900 mt-1 flex items-center gap-1">
                                            <Ruler size={18}/>
                                            {(
                                                data.applications
                                                    .filter(a => a.jobId === jobInfoTarget.id && a.scorecardResults)
                                                    .reduce((acc, curr) => {
                                                        const appTotal = calculateSafeScore(curr, jobInfoTarget.scorecardSchema);
                                                        return acc + appTotal;
                                                    }, 0) /
                                                (data.applications.filter(a => a.jobId === jobInfoTarget.id && a.scorecardResults).length || 1)
                                            ).toFixed(1)}
                                        </div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4 text-sm bg-stone-50 p-4 rounded-xl border border-stone-100">
                                    <div>
                                        <span className="block text-xs font-bold text-stone-400 uppercase mb-1">Data Creazione</span>
                                        <span className="font-medium text-stone-900">{new Date(jobInfoTarget.createdAt).toLocaleDateString()}</span>
                                    </div>
                                    <div>
                                        <span className="block text-xs font-bold text-stone-400 uppercase mb-1">Scartati</span>
                                        <span className="font-medium text-stone-900">{data.applications.filter(a => a.jobId === jobInfoTarget.id && a.status === SelectionStatus.REJECTED).length}</span>
                                    </div>
                                </div>
                                <div><h4 className="text-xs font-bold text-stone-400 uppercase mb-3 flex items-center gap-2"><FileText size={14}/> Descrizione Posizione</h4><div className="p-4 bg-stone-50 rounded-xl border border-stone-100 text-sm text-stone-800 whitespace-pre-wrap leading-relaxed">{jobInfoTarget.description || "Nessuna descrizione disponibile."}</div></div>
                                <div><h4 className="text-xs font-bold text-stone-400 uppercase mb-3 flex items-center gap-2"><ListChecks size={14}/> Requisiti</h4><div className="p-4 bg-stone-50 rounded-xl border border-stone-100 text-sm text-stone-800 whitespace-pre-wrap leading-relaxed">{jobInfoTarget.requirements || "Nessun requisito specificato."}</div></div>
                                <div><h4 className="text-xs font-bold text-stone-400 uppercase mb-3 flex items-center gap-2"><Users size={14}/> Team di Selezione</h4><div className="bg-white border border-stone-200 rounded-xl overflow-hidden">{!jobInfoTarget.assignedTeamMembers || jobInfoTarget.assignedTeamMembers.length === 0 ? (<p className="p-4 text-sm text-stone-400 italic">Nessun membro assegnato.</p>) : (jobInfoTarget.assignedTeamMembers.map(uid => { const u = availableUsers.find(user => user.uid === uid); return (<div key={uid} className="flex items-center gap-3 p-3 hover:bg-stone-50 border-b border-stone-50 last:border-0"><div className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center text-xs font-bold text-emerald-600 border border-stone-200">{u ? u.name.charAt(0) : '?'}</div><div><p className="text-sm font-bold text-stone-900">{u ? u.name : 'Utente ' + uid.substring(0,4)}</p><p className="text-xs text-stone-500">{u ? u.role : 'Membro Team'}</p></div></div>)}))}</div></div>
                            </div>
                        </div>
                    </div>
                )}

            {/* QUICK VIEW OVERLAY */}
            {viewingApp && (
                <div className="fixed inset-0 bg-stone-900/30 flex items-center justify-end z-50 backdrop-blur-[2px]" onClick={() => setViewingApp(null)}>
                    <div className="bg-white/95 h-full shadow-2xl flex flex-col animate-slide-left transition-all duration-300 w-full max-w-3xl border-l border-white" onClick={e => e.stopPropagation()}>
                        <div className="flex flex-1 overflow-hidden h-full">
                            {/* LEFT DETAILS */}
                            <div className="flex flex-col h-full overflow-hidden w-full">
                                <div className="p-6 border-b border-stone-100 bg-stone-50/80 shrink-0">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex items-center gap-4">
                                            <div className="w-16 h-16 rounded-full bg-white border-2 border-white overflow-hidden shadow-md flex items-center justify-center cursor-zoom-in hover:ring-2 hover:ring-emerald-400 transition-all" onClick={() => setIsPhotoZoomed(true)}>{viewingApp.candidate.photo ? <img src={`data:image/jpeg;base64,${viewingApp.candidate.photo}`} className="w-full h-full object-cover"/> : <span className="text-2xl font-bold text-emerald-600">{viewingApp.candidate.fullName.charAt(0)}</span>}</div>
                                            <div>
                                                <div className="flex items-center gap-3">
                                                    <h2 className="text-2xl font-bold text-stone-900 font-serif">{view