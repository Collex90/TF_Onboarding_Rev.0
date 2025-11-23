
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { AppState, JobPosition, SelectionStatus, StatusLabels, StatusColors, Candidate, Application, User, Comment, UserRole, EmailTemplate, ScorecardSchema, ScorecardCategory, ScorecardTemplate, OnboardingProcess, OnboardingTask, OnboardingPhase, OnboardingPhaseLabels } from '../types';
import { Plus, ChevronRight, Sparkles, BrainCircuit, Search, GripVertical, UploadCloud, X, Loader2, CheckCircle, AlertTriangle, FileText, Star, Flag, Calendar, Download, Phone, Briefcase, MessageSquare, Clock, Send, Building, Banknote, Maximize2, Minimize2, Eye, ZoomIn, ZoomOut, Mail, LayoutGrid, Kanban, UserPlus, ArrowRight, CheckSquare, Square, ChevronUp, ChevronDown, Edit, Shield, Users, Trash2, Copy, BarChart2, ListChecks, Ruler, Circle, Save, Filter, Settings } from 'lucide-react';
import { addJob, createApplication, updateApplicationStatus, updateApplicationAiScore, generateId, addCandidate, updateApplicationMetadata, addCandidateComment, updateCandidate, updateJob, getAllUsers, getEmailTemplates, updateApplicationScorecard, saveScorecardTemplate, getScorecardTemplates, deleteScorecardTemplate, updateScorecardTemplate, createOnboardingProcess } from '../services/storage';
import { evaluateFit, generateJobDetails, generateScorecardSchema, generateOnboardingChecklist } from '../services/ai';
import { OnboardingSetupModal } from './OnboardingSetupModal';

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

