
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { AppState, JobPosition, SelectionStatus, StatusLabels, StatusColors, Candidate, Application, User, Comment, UserRole, EmailTemplate, ScorecardSchema, ScorecardCategory, ScorecardTemplate } from '../types';
import { Plus, ChevronRight, Sparkles, BrainCircuit, Search, GripVertical, UploadCloud, X, Loader2, CheckCircle, AlertTriangle, FileText, Star, Flag, Calendar, Download, Phone, Briefcase, MessageSquare, Clock, Send, Building, Banknote, Maximize2, Minimize2, Eye, ZoomIn, ZoomOut, Mail, LayoutGrid, Kanban, UserPlus, ArrowRight, CheckSquare, Square, ChevronUp, ChevronDown, Edit, Shield, Users, Trash2, Copy, BarChart2, ListChecks, Ruler, Circle, Save, Filter, Settings, Image } from 'lucide-react';
import { addJob, createApplication, updateApplicationStatus, updateApplicationAiScore, generateId, addCandidate, updateApplicationMetadata, addCandidateComment, updateCandidate, updateJob, getAllUsers, getEmailTemplates, updateApplicationScorecard, saveScorecardTemplate, getScorecardTemplates, deleteScorecardTemplate, updateScorecardTemplate } from '../services/storage';
import { evaluateFit, generateJobDetails, generateScorecardSchema } from '../services/ai';

interface RecruitmentViewProps {
    data: AppState;
    refreshData: () => void;
    currentUser: User | null;
    onUpload: (files: File[], jobId?: string) => void;
}

// ... (Keep existing PdfPage and PdfPreview components exactly as they are)
const PdfPage: React.FC<{ pdf: any, pageNumber: number, scale: number }> = ({ pdf, pageNumber, scale }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    useEffect(() => {
        const renderPage = async () => {
            const page = await pdf.getPage(pageNumber);
            const viewport = page.getViewport({ scale });
            const canvas = canvasRef.current;
            if (canvas) {
                const context = canvas.getContext('2d');
                canvas.height = viewport.height;
                canvas.width = viewport.width;
                await page.render({ canvasContext: context!, viewport: viewport }).promise;
            }
        };
        renderPage();
    }, [pdf, pageNumber, scale]);
    return <canvas ref={canvasRef} className="shadow-md rounded bg-white mb-4 block" />;
};

const PdfPreview: React.FC<{ base64?: string; mimeType: string; url?: string }> = ({ base64, mimeType, url }) => {
    const [pdfDoc, setPdfDoc] = useState<any>(null);
    const [scale, setScale] = useState(0.6);
    const [numPages, setNumPages] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const [imgDimensions, setImgDimensions] = useState({ width: 0, height: 0 });

    useEffect(() => {
        const loadPdf = async () => {
            if (!mimeType.includes('pdf')) return;
            setLoading(true);
            try {
                const pdfjs = (window as any).pdfjsLib;
                if (!pdfjs) throw new Error("PDF Lib not found");
                
                let pdf;
                if (url) {
                    pdf = await pdfjs.getDocument(url).promise;
                } else if (base64) {
                    const binaryString = window.atob(base64);
                    const len = binaryString.length;
                    const bytes = new Uint8Array(len);
                    for (let i = 0; i < len; i++) {
                        bytes[i] = binaryString.charCodeAt(i);
                    }
                    pdf = await pdfjs.getDocument({ data: bytes }).promise;
                } else {
                     throw new Error("No source");
                }
                
                setPdfDoc(pdf);
                setNumPages(pdf.numPages);
            } catch (e: any) {
                console.error(e);
                setError("Impossibile visualizzare l'anteprima PDF.");
            } finally {
                setLoading(false);
            }
        };
        loadPdf();
    }, [base64, mimeType, url]);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        const handleWheel = (e: WheelEvent) => {
            if (e.ctrlKey) {
                e.preventDefault(); 
                const delta = e.deltaY * -0.001; 
                setScale(prev => Math.min(Math.max(0.3, prev + delta), 4));
            }
        };
        container.addEventListener('wheel', handleWheel, { passive: false });
        return () => { container.removeEventListener('wheel', handleWheel); };
    }, []);

    return (
        <div className="w-full h-full relative bg-gray-200 flex flex-col overflow-hidden">
            <div ref={containerRef} className="flex-1 overflow-auto flex relative custom-scrollbar">
                <div className="m-auto p-8 min-w-min min-h-min">
                    {loading && <div className="text-gray-500 flex items-center gap-2 mb-4 justify-center"><Loader2 className="animate-spin"/> Caricamento...</div>}
                    {error && <div className="text-red-500 bg-white p-4 rounded shadow">{error}</div>}
                    
                    {!mimeType.includes('pdf') ? (
                        <img 
                            src={url || `data:${mimeType};base64,${base64}`} 
                            className="shadow-lg rounded bg-white transition-all duration-75 ease-linear block" 
                            style={{ width: imgDimensions.width ? `${imgDimensions.width * scale}px` : 'auto', maxWidth: 'none' }} 
                            onLoad={(e) => setImgDimensions({ width: e.currentTarget.naturalWidth, height: e.currentTarget.naturalHeight })} 
                            alt="Preview" 
                        />
                    ) : (
                        pdfDoc && (<div className="flex flex-col items-center">{Array.from(new Array(numPages), (el, index) => (<PdfPage key={index} pdf={pdfDoc} pageNumber={index + 1} scale={scale} />))}</div>)
                    )}
                </div>
            </div>
            <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 bg-white/90 backdrop-blur shadow-xl border border-gray-200 rounded-full px-4 py-2 flex items-center gap-4 z-50">
                <button onClick={() => setScale(s => Math.max(0.2, s - 0.1))} className="p-1.5 hover:bg-gray-100 rounded-full text-gray-700" title="Zoom Out"><ZoomOut size={20} /></button>
                <span className="text-xs font-bold w-12 text-center text-gray-800">{Math.round(scale * 100)}%</span>
                <button onClick={() => setScale(s => Math.min(4.0, s + 0.1))} className="p-1.5 hover:bg-gray-100 rounded-full text-gray-700" title="Zoom In"><ZoomIn size={20} /></button>
            </div>
        </div>
    );
};

