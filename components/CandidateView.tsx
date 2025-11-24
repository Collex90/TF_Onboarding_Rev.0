
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Candidate, JobPosition, Application, User, Comment, StatusLabels, StatusColors, CandidateStatus, CandidateStatusLabels, CandidateStatusColors, Attachment, UserRole } from '../types';
import { Plus, Upload, FileText, Sparkles, X, Users, Search, Pencil, UploadCloud, AlertTriangle, CheckCircle, Loader2, Trash2, Download, MessageSquare, Clock, Briefcase, Send, Building, Banknote, Eye, Maximize2, Minimize2, ZoomIn, ZoomOut, Phone, Mail, LayoutGrid, List, ChevronUp, ChevronDown, CheckSquare, Square, Star, Paperclip, Flag, Table, Image } from 'lucide-react';
import { parseCV, ParsedCVData } from '../services/ai';
import { addCandidate, updateCandidate, generateId, addCandidateComment, deleteCandidate, addCandidateAttachment, deleteCandidateAttachment } from '../services/storage';
import { OnboardingSetupModal } from './OnboardingSetupModal';

interface CandidateViewProps {
    candidates: Candidate[];
    jobs: JobPosition[];
    applications: Application[];
    refreshData: () => void;
    currentUser: User | null;
    onUpload: (files: File[]) => void;
}

// Helper for file icons
const getFileIcon = (mimeType: string) => {
    if (mimeType.includes('pdf')) return <FileText size={16} className="text-red-500"/>;
    if (mimeType.includes('sheet') || mimeType.includes('excel')) return <Table size={16} className="text-green-600"/>;
    if (mimeType.includes('image')) return <Image size={16} className="text-purple-500"/>;
    return <FileText size={16} className="text-indigo-500"/>;
};

// ... Keep PdfPage, PdfPreview, DeleteConfirmationModal helper components as is ...
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
                await page.render({
                    canvasContext: context!,
                    viewport: viewport
                }).promise;
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

interface DeleteModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    isDeleting: boolean;
    count?: number;
}