const PdfPreview: React.FC<{ base64: string; mimeType: string }> = ({ base64, mimeType }) => {
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
                const binaryString = window.atob(base64);
                const len = binaryString.length;
                const bytes = new Uint8Array(len);
                for (let i = 0; i < len; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                const pdfjs = (window as any).pdfjsLib;
                if (!pdfjs) throw new Error("PDF Lib not found");
                const pdf = await pdfjs.getDocument({ data: bytes }).promise;
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
    }, [base64, mimeType]);

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
                        <img src={`data:${mimeType};base64,${base64}`} className="shadow-lg rounded bg-white transition-all duration-75 ease-linear block" style={{ width: imgDimensions.width ? `${imgDimensions.width * scale}px` : 'auto', maxWidth: 'none' }} onLoad={(e) => setImgDimensions({ width: e.currentTarget.naturalWidth, height: e.currentTarget.naturalHeight })} alt="Preview" />
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
    // ... (Keep all existing state and logic exactly as is)
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

    // SCORECARD TEMPLATES STATE
    const [isSaveTemplateModalOpen, setIsSaveTemplateModalOpen] = useState(false);
    const [isLoadTemplateModalOpen, setIsLoadTemplateModalOpen] = useState(false);
    const [templateName, setTemplateName] = useState('');
    const [templates, setTemplates] = useState<ScorecardTemplate[]>([]);
    
    // TEMPLATE MANAGER
    const [isTemplateManagerOpen, setIsTemplateManagerOpen] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<ScorecardTemplate | null>(null);
    const [isTemplateEditorOpen, setIsTemplateEditorOpen] = useState(false);

    // COMPARISON MATRIX
    const [isComparisonModalOpen, setIsComparisonModalOpen] = useState(false);
    const [matrixSelectedCandidateIds, setMatrixSelectedCandidateIds] = useState<Set<string>>(new Set());
    const [isMatrixCandidateFilterOpen, setIsMatrixCandidateFilterOpen] = useState(false);
    const [matrixStatusFilter, setMatrixStatusFilter] = useState<SelectionStatus[]>([]);

    // ONBOARDING SETUP MODAL (REPLACES OLD ONE)
    const [isSetupModalOpen, setIsSetupModalOpen] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // ... (Keep existing useEffects)
    useEffect(() => { if (!viewingApp) { setIsCvPreviewOpen(false); setIsPhotoZoomed(false); } }, [viewingApp]);
    useEffect(() => { if (isAssociateModalOpen) { setSelectedAssociateIds(new Set()); setAssociateSearch(''); } }, [isAssociateModalOpen]);
    useEffect(() => { if (isJobModalOpen && (currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.HR)) { getAllUsers().then(setAvailableUsers); } }, [isJobModalOpen, currentUser]);
    useEffect(() => { if (isTemplateManagerOpen || isLoadTemplateModalOpen) { getScorecardTemplates().then(setTemplates); } }, [isTemplateManagerOpen, isLoadTemplateModalOpen]);

    // ... (Keep all existing handlers)
    const openCreateJobModal = () => { setEditingJobId(null); setJobForm({ title: '', department: '', description: '', requirements: '', status: 'OPEN', scorecardSchema: undefined }); setAssignedTeamMembers([]); setIsJobModalOpen(true); };
    const openEditJobModal = (job: JobPosition) => { setEditingJobId(job.id); setJobForm({ title: job.title, department: job.department, description: job.description, requirements: job.requirements, status: job.status, scorecardSchema: job.scorecardSchema }); setAssignedTeamMembers(job.assignedTeamMembers || []); setIsJobModalOpen(true); };
    const handleAddCategory = () => { setJobForm(prev => ({ ...prev, scorecardSchema: { categories: [ ...(prev.scorecardSchema?.categories || []), { id: generateId(), name: 'Nuova Categoria', items: [] } ] } })); };
    const handleDeleteCategory = (catId: string) => { setJobForm(prev => ({ ...prev, scorecardSchema: { categories: (prev.scorecardSchema?.categories || []).filter(c => c.id !== catId) } })); };
    const handleUpdateCategoryName = (catId: string, newName: string) => { setJobForm(prev => ({ ...prev, scorecardSchema: { categories: (prev.scorecardSchema?.categories || []).map(c => c.id === catId ? { ...c, name: newName } : c) } })); };
    const handleAddItem = (catId: string) => { setJobForm(prev => ({ ...prev, scorecardSchema: { categories: (prev.scorecardSchema?.categories || []).map(c => c.id === catId ? { ...c, items: [...c.items, { id: generateId(), label: 'Nuova Voce' }] } : c) } })); };
    const handleDeleteItem = (catId: string, itemId: string) => { setJobForm(prev => ({ ...prev, scorecardSchema: { categories: (prev.scorecardSchema?.categories || []).map(c => c.id === catId ? { ...c, items: c.items.filter(i => i.id !== itemId) } : c) } })); };
    const handleUpdateItemLabel = (catId: string, itemId: string, newLabel: string) => { setJobForm(prev => ({ ...prev, scorecardSchema: { categories: (prev.scorecardSchema?.categories || []).map(c => c.id === catId ? { ...c, items: c.items.map(i => i.id === itemId ? { ...i, label: newLabel } : i) } : c) } })); };
    const handleSaveJob = (e: React.FormEvent) => { e.preventDefault(); const commonData = { ...jobForm, assignedTeamMembers: assignedTeamMembers }; if (editingJobId) { const updatedJob: JobPosition = { ...data.jobs.find(j => j.id === editingJobId)!, ...commonData }; updateJob(updatedJob); } else { const newJob: JobPosition = { id: generateId(), ...commonData, createdAt: Date.now() }; addJob(newJob); } refreshData(); setIsJobModalOpen(false); };
    const handleGenerateJobAI = async () => { if (!jobForm.title || !jobForm.department) { alert("Inserisci Titolo e Dipartimento."); return; } setIsGeneratingJob(true); try { const details = await generateJobDetails(jobForm.title, jobForm.department); setJobForm(prev => ({ ...prev, description: details.description, requirements: details.requirements })); } catch (e) { alert("Errore AI: impossibile generare dettagli."); } finally { setIsGeneratingJob(false); } };
    const handleGenerateScorecardAI = async () => { if (!jobForm.title || !jobForm.description) { alert("Inserisci Titolo e Descrizione prima di generare la scheda."); return; } setIsGeneratingScorecard(true); try { const schema = await generateScorecardSchema(jobForm.title, jobForm.description); setJobForm(prev => ({ ...prev, scorecardSchema: schema })); } catch(e) { alert("Errore AI Scorecard."); } finally { setIsGeneratingScorecard(false); } };
    const handleOpenSaveTemplate = () => { if (!jobForm.scorecardSchema?.categories.length) { alert("La scheda è vuota. Aggiungi categorie prima di salvare."); return; } setTemplateName(''); setIsSaveTemplateModalOpen(true); };
    const handleConfirmSaveTemplate = async () => { if (!templateName.trim() || !jobForm.scorecardSchema) return; await saveScorecardTemplate(templateName, jobForm.scorecardSchema); setIsSaveTemplateModalOpen(false); };
    const handleOpenLoadTemplate = async () => { const tmpls = await getScorecardTemplates(); setTemplates(tmpls); setIsLoadTemplateModalOpen(true); };
    const handleLoadTemplate = (template: ScorecardTemplate) => { setJobForm(prev => ({ ...prev, scorecardSchema: template.schema })); setIsLoadTemplateModalOpen(false); };
    const handleDeleteTemplate = async (id: string) => { if (confirm("Eliminare questo modello definitivamente?")) { await deleteScorecardTemplate(id); setTemplates(prev => prev.filter(t => t.id !== id)); } };
    const openNewTemplate = () => { setEditingTemplate({ id: generateId(), name: 'Nuovo Modello', schema: { categories: [] }, createdAt: Date.now() }); setIsTemplateEditorOpen(true); };
    const openEditTemplate = (t: ScorecardTemplate) => { setEditingTemplate({ ...t }); setIsTemplateEditorOpen(true); };
    const saveEditedTemplate = async () => { if (!editingTemplate || !editingTemplate.name) return; if (templates.find(t => t.id === editingTemplate.id)) { await updateScorecardTemplate(editingTemplate); } else { await saveScorecardTemplate(editingTemplate.name, editingTemplate.schema); } getScorecardTemplates().then(setTemplates); setIsTemplateEditorOpen(false); };
    const handleTemplateAddCategory = () => { setEditingTemplate(prev => prev ? { ...prev, schema: { categories: [...prev.schema.categories, { id: generateId(), name: 'Nuova Categoria', items: [] }] } } : null); };
    const handleTemplateDeleteCategory = (id: string) => { setEditingTemplate(prev => prev ? { ...prev, schema: { categories: prev.schema.categories.filter(c => c.id !== id) } } : null); };
    const handleTemplateUpdateCategory = (id: string, name: string) => { setEditingTemplate(prev => prev ? { ...prev, schema: { categories: prev.schema.categories.map(c => c.id === id ? { ...c, name } : c) } } : null); };
    const handleTemplateAddItem = (catId: string) => { setEditingTemplate(prev => prev ? { ...prev, schema: { categories: prev.schema.categories.map(c => c.id === catId ? { ...c, items: [...c.items, { id: generateId(), label: 'Nuova Voce' }] } : c) } } : null); };
    const handleTemplateDeleteItem = (catId: string, itemId: string) => { setEditingTemplate(prev => prev ? { ...prev, schema: { categories: prev.schema.categories.map(c => c.id === catId ? { ...c, items: c.items.filter(i => i.id !== itemId) } : c) } } : null); };
    const handleTemplateUpdateItem = (catId: string, itemId: string, label: string) => { setEditingTemplate(prev => prev ? { ...prev, schema: { categories: prev.schema.categories.map(c => c.id === catId ? { ...c, items: c.items.map(i => i.id === itemId ? { ...i, label } : i) } : c) } } : null); };
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
    const handleAddComment = async () => { if (!viewingApp || !newComment.trim() || !currentUser) return; const comment: Comment = { id: generateId(), text: newComment, authorName: currentUser.name, authorAvatar: currentUser.avatar, createdAt: Date.now() }; await addCandidateComment(viewingApp.candidate.id, comment); setViewingApp(prev => prev ? { ...prev, candidate: { ...prev.candidate, comments: [...(prev.candidate.comments || []), comment] } } : null); setNewComment(''); refreshData(); };
    const handleCommentKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); handleAddComment(); } };
    const handleScorecardVote = async (itemId: string, score: number) => { if (!viewingApp) return; const currentResults = viewingApp.app.scorecardResults || {}; const newResults = { ...currentResults, [itemId]: score }; await updateApplicationScorecard(viewingApp.app.id, newResults); setViewingApp(prev => prev ? { ...prev, app: { ...prev.app, scorecardResults: newResults } } : null); refreshData(); };
    const openEmailModal = () => { if (!viewingApp) return; const tmpl = emailTemplates[0]; setSelectedTemplateId(tmpl.id); updateEmailContent(tmpl.id); setIsEmailModalOpen(true); };
    const updateEmailContent = (tmplId: string) => { const tmpl = emailTemplates.find(t => t.id === tmplId); if (!tmpl || !viewingApp) return; const job = data.jobs.find(j => j.id === viewingApp.app.jobId); const candidateName = viewingApp.candidate.fullName; const jobTitle = job?.title || 'Posizione'; let subj = tmpl.subject.replace('{candidateName}', candidateName).replace('{jobTitle}', jobTitle); let body = tmpl.body.replace('{candidateName}', candidateName).replace('{jobTitle}', jobTitle); setEmailSubject(subj); setEmailBody(body); };
    const handleTemplateChange = (id: string) => { setSelectedTemplateId(id); updateEmailContent(id); };
    const handleSendEmail = () => { if (!viewingApp) return; const mailtoLink = `mailto:${viewingApp.candidate.email}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`; window.location.href = mailtoLink; setIsEmailModalOpen(false); };

    // --- ONBOARDING HANDLERS ---
    const hasOnboarding = useMemo(() => {
        if (!viewingApp) return false;
        return data.onboarding.some(o => o.candidateId === viewingApp.candidate.id && o.jobId === viewingApp.app.jobId);
    }, [viewingApp, data.onboarding]);

    const handleStartOnboarding = () => {
        if (!viewingApp) return;
        setIsSetupModalOpen(true);
    };

    // ... (Keep RadarChart and Matrix Logic)
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

    // ... (Keep filtering logic)
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
    
    const SortHeader = ({ label, sortKey }: { label: string, sortKey: string }) => ( <th className="p-4 font-semibold cursor-pointer hover:bg-gray-100 transition-colors group select-none" onClick={() => handleSort(sortKey)}> <div className="flex items-center gap-1">{label}<div className="flex flex-col"><ChevronUp size={10} className={sortConfig?.key === sortKey && sortConfig.direction === 'asc' ? 'text-indigo-600' : 'text-gray-300'} /><ChevronDown size={10} className={sortConfig?.key === sortKey && sortConfig.direction === 'desc' ? 'text-indigo-600' : 'text-gray-300'}</div></div> </th> );

    // Matrix candidates
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
                        const totalScore = app.scorecardResults ? (Object.values(app.scorecardResults) as number[]).reduce((sum: number, v: number) => sum + v, 0) : 0;
                        const maxScore = selectedJob?.scorecardSchema ? selectedJob.scorecardSchema.categories.reduce((acc, cat) => acc + cat.items.length * 5, 0) : 0;

                        return (
                            <div key={app.id} draggable onDragStart={(e) => handleDragStart(e, app.id)} onClick={() => openQuickView(app, candidate)} className={`bg-white p-4 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-all cursor-pointer active:cursor-grabbing relative group ${isDragging ? 'opacity-50 scale-95 ring-2 ring-indigo-400' : ''}`}>
                                {priorityColor && <div className={`absolute top-2 right-2 text-[10px] font-bold px-1.5 py-0.5 rounded border ${priorityColor}`}>{app.priority}</div>}
                                <div className="flex justify-between items-start mb-2 pr-8"><div className="flex items-center gap-2 min-w-0"><GripVertical size={14} className="text-gray-300 shrink-0" /><div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0 overflow-hidden border border-gray-200 hover:ring-2 hover:ring-indigo-200 transition-all" onClick={(e) => { e.stopPropagation(); setViewingApp({ app, candidate }); setIsPhotoZoomed(true); }}>{candidate.photo ? <img src={`data:image/jpeg;base64,${candidate.photo}`} className="w-full h-full object-cover" /> : <span className="text-xs font-bold text-indigo-600">{candidate.fullName.charAt(0)}</span>}</div><h5 className="font-bold text-gray-800 truncate text-sm">{candidate.fullName}</h5></div></div>
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

    if (!selectedJobId) {
        // ... (Keep existing Job Selection View)
        return (
            <div className="p-8 h-full overflow-y-auto">
                <div className="flex justify-between items-start mb-8 gap-4 flex-wrap">
                    <div><h2 className="text-2xl font-bold text-gray-900">Posizioni Aperte</h2><p className="text-gray-500">Seleziona una posizione per gestire la pipeline.</p></div>
                    <div className="flex items-center gap-3 flex-1 max-w-xl justify-end">
                        <div className="relative flex-1 max-w-md"><Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} /><input type="text" placeholder="Cerca posizioni o candidati..." className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-full focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm transition-shadow text-gray-900" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>
                        {(currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.HR) && (
                            <>
                                <button onClick={() => setIsTemplateManagerOpen(true)} className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 px-4 py-2.5 rounded-lg flex items-center gap-2 shadow-sm shrink-0 font-medium transition-colors"><ListChecks size={20}/> Libreria Modelli</button>
                                <button onClick={openCreateJobModal} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg flex items-center gap-2 shadow-sm shrink-0 font-medium transition-colors"><Plus size={20} /> Nuova</button>
                            </>
                        )}
                    </div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {filteredJobs.map(job => {
                        const jobApps = data.applications.filter(a => a.jobId === job.id);
                        const activeCount = jobApps.filter(a => a.status !== SelectionStatus.HIRED && a.status !== SelectionStatus.REJECTED).length;
                        const hiredCount = jobApps.filter(a => a.status === SelectionStatus.HIRED).length;
                        const rejectedCount = jobApps.filter(a => a.status === SelectionStatus.REJECTED).length;
                        const isAssigned = job.assignedTeamMembers?.includes(currentUser?.uid || '');
                        return (
                            <div key={job.id} onClick={() => setSelectedJobId(job.id)} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:border-indigo-200 hover:shadow-md cursor-pointer transition-all group flex flex-col relative">
                                {currentUser?.role === UserRole.TEAM && isAssigned && (<div className="absolute top-6 right-6 text-[10px] bg-indigo-50 text-indigo-600 px-2 py-1 rounded-full font-bold flex items-center gap-1 border border-indigo-100"><Shield size={10}/> ASSEGNATO</div>)}
                                <div className="flex justify-between items-start mb-2 pr-20"><h3 className="text-xl font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">{job.title}</h3><span className={`text-xs px-2 py-1 rounded-full font-medium ${job.status === 'OPEN' ? 'bg-green-100 text-green-800' : job.status === 'COMPLETED' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-700'}`}>{job.status}</span></div>
                                <p className="text-gray-500 text-sm mb-4">{job.department}</p>
                                <div className="mt-auto flex justify-between items-center text-sm pt-4 border-t border-gray-50"><div className="flex gap-4 text-xs"><span className="font-bold text-gray-700">{activeCount} <span className="text-gray-400 font-normal">Attivi</span></span><span className="font-bold text-green-700">{hiredCount} <span className="text-gray-400 font-normal">Assunti</span></span><span className="font-bold text-red-700">{rejectedCount} <span className="text-gray-400 font-normal">Scartati</span></span></div><div className="flex gap-2">{(currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.HR) && (<button onClick={(e) => { e.stopPropagation(); openEditJobModal(job); }} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"><Edit size={16}/></button>)}<span className="flex items-center gap-1 text-indigo-600 font-medium">Gestisci <ChevronRight size={16} /></span></div></div>
                            </div>
                        );
                    })}
                </div>
                
                {/* JOB MODAL (Kept existing) */}
                {isJobModalOpen && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
                         {/* ... Existing Modal Content ... (Shortened for clarity, use existing from previous files) */}
                         <div className="bg-white rounded-xl p-6 w-full max-w-4xl m-4 shadow-2xl max-h-[90vh] overflow-y-auto">
                             <div className="flex justify-between items-center mb-6"><h3 className="text-xl font-bold text-gray-900">{editingJobId ? 'Modifica Posizione' : 'Nuova Posizione'}</h3><button onClick={() => setIsJobModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={24} /></button></div>
                            <form onSubmit={handleSaveJob} className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-4">
                                        <div><label className="block text-sm font-medium text-gray-700 mb-1">Titolo Posizione</label><input required value={jobForm.title} onChange={e => setJobForm({...jobForm, title: e.target.value})} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-gray-900" placeholder="es. Senior React Dev" /></div>
                                        <div><label className="block text-sm font-medium text-gray-700 mb-1">Dipartimento</label><input required value={jobForm.department} onChange={e => setJobForm({...jobForm, department: e.target.value})} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-gray-900" placeholder="es. Engineering" /></div>
                                        {editingJobId && (<div><label className="block text-sm font-medium text-gray-700 mb-1">Stato</label><select value={jobForm.status} onChange={(e) => setJobForm({...jobForm, status: e.target.value as any})} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-gray-900"><option value="OPEN">APERTA</option><option value="SUSPENDED">SOSPESA</option><option value="COMPLETED">COMPLETATA</option><option value="CLOSED">CHIUSA</option></select></div>)}
                                        <div><label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2"><Users size={16} className="text-indigo-600"/> Assegna Team</label><div className="border border-gray-300 rounded-lg max-h-40 overflow-y-auto p-2 bg-white custom-scrollbar">{availableUsers.length === 0 ? <p className="text-xs text-gray-400 text-center py-2">Nessun utente disponibile</p> : availableUsers.map(u => (<div key={u.uid} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer" onClick={() => { const has = assignedTeamMembers.includes(u.uid || ''); setAssignedTeamMembers(prev => has ? prev.filter(id => id !== u.uid) : [...prev, u.uid || '']); }}><div className={`w-4 h-4 border rounded flex items-center justify-center ${assignedTeamMembers.includes(u.uid || '') ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300 bg-white'}`}>{assignedTeamMembers.includes(u.uid || '') && <CheckSquare size={12} className="text-white"/>}</div><span className="text-sm text-gray-800">{u.name} <span className="text-xs text-gray-400">({u.role})</span></span></div>))}</div></div>
                                         <div className="pt-2"><button type="button" onClick={handleGenerateJobAI} disabled={isGeneratingJob || !jobForm.title || !jobForm.department} className="w-full text-sm font-medium text-indigo-600 hover:bg-indigo-50 px-3 py-2 rounded-lg border border-indigo-100 flex items-center justify-center gap-2 transition-colors disabled:opacity-50">{isGeneratingJob ? <Loader2 size={14} className="animate-spin"/> : <Sparkles size={14}/>} Genera Descrizione con AI</button></div>
                                    </div>
                                    <div className="space-y-4"><div><label className="block text-sm font-medium text-gray-700 mb-1">Descrizione</label><textarea required rows={6} value={jobForm.description} onChange={e => setJobForm({...jobForm, description: e.target.value})} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-gray-900" placeholder="Descrizione del ruolo..." /></div><div><label className="block text-sm font-medium text-gray-700 mb-1">Requisiti</label><textarea required rows={6} value={jobForm.requirements} onChange={e => setJobForm({...jobForm, requirements: e.target.value})} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-gray-900" placeholder="Lista requisiti..." /></div></div>
                                </div>
                                <div className="border-t border-gray-100 pt-6">
                                    <div className="flex justify-between items-center mb-4"><h4 className="text-lg font-bold text-gray-900 flex items-center gap-2"><ListChecks size={20} className="text-indigo-600"/> Scheda di Valutazione</h4><div className="flex gap-2"><button type="button" onClick={handleOpenLoadTemplate} className="text-xs font-medium bg-white text-gray-600 border border-gray-300 hover:bg-gray-50 px-3 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-sm"><Download size={14}/> Carica Modello</button><button type="button" onClick={handleOpenSaveTemplate} className="text-xs font-medium bg-white text-gray-600 border border-gray-300 hover:bg-gray-50 px-3 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-sm"><Save size={14}/> Salva Modello</button><button type="button" onClick={handleGenerateScorecardAI} disabled={isGeneratingScorecard} className="text-xs font-medium text-indigo-600 hover:bg-indigo-50 px-3 py-2 rounded-lg border border-indigo-100 flex items-center gap-2 transition-colors disabled:opacity-50">{isGeneratingScorecard ? <Loader2 size={14} className="animate-spin"/> : <Sparkles size={14}/>} Genera con AI</button></div></div>
                                    <div className="space-y-4">
                                        {jobForm.scorecardSchema?.categories.map(cat => (
                                            <div key={cat.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                                                <div className="flex justify-between items-center mb-3"><input value={cat.name} onChange={(e) => handleUpdateCategoryName(cat.id, e.target.value)} className="font-bold text-gray-800 bg-white border border-gray-300 rounded px-2 py-1 text-sm w-1/2 focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Nome Categoria" /><button type="button" onClick={() => handleDeleteCategory(cat.id)} className="text-red-400 hover:text-red-600"><Trash2 size={16} /></button></div>
                                                <div className="space-y-2 pl-4">{cat.items.map(item => (<div key={item.id} className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-indigo-400 rounded-full shrink-0"></div><input value={item.label} onChange={(e) => handleUpdateItemLabel(cat.id, item.id, e.target.value)} className="flex-1 text-sm bg-white border border-gray-300 rounded px-2 py-1 text-gray-700 focus:ring-2 focus:ring-indigo-500 outline-none" /><button type="button" onClick={() => handleDeleteItem(cat.id, item.id)} className="text-gray-400 hover:text-red-500"><X size={14} /></button></div>))}<button type="button" onClick={() => handleAddItem(cat.id)} className="text-xs text-indigo-600 font-medium hover:underline flex items-center gap-1 mt-2"><Plus size={12} /> Aggiungi Voce</button></div>
                                            </div>
                                        ))}<button type="button" onClick={handleAddCategory} className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 font-medium text-sm hover:border-indigo-400 hover:text-indigo-600 transition-colors flex items-center justify-center gap-2"><Plus size={16} /> Aggiungi Categoria</button>
                                    </div>
                                </div>
                                <div className="flex justify-end gap-3 pt-6 border-t border-gray-100"><button type="button" onClick={() => setIsJobModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Annulla</button><button type="submit" className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-sm">{editingJobId ? 'Aggiorna' : 'Crea Posizione'}</button></div>
                            </form>
                         </div>
                    </div>
                )}
                {/* Template modals */}
                {isTemplateManagerOpen && <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm"><div className="bg-white rounded-xl p-6 w-full max-w-3xl m-4 shadow-2xl max-h-[80vh] flex flex-col"><div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4"><div className="flex items-center gap-3"><div className="bg-indigo-50 p-2 rounded-lg text-indigo-600"><ListChecks size={24}/></div><div><h3 className="text-xl font-bold text-gray-900">Libreria Modelli</h3><p className="text-sm text-gray-500">Gestisci i template di valutazione.</p></div></div><button onClick={() => setIsTemplateManagerOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={24}/></button></div><div className="flex justify-between mb-4"><div className="text-sm text-gray-500">Totale modelli: <b>{templates.length}</b></div><button onClick={openNewTemplate} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700 flex items-center gap-2"><Plus size={16}/> Nuovo Modello</button></div><div className="flex-1 overflow-y-auto custom-scrollbar space-y-3">{templates.length === 0 ? (<div className="text-center py-10 bg-gray-50 rounded-xl border border-dashed border-gray-200 text-gray-400"><p>Nessun modello salvato.</p></div>) : (templates.map(t => (<div key={t.id} className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl hover:shadow-md transition-shadow"><div><h4 className="font-bold text-gray-900">{t.name}</h4><div className="flex gap-3 text-xs text-gray-500 mt-1"><span>{new Date(t.createdAt).toLocaleDateString()}</span><span>•</span><span>{t.schema.categories.length} Categorie</span></div></div><div className="flex gap-2"><button onClick={() => openEditTemplate(t)} className="p-2 text-gray-500 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg"><Edit size={18}/></button><button onClick={() => handleDeleteTemplate(t.id)} className="p-2 text-gray-500 hover:bg-red-50 hover:text-red-600 rounded-lg"><Trash2 size={18}/></button></div></div>)))}</div></div></div>}
                {isTemplateEditorOpen && editingTemplate && <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] backdrop-blur-sm"><div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] m-4 shadow-2xl flex flex-col"><div className="p-6 border-b border-gray-100 flex justify-between items-center"><input value={editingTemplate.name} onChange={(e) => setEditingTemplate({...editingTemplate, name: e.target.value})} className="text-xl font-bold text-gray-900 border-b border-transparent hover:border-gray-300 focus:border-indigo-500 outline-none bg-white w-full mr-4" placeholder="Nome Modello..." /><button onClick={() => setIsTemplateEditorOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={24}/></button></div><div className="p-6 flex-1 overflow-y-auto bg-gray-50 custom-scrollbar space-y-4">{editingTemplate.schema.categories.map(cat => (<div key={cat.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm"><div className="flex justify-between items-center mb-3"><input value={cat.name} onChange={(e) => handleTemplateUpdateCategory(cat.id, e.target.value)} className="font-bold text-gray-800 bg-white border border-gray-300 rounded px-2 py-1 text-sm w-2/3 focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Nome Categoria"/><button onClick={() => handleTemplateDeleteCategory(cat.id)} className="text-red-400 hover:text-red-600"><Trash2 size={16}/></button></div><div className="space-y-2 pl-4 border-l-2 border-gray-100">{cat.items.map(item => (<div key={item.id} className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-indigo-400 rounded-full shrink-0"></div><input value={item.label} onChange={(e) => handleTemplateUpdateItem(cat.id, item.id, e.target.value)} className="flex-1 text-sm bg-white border border-gray-300 rounded px-2 py-1 text-gray-700 focus:ring-2 focus:ring-indigo-500 outline-none" /><button onClick={() => handleTemplateDeleteItem(cat.id, item.id)} className="text-gray-300 hover:text-red-500"><X size={14}/></button></div>))}<button onClick={() => handleTemplateAddItem(cat.id)} className="text-xs text-indigo-600 font-medium hover:underline flex items-center gap-1 mt-2"><Plus size={12}/> Aggiungi Voce</button></div></div>))}<button onClick={handleTemplateAddCategory} className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 font-bold hover:border-indigo-400 hover:text-indigo-600 transition-colors flex items-center justify-center gap-2 bg-white"><Plus size={18}/> Aggiungi Categoria</button></div><div className="p-4 border-t border-gray-100 bg-white rounded-b-xl flex justify-end gap-3"><button onClick={() => setIsTemplateEditorOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium">Annulla</button><button onClick={saveEditedTemplate} className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200">Salva Modello</button></div></div></div>}
                {isSaveTemplateModalOpen && <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] backdrop-blur-sm"><div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl"><h3 className="text-lg font-bold mb-4">Salva come Modello</h3><input value={templateName} onChange={e => setTemplateName(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg mb-4 outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Nome del modello (es. Standard Sales)..." autoFocus /><div className="flex justify-end gap-2"><button onClick={() => setIsSaveTemplateModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Annulla</button><button onClick={handleConfirmSaveTemplate} disabled={!templateName.trim()} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">Salva</button></div></div></div>}
                {isLoadTemplateModalOpen && <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] backdrop-blur-sm"><div className="bg-white rounded-xl p-6 w-full max-w-2xl shadow-2xl max-h-[80vh] flex flex-col"><div className="flex justify-between mb-4"><h3 className="text-lg font-bold">Carica Modello</h3><button onClick={() => setIsLoadTemplateModalOpen(false)}><X size={20} className="text-gray-400"/></button></div><div className="flex-1 overflow-y-auto custom-scrollbar space-y-2">{templates.length === 0 ? <p className="text-center text-gray-400 py-8">Nessun modello salvato.</p> : templates.map(t => (<div key={t.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-indigo-50 hover:border-indigo-200 cursor-pointer group transition-colors" onClick={() => handleLoadTemplate(t)}><div><div className="font-bold text-gray-800">{t.name}</div><div className="text-xs text-gray-500">{t.schema.categories.length} categorie</div></div><button onClick={(e) => { e.stopPropagation(); handleDeleteTemplate(t.id); }} className="p-2 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100"><Trash2 size={16}/></button></div>))}</div></div></div>}
            </div>
        );
    }

    // MAIN VIEW (When Job Selected)
    return (
        <div className="h-full flex flex-col bg-gray-50">
            {/* TOOLBAR */}
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
                                            const totalScore = app.scorecardResults ? (Object.values(app.scorecardResults) as number[]).reduce((sum: number, v: number) => sum + v, 0) : 0;
                                            const maxScore = selectedJob?.scorecardSchema ? selectedJob.scorecardSchema.categories.reduce((acc, cat) => acc + cat.items.length * 5, 0) : 0;

                                            return (
                                                <tr key={app.id} className="hover:bg-gray-50 transition-colors group" onClick={() => openQuickView(app, candidate)}>
                                                    <td className="p-4 font-bold text-gray-900 flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden border border-gray-200">{candidate.photo ? <img src={`data:image/jpeg;base64,${candidate.photo}`} className="w-full h-full object-cover"/> : candidate.fullName.charAt(0)}</div>
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
                                            <div className="w-16 h-16 rounded-full bg-white border border-gray-200 overflow-hidden shadow-sm flex items-center justify-center cursor-zoom-in hover:ring-2 hover:ring-indigo-400 transition-all" onClick={() => setIsPhotoZoomed(true)}>{viewingApp.candidate.photo ? <img src={`data:image/jpeg;base64,${viewingApp.candidate.photo}`} className="w-full h-full object-cover"/> : <span className="text-2xl font-bold text-indigo-600">{viewingApp.candidate.fullName.charAt(0)}</span>}</div>
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
                                            <div className="flex gap-2 mb-4">
                                                <button onClick={openEmailModal} className="flex-1 bg-indigo-50 text-indigo-700 py-3 rounded-xl font-bold border border-indigo-100 hover:bg-indigo-100 transition-colors flex items-center justify-center gap-2"><Mail size={18}/> Email</button>
                                                {/* ONBOARDING BUTTON */}
                                                {viewingApp.app.status === SelectionStatus.HIRED && (
                                                    <button 
                                                        onClick={handleStartOnboarding}
                                                        className={`flex-1 py-3 rounded-xl font-bold border transition-colors flex items-center justify-center gap-2 ${hasOnboarding ? 'bg-green-50 text-green-700 border-green-100 hover:bg-green-100' : 'bg-gray-900 text-white hover:bg-gray-700 border-gray-900'}`}
                                                    >
                                                        <Flag size={18}/> {hasOnboarding ? 'Vedi Onboarding' : 'Avvia Onboarding'}
                                                    </button>
                                                )}
                                            </div>
                                            
                                            {viewingApp.app.aiScore && (
                                                <div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-4 rounded-xl border border-indigo-100">
                                                    <div className="flex justify-between items-center mb-2"><h4 className="text-sm font-bold text-indigo-900 flex items-center gap-2"><BrainCircuit size={16}/> AI Match Analysis</h4><span className="text-2xl font-bold text-indigo-600">{viewingApp.app.aiScore}%</span></div>
                                                    <p className="text-sm text-indigo-800 leading-relaxed">{viewingApp.app.aiReasoning}</p>
                                                </div>
                                            )}

                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100"><span className="block text-xs font-bold text-gray-400 uppercase mb-2">VALUTAZIONE</span><div className="flex">{[1,2,3,4,5].map(star => (<Star key={star} size={20} className={`cursor-pointer transition-colors ${star <= (viewingApp.app.rating || 0) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200 hover:text-yellow-200'}`} onClick={() => handleRatingChange(star)}/>))}</div></div>
                                                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100"><span className="block text-xs font-bold text-gray-400 uppercase mb-2">PRIORITÀ</span><div className="flex gap-1">{['LOW','MEDIUM','HIGH'].map(p => (<button key={p} onClick={() => handlePriorityChange(p as any)} className={`text-[10px] px-3 py-1.5 rounded border font-bold transition-all ${viewingApp.app.priority === p ? (p==='HIGH'?'bg-red-600 text-white border-red-600':p==='MEDIUM'?'bg-yellow-400 text-yellow-900 border-yellow-400':'bg-blue-600 text-white border-blue-600') : 'bg-white border-gray-200 text-gray-400 hover:border-gray-300'}`}>{p}</button>))}</div></div>
                                            </div>

                                            <div><h4 className="text-xs font-bold text-gray-400 uppercase mb-3">Dettagli Candidato</h4><div className="grid grid-cols-2 gap-4 text-sm"><div className="p-3 bg-gray-50 rounded-lg border border-gray-100"><span className="text-gray-400 block text-xs mb-1">Telefono</span><input className="bg-transparent font-medium text-gray-900 w-full outline-none" value={viewingApp.candidate.phone} onChange={e => handleCandidateUpdate('phone', e.target.value)}/></div><div className="p-3 bg-gray-50 rounded-lg border border-gray-100"><span className="text-gray-400 block text-xs mb-1">Età</span><span className="font-medium text-gray-900">{viewingApp.candidate.age ? viewingApp.candidate.age + ' anni' : '-'}</span></div></div></div>
                                            
                                            {/* Current Occupation Editable */}
                                            <div>
                                                <h4 className="text-xs font-bold text-gray-400 uppercase mb-3">Attuale Occupazione</h4>
                                                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 text-sm space-y-4">
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div><span className="text-gray-400 block text-xs mb-1">Azienda</span><input className="w-full bg-white border border-gray-200 rounded px-2 py-1.5 font-medium text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none" value={viewingApp.candidate.currentCompany || ''} onChange={e => handleCandidateUpdate('currentCompany', e.target.value)} placeholder="Azienda..." /></div>
                                                        <div><span className="text-gray-400 block text-xs mb-1">RAL</span><input className="w-full bg-white border border-gray-200 rounded px-2 py-1.5 font-medium text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none" value={viewingApp.candidate.currentSalary || ''} onChange={e => handleCandidateUpdate('currentSalary', e.target.value)} placeholder="RAL..." /></div>
                                                    </div>
                                                    <div><span className="text-gray-400 block text-xs mb-1">Ruolo</span><input className="w-full bg-white border border-gray-200 rounded px-2 py-1.5 font-medium text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none" value={viewingApp.candidate.currentRole || ''} onChange={e => handleCandidateUpdate('currentRole', e.target.value)} placeholder="Job Title..." /></div>
                                                    {viewingApp.candidate.benefits && viewingApp.candidate.benefits.length > 0 && <div><span className="text-gray-400 block text-xs mb-2">Benefit</span><div className="flex flex-wrap gap-2">{viewingApp.candidate.benefits.map((b, i) => <span key={i} className="px-2 py-1 bg-white border border-gray-200 rounded text-xs text-gray-600 shadow-sm">{b}</span>)}</div></div>}
                                                </div>
                                            </div>

                                            <div><h4 className="text-xs font-bold text-gray-400 uppercase mb-3">Summary</h4><p className="text-sm text-gray-600 leading-relaxed bg-gray-50 p-4 rounded-xl border border-gray-100 italic">{viewingApp.candidate.summary}</p></div>
                                            
                                            {viewingApp.candidate.cvFileBase64 && (
                                                <div className="pt-4 border-t border-gray-100">
                                                    <button onClick={() => setIsCvPreviewOpen(!isCvPreviewOpen)} className={`w-full flex items-center justify-center gap-2 p-3 rounded-xl transition-colors border font-medium ${isCvPreviewOpen ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}>
                                                        {isCvPreviewOpen ? <Minimize2 size={18}/> : <Maximize2 size={18}/>} {isCvPreviewOpen ? 'Chiudi Anteprima' : 'Apri Anteprima CV'}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* SCORECARD TAB (Kept same) */}
                                    {quickViewTab === 'scorecard' && (
                                        <div className="space-y-6">
                                            {!selectedJob?.scorecardSchema ? (
                                                <div className="text-center py-10 text-gray-400 border-2 border-dashed border-gray-100 rounded-xl"><ListChecks size={32} className="mx-auto mb-2 opacity-50"/>Nessuna scheda di valutazione configurata per questa posizione.</div>
                                            ) : (
                                                <>
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

                                    {/* PROCESSES & COMMENTS (Kept same) */}
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
                            {isCvPreviewOpen && viewingApp.candidate.cvFileBase64 && viewingApp.candidate.cvMimeType && (
                                <div className="flex-1 bg-gray-100 h-full flex flex-col overflow-hidden relative border-l border-gray-200">
                                    <div className="p-3 bg-white border-b border-gray-200 flex justify-between items-center shadow-sm z-10">
                                        <span className="text-sm font-bold text-gray-700 flex items-center gap-2"><FileText size={16}/> Anteprima Documento</span>
                                        <button onClick={() => setIsCvPreviewOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
                                    </div>
                                    <div className="flex-1 relative overflow-hidden">
                                        <PdfPreview base64={viewingApp.candidate.cvFileBase64} mimeType={viewingApp.candidate.cvMimeType} />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* NEW ONBOARDING SETUP MODAL */}
            {isSetupModalOpen && viewingApp && selectedJob && (
                <OnboardingSetupModal 
                    isOpen={isSetupModalOpen}
                    onClose={() => setIsSetupModalOpen(false)}
                    candidate={viewingApp.candidate}
                    job={selectedJob}
                    onProcessCreated={() => {
                        refreshData();
                        setIsSetupModalOpen(false);
                    }}
                />
            )}

            {/* Other Modals (Delete, Email, Associate, Comparison) kept ... */}
            {/* EMAIL MODAL */}
            {isEmailModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] backdrop-blur-sm">
                    <div className="bg-white rounded-xl p-6 w-full max-w-2xl shadow-2xl">
                        <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4"><h3 className="text-xl font-bold text-gray-900 flex items-center gap-2"><Mail size={24} className="text-indigo-600"/> Invia Email</h3><button onClick={() => setIsEmailModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={24}/></button></div>
                        <div className="grid grid-cols-3 gap-6 h-[400px]">
                            <div className="col-span-1 border-r border-gray-100 pr-4 space-y-2">
                                <h4 className="text-xs font-bold text-gray-400 uppercase mb-2">Template</h4>
                                {emailTemplates.map(tmpl => (<button key={tmpl.id} onClick={() => handleTemplateChange(tmpl.id)} className={`w-full text-left p-3 rounded-lg text-sm transition-all border ${selectedTemplateId === tmpl.id ? 'bg-indigo-50 border-indigo-200 text-indigo-700 font-bold' : 'bg-white border-gray-100 text-gray-600 hover:bg-gray-50'}`}>{tmpl.name}</button>))}
                            </div>
                            <div className="col-span-2 flex flex-col gap-4">
                                <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Oggetto</label><input className="w-full p-2 bg-gray-50 border border-gray-200 rounded text-sm font-medium text-gray-900" value={emailSubject} readOnly /></div>
                                <div className="flex-1"><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Messaggio</label><textarea className="w-full h-full p-3 bg-gray-50 border border-gray-200 rounded text-sm text-gray-800 resize-none font-sans leading-relaxed" value={emailBody} readOnly /></div>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
                            <button onClick={() => setIsEmailModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Annulla</button>
                            <button onClick={handleSendEmail} className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-lg shadow-indigo-200 font-bold flex items-center gap-2"><Send size={16}/> Apri Client Posta</button>
                        </div>
                    </div>
                </div>
            )}

            {/* REJECTION REASON MODAL */}
            {pendingRejection && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] backdrop-blur-sm">
                    <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl border border-red-100">
                        <div className="flex items-center gap-3 mb-4 text-red-600"><AlertTriangle size={28} /><h3 className="text-lg font-bold text-gray-900">Conferma Scarto</h3></div>
                        <p className="text-sm text-gray-500 mb-4">Indica il motivo per cui stai scartando questo candidato.</p>
                        <div className="space-y-4">
                            <div><label className="block text-xs font-bold text-gray-700 mb-1">Motivazione</label><select value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} className="w-full p-2.5 bg-white border border-gray-300 rounded-lg text-gray-900 font-medium outline-none focus:ring-2 focus:ring-red-200"><option>Soft Skill</option><option>Hard Skill mancanti</option><option>RAL troppo alta</option><option>Non interessato</option><option>Altro</option></select></div>
                            <div><label className="block text-xs font-bold text-gray-700 mb-1">Note aggiuntive</label><textarea value={rejectionNotes} onChange={(e) => setRejectionNotes(e.target.value)} className="w-full p-3 bg-white border border-gray-300 rounded-lg text-gray-900 text-sm outline-none focus:ring-2 focus:ring-red-200" rows={3} placeholder="Dettagli..." /></div>
                        </div>
                        <div className="flex gap-3 mt-6">
                            <button onClick={cancelRejection} className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200">Annulla</button>
                            <button onClick={confirmRejection} className="flex-1 py-2 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 shadow-lg shadow-red-200">Conferma Scarto</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ASSOCIATE MODAL */}
            {isAssociateModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl p-6 w-full max-w-2xl m-4 shadow-2xl max-h-[80vh] flex flex-col">
                        <div className="flex justify-between items-center mb-4 shrink-0"><h3 className="text-xl font-bold text-gray-900">Associa Candidato</h3><button onClick={() => setIsAssociateModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={24} /></button></div>
                        <div className="flex gap-2 mb-4 shrink-0"><div className="relative flex-1"><Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} /><input type="text" placeholder="Cerca nel database..." className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" value={associateSearch} onChange={(e) => setAssociateSearch(e.target.value)} /></div></div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 border rounded-lg p-2 bg-gray-50">
                            {availableCandidates.length === 0 ? <p className="text-center text-gray-400 py-4">Nessun candidato disponibile.</p> : availableCandidates.map(c => (
                                <div key={c.id} onClick={() => toggleCandidateSelection(c.id)} className={`flex items-center gap-3 p-3 bg-white border rounded-lg cursor-pointer transition-all hover:shadow-sm ${selectedAssociateIds.has(c.id) ? 'border-indigo-500 ring-1 ring-indigo-500 bg-indigo-50' : 'border-gray-200'}`}>
                                    <div className={`w-5 h-5 rounded border flex items-center justify-center ${selectedAssociateIds.has(c.id) ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300 bg-white'}`}>{selectedAssociateIds.has(c.id) && <CheckSquare size={14} className="text-white" />}</div>
                                    <div className="w-8 h-8 rounded-full bg-gray-100 overflow-hidden border border-gray-200">{c.photo ? <img src={`data:image/jpeg;base64,${c.photo}`} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center font-bold text-gray-500 text-xs">{c.fullName.charAt(0)}</div>}</div>
                                    <div><p className="font-bold text-sm text-gray-900">{c.fullName}</p><p className="text-xs text-gray-500">{c.skills.slice(0,3).join(', ')}</p></div>
                                </div>
                            ))}
                        </div>
                        <div className="pt-4 mt-2 border-t border-gray-100 flex justify-end gap-3 shrink-0"><button onClick={() => setIsAssociateModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Annulla</button><button onClick={handleBatchAddToPipeline} disabled={selectedAssociateIds.size === 0 || isAssociating} className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-sm disabled:opacity-50 flex items-center gap-2">{isAssociating ? <Loader2 size={16} className="animate-spin"/> : <UserPlus size={16}/>} Conferma e Aggiungi ({selectedAssociateIds.size})</button></div>
                    </div>
                </div>
            )}

            {/* COMPARISON MATRIX MODAL */}
            {isComparisonModalOpen && selectedJob?.scorecardSchema && (
                <div className="fixed inset-0 bg-white z-[80] flex flex-col animate-in slide-in-from-bottom-4">
                    <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50 shadow-sm">
                        <div><h2 className="text-xl font-bold text-gray-900 flex items-center gap-2"><BarChart2 className="text-indigo-600"/> Matrice di Confronto</h2><p className="text-sm text-gray-500">Analisi comparativa dei candidati per {selectedJob.title}</p></div>
                        <div className="flex items-center gap-4">
                            <div className="relative">
                                <button onClick={() => setIsMatrixCandidateFilterOpen(!isMatrixCandidateFilterOpen)} className="bg-white border border-gray-300 px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-gray-50 text-gray-700">
                                    <Filter size={16}/> {matrixSelectedCandidateIds.size > 0 ? `${matrixSelectedCandidateIds.size} Candidati` : 'Tutti i Candidati'} <ChevronDown size={14}/>
                                </button>
                                {isMatrixCandidateFilterOpen && (
                                    <div className="absolute top-full mt-1 right-0 w-64 bg-white border border-gray-200 rounded-xl shadow-xl z-50 p-2 max-h-60 overflow-y-auto">
                                        <div className="flex items-center justify-between px-2 mb-2"><span className="text-xs font-bold text-gray-500 uppercase">Seleziona</span><button onClick={() => setMatrixSelectedCandidateIds(new Set())} className="text-xs text-indigo-600 hover:underline">Reset</button></div>
                                        {applicationsForJob.filter(a => a.scorecardResults).map(app => {
                                            const c = data.candidates.find(cand => cand.id === app.candidateId);
                                            if(!c) return null;
                                            const isSel = matrixSelectedCandidateIds.has(app.candidateId);
                                            return (
                                                <div key={app.id} onClick={() => { const next = new Set(matrixSelectedCandidateIds); if(isSel) next.delete(app.candidateId); else next.add(app.candidateId); setMatrixSelectedCandidateIds(next); }} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                                                    <div className={`w-4 h-4 border rounded flex items-center justify-center ${isSel ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-gray-300'}`}>{isSel && <CheckSquare size={10} className="text-white"/>}</div>
                                                    <span className="text-sm text-gray-800 truncate">{c.fullName}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                            <div className="flex bg-gray-200 rounded-lg p-1 gap-1">
                                {Object.values(SelectionStatus).slice(0,4).map(s => (
                                    <button 
                                        key={s} 
                                        onClick={() => { if(matrixStatusFilter.includes(s)) setMatrixStatusFilter(prev => prev.filter(x => x !== s)); else setMatrixStatusFilter(prev => [...prev, s]); }}
                                        className={`px-2 py-1 text-[10px] font-bold rounded uppercase transition-all ${matrixStatusFilter.includes(s) ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                    >
                                        {StatusLabels[s]}
                                    </button>
                                ))}
                                {matrixStatusFilter.length > 0 && <button onClick={() => setMatrixStatusFilter([])} className="px-2 py-1 text-[10px] text-red-500 hover:bg-white rounded"><X size={10}/></button>}
                            </div>
                            <button onClick={() => setIsComparisonModalOpen(false)} className="p-2 bg-white border border-gray-300 rounded-full hover:bg-gray-100 text-gray-500"><X size={20}/></button>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-8 bg-gray-50">
                        <div className="max-w-6xl mx-auto space-y-8">
                            {matrixCandidates.length === 0 ? (
                                <div className="text-center py-20 text-gray-400"><BarChart2 size={48} className="mx-auto mb-4 opacity-30"/><p className="text-lg">Nessun candidato con valutazione trovato.</p></div>
                            ) : (
                                <>
                                    <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200">
                                        <h3 className="text-lg font-bold text-gray-900 mb-6 text-center">Confronto Competenze</h3>
                                        <RadarChart schema={selectedJob.scorecardSchema} candidates={matrixCandidates.map((app, i) => { const c = data.candidates.find(cand => cand.id === app.candidateId); const colors = ['#4f46e5', '#ec4899', '#10b981', '#f59e0b', '#3b82f6']; return { name: c?.fullName || '?', color: colors[i % colors.length], results: app.scorecardResults || {} }; })} />
                                        <div className="flex flex-wrap justify-center gap-4 mt-6">{matrixCandidates.map((app, i) => { const c = data.candidates.find(cand => cand.id === app.candidateId); const colors = ['#4f46e5', '#ec4899', '#10b981', '#f59e0b', '#3b82f6']; return <div key={app.id} className="flex items-center gap-2 text-sm font-medium"><div className="w-3 h-3 rounded-full" style={{ backgroundColor: colors[i % colors.length] }}></div>{c?.fullName}</div>; })}</div>
                                    </div>
                                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                                        <table className="w-full text-left text-sm table-fixed">
                                            <thead>
                                                <tr className="bg-gray-50 border-b border-gray-200">
                                                    <th className="p-4 font-bold text-gray-500 uppercase text-xs w-1/4">Criterio</th>
                                                    {matrixCandidates.map(app => { const c = data.candidates.find(cand => cand.id === app.candidateId); return ( <th key={app.id} className="p-4 font-bold text-gray-900 text-center border-l border-gray-100 truncate" title={c?.fullName}>{c?.fullName}<div className="text-[10px] text-gray-400 font-normal mt-1 uppercase">{StatusLabels[app.status]}</div></th> ); })}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                <tr className="bg-indigo-50/50 font-bold"><td className="p-4 text-indigo-900">PUNTEGGIO TOTALE</td>{matrixCandidates.map(app => { const total = Object.values(app.scorecardResults || {}).reduce((a: number, b: number) => a + b, 0); return <td key={app.id} className="p-4 text-center text-indigo-700 text-lg border-l border-indigo-100">{total}</td>; })}</tr>
                                                {selectedJob.scorecardSchema.categories.map(cat => (<React.Fragment key={cat.id}><tr className="bg-gray-50/50"><td colSpan={matrixCandidates.length + 1} className="p-2 px-4 text-xs font-bold text-gray-400 uppercase tracking-wider">{cat.name}</td></tr>{cat.items.map(item => (<tr key={item.id} className="hover:bg-gray-50"><td className="p-3 pl-6 text-gray-700 border-r border-gray-100 truncate" title={item.label}>{item.label}</td>{matrixCandidates.map(app => { const score = app.scorecardResults?.[item.id] || 0; const bgClass = score === 5 ? 'bg-green-100 text-green-800' : score === 4 ? 'bg-green-50 text-green-700' : score === 3 ? 'bg-yellow-50 text-yellow-700' : score === 2 ? 'bg-orange-50 text-orange-700' : score === 1 ? 'bg-red-50 text-red-700' : 'text-gray-300'; return (<td key={app.id} className="p-3 text-center border-l border-gray-100"><div className={`w-8 h-8 mx-auto flex items-center justify-center rounded font-bold ${bgClass}`}>{score || '-'}</div></td>); })}</tr>))}</React.Fragment>))}
                                            </tbody>
                                        </table>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* PHOTO ZOOM (Kept same) */}
            {isPhotoZoomed && viewingApp?.candidate.photo && (
                <div className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center cursor-zoom-out animate-in fade-in duration-200" onClick={() => setIsPhotoZoomed(false)}>
                    <img src={`data:image/jpeg;base64,${viewingApp.candidate.photo}`} className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl" alt="Full size"/>
                    <button className="absolute top-4 right-4 text-white/70 hover:text-white"><X size={32}/></button>
                </div>
            )}
        </div>
    );
};