export const RecruitmentView: React.FC<RecruitmentViewProps> = ({ data, refreshData, currentUser, onUpload }) => {
    // ... all logic same as original ...
    const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
    const [isJobModalOpen, setIsJobModalOpen] = useState(false);
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
    const [quickViewTab, setQuickViewTab] = useState<'info' | 'processes' | 'comments' | 'scorecard'>('info');
    const [newComment, setNewComment] = useState('');
    const [isPhotoZoomed, setIsPhotoZoomed] = useState(false);
    const [isCvPreviewOpen, setIsCvPreviewOpen] = useState(false);
    
    // EMAIL STATE
    const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
    const [emailTemplates] = useState<EmailTemplate[]>(getEmailTemplates());
    const [selectedTemplateId, setSelectedTemplateId] = useState<string>(emailTemplates[0]?.id || '');
    const [emailSubject, setEmailSubject] = useState('');
    const [emailBody, setEmailBody] = useState('');
    
    // JOB MODAL & SCORECARD
    const [jobForm, setJobForm] = useState<{ title: string, department: string, description: string, requirements: string, status: any, scorecardSchema?: ScorecardSchema }>({ title: '', department: '', description: '', requirements: '', status: 'OPEN', scorecardSchema: undefined });
    const [isGeneratingJob, setIsGeneratingJob] = useState(false);
    const [isGeneratingScorecard, setIsGeneratingScorecard] = useState(false);
    const [availableUsers, setAvailableUsers] = useState<User[]>([]);
    const [assignedTeamMembers, setAssignedTeamMembers] = useState<string[]>([]);

    // SCORECARD TEMPLATES STATE (Management)
    const [isSaveTemplateModalOpen, setIsSaveTemplateModalOpen] = useState(false);
    const [isLoadTemplateModalOpen, setIsLoadTemplateModalOpen] = useState(false);
    const [templateName, setTemplateName] = useState('');
    const [templates, setTemplates] = useState<ScorecardTemplate[]>([]);
    
    // TEMPLATE MANAGER (Moved from Settings)
    const [isTemplateManagerOpen, setIsTemplateManagerOpen] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<ScorecardTemplate | null>(null);
    const [isTemplateEditorOpen, setIsTemplateEditorOpen] = useState(false);

    // COMPARISON MATRIX
    const [isComparisonModalOpen, setIsComparisonModalOpen] = useState(false);
    const [matrixSelectedCandidateIds, setMatrixSelectedCandidateIds] = useState<Set<string>>(new Set());
    const [isMatrixCandidateFilterOpen, setIsMatrixCandidateFilterOpen] = useState(false);
    const [matrixStatusFilter, setMatrixStatusFilter] = useState<SelectionStatus[]>([]);

    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!viewingApp) { setIsCvPreviewOpen(false); setIsPhotoZoomed(false); }
    }, [viewingApp]);

    useEffect(() => {
        if (isAssociateModalOpen) { setSelectedAssociateIds(new Set()); setAssociateSearch(''); }
    }, [isAssociateModalOpen]);

    useEffect(() => {
        if (isJobModalOpen && (currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.HR)) {
            getAllUsers().then(setAvailableUsers);
        }
    }, [isJobModalOpen, currentUser]);

    // Load templates when manager or modal opens
    useEffect(() => {
        if (isTemplateManagerOpen || isLoadTemplateModalOpen) {
            getScorecardTemplates().then(setTemplates);
        }
    }, [isTemplateManagerOpen, isLoadTemplateModalOpen]);

    const openCreateJobModal = () => {
        setEditingJobId(null);
        setJobForm({ title: '', department: '', description: '', requirements: '', status: 'OPEN', scorecardSchema: undefined });
        setAssignedTeamMembers([]);
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
        setIsJobModalOpen(true);
    };

    // Scorecard Edit Handlers (Job Modal)
    const handleAddCategory = () => { setJobForm(prev => ({ ...prev, scorecardSchema: { categories: [ ...(prev.scorecardSchema?.categories || []), { id: generateId(), name: 'Nuova Categoria', items: [] } ] } })); };
    const handleDeleteCategory = (catId: string) => { setJobForm(prev => ({ ...prev, scorecardSchema: { categories: (prev.scorecardSchema?.categories || []).filter(c => c.id !== catId) } })); };
    const handleUpdateCategoryName = (catId: string, newName: string) => { setJobForm(prev => ({ ...prev, scorecardSchema: { categories: (prev.scorecardSchema?.categories || []).map(c => c.id === catId ? { ...c, name: newName } : c) } })); };
    const handleAddItem = (catId: string) => { setJobForm(prev => ({ ...prev, scorecardSchema: { categories: (prev.scorecardSchema?.categories || []).map(c => c.id === catId ? { ...c, items: [...c.items, { id: generateId(), label: 'Nuova Voce' }] } : c) } })); };
    const handleDeleteItem = (catId: string, itemId: string) => { setJobForm(prev => ({ ...prev, scorecardSchema: { categories: (prev.scorecardSchema?.categories || []).map(c => c.id === catId ? { ...c, items: c.items.filter(i => i.id !== itemId) } : c) } })); };
    const handleUpdateItemLabel = (catId: string, itemId: string, newLabel: string) => { setJobForm(prev => ({ ...prev, scorecardSchema: { categories: (prev.scorecardSchema?.categories || []).map(c => c.id === catId ? { ...c, items: c.items.map(i => i.id === itemId ? { ...i, label: newLabel } : i) } : c) } })); };

    const handleSaveJob = (e: React.FormEvent) => {
        e.preventDefault();
        const commonData = { ...jobForm, assignedTeamMembers: assignedTeamMembers };
        if (editingJobId) {
            const updatedJob: JobPosition = { ...data.jobs.find(j => j.id === editingJobId)!, ...commonData };
            updateJob(updatedJob);
        } else {
            const newJob: JobPosition = { id: generateId(), ...commonData, createdAt: Date.now() };
            addJob(newJob);
        }
        refreshData();
        setIsJobModalOpen(false);
    };

    const handleGenerateJobAI = async () => { if (!jobForm.title || !jobForm.department) { alert("Inserisci Titolo e Dipartimento."); return; } setIsGeneratingJob(true); try { const details = await generateJobDetails(jobForm.title, jobForm.department); setJobForm(prev => ({ ...prev, description: details.description, requirements: details.requirements })); } catch (e) { alert("Errore AI: impossibile generare dettagli."); } finally { setIsGeneratingJob(false); } };
    const handleGenerateScorecardAI = async () => { if (!jobForm.title || !jobForm.description) { alert("Inserisci Titolo e Descrizione prima di generare la scheda."); return; } setIsGeneratingScorecard(true); try { const schema = await generateScorecardSchema(jobForm.title, jobForm.description); setJobForm(prev => ({ ...prev, scorecardSchema: schema })); } catch(e) { alert("Errore AI Scorecard."); } finally { setIsGeneratingScorecard(false); } };

    // --- TEMPLATE MANAGEMENT LOGIC ---
    const handleOpenSaveTemplate = () => { if (!jobForm.scorecardSchema?.categories.length) { alert("La scheda è vuota. Aggiungi categorie prima di salvare."); return; } setTemplateName(''); setIsSaveTemplateModalOpen(true); };
    const handleConfirmSaveTemplate = async () => { if (!templateName.trim() || !jobForm.scorecardSchema) return; await saveScorecardTemplate(templateName, jobForm.scorecardSchema); setIsSaveTemplateModalOpen(false); };
    const handleOpenLoadTemplate = async () => { const tmpls = await getScorecardTemplates(); setTemplates(tmpls); setIsLoadTemplateModalOpen(true); };
    
    // FIXED: Load Template directly without confirm to prevent blocking
    const handleLoadTemplate = (template: ScorecardTemplate) => { 
        setJobForm(prev => ({ ...prev, scorecardSchema: template.schema })); 
        setIsLoadTemplateModalOpen(false); 
    };
    
    const handleDeleteTemplate = async (id: string) => { if (confirm("Eliminare questo modello definitivamente?")) { await deleteScorecardTemplate(id); setTemplates(prev => prev.filter(t => t.id !== id)); } };

    // --- NEW TEMPLATE MANAGER FUNCTIONS ---
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
    
    // Helpers for Template Editor (Duplicated logic for independence)
    const handleTemplateAddCategory = () => { setEditingTemplate(prev => prev ? { ...prev, schema: { categories: [...prev.schema.categories, { id: generateId(), name: 'Nuova Categoria', items: [] }] } } : null); };
    const handleTemplateDeleteCategory = (id: string) => { setEditingTemplate(prev => prev ? { ...prev, schema: { categories: prev.schema.categories.filter(c => c.id !== id) } } : null); };
    const handleTemplateUpdateCategory = (id: string, name: string) => { setEditingTemplate(prev => prev ? { ...prev, schema: { categories: prev.schema.categories.map(c => c.id === id ? { ...c, name } : c) } } : null); };
    const handleTemplateAddItem = (catId: string) => { setEditingTemplate(prev => prev ? { ...prev, schema: { categories: prev.schema.categories.map(c => c.id === catId ? { ...c, items: [...c.items, { id: generateId(), label: 'Nuova Voce' }] } : c) } } : null); };
    const handleTemplateDeleteItem = (catId: string, itemId: string) => { setEditingTemplate(prev => prev ? { ...prev, schema: { categories: prev.schema.categories.map(c => c.id === catId ? { ...c, items: c.items.filter(i => i.id !== itemId) } : c) } } : null); };
    const handleTemplateUpdateItem = (catId: string, itemId: string, label: string) => { setEditingTemplate(prev => prev ? { ...prev, schema: { categories: prev.schema.categories.map(c => c.id === catId ? { ...c, items: c.items.map(i => i.id === itemId ? { ...i, label } : i) } : c) } } : null); };


    // ... (Standard handlers kept same)
    const handleBatchAddToPipeline = async () => { if (!selectedJobId || selectedAssociateIds.size === 0) return; setIsAssociating(true); try { const job = data.jobs.find(j => j.id === selectedJobId); if (!job) return; const promises = Array.from(selectedAssociateIds).map(async (candidateId: string) => { const candidate = data.candidates.find(c => c.id === candidateId); let aiScore: number | undefined; let aiReasoning: string | undefined; if (candidate) { try { const fit = await evaluateFit(candidate, job); aiScore = fit.score; aiReasoning = fit.reasoning; } catch (e) { console.error(e); } } const app: Application = { id: generateId(), candidateId, jobId: selectedJobId, status: SelectionStatus.TO_ANALYZE, aiScore, aiReasoning, updatedAt: Date.now() }; return createApplication(app); }); await Promise.all(promises); refreshData(); setIsAssociateModalOpen(false); setSelectedAssociateIds(new Set()); } catch(e) { console.error(e); } finally { setIsAssociating(false); } };
    const toggleCandidateSelection = (candidateId: string) => { const newSet = new Set(selectedAssociateIds); if (newSet.has(candidateId)) { newSet.delete(candidateId); } else { newSet.add(candidateId); } setSelectedAssociateIds(newSet); };
    const handleEvaluate = async (appId: string, candidateId: string) => { if (!selectedJobId) return; const job = data.jobs.find(j => j.id === selectedJobId); const candidate = data.candidates.find(c => c.id === candidateId); if (!job || !candidate) return; setEvaluatingId(appId); try { const result = await evaluateFit(candidate, job); updateApplicationAiScore(appId, result.score, result.reasoning); refreshData(); } catch (e) { alert("Errore valutazione AI: " + e); } finally { setEvaluatingId(null); } };
    const handleDragStart = (e: React.DragEvent, appId: string) => { setDraggedAppId(appId); e.dataTransfer.effectAllowed = 'move'; };
    const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; };
    const handleDrop = (e: React.DragEvent, status: SelectionStatus) => { e.preventDefault(); if (draggedAppId) { if (status === SelectionStatus.REJECTED) { setPendingRejection({ appId: draggedAppId, status }); } else { updateApplicationStatus(draggedAppId, status); refreshData(); } setDraggedAppId(null); } };
    const confirmRejection = () => { if (pendingRejection) { updateApplicationStatus(pendingRejection.appId, pendingRejection.status, rejectionReason, rejectionNotes); refreshData(); setPendingRejection(null); setRejectionReason('Soft Skill'); setRejectionNotes(''); if (viewingApp?.app.id === pendingRejection.appId) { setViewingApp(null); } } };
    const cancelRejection = () => { setPendingRejection(null); setRejectionReason('Soft Skill'); setRejectionNotes(''); };
    const openQuickView = (app: Application, candidate: Candidate, openPreview = false) => { setViewingApp({ app, candidate }); setQuickViewTab('info'); setIsPhotoZoomed(false); setIsCvPreviewOpen(openPreview); };
    const handleRatingChange = (rating: number) => { if (viewingApp) { updateApplicationMetadata(viewingApp.app.id, { rating }); setViewingApp(prev => prev ? { ...prev, app: { ...prev.app, rating } } : null); refreshData(); } };
    const handleInlineRatingChange = (appId: string, rating: number) => { updateApplicationMetadata(appId, { rating }); refreshData(); };
    const handleInlinePriorityChange = (appId: string, priority: 'LOW' | 'MEDIUM' | 'HIGH') => { updateApplicationMetadata(appId, { priority }); refreshData(); };
    const handleInlineStatusChange = (appId: string, newStatus: SelectionStatus) => { if (newStatus === SelectionStatus.REJECTED) { setPendingRejection({ appId, status: newStatus }); } else { updateApplicationStatus(appId, newStatus); refreshData(); } };
    const handlePriorityChange = (priority: 'LOW' | 'MEDIUM' | 'HIGH') => { if (viewingApp) { updateApplicationMetadata(viewingApp.app.id, { priority }); setViewingApp(prev => prev ? { ...prev, app: { ...prev.app, priority } } : null); refreshData(); } };
    const handleStatusChange = (newStatus: SelectionStatus) => { if (!viewingApp) return; if (newStatus === SelectionStatus.REJECTED) { setViewingApp(null); setPendingRejection({ appId: viewingApp.app.id, status: newStatus }); } else { updateApplicationStatus(viewingApp.app.id, newStatus); setViewingApp(prev => prev ? { ...prev, app: { ...prev.app, status: newStatus } } : null); refreshData(); } };
    const handleCandidateUpdate = async (field: keyof Candidate, value: any) => { if (!viewingApp) return; const updatedCandidate = { ...viewingApp.candidate, [field]: value }; setViewingApp(prev => prev ? { ...prev, candidate: updatedCandidate } : null); await updateCandidate(updatedCandidate); refreshData(); };
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files && e.target.files.length > 0 && selectedJobId) { onUpload(Array.from(e.target.files), selectedJobId); if (fileInputRef.current) fileInputRef.current.value = ''; } };
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

    // SCORECARD VOTE
    const handleScorecardVote = async (itemId: string, score: number) => {
        if (!viewingApp) return;
        const currentResults = viewingApp.app.scorecardResults || {};
        const newResults = { ...currentResults, [itemId]: score };
        await updateApplicationScorecard(viewingApp.app.id, newResults);
        setViewingApp(prev => prev ? { ...prev, app: { ...prev.app, scorecardResults: newResults } } : null);
        refreshData();
    };

    // EMAIL LOGIC
    const openEmailModal = () => { if (!viewingApp) return; const tmpl = emailTemplates[0]; setSelectedTemplateId(tmpl.id); updateEmailContent(tmpl.id); setIsEmailModalOpen(true); };
    const updateEmailContent = (tmplId: string) => { const tmpl = emailTemplates.find(t => t.id === tmplId); if (!tmpl || !viewingApp) return; const job = data.jobs.find(j => j.id === viewingApp.app.jobId); const candidateName = viewingApp.candidate.fullName; const jobTitle = job?.title || 'Posizione'; let subj = tmpl.subject.replace('{candidateName}', candidateName).replace('{jobTitle}', jobTitle); let body = tmpl.body.replace('{candidateName}', candidateName).replace('{jobTitle}', jobTitle); setEmailSubject(subj); setEmailBody(body); };
    const handleTemplateChange = (id: string) => { setSelectedTemplateId(id); updateEmailContent(id); };
    const handleSendEmail = () => { if (!viewingApp) return; const mailtoLink = `mailto:${viewingApp.candidate.email}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`; window.location.href = mailtoLink; setIsEmailModalOpen(false); };

    // ... (filtering logic)
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
                        valA = Object.values(a.scorecardResults || {}).reduce((sum: number, v: number) => sum + v, 0);
                        valB = Object.values(b.scorecardResults || {}).reduce((sum: number, v: number) => sum + v, 0);
                        break;
                    default: return 0; 
                } 
                if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1; 
                if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1; 
                return 0; 
            }); 
        } 
        return filtered; 
    }, [data.applications, selectedJobId, searchTerm, data.candidates, sortConfig]);
    
    const availableCandidates = useMemo(() => { if (!selectedJobId) return []; const term = associateSearch.toLowerCase(); return data.candidates.filter(c => { const alreadyApplied = data.applications.some(a => a.candidateId === c.id && a.jobId === selectedJobId); if (alreadyApplied) return false; if (term && !c.fullName.toLowerCase().includes(term) && !c.email.toLowerCase().includes(term)) return false; return true; }); }, [data.candidates, data.applications, selectedJobId, associateSearch]);
    
    const SortHeader = ({ label, sortKey }: { label: string, sortKey: string }) => ( <th className="p-4 font-semibold cursor-pointer hover:bg-gray-100 transition-colors group select-none" onClick={() => handleSort(sortKey)}> <div className="flex items-center gap-1">{label}<div className="flex flex-col"><ChevronUp size={10} className={sortConfig?.key === sortKey && sortConfig.direction === 'asc' ? 'text-indigo-600' : 'text-gray-300'} /><ChevronDown size={10} className={sortConfig?.key === sortKey && sortConfig.direction === 'desc' ? 'text-indigo-600' : 'text-gray-300'} /></div></div> </th> );
    
    // --- RADAR CHART COMPONENT ---
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
                            <text x={x} y={y} textAnchor="middle" dominantBaseline="middle" className="text-[10px] fill-gray-500 uppercase font-bold" transform={`translate(${x > center ? 10 : -10}, ${y > center ? 10 : -10})`}>{cat.name}</text>
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

        return (
            <div className={`min-w-[320px] w-[320px] max-w-[320px] rounded-xl p-4 flex flex-col gap-3 h-full max-h-[calc(100vh-200px)] transition-colors ${isRejectedCol ? 'bg-red-50 border border-red-100' : 'bg-gray-50'}`} onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, status)}>
                <div className="flex items-center justify-between mb-2 shrink-0">
                    <h4 className={`font-semibold text-sm uppercase tracking-wider ${isRejectedCol ? 'text-red-700' : 'text-gray-700'}`}>{StatusLabels[status]}</h4>
                    <span className={`text-xs px-2 py-1 rounded-full ${isRejectedCol ? 'bg-red-100 text-red-700' : 'bg-gray-200 text-gray-600'}`}>{appsInStatus.length}</span>
                </div>
                <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
                    {appsInStatus.map((app: Application) => {
                        const candidate = data.candidates.find(c => c.id === app.candidateId);
                        if (!candidate) return null;
                        const isDragging = draggedAppId === app.id;
                        const priorityColor = app.priority === 'HIGH' ? 'bg-red-100 text-red-800 border-red-200' : app.priority === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' : app.priority === 'LOW' ? 'bg-blue-100 text-blue-800 border-blue-200' : null;
                        const totalScore = app.scorecardResults ? Object.values(app.scorecardResults).reduce((sum: number, v: number) => sum + v, 0) : 0;
                        const maxScore = selectedJob?.scorecardSchema ? selectedJob.scorecardSchema.categories.reduce((acc, cat) => acc + cat.items.length * 5, 0) : 0;

                        return (
                            <div key={app.id} draggable onDragStart={(e) => handleDragStart(e, app.id)} onClick={() => openQuickView(app, candidate)} className={`bg-white p-4 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-all cursor-pointer active:cursor-grabbing relative group ${isDragging ? 'opacity-50 scale-95 ring-2 ring-indigo-400' : ''}`}>
                                {priorityColor && <div className={`absolute top-2 right-2 text-[10px] font-bold px-1.5 py-0.5 rounded border ${priorityColor}`}>{app.priority}</div>}
                                <div className="flex justify-between items-start mb-2 pr-8"><div className="flex items-center gap-2 min-w-0"><GripVertical size={14} className="text-gray-300 shrink-0" /><div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0 overflow-hidden border border-gray-200 hover:ring-2 hover:ring-indigo-200 transition-all" onClick={(e) => { e.stopPropagation(); setViewingApp({ app, candidate }); setIsPhotoZoomed(true); }}>{candidate.photoUrl || candidate.photo ? <img src={candidate.photoUrl || `data:image/jpeg;base64,${candidate.photo}`} className="w-full h-full object-cover" /> : <span className="text-xs font-bold text-indigo-600">{candidate.fullName.charAt(0)}</span>}</div><h5 className="font-bold text-gray-800 truncate text-sm">{candidate.fullName}</h5></div></div>
                                <div className="flex items-center gap-2 mb-2 text-xs text-gray-500 pl-6">{candidate.age && <span className="flex items-center gap-1 bg-gray-100 px-1.5 py-0.5 rounded"><Calendar size={10}/> {candidate.age}</span>}{app.rating && <span className="flex items-center gap-1 text-yellow-600 font-medium"><Star size={10} fill="currentColor" /> {app.rating}</span>}</div>
                                <p className="text-xs text-gray-500 mb-3 line-clamp-2 break-words whitespace-normal pl-6">{candidate.summary}</p>
                                <div className="pl-6 flex flex-wrap gap-2">
                                    {app.aiScore !== undefined && <div className={`text-[10px] font-bold px-2 py-1 rounded-md flex items-center gap-1 shrink-0 border ${(app.aiScore || 0) >= 80 ? 'bg-green-50 text-green-700 border-green-100' : (app.aiScore || 0) >= 50 ? 'bg-yellow-50 text-yellow-700 border-yellow-100' : 'bg-red-50 text-red-700 border-red-100'}`}><BrainCircuit size={10} /> {app.aiScore}% Fit</div>}
                                    {totalScore > 0 && <div className="text-[10px] font-bold px-2 py-1 rounded-md flex items-center gap-1 shrink-0 border bg-indigo-50 text-indigo-700 border-indigo-100"><Ruler size={10}/> {totalScore}/{maxScore}</div>}
                                </div>
                                <div className="flex flex-col gap-2 mt-2 pl-6">{app.status === SelectionStatus.TO_ANALYZE && !app.aiScore && (<button onClick={(e) => { e.stopPropagation(); handleEvaluate(app.id, candidate.id); }} disabled={!!evaluatingId} className="w-full py-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-xs rounded font-medium flex items-center justify-center gap-1 hover:opacity-90 disabled:opacity-50 cursor-pointer">{evaluatingId === app.id ? 'Analisi...' : <><Sparkles size={12} /> Valuta Fit</>}</button>)}</div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    // ... (rest of the file remains same, updating PdfPreview usage where relevant)
    // IMPORTANT: Make sure the PdfPreview rendering inside `viewingApp` uses the updated props

    return (
        <div className="h-full flex flex-col bg-gray-50">
            {/* ... toolbar ... */}
            <div className="bg-white border-b border-gray-200 px-6 py-3 flex justify-between items-center shadow-sm shrink-0 z-20">
                <div className="flex items-center gap-4">
                    <button onClick={() => setSelectedJobId(null)} className="flex items-center gap-1 text-gray-500 hover:text-indigo-600 transition-colors text-sm font-medium"><ArrowRight size={16} className="rotate-180" /> Torna alle posizioni</button>
                    <div className="h-6 w-px bg-gray-200"></div>
                    <div><h2 className="text-lg font-bold text-gray-900 leading-tight">{selectedJob?.title}</h2><p className="text-xs text-gray-500">{selectedJob?.department}</p></div>
                    <span className={`text-[10px] px-2 py-0.5 rounded border font-bold ${selectedJob?.status === 'OPEN' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-100 text-gray-600 border-gray-200'}`}>{selectedJob?.status}</span>
                </div>
                <div className="flex items-center gap-3">
                    <div className="relative"><Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={14} /><input type="text" placeholder="Filtra candidati..." className="pl-9 pr-4 py-1.5 bg-gray-100 border-transparent focus:bg-white focus:border-indigo-300 rounded-md text-sm outline-none transition-all w-48 focus:w-64" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>
                    {selectedJob?.scorecardSchema && (
                        <button onClick={() => { setIsComparisonModalOpen(true); setMatrixSelectedCandidateIds(new Set()); }} className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-md text-sm font-medium border border-indigo-200 transition-colors">
                            <BarChart2 size={16} /> Confronta Candidati
                        </button>
                    )}
                    <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200">
                        <button onClick={() => setViewMode('kanban')} className={`p-1.5 rounded transition-all ${viewMode === 'kanban' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}><Kanban size={16} /></button>
                        <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded transition-all ${viewMode === 'grid' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}><LayoutGrid size={16} /></button>
                    </div>
                    <input type="file" multiple accept=".pdf,image/*" className="hidden" ref={fileInputRef} onChange={handleFileSelect} />
                    <button onClick={() => fileInputRef.current?.click()} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm text-sm font-bold transition-colors"><UploadCloud size={16} /> Importa CV</button>
                    {currentUser?.role !== UserRole.TEAM && (
                        <button onClick={() => setIsAssociateModalOpen(true)} className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm text-sm font-medium transition-colors"><Plus size={16} /> Associa Esistente</button>
                    )}
                </div>
            </div>

            {/* CONTENT */}
            <div className="flex-1 overflow-hidden relative">
                {viewMode === 'kanban' ? (
                    <div className="h-full overflow-x-auto overflow-y-hidden p-6 flex gap-6 custom-scrollbar">
                        {renderColumn(SelectionStatus.TO_ANALYZE)}
                        {renderColumn(SelectionStatus.SCREENING)}
                        {renderColumn(SelectionStatus.FIRST_INTERVIEW)}
                        {renderColumn(SelectionStatus.SECOND_INTERVIEW)}
                        {renderColumn(SelectionStatus.OFFER)}
                        {renderColumn(SelectionStatus.HIRED)}
                        {renderColumn(SelectionStatus.REJECTED)}
                    </div>
                ) : (
                    <div className="h-full p-6 overflow-hidden flex flex-col">
                        <div className="bg-white border border-gray-200 rounded-xl shadow-sm flex-1 overflow-hidden flex flex-col">
                            <div className="overflow-auto flex-1 custom-scrollbar">
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm text-xs text-gray-500 font-semibold uppercase tracking-wider">
                                        <tr>
                                            <SortHeader label="Candidato" sortKey="candidate" />
                                            <SortHeader label="Età" sortKey="age" />
                                            <SortHeader label="Valutazione" sortKey="rating" />
                                            <SortHeader label="Priorità" sortKey="priority" />
                                            <SortHeader label="Stato" sortKey="status" />
                                            <SortHeader label="AI Fit" sortKey="aiScore" />
                                            <SortHeader label="Score" sortKey="score" />
                                            <th className="p-4 w-10"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-sm divide-y divide-gray-100">
                                        {applicationsForJob.map(app => {
                                            const candidate = data.candidates.find(c => c.id === app.candidateId);
                                            if (!candidate) return null;
                                            const totalScore = app.scorecardResults ? Object.values(app.scorecardResults).reduce((sum: number, v: number) => sum + v, 0) : 0;
                                            const maxScore = selectedJob?.scorecardSchema ? selectedJob.scorecardSchema.categories.reduce((acc, cat) => acc + cat.items.length * 5, 0) : 0;

                                            return (
                                                <tr key={app.id} className="hover:bg-gray-50 transition-colors group" onClick={() => openQuickView(app, candidate)}>
                                                    <td className="p-4 font-bold text-gray-900 flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden border border-gray-200">{candidate.photoUrl || candidate.photo ? <img src={candidate.photoUrl || `data:image/jpeg;base64,${candidate.photo}`} className="w-full h-full object-cover"/> : candidate.fullName.charAt(0)}</div>
                                                        {candidate.fullName}
                                                    </td>
                                                    <td className="p-4 text-gray-600">{candidate.age || '-'}</td>
                                                    <td className="p-4" onClick={e => e.stopPropagation()}>
                                                        <div className="flex">{[1,2,3,4,5].map(star => (<Star key={star} size={14} className={`cursor-pointer transition-colors ${star <= (app.rating || 0) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300 hover:text-yellow-200'}`} onClick={() => handleInlineRatingChange(app.id, star)}/>))}</div>
                                                    </td>
                                                    <td className="p-4" onClick={e => e.stopPropagation()}>
                                                        <select value={app.priority || 'LOW'} onChange={(e) => handleInlinePriorityChange(app.id, e.target.value as any)} className={`text-xs font-bold px-2 py-1 rounded border outline-none cursor-pointer ${app.priority === 'HIGH' ? 'bg-red-100 text-red-700 border-red-200' : app.priority === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                                                            <option value="LOW">LOW</option><option value="MEDIUM">MEDIUM</option><option value="HIGH">HIGH</option>
                                                        </select>
                                                    </td>
                                                    <td className="p-4" onClick={e => e.stopPropagation()}>
                                                        <select value={app.status} onChange={(e) => handleInlineStatusChange(app.id, e.target.value as any)} className={`text-xs font-bold px-2 py-1 rounded border outline-none cursor-pointer ${StatusColors[app.status]}`}>
                                                            {Object.values(SelectionStatus).map(s => (<option key={s} value={s}>{StatusLabels[s]}</option>))}
                                                        </select>
                                                    </td>
                                                    <td className="p-4"><div className={`text-xs font-bold px-2 py-1 rounded inline-flex items-center gap-1 border ${(app.aiScore || 0) >= 80 ? 'bg-green-50 text-green-700 border-green-100' : (app.aiScore || 0) >= 50 ? 'bg-yellow-50 text-yellow-700 border-yellow-100' : 'bg-red-50 text-red-700 border-red-100'}`}><BrainCircuit size={12}/> {app.aiScore}%</div></td>
                                                    <td className="p-4 font-bold text-indigo-700">{totalScore > 0 ? `${totalScore}/${maxScore}` : '-'}</td>
                                                    <td className="p-4"><button onClick={(e) => { e.stopPropagation(); openQuickView(app, candidate, true); }} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"><Eye size={18}/></button></td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* QUICK VIEW OVERLAY */}
            {viewingApp && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-end z-50 backdrop-blur-[2px]" onClick={() => setViewingApp(null)}>
                    <div className={`bg-white h-full shadow-2xl flex flex-col animate-slide-left transition-all duration-300 ${isCvPreviewOpen ? 'w-[95vw] max-w-7xl' : 'w-full max-w-3xl'}`} onClick={e => e.stopPropagation()}>
                        <div className="flex flex-1 overflow-hidden h-full">
                            {/* LEFT DETAILS */}
                            <div className={`flex flex-col h-full border-r border-gray-200 overflow-hidden transition-all duration-300 ${isCvPreviewOpen ? 'w-1/2 min-w-[600px]' : 'w-full'}`}>
                                <div className="p-6 border-b border-gray-100 bg-gray-50 shrink-0">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex items-center gap-4">
                                            <div className="w-16 h-16 rounded-full bg-white border border-gray-200 overflow-hidden shadow-sm flex items-center justify-center cursor-zoom-in hover:ring-2 hover:ring-indigo-400 transition-all" onClick={() => setIsPhotoZoomed(true)}>{viewingApp.candidate.photoUrl || viewingApp.candidate.photo ? <img src={viewingApp.candidate.photoUrl || `data:image/jpeg;base64,${viewingApp.candidate.photo}`} className="w-full h-full object-cover"/> : <span className="text-2xl font-bold text-indigo-600">{viewingApp.candidate.fullName.charAt(0)}</span>}</div>
                                            <div>
                                                <div className="flex items-center gap-3">
                                                    <h2 className="text-2xl font-bold text-gray-900">{viewingApp.candidate.fullName}</h2>
                                                    <select value={viewingApp.app.status} onChange={(e) => handleStatusChange(e.target.value as SelectionStatus)} className={`text-xs font-bold px-2 py-1 rounded border outline-none cursor-pointer uppercase ${StatusColors[viewingApp.app.status]}`}>{Object.values(SelectionStatus).map(s => (<option key={s} value={s}>{StatusLabels[s]}</option>))}</select>
                                                </div>
                                                <div className="flex items-center gap-2 mt-1"><Mail size={12} className="text-gray-400"/> <span className="text-xs text-gray-500">{viewingApp.candidate.email}</span>{viewingApp.candidate.phone && <><Phone size={12} className="text-gray-400 ml-2"/> <span className="text-xs text-gray-500">{viewingApp.candidate.phone}</span></>}</div>
                                            </div>
                                        </div>
                                        <div className="flex gap-2"><button onClick={() => setViewingApp(null)} className="p-2 text-gray-400 hover:text-gray-600"><X size={24}/></button></div>
                                    </div>
                                    <div className="flex justify-between items-center overflow-x-auto custom-scrollbar">
                                        <div className="flex gap-1 border-b border-gray-200 whitespace-nowrap">
                                            {[{id:'info', label:'Informazioni', icon:FileText}, {id:'scorecard', label:'Valutazione', icon:ListChecks}, {id:'processes', label:'Altri Processi', icon:Briefcase}, {id:'comments', label:'Commenti', icon:MessageSquare}].map(tab => (
                                                <button key={tab.id} onClick={() => setQuickViewTab(tab.id as any)} className={`flex items-center gap-2 px-4 py-2 text-sm font-bold uppercase tracking-wide border-b-2 transition-colors ${quickViewTab === tab.id ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>{React.createElement(tab.icon, { size: 14 })} {tab.label}</button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex-1 overflow-y-auto p-6 bg-white custom-scrollbar">
                                    {/* INFO TAB */}
                                    {quickViewTab === 'info' && (
                                        <div className="space-y-6">
                                            {/* ... info content ... */}
                                            {/* ... */}
                                            {/* CV Preview Button */}
                                            {(viewingApp.candidate.cvUrl || viewingApp.candidate.cvFileBase64) && (
                                                <div className="pt-4 border-t border-gray-100">
                                                    <button onClick={() => setIsCvPreviewOpen(!isCvPreviewOpen)} className={`w-full flex items-center justify-center gap-2 p-3 rounded-xl transition-colors border font-medium ${isCvPreviewOpen ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}>
                                                        {isCvPreviewOpen ? <Minimize2 size={18}/> : <Maximize2 size={18}/>} {isCvPreviewOpen ? 'Chiudi Anteprima' : 'Apri Anteprima CV'}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* ... other tabs ... */}
                                    {quickViewTab === 'scorecard' && (
                                        <div className="space-y-6">
                                            {/* ... scorecard content ... */}
                                            {!selectedJob?.scorecardSchema ? (
                                                <div className="text-center py-10 text-gray-400 border-2 border-dashed border-gray-100 rounded-xl"><ListChecks size={32} className="mx-auto mb-2 opacity-50"/>Nessuna scheda di valutazione configurata per questa posizione.</div>
                                            ) : (
                                                <>
                                                {/* ... Scorecard rendering ... */}
                                                <div className="flex justify-between items-end bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                                                    <div><h4 className="text-indigo-900 font-bold text-lg">Punteggio Totale</h4><p className="text-indigo-600 text-xs">Somma delle valutazioni</p></div>
                                                    <div className="text-3xl font-bold text-indigo-700">
                                                        {Object.values(viewingApp.app.scorecardResults || {}).reduce((a: number, b: number) => a + b, 0)}
                                                        <span className="text-sm text-indigo-400 font-medium"> / {selectedJob.scorecardSchema.categories.reduce((acc, cat) => acc + cat.items.length * 5, 0)}</span>
                                                    </div>
                                                </div>
                                                <div className="space-y-6">
                                                    {selectedJob.scorecardSchema.categories.map(cat => (
                                                        <div key={cat.id}>
                                                            <h5 className="text-xs font-bold text-gray-400 uppercase mb-3 tracking-wider border-b border-gray-100 pb-1">{cat.name}</h5>
                                                            <div className="space-y-3">
                                                                {cat.items.map(item => {
                                                                    const currentScore = viewingApp.app.scorecardResults?.[item.id] || 0;
                                                                    return (
                                                                        <div key={item.id} className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                                                                            <div className="flex justify-between items-center mb-2"><span className="text-sm font-medium text-gray-800">{item.label}</span><span className="text-xs font-bold text-indigo-600">{currentScore > 0 ? currentScore : '-'}</span></div>
                                                                            <div className="flex gap-1">
                                                                                {[1,2,3,4,5].map(v => (
                                                                                    <button key={v} onClick={() => handleScorecardVote(item.id, v)} className={`flex-1 h-8 rounded text-xs font-bold transition-all ${currentScore === v ? 'bg-indigo-600 text-white shadow-md scale-105' : 'bg-white border border-gray-200 text-gray-400 hover:border-indigo-300'}`}>{v}</button>
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                                </>
                                            )}
                                        </div>
                                    )}

                                    {quickViewTab === 'processes' && (
                                        <div className="space-y-4">
                                            <h4 className="text-xs font-bold text-gray-400 uppercase mb-3">Altre Candidature</h4>
                                            {data.applications.filter(a => a.candidateId === viewingApp.candidate.id && a.id !== viewingApp.app.id).length === 0 ? (
                                                <p className="text-gray-400 text-sm italic">Nessun'altra candidatura attiva.</p>
                                            ) : (
                                                data.applications.filter(a => a.candidateId === viewingApp.candidate.id && a.id !== viewingApp.app.id).map(app => {
                                                    const job = data.jobs.find(j => j.id === app.jobId);
                                                    return (
                                                        <div key={app.id} className="border border-gray-200 rounded-xl p-4 bg-gray-50">
                                                            <div className="flex justify-between items-start mb-2"><h5 className="font-bold text-gray-900">{job?.title}</h5><span className={`text-[10px] px-2 py-0.5 rounded border ${StatusColors[app.status]}`}>{StatusLabels[app.status]}</span></div>
                                                            <p className="text-xs text-gray-500">{job?.department}</p>
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    )}

                                    {quickViewTab === 'comments' && (
                                        <div className="flex flex-col h-full">
                                            <div className="flex-1 space-y-4 mb-6">
                                                {!viewingApp.candidate.comments || viewingApp.candidate.comments.length === 0 ? <p className="text-center text-gray-400 text-sm py-8 italic">Nessun commento.</p> : viewingApp.candidate.comments.map((comment) => (<div key={comment.id} className="bg-gray-50 p-3 rounded-xl rounded-tl-none border border-gray-100 ml-2"><div className="flex items-center justify-between mb-1"><span className="text-xs font-bold text-gray-900">{comment.authorName}</span><span className="text-[10px] text-gray-400 flex items-center gap-1"><Clock size={10}/> {new Date(comment.createdAt).toLocaleDateString()}</span></div><p className="text-sm text-gray-900">{comment.text}</p></div>))}
                                            </div>
                                            <div className="relative mt-auto pt-4 border-t border-gray-100">
                                                <textarea className="text-gray-900 w-full bg-white border border-gray-200 rounded-xl p-3 pr-12 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none" rows={3} placeholder="Scrivi una nota... (Ctrl+Enter per inviare)" value={newComment} onChange={e => setNewComment(e.target.value)} onKeyDown={handleCommentKeyDown} />
                                                <button onClick={handleAddComment} disabled={!newComment.trim()} className="absolute right-3 bottom-3 p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"><Send size={16} /></button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* RIGHT PREVIEW */}
                            {isCvPreviewOpen && (viewingApp.candidate.cvUrl || viewingApp.candidate.cvFileBase64) && viewingApp.candidate.cvMimeType && (
                                <div className="flex-1 bg-gray-100 h-full flex flex-col overflow-hidden relative border-l border-gray-200">
                                    <div className="p-3 bg-white border-b border-gray-200 flex justify-between items-center shadow-sm z-10">
                                        <span className="text-sm font-bold text-gray-700 flex items-center gap-2"><FileText size={16}/> Anteprima Documento</span>
                                        <button onClick={() => setIsCvPreviewOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
                                    </div>
                                    <div className="flex-1 relative overflow-hidden">
                                        <PdfPreview url={viewingApp.candidate.cvUrl} base64={viewingApp.candidate.cvFileBase64} mimeType={viewingApp.candidate.cvMimeType} />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
            {/* ... other modals ... */}
        </div>
    );
};