const DeleteConfirmationModal: React.FC<DeleteModalProps> = ({ isOpen, onClose, onConfirm, isDeleting, count = 1 }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4 border border-gray-200" onClick={e => e.stopPropagation()}>
                <div className="flex flex-col items-center text-center">
                    <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4 text-red-600">
                        <Trash2 size={24} />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-2">Elimina {count > 1 ? `${count} Candidati` : 'Candidato'}</h3>
                    <p className="text-sm text-gray-500 mb-6">
                        Sei sicuro? I dati verranno spostati nel cestino e rimossi da tutti i processi di selezione.
                    </p>
                    <div className="flex gap-3 w-full">
                        <button onClick={onClose} disabled={isDeleting} className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors disabled:opacity-50">Annulla</button>
                        <button onClick={onConfirm} disabled={isDeleting} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 shadow-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50">{isDeleting ? <Loader2 size={16} className="animate-spin"/> : 'Elimina'}</button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export const CandidateView: React.FC<CandidateViewProps> = ({ candidates, jobs, applications, refreshData, currentUser, onUpload }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [viewingCandidate, setViewingCandidate] = useState<Candidate | null>(null);
    const [quickViewTab, setQuickViewTab] = useState<'info' | 'processes' | 'comments' | 'attachments'>('info');
    const [newComment, setNewComment] = useState('');
    const commentInputRef = useRef<HTMLTextAreaElement>(null);
    
    const [isPhotoZoomed, setIsPhotoZoomed] = useState(false);
    const [isCvPreviewOpen, setIsCvPreviewOpen] = useState(false);

    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const attachmentInputRef = useRef<HTMLInputElement>(null);
    const bulkInputRef = useRef<HTMLInputElement>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);

    // View Mode
    const [viewMode, setViewMode] = useState<'card' | 'grid'>('card');
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);
    
    // Multi-select
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Delete State
    const [deleteCandidateIds, setDeleteCandidateIds] = useState<Set<string>>(new Set());
    const [isDeleting, setIsDeleting] = useState(false);

    // Onboarding Setup
    const [isOnboardingSetupOpen, setIsOnboardingSetupOpen] = useState(false);

    const [formData, setFormData] = useState<Partial<Candidate>>({
        fullName: '', email: '', phone: '', age: undefined, skills: [], summary: '',
        currentCompany: '', currentRole: '', currentSalary: '', benefits: [], status: CandidateStatus.CANDIDATE
    });

    useEffect(() => {
        if (!viewingCandidate) {
            setIsCvPreviewOpen(false);
            setIsPhotoZoomed(false);
        }
    }, [viewingCandidate]);

    useEffect(() => {
        // Clear selections on search change
        setSelectedIds(new Set());
    }, [searchTerm]);
    
    useEffect(() => {
        if (quickViewTab === 'comments' && commentInputRef.current) {
            commentInputRef.current.focus();
        }
    }, [quickViewTab]);

    // ... Filter & Sort Logic (Keep same) ...
    const processedCandidates = useMemo(() => {
        let filtered = candidates;
        if (searchTerm) {
            const term = (searchTerm || '').toLowerCase();
            filtered = candidates.filter(c => 
                c.fullName.toLowerCase().includes(term) ||
                c.email.toLowerCase().includes(term) ||
                c.skills.some(s => s.toLowerCase().includes(term)) ||
                (c.summary || '').toLowerCase().includes(term) ||
                c.currentCompany?.toLowerCase().includes(term) ||
                c.currentRole?.toLowerCase().includes(term)
            );
        }

        if (sortConfig) {
            filtered = [...filtered].sort((a: Candidate, b: Candidate) => {
                let valA: any = (a as any)[sortConfig.key];
                let valB: any = (b as any)[sortConfig.key];
                if (sortConfig.key === 'positions') {
                    valA = applications.filter(app => app.candidateId === a.id).length;
                    valB = applications.filter(app => app.candidateId === b.id).length;
                }
                else if (typeof valA === 'string' && typeof valB === 'string') {
                    valA = valA.toLowerCase();
                    valB = valB.toLowerCase();
                } else {
                    valA = valA || 0;
                    valB = valB || 0;
                }
                if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
                if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return filtered;
    }, [candidates, searchTerm, sortConfig, applications]);

    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const toggleSelection = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
    };

    const toggleAll = () => {
        if (selectedIds.size === processedCandidates.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(processedCandidates.map(c => c.id)));
        }
    };

    const downloadCV = (e: React.MouseEvent, candidate: Candidate) => {
        e.preventDefault();
        e.stopPropagation();
        if (!candidate.cvFileBase64 || !candidate.cvMimeType) return;
        const link = document.createElement('a');
        link.href = `data:${candidate.cvMimeType};base64,${candidate.cvFileBase64}`;
        link.download = `${candidate.fullName.replace(/\s+/g, '_')}_CV`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const requestDelete = (e: React.MouseEvent, candidateId: string) => {
        e.preventDefault();
        e.stopPropagation();
        setDeleteCandidateIds(new Set([candidateId]));
    };
    
    const handleBulkDelete = () => {
        setDeleteCandidateIds(new Set(selectedIds));
    };

    const confirmDelete = async () => {
        if (deleteCandidateIds.size === 0) return;
        setIsDeleting(true);
        try {
            const promises = Array.from(deleteCandidateIds).map(id => deleteCandidate(id));
            await Promise.all(promises);
            refreshData();
            setViewingCandidate(null);
            setIsModalOpen(false);
            setDeleteCandidateIds(new Set());
            setSelectedIds(new Set());
        } catch (error: any) {
            console.error("Delete error:", error);
            alert("Errore durante l'eliminazione: " + error.message);
        } finally {
            setIsDeleting(false);
        }
    };

    const handleBulkStatusChange = async (status: CandidateStatus) => {
        if (selectedIds.size === 0) return;
        try {
            const promises = Array.from(selectedIds).map(id => {
                const candidate = candidates.find(c => c.id === id);
                if (candidate) {
                    return updateCandidate({ ...candidate, status });
                }
                return Promise.resolve();
            });
            await Promise.all(promises);
            refreshData();
            setSelectedIds(new Set());
        } catch (e: any) {
            alert("Errore aggiornamento massivo.");
        }
    };

    const handleInlineStatusChange = async (candidate: Candidate, status: CandidateStatus) => {
        await updateCandidate({ ...candidate, status });
        refreshData();
    };
    
    const handleCandidateUpdate = async (field: keyof Candidate, value: any) => { 
        if (!viewingCandidate) return; 
        const updatedCandidate = { ...viewingCandidate, [field]: value }; 
        setViewingCandidate(updatedCandidate); 
        await updateCandidate(updatedCandidate); 
        refreshData(); 
    };

    const openAddModal = () => {
        setEditingId(null);
        setFormData({ fullName: '', email: '', phone: '', age: undefined, skills: [], summary: '', photo: undefined, currentCompany: '', currentRole: '', currentSalary: '', benefits: [], status: CandidateStatus.CANDIDATE });
        setError(null);
        setIsModalOpen(true);
    };

    const openEditModal = (candidate: Candidate) => {
        setEditingId(candidate.id);
        setFormData({ ...candidate });
        setError(null);
        setIsModalOpen(true);
        setViewingCandidate(null);
    };

    const openQuickView = (candidate: Candidate) => {
        setViewingCandidate(candidate);
        setQuickViewTab('info');
        setIsCvPreviewOpen(false);
        setIsPhotoZoomed(false);
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 50 * 1024 * 1024) { setError('Limite 50MB.'); return; }

        setIsLoading(true);
        try {
            const reader = new FileReader();
            reader.onload = async () => {
                const res = reader.result as string;
                const base64String = res.split(',')[1] || '';
                try {
                    const parsedData = await parseCV(base64String, file.type);
                    setFormData(prev => ({
                        ...prev,
                        ...parsedData,
                        cvFileBase64: base64String,
                        cvMimeType: file.type
                    }));
                } catch (err: any) { setError("Errore AI: " + err.message); } 
                finally { setIsLoading(false); }
            };
            reader.readAsDataURL(file);
        } catch (err: any) { setError('Errore lettura file.'); setIsLoading(false); }
    };

    const handleAttachmentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if(!viewingCandidate || !e.target.files?.length || !currentUser) return;
        const files = Array.from(e.target.files);
        
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
                await addCandidateAttachment(viewingCandidate.id, attachment);
                // Local optimistic update
                setViewingCandidate(prev => prev ? { ...prev, attachments: [...(prev.attachments || []), attachment] } : null);
            };
            reader.readAsDataURL(file);
        }
        
        refreshData();
        if(attachmentInputRef.current) attachmentInputRef.current.value = '';
    };

    const handleDeleteAttachment = async (attachmentId: string) => {
        if(!viewingCandidate || !confirm("Eliminare allegato?")) return;
        await deleteCandidateAttachment(viewingCandidate.id, attachmentId);
        setViewingCandidate(prev => prev ? { ...prev, attachments: prev.attachments?.filter(a => a.id !== attachmentId) } : null);
        refreshData();
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.fullName || !formData.email) return;

        setIsSaving(true);
        setError(null);

        try {
            const candidateData: Partial<Candidate> = {
                ...formData,
                age: formData.age ? Number(formData.age) : undefined,
                skills: formData.skills || [],
                benefits: formData.benefits || [],
                status: formData.status || CandidateStatus.CANDIDATE
            };

            if (editingId) {
                const existing = candidates.find(c => c.id === editingId);
                if(existing) {
                    await updateCandidate({ ...existing, ...candidateData as any, updatedAt: Date.now() });
                }
            } else {
                await addCandidate({ id: generateId(), ...candidateData as any, createdAt: Date.now(), comments: [] });
            }
            refreshData();
            setIsModalOpen(false);
        } catch (err: any) {
            console.error("Save error:", err);
            setError("Errore durante il salvataggio: " + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleAddComment = async () => {
        if (!viewingCandidate || !newComment.trim() || !currentUser) return;
        const comment: Comment = {
            id: generateId(),
            text: newComment,
            authorName: currentUser.name,
            authorAvatar: currentUser.avatar,
            createdAt: Date.now()
        };
        await addCandidateComment(viewingCandidate.id, comment);
        setViewingCandidate(prev => prev ? { ...prev, comments: [...(prev.comments || []), comment] } : null);
        setNewComment('');
        refreshData();
        // Keep focus
        setTimeout(() => commentInputRef.current?.focus(), 100);
    };

    const handleCommentKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            handleAddComment();
        }
    };

    const handleBulkFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            onUpload(Array.from(e.target.files));
            if (bulkInputRef.current) bulkInputRef.current.value = '';
        }
    };

    // --- Render Helper for Sort Header ---
    const SortHeader = ({ label, sortKey, className = '' }: { label: string, sortKey: string, className?: string }) => (
        <th className={`p-4 font-semibold cursor-pointer hover:bg-gray-100 transition-colors group select-none ${className}`} onClick={() => handleSort(sortKey)}>
            <div className="flex items-center gap-1">
                {label}
                <div className="flex flex-col">
                    <ChevronUp size={10} className={sortConfig?.key === sortKey && sortConfig.direction === 'asc' ? 'text-indigo-600' : 'text-gray-300'} />
                    <ChevronDown size={10} className={sortConfig?.key === sortKey && sortConfig.direction === 'desc' ? 'text-indigo-600' : 'text-gray-300'} />
                </div>
            </div>
        </th>
    );

    return (
        <div className="p-8 h-full overflow-y-auto flex flex-col">
            {/* ... Keep Search/Toolbar JSX same as before ... */}
            <div className="flex justify-between items-start mb-6 gap-4 flex-wrap">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Database Candidati</h2>
                    <p className="text-gray-500">Gestisci e analizza i profili dei talenti.</p>
                </div>
                
                <div className="flex items-center gap-3 flex-1 max-w-xl justify-end">
                    {/* View Toggle */}
                    <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200">
                         <button 
                            onClick={() => setViewMode('card')}
                            className={`p-2 rounded-md transition-all ${viewMode === 'card' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                            title="Vista Card"
                         >
                             <LayoutGrid size={18} />
                         </button>
                         <button 
                            onClick={() => setViewMode('grid')}
                            className={`p-2 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                            title="Vista Griglia"
                         >
                             <List size={18} />
                         </button>
                     </div>

                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                        <input 
                            type="text" 
                            placeholder="Cerca per nome, skills, email..." 
                            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-full focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm transition-shadow text-gray-900"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    
                    <input type="file" multiple accept=".pdf,image/*" className="hidden" ref={bulkInputRef} onChange={handleBulkFileSelect} />
                    <button 
                        onClick={() => bulkInputRef.current?.click()}
                        className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 px-4 py-2.5 rounded-lg flex items-center gap-2 transition-colors shadow-sm shrink-0 font-medium"
                    >
                        <UploadCloud size={20} className="text-indigo-600" />
                        Importa
                    </button>

                    <button 
                        onClick={openAddModal}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg flex items-center gap-2 transition-colors shadow-sm shrink-0 font-medium"
                    >
                        <Plus size={20} />
                        Nuovo
                    </button>
                </div>
            </div>

            {/* BULK ACTIONS BAR */}
            {viewMode === 'grid' && selectedIds.size > 0 && (
                <div className="bg-indigo-50 border border-indigo-100 p-3 rounded-xl mb-4 flex items-center justify-between animate-in slide-in-from-top-2">
                    <div className="flex items-center gap-4">
                        <span className="font-bold text-indigo-900 text-sm px-2">{selectedIds.size} selezionati</span>
                        <div className="h-4 w-px bg-indigo-200"></div>
                        <div className="flex gap-2">
                            <button onClick={handleBulkDelete} className="flex items-center gap-1 text-red-600 hover:bg-red-100 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors">
                                <Trash2 size={14}/> Elimina ({selectedIds.size})
                            </button>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-indigo-700 font-medium">Cambia Stato:</span>
                        {Object.values(CandidateStatus).map(status => (
                            <button 
                                key={status}
                                onClick={() => handleBulkStatusChange(status as CandidateStatus)}
                                className={`text-[10px] px-2 py-1 rounded border ${CandidateStatusColors[status]} bg-white hover:brightness-95`}
                            >
                                {CandidateStatusLabels[status]}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* ... Keep Grid/Card Rendering same ... */}
            {viewMode === 'card' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-10">
                    {processedCandidates.map(candidate => (
                        <div 
                            key={candidate.id} 
                            onClick={() => openQuickView(candidate)}
                            className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-lg hover:border-indigo-100 transition-all group relative cursor-pointer flex flex-col"
                        >
                            {/* Status Badge */}
                            <div className={`absolute top-4 left-4 text-[10px] font-bold px-2 py-0.5 rounded border ${CandidateStatusColors[candidate.status || CandidateStatus.CANDIDATE]}`}>
                                {CandidateStatusLabels[candidate.status || CandidateStatus.CANDIDATE]}
                            </div>

                            <div 
                                className="absolute top-4 right-4 flex gap-1 z-50 bg-white/90 backdrop-blur-sm p-1 rounded-lg border border-gray-100 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity flex-nowrap" 
                                onClick={e => e.stopPropagation()}
                            >
                                {candidate.cvFileBase64 && (
                                    <button 
                                        type="button"
                                        onClick={(e) => downloadCV(e, candidate)}
                                        className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                                        title="Scarica CV"
                                    >
                                        <Download size={16} />
                                    </button>
                                )}
                                <button 
                                    type="button"
                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); openEditModal(candidate); }}
                                    className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                                    title="Modifica"
                                >
                                    <Pencil size={16} />
                                </button>
                                <button 
                                    type="button"
                                    onClick={(e) => requestDelete(e, candidate.id)}
                                    className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors z-50"
                                    title="Elimina"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>

                            <div className="flex items-start gap-4 mb-4 mt-6">
                                <div className="w-14 h-14 rounded-full shrink-0 shadow-inner border border-white overflow-hidden bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
                                    {candidate.photo ? (
                                        <img src={`data:image/jpeg;base64,${candidate.photo}`} alt={candidate.fullName} className="w-full h-full object-cover" />
                                    ) : (
                                        <span className="text-xl font-bold text-indigo-600">{candidate.fullName.charAt(0)}</span>
                                    )}
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-900 text-lg leading-tight group-hover:text-indigo-600 transition-colors">{candidate.fullName}</h3>
                                    <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                                        {candidate.age && <span className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-600 font-medium">{candidate.age} anni</span>}
                                        {candidate.currentRole && <span className="text-gray-400">• {candidate.currentRole}</span>}
                                    </p>
                                </div>
                            </div>

                            <p className="text-sm text-gray-600 line-clamp-3 mb-4 flex-1 italic bg-gray-50 p-3 rounded-lg border border-gray-50">
                                "{candidate.summary || 'Nessun riepilogo disponibile.'}"
                            </p>

                            <div className="flex flex-wrap gap-2 mt-auto">
                                {candidate.skills.slice(0, 3).map((skill, idx) => (
                                    <span key={idx} className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-1 rounded-md font-medium border border-indigo-100">
                                        {skill}
                                    </span>
                                ))}
                                {candidate.skills.length > 3 && (
                                    <span className="text-[10px] text-gray-400 px-1 py-1">+{candidate.skills.length - 3}</span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden flex flex-col h-full">
                    <div className="overflow-auto flex-1 custom-scrollbar">
                        <table className="w-full text-left border-collapse relative">
                            <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm text-xs text-gray-500 font-semibold uppercase tracking-wider">
                                <tr>
                                    <th className="p-4 w-10">
                                        <button onClick={toggleAll} className="flex items-center justify-center w-5 h-5 rounded border border-gray-300 bg-white hover:border-indigo-500">
                                            {selectedIds.size > 0 && selectedIds.size === processedCandidates.length && <CheckSquare size={14} className="text-indigo-600"/>}
                                            {selectedIds.size > 0 && selectedIds.size < processedCandidates.length && <Square size={10} className="text-indigo-600 fill-indigo-600"/>}
                                        </button>
                                    </th>
                                    <SortHeader label="Candidato" sortKey="fullName" />
                                    <SortHeader label="Età" sortKey="age" />
                                    <SortHeader label="Email" sortKey="email" />
                                    <SortHeader label="Telefono" sortKey="phone" />
                                    <SortHeader label="Stato" sortKey="status" />
                                    <SortHeader label="Ruolo Attuale" sortKey="currentRole" />
                                    <SortHeader label="Posizioni" sortKey="positions" />
                                    <th className="p-4 w-20"></th>
                                </tr>
                            </thead>
                            <tbody className="text-sm divide-y divide-gray-100">
                                {processedCandidates.map(candidate => {
                                    const isSelected = selectedIds.has(candidate.id);
                                    const positionCount = applications.filter(app => app.candidateId === candidate.id).length;

                                    return (
                                        <tr 
                                            key={candidate.id} 
                                            className={`hover:bg-gray-50 transition-colors group ${isSelected ? 'bg-indigo-50/30' : ''}`}
                                            onClick={() => openQuickView(candidate)}
                                        >
                                            <td className="p-4" onClick={(e) => { e.stopPropagation(); toggleSelection(candidate.id); }}>
                                                <div className={`w-5 h-5 rounded border flex items-center justify-center cursor-pointer transition-colors ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300 bg-white hover:border-indigo-400'}`}>
                                                    {isSelected && <CheckSquare size={14} className="text-white"/>}
                                                </div>
                                            </td>
                                            <td className="p-4 font-medium text-gray-900 flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden border border-gray-200 shrink-0">
                                                    {candidate.photo ? <img src={`data:image/jpeg;base64,${candidate.photo}`} className="w-full h-full object-cover"/> : candidate.fullName.charAt(0)}
                                                </div>
                                                {candidate.fullName}
                                            </td>
                                            <td className="p-4 text-gray-600">{candidate.age || '-'}</td>
                                            <td className="p-4 text-gray-600">{candidate.email}</td>
                                            <td className="p-4 text-gray-600">{candidate.phone || '-'}</td>
                                            <td className="p-4" onClick={e => e.stopPropagation()}>
                                                <select 
                                                    value={candidate.status || CandidateStatus.CANDIDATE} 
                                                    onChange={(e) => handleInlineStatusChange(candidate, e.target.value as CandidateStatus)}
                                                    className={`text-xs font-bold px-2 py-1 rounded border outline-none cursor-pointer ${CandidateStatusColors[candidate.status || CandidateStatus.CANDIDATE]}`}
                                                >
                                                    {Object.values(CandidateStatus).map(s => (
                                                        <option key={s} value={s}>{CandidateStatusLabels[s]}</option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td className="p-4 text-gray-600 max-w-[150px] truncate" title={candidate.currentRole}>{candidate.currentRole || '-'}</td>
                                            <td className="p-4 text-center font-bold text-indigo-600">{positionCount}</td>
                                            <td className="p-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                                                <button onClick={(e) => {e.stopPropagation(); openEditModal(candidate)}} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded"><Pencil size={16}/></button>
                                                <button onClick={(e) => requestDelete(e, candidate.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 size={16}/></button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Add/Edit Modal (Keep same) */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] backdrop-blur-sm p-4 overflow-y-auto">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl m-auto" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center p-6 border-b border-gray-100">
                            <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                                {editingId ? <Pencil className="text-indigo-600"/> : <Plus className="text-indigo-600"/>}
                                {editingId ? 'Modifica Profilo' : 'Aggiungi Profilo'}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                                <X size={24} />
                            </button>
                        </div>
                        
                        <form onSubmit={handleSubmit} className="p-6 space-y-6">
                            {!editingId && (
                                <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 flex items-start gap-4">
                                    <div className="bg-white p-2 rounded-lg shadow-sm text-indigo-600"><Sparkles size={24}/></div>
                                    <div className="flex-1">
                                        <h4 className="font-bold text-indigo-900 text-sm mb-1">Autocompletamento AI + Foto</h4>
                                        <p className="text-xs text-indigo-700 mb-3">Carica CV per compilare ed estrarre la foto.</p>
                                        <input 
                                            type="file" 
                                            accept=".pdf,image/*" 
                                            className="hidden" 
                                            id="modal-cv-upload"
                                            onChange={handleFileChange}
                                        />
                                        <label 
                                            htmlFor="modal-cv-upload"
                                            className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-indigo-200 text-indigo-700 text-xs font-bold rounded-lg cursor-pointer hover:bg-indigo-50 transition-colors shadow-sm"
                                        >
                                            {isLoading ? <Loader2 size={14} className="animate-spin"/> : <Upload size={14}/>}
                                            Carica CV
                                        </label>
                                        {error && <p className="text-red-500 text-xs mt-2 font-medium bg-red-50 p-1 rounded border border-red-100">{error}</p>}
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div><label className="block text-sm font-bold text-gray-700 mb-1">Nome Completo</label><input required value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} className="w-full p-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900 font-medium" /></div>
                                <div><label className="block text-sm font-bold text-gray-700 mb-1">Email</label><input type="email" required value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full p-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900 font-medium" /></div>
                                <div><label className="block text-sm font-bold text-gray-700 mb-1">Telefono</label><input value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full p-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900 font-medium" /></div>
                                <div><label className="block text-sm font-bold text-gray-700 mb-1">Età</label><input type="number" value={formData.age || ''} onChange={e => setFormData({...formData, age: parseInt(e.target.value) || undefined})} className="w-full p-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900 font-medium" /></div>
                                <div><label className="block text-sm font-bold text-gray-700 mb-1">Stato Candidato</label><select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as CandidateStatus})} className="w-full p-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900 font-medium">{Object.values(CandidateStatus).map(s => (<option key={s} value={s}>{CandidateStatusLabels[s]}</option>))}</select></div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Skills (separate da virgola)</label>
                                <input 
                                    value={formData.skills?.join(', ')} 
                                    onChange={e => setFormData({...formData, skills: e.target.value.split(',').map(s => s.trim()).filter(s => s)})} 
                                    className="w-full p-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900 font-medium" 
                                    placeholder="React, TypeScript, Sales..."
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Summary</label>
                                <textarea 
                                    value={formData.summary} 
                                    onChange={e => setFormData({...formData, summary: e.target.value})} 
                                    className="w-full p-3 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none h-24 text-gray-900 font-medium resize-none" 
                                />
                            </div>

                            <div className="border-t border-gray-200 pt-4">
                                <h4 className="text-sm font-bold text-gray-900 mb-3 uppercase tracking-wider">Attuale Occupazione</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div><label className="block text-xs font-bold text-gray-500 mb-1">Azienda attuale</label><input value={formData.currentCompany} onChange={e => setFormData({...formData, currentCompany: e.target.value})} className="w-full p-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900" /></div>
                                    <div><label className="block text-xs font-bold text-gray-500 mb-1">Ruolo attuale</label><input value={formData.currentRole} onChange={e => setFormData({...formData, currentRole: e.target.value})} className="w-full p-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900" /></div>
                                    <div><label className="block text-xs font-bold text-gray-500 mb-1">RAL (es. 35k)</label><input value={formData.currentSalary} onChange={e => setFormData({...formData, currentSalary: e.target.value})} className="w-full p-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900" /></div>
                                    <div><label className="block text-xs font-bold text-gray-500 mb-1">Benefits (Auto, Buoni Pasto...)</label><input value={formData.benefits?.join(', ')} onChange={e => setFormData({...formData, benefits: e.target.value.split(',').map(s => s.trim()).filter(s => s)})} className="w-full p-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900" /></div>
                                </div>
                            </div>
                            
                            {error && (
                                <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm border border-red-100">
                                    <AlertTriangle size={16} className="inline mr-2"/> {error}
                                </div>
                            )}

                            <div className="flex justify-end gap-3 pt-2">
                                <button type="button" onClick={() => setIsModalOpen(false)} disabled={isSaving} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium disabled:opacity-50">Annulla</button>
                                <button 
                                    type="submit" 
                                    disabled={isSaving}
                                    className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 flex items-center gap-2 disabled:opacity-70"
                                >
                                    {isSaving && <Loader2 size={16} className="animate-spin"/>}
                                    {isSaving ? 'Salvataggio...' : 'Salva'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* QUICK VIEW OVERLAY */}
            {viewingCandidate && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-end z-[60] backdrop-blur-[2px]" onClick={() => setViewingCandidate(null)}>
                    <div className={`bg-white h-full shadow-2xl flex flex-col animate-slide-left transition-all duration-300 ${isCvPreviewOpen ? 'w-[95vw] max-w-7xl' : 'w-full max-w-2xl'}`} onClick={e => e.stopPropagation()}>
                        <div className="flex flex-1 overflow-hidden h-full">
                            {/* LEFT COLUMN */}
                            <div className={`flex flex-col h-full border-r border-gray-200 overflow-hidden transition-all duration-300 ${isCvPreviewOpen ? 'w-1/2 min-w-[500px]' : 'w-full'}`}>
                                <div className="p-6 border-b border-gray-100 bg-gray-50 shrink-0">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex items-center gap-4">
                                            <div className="w-16 h-16 rounded-full bg-white border border-gray-200 overflow-hidden shadow-sm flex items-center justify-center cursor-zoom-in hover:ring-2 hover:ring-indigo-400 transition-all" onClick={() => setIsPhotoZoomed(true)}>{viewingCandidate.photo ? <img src={`data:image/jpeg;base64,${viewingCandidate.photo}`} className="w-full h-full object-cover"/> : <span className="text-2xl font-bold text-indigo-600">{viewingCandidate.fullName.charAt(0)}</span>}</div>
                                            <div>
                                                <h2 className="text-2xl font-bold text-gray-900">{viewingCandidate.fullName}</h2>
                                                <div className="flex items-center gap-2 mt-1 text-gray-500 text-sm"><Mail size={14}/> {viewingCandidate.email}</div>
                                                <div className="flex items-center gap-2 mt-1 text-gray-500 text-sm"><Phone size={14}/> 
                                                    <input 
                                                        className="bg-transparent border-b border-transparent hover:border-gray-300 focus:border-indigo-500 outline-none w-32" 
                                                        value={viewingCandidate.phone || ''}
                                                        onChange={e => handleCandidateUpdate('phone', e.target.value)}
                                                        placeholder="Aggiungi telefono"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            {viewingCandidate.status === CandidateStatus.HIRED && (
                                                <button 
                                                    onClick={() => setIsOnboardingSetupOpen(true)}
                                                    className="flex items-center gap-1 bg-green-100 text-green-700 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-green-200 transition-colors"
                                                >
                                                    <Flag size={14}/> Onboarding
                                                </button>
                                            )}
                                            <div className="flex gap-1 bg-white border border-gray-200 rounded-lg p-1 shadow-sm">
                                                <button onClick={() => openEditModal(viewingCandidate)} className="p-2 hover:bg-indigo-50 hover:text-indigo-600 rounded text-gray-400 transition-colors" title="Modifica"><Pencil size={18}/></button>
                                                <button onClick={() => setDeleteCandidateIds(new Set([viewingCandidate.id]))} className="p-2 hover:bg-red-50 hover:text-red-600 rounded text-gray-400 transition-colors" title="Elimina"><Trash2 size={18}/></button>
                                            </div>
                                            <button onClick={() => setViewingCandidate(null)} className="p-2 text-gray-400 hover:text-gray-600"><X size={24}/></button>
                                        </div>
                                    </div>
                                    <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
                                        {[{id:'info', label:'Informazioni', icon:FileText}, {id:'processes', label:'Processi', icon:Briefcase}, {id:'comments', label:'Commenti', icon:MessageSquare}, {id:'attachments', label:'Allegati', icon:Paperclip}].map(tab => (
                                            <button key={tab.id} onClick={() => setQuickViewTab(tab.id as any)} className={`flex items-center gap-2 px-4 py-2 text-sm font-bold uppercase tracking-wide border-b-2 transition-colors whitespace-nowrap ${quickViewTab === tab.id ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>{React.createElement(tab.icon, { size: 14 })} {tab.label}</button>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex-1 overflow-y-auto p-6 bg-white custom-scrollbar">
                                    {quickViewTab === 'info' && (
                                        <div className="space-y-6">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 flex flex-col justify-center">
                                                    <span className="block text-xs font-bold text-gray-400 uppercase mb-1">Età</span>
                                                    <input 
                                                        type="number" 
                                                        className="text-lg font-bold text-gray-800 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-indigo-500 outline-none w-full"
                                                        value={viewingCandidate.age || ''}
                                                        onChange={e => handleCandidateUpdate('age', parseInt(e.target.value))}
                                                        placeholder="-"
                                                    />
                                                </div>
                                                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                                                    <span className="block text-xs font-bold text-gray-400 uppercase mb-1">Stato</span>
                                                    <select 
                                                        value={viewingCandidate.status}
                                                        onChange={(e) => handleCandidateUpdate('status', e.target.value)}
                                                        className={`inline-block px-2 py-1 rounded text-xs font-bold border outline-none cursor-pointer w-full ${CandidateStatusColors[viewingCandidate.status]}`}
                                                    >
                                                        {Object.values(CandidateStatus).map(s => <option key={s} value={s}>{CandidateStatusLabels[s]}</option>)}
                                                    </select>
                                                </div>
                                            </div>
                                            
                                            <div><h4 className="text-xs font-bold text-gray-400 uppercase mb-3">Skills</h4><div className="flex flex-wrap gap-2">{viewingCandidate.skills.map((s, i) => (<span key={i} className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-sm font-medium border border-indigo-100">{s}</span>))}</div></div>
                                            
                                            <div><h4 className="text-xs font-bold text-gray-400 uppercase mb-3">Attuale Occupazione</h4><div className="bg-gray-50 p-4 rounded-xl border border-gray-100 text-sm grid grid-cols-2 gap-y-4 gap-x-8"><div><span className="block text-xs text-gray-400">Azienda</span><span className="font-bold text-gray-800">{viewingCandidate.currentCompany || '-'}</span></div><div><span className="block text-xs text-gray-400">Ruolo</span><span className="font-bold text-gray-800">{viewingCandidate.currentRole || '-'}</span></div><div><span className="block text-xs text-gray-400">RAL</span><span className="font-bold text-gray-800">{viewingCandidate.currentSalary || '-'}</span></div><div className="col-span-2"><span className="block text-xs text-gray-400 mb-1">Benefit</span><div className="flex flex-wrap gap-2">{viewingCandidate.benefits?.map((b,i)=><span key={i} className="text-xs bg-white border px-2 py-1 rounded text-gray-600">{b}</span>)}</div></div></div></div>

                                            <div><h4 className="text-xs font-bold text-gray-400 uppercase mb-3">Summary</h4><p className="text-sm text-gray-600 leading-relaxed bg-gray-50 p-4 rounded-xl border border-gray-100 italic">{viewingCandidate.summary}</p></div>
                                            
                                            {viewingCandidate.cvFileBase64 && (
                                                <div className="pt-4 border-t border-gray-100">
                                                    <button onClick={() => setIsCvPreviewOpen(!isCvPreviewOpen)} className={`w-full flex items-center justify-center gap-2 p-3 rounded-xl transition-colors border font-medium ${isCvPreviewOpen ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}>
                                                        {isCvPreviewOpen ? <Minimize2 size={18}/> : <Maximize2 size={18}/>} {isCvPreviewOpen ? 'Chiudi Anteprima' : 'Apri Anteprima CV'}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {quickViewTab === 'processes' && (
                                        <div className="space-y-4">
                                            <h4 className="text-xs font-bold text-gray-400 uppercase mb-3">Storico Candidature</h4>
                                            {applications.filter(a => a.candidateId === viewingCandidate.id).length === 0 ? <p className="text-gray-400 italic text-sm">Nessuna candidatura attiva.</p> : applications.filter(a => a.candidateId === viewingCandidate.id).map(app => {
                                                const job = jobs.find(j => j.id === app.jobId);
                                                return (
                                                    <div key={app.id} className="border border-gray-200 rounded-xl p-4 bg-gray-50">
                                                        <div className="flex justify-between items-start mb-2"><h5 className="font-bold text-gray-900">{job?.title}</h5><span className={`text-[10px] px-2 py-0.5 rounded border ${StatusColors[app.status]}`}>{StatusLabels[app.status]}</span></div>
                                                        <p className="text-xs text-gray-500 mb-3">{job?.department}</p>
                                                        {app.rating && <div className="flex items-center gap-1 text-yellow-500 text-xs font-bold"><Star size={12} fill="currentColor"/> {app.rating}/5</div>}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {quickViewTab === 'comments' && (
                                        <div className="flex flex-col h-full">
                                            <div className="flex-1 space-y-4 mb-6">
                                                {!viewingCandidate.comments || viewingCandidate.comments.length === 0 ? <p className="text-center text-gray-400 text-sm py-8 italic">Nessun commento.</p> : viewingCandidate.comments.map((comment) => (<div key={comment.id} className="bg-gray-50 p-3 rounded-xl rounded-tl-none border border-gray-100 ml-2"><div className="flex items-center justify-between mb-1"><span className="text-xs font-bold text-gray-900">{comment.authorName}</span><span className="text-[10px] text-gray-400 flex items-center gap-1"><Clock size={10}/> {new Date(comment.createdAt).toLocaleDateString()}</span></div><p className="text-sm text-gray-900">{comment.text}</p></div>))}
                                            </div>
                                            <div className="relative mt-auto pt-4 border-t border-gray-100">
                                                <textarea ref={commentInputRef} className="text-gray-900 w-full bg-white border border-gray-200 rounded-xl p-3 pr-12 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none" rows={3} placeholder="Scrivi una nota... (Ctrl+Enter per inviare)" value={newComment} onChange={e => setNewComment(e.target.value)} onKeyDown={handleCommentKeyDown} />
                                                <button onClick={handleAddComment} disabled={!newComment.trim()} className="absolute right-3 bottom-3 p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"><Send size={16} /></button>
                                            </div>
                                        </div>
                                    )}

                                    {quickViewTab === 'attachments' && (
                                        <div className="space-y-4">
                                            <div className="flex justify-between items-center mb-2">
                                                <h4 className="text-xs font-bold text-gray-400 uppercase">File Allegati</h4>
                                                <input type="file" multiple ref={attachmentInputRef} className="hidden" onChange={handleAttachmentUpload}/>
                                                <button onClick={() => attachmentInputRef.current?.click()} className="text-xs bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg border border-indigo-200 hover:bg-indigo-100 font-bold flex items-center gap-1">
                                                    <Upload size={12}/> Carica
                                                </button>
                                            </div>
                                            {!viewingCandidate.attachments || viewingCandidate.attachments.length === 0 ? (
                                                <p className="text-center text-gray-400 text-sm py-8 italic border-2 border-dashed border-gray-100 rounded-xl">Nessun file extra allegato.</p>
                                            ) : (
                                                <div className="grid grid-cols-2 gap-3">
                                                    {viewingCandidate.attachments.map(file => (
                                                        <div key={file.id} className="border border-gray-200 rounded-lg p-3 hover:shadow-sm bg-gray-50">
                                                            <div className="flex items-start justify-between mb-2">
                                                                <div className="p-2 bg-white rounded shadow-sm">
                                                                    {getFileIcon(file.type)}
                                                                </div>
                                                                <div className="flex gap-1">
                                                                    <a href={`data:${file.type};base64,${file.dataBase64}`} download={file.name} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded"><Download size={16}/></a>
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

                            {/* RIGHT PREVIEW */}
                            {isCvPreviewOpen && viewingCandidate.cvFileBase64 && viewingCandidate.cvMimeType && (
                                <div className="flex-1 bg-gray-100 h-full flex flex-col overflow-hidden relative border-l border-gray-200">
                                    <div className="p-3 bg-white border-b border-gray-200 flex justify-between items-center shadow-sm z-10">
                                        <span className="text-sm font-bold text-gray-700 flex items-center gap-2"><FileText size={16}/> Anteprima Documento</span>
                                        <button onClick={() => setIsCvPreviewOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
                                    </div>
                                    <div className="flex-1 relative overflow-hidden">
                                        <PdfPreview base64={viewingCandidate.cvFileBase64} mimeType={viewingCandidate.cvMimeType} />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ONBOARDING SETUP MODAL TRIGGERED FROM QUICK VIEW */}
            {isOnboardingSetupOpen && viewingCandidate && (
                <OnboardingSetupModal 
                    isOpen={isOnboardingSetupOpen}
                    onClose={() => setIsOnboardingSetupOpen(false)}
                    candidate={viewingCandidate}
                    job={jobs.find(j => applications.some(a => a.candidateId === viewingCandidate.id && a.jobId === j.id)) || jobs[0]} // Simplistic fallback for job
                    onProcessCreated={() => { setIsOnboardingSetupOpen(false); refreshData(); }}
                />
            )}

            {/* CUSTOM DELETE CONFIRMATION MODAL */}
            <DeleteConfirmationModal 
                isOpen={deleteCandidateIds.size > 0} 
                onClose={() => setDeleteCandidateIds(new Set())}
                onConfirm={confirmDelete}
                isDeleting={isDeleting}
                count={deleteCandidateIds.size}
            />
        </div>
    );
};
