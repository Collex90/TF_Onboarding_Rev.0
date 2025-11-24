
import React, { useState, useEffect } from 'react';
import { OnboardingTask, OnboardingPhase, OnboardingPhaseLabels, Candidate, JobPosition, OnboardingTemplate, User } from '../types';
import { generateOnboardingChecklist } from '../services/ai';
import { saveOnboardingTemplate, getOnboardingTemplates, deleteOnboardingTemplate, generateId, createOnboardingProcess, getAllUsers } from '../services/storage';
import { X, Sparkles, Loader2, Save, Download, Trash2, Plus, GripVertical, CheckCircle, Calendar, User as UserIcon } from 'lucide-react';

interface OnboardingSetupModalProps {
    isOpen: boolean;
    onClose: () => void;
    candidate: Candidate;
    job: JobPosition;
    onProcessCreated: () => void;
}

export const OnboardingSetupModal: React.FC<OnboardingSetupModalProps> = ({ isOpen, onClose, candidate, job, onProcessCreated }) => {
    const [tasks, setTasks] = useState<OnboardingTask[]>([]);
    const [isGenerating, setIsGenerating] = useState(false);
    const [allUsers, setAllUsers] = useState<User[]>([]);
    
    // Custom Phase Labels
    const [phaseConfig, setPhaseConfig] = useState<Record<string, string>>(OnboardingPhaseLabels);

    // Templates State
    const [templates, setTemplates] = useState<OnboardingTemplate[]>([]);
    const [isTemplateMenuOpen, setIsTemplateMenuOpen] = useState(false);
    const [isSaveMode, setIsSaveMode] = useState(false);
    const [newTemplateName, setNewTemplateName] = useState('');

    useEffect(() => {
        if (isOpen) {
            setTasks([]); 
            setPhaseConfig(OnboardingPhaseLabels); // Reset to default
            loadTemplates();
            getAllUsers().then(users => setAllUsers(users.filter(u => !u.isDeleted)));
        }
    }, [isOpen]);

    const loadTemplates = async () => {
        const t = await getOnboardingTemplates();
        setTemplates(t);
    };

    const handleGenerateAI = async () => {
        setIsGenerating(true);
        try {
            const result = await generateOnboardingChecklist(job.title);
            const newTasks: OnboardingTask[] = result.items.map(i => ({
                id: generateId(),
                description: i.task,
                department: i.department,
                phase: i.phase || OnboardingPhase.WEEK_1,
                isCompleted: false
            }));
            setTasks(newTasks);
        } catch (e) {
            console.error(e);
            alert("Errore generazione AI");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleLoadTemplate = (template: OnboardingTemplate) => {
        const loadedTasks: OnboardingTask[] = template.tasks.map(t => ({
            ...t,
            id: generateId(), 
            isCompleted: false
        }));
        setTasks(loadedTasks);
        if (template.phaseConfig) {
            setPhaseConfig(template.phaseConfig);
        } else {
            setPhaseConfig(OnboardingPhaseLabels);
        }
        setIsTemplateMenuOpen(false);
    };

    const handleSaveTemplate = async () => {
        if (!newTemplateName.trim() || tasks.length === 0) return;
        const template: OnboardingTemplate = {
            id: generateId(),
            name: newTemplateName,
            tasks: tasks.map(({ id, isCompleted, ...rest }) => rest), // Keep assignments and dates in template!
            phaseConfig: phaseConfig,
            createdAt: Date.now()
        };
        await saveOnboardingTemplate(template);
        await loadTemplates();
        setIsSaveMode(false);
        setNewTemplateName('');
    };

    const handleDeleteTemplate = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (confirm("Eliminare questo modello?")) {
            await deleteOnboardingTemplate(id);
            loadTemplates();
        }
    };

    // --- INLINE EDITING HANDLERS ---
    const handleTaskUpdate = (id: string, field: keyof OnboardingTask, value: any) => {
        setTasks(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t));
    };

    const handleTaskDateChange = (id: string, dateString: string) => {
        // Convert YYYY-MM-DD to timestamp
        const timestamp = dateString ? new Date(dateString).getTime() : undefined;
        handleTaskUpdate(id, 'dueDate', timestamp);
    };

    const handleDeleteTask = (id: string) => {
        setTasks(prev => prev.filter(t => t.id !== id));
    };

    const handleAddTask = (phase: OnboardingPhase) => {
        const newTask: OnboardingTask = {
            id: generateId(),
            description: '',
            department: 'HR',
            phase: phase,
            isCompleted: false
        };
        setTasks(prev => [...prev, newTask]);
    };

    const handlePhaseNameChange = (phaseKey: string, newName: string) => {
        setPhaseConfig(prev => ({
            ...prev,
            [phaseKey]: newName
        }));
    };

    const handleConfirm = async () => {
        if (tasks.length === 0) {
            alert("Aggiungi almeno un task.");
            return;
        }
        
        const validTasks = tasks.filter(t => t.description.trim() !== '');
        
        await createOnboardingProcess({
            id: generateId(),
            candidateId: candidate.id,
            jobId: job.id,
            status: 'IN_PROGRESS',
            startDate: Date.now(),
            phaseConfig: phaseConfig, // Save Custom Labels
            tasks: validTasks
        });
        
        onProcessCreated();
        onClose();
    };

    const phaseOrder = [OnboardingPhase.PRE_BOARDING, OnboardingPhase.DAY_1, OnboardingPhase.WEEK_1, OnboardingPhase.MONTH_1];

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[80] backdrop-blur-sm">
            <div className="bg-white rounded-xl w-full max-w-5xl m-4 shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
                {/* HEADER */}
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-xl">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Setup Onboarding</h2>
                        <p className="text-sm text-gray-500">Definisci il piano per <span className="font-semibold text-gray-700">{candidate.fullName}</span> ({job.title})</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={24}/></button>
                </div>

                {/* TOOLBAR */}
                <div className="p-4 border-b border-gray-100 flex gap-3 items-center bg-white">
                    <button 
                        onClick={handleGenerateAI} 
                        disabled={isGenerating}
                        className="bg-indigo-50 text-indigo-700 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-indigo-100 border border-indigo-200 transition-colors disabled:opacity-50"
                    >
                        {isGenerating ? <Loader2 size={16} className="animate-spin"/> : <Sparkles size={16}/>} Genera con AI
                    </button>
                    
                    <div className="relative">
                        <button 
                            onClick={() => setIsTemplateMenuOpen(!isTemplateMenuOpen)}
                            className="bg-white text-gray-700 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-gray-50 border border-gray-200 transition-colors"
                        >
                            <Download size={16}/> Carica Modello
                        </button>
                        {isTemplateMenuOpen && (
                            <div className="absolute top-full left-0 mt-2 w-72 bg-white border border-gray-200 rounded-lg shadow-xl z-20 overflow-hidden">
                                <div className="p-2 bg-gray-50 border-b border-gray-100 text-[10px] font-bold text-gray-500 uppercase">Modelli Salvati</div>
                                <div className="max-h-60 overflow-y-auto">
                                    {templates.length === 0 ? <p className="text-xs text-gray-400 p-4 text-center">Nessun modello.</p> : templates.map(t => (
                                        <div key={t.id} onClick={() => handleLoadTemplate(t)} className="px-4 py-2 hover:bg-indigo-50 cursor-pointer flex justify-between items-center group">
                                            <div>
                                                <div className="text-sm font-medium text-gray-800">{t.name}</div>
                                                <div className="text-[10px] text-gray-400">{t.tasks.length} task</div>
                                            </div>
                                            <button onClick={(e) => handleDeleteTemplate(e, t.id)} className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100"><Trash2 size={12}/></button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="ml-auto flex gap-2">
                        {isSaveMode ? (
                            <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-lg animate-in fade-in slide-in-from-right-2">
                                <input 
                                    value={newTemplateName} 
                                    onChange={e => setNewTemplateName(e.target.value)} 
                                    placeholder="Nome modello..." 
                                    className="bg-white border border-gray-300 rounded px-2 py-1 text-sm outline-none w-40"
                                    autoFocus
                                />
                                <button onClick={handleSaveTemplate} className="bg-indigo-600 text-white p-1 rounded hover:bg-indigo-700"><CheckCircle size={16}/></button>
                                <button onClick={() => setIsSaveMode(false)} className="text-gray-500 p-1 hover:text-gray-700"><X size={16}/></button>
                            </div>
                        ) : (
                            <button 
                                onClick={() => setIsSaveMode(true)}
                                disabled={tasks.length === 0}
                                className="text-gray-500 px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-gray-100 hover:text-indigo-600 transition-colors disabled:opacity-50"
                            >
                                <Save size={16}/> Salva come Modello
                            </button>
                        )}
                    </div>
                </div>

                {/* MAIN CONTENT - EXCEL STYLE EDITING */}
                <div className="flex-1 overflow-y-auto p-6 bg-gray-50 custom-scrollbar">
                    {tasks.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
                            <Sparkles size={48} className="mb-4 opacity-20"/>
                            <p className="text-lg font-medium">Lista vuota.</p>
                            <p className="text-sm">Genera con AI o aggiungi task manualmente.</p>
                            <div className="flex gap-2 mt-4">
                                {phaseOrder.map(phase => (
                                    <button key={phase} onClick={() => handleAddTask(phase)} className="text-xs bg-white border border-gray-300 px-3 py-1.5 rounded-lg hover:border-indigo-500 hover:text-indigo-600">
                                        + {phaseConfig[phase]}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {phaseOrder.map(phase => {
                                const phaseTasks = tasks.filter(t => t.phase === phase);
                                return (
                                    <div key={phase} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                                        <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex justify-between items-center group">
                                            {/* Phase Name Editor */}
                                            <input 
                                                value={phaseConfig[phase]} 
                                                onChange={(e) => handlePhaseNameChange(phase, e.target.value)}
                                                className="text-sm font-bold text-gray-800 uppercase tracking-wide bg-transparent border-b border-transparent focus:border-indigo-500 focus:bg-white outline-none transition-all w-1/2"
                                            />
                                            <span className="text-xs font-mono text-gray-400 bg-white px-2 rounded border">{phaseTasks.length} task</span>
                                        </div>
                                        <div className="divide-y divide-gray-100">
                                            {/* Header Row for Columns */}
                                            {phaseTasks.length > 0 && (
                                                <div className="flex items-center gap-2 p-2 bg-gray-50/50 text-[10px] text-gray-400 uppercase font-bold">
                                                    <div className="w-5"></div>
                                                    <div className="flex-1">Descrizione</div>
                                                    <div className="w-24">Reparto</div>
                                                    <div className="w-32">Fase</div>
                                                    <div className="w-32">Scadenza</div>
                                                    <div className="w-32">Assegna a</div>
                                                    <div className="w-6"></div>
                                                </div>
                                            )}

                                            {phaseTasks.map(task => (
                                                <div key={task.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 group">
                                                    <GripVertical size={16} className="text-gray-300 cursor-move shrink-0"/>
                                                    
                                                    {/* Description Input */}
                                                    <input 
                                                        value={task.description}
                                                        onChange={(e) => handleTaskUpdate(task.id, 'description', e.target.value)}
                                                        className="flex-1 bg-transparent border border-transparent hover:border-gray-200 focus:border-indigo-400 focus:bg-white rounded px-2 py-1.5 text-sm text-gray-800 outline-none transition-all min-w-[150px]"
                                                        placeholder="Descrizione attività..."
                                                    />

                                                    {/* Department Select */}
                                                    <select
                                                        value={task.department}
                                                        onChange={(e) => handleTaskUpdate(task.id, 'department', e.target.value)}
                                                        className="w-24 bg-transparent border border-transparent hover:border-gray-200 focus:border-indigo-400 focus:bg-white rounded px-2 py-1.5 text-xs font-medium text-gray-600 outline-none"
                                                    >
                                                        <option value="HR">HR</option>
                                                        <option value="IT">IT</option>
                                                        <option value="TEAM">TEAM</option>
                                                        <option value="ADMIN">ADMIN</option>
                                                    </select>

                                                    {/* Phase Mover */}
                                                    <select
                                                        value={task.phase}
                                                        onChange={(e) => handleTaskUpdate(task.id, 'phase', e.target.value as OnboardingPhase)}
                                                        className="w-32 bg-transparent border border-transparent hover:border-gray-200 focus:border-indigo-400 focus:bg-white rounded px-2 py-1.5 text-xs text-gray-500 outline-none"
                                                    >
                                                        {phaseOrder.map(p => <option key={p} value={p}>{phaseConfig[p]}</option>)}
                                                    </select>

                                                    {/* Due Date Picker */}
                                                    <input 
                                                        type="date"
                                                        value={task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : ''}
                                                        onChange={(e) => handleTaskDateChange(task.id, e.target.value)}
                                                        className="w-32 bg-transparent border border-transparent hover:border-gray-200 focus:border-indigo-400 focus:bg-white rounded px-2 py-1.5 text-xs text-gray-600 outline-none cursor-pointer"
                                                    />

                                                    {/* Assignee Select */}
                                                    <select
                                                        value={task.assigneeId || ''}
                                                        onChange={(e) => handleTaskUpdate(task.id, 'assigneeId', e.target.value || undefined)}
                                                        className="w-32 bg-transparent border border-transparent hover:border-gray-200 focus:border-indigo-400 focus:bg-white rounded px-2 py-1.5 text-xs text-gray-600 outline-none"
                                                    >
                                                        <option value="">-- Nessuno --</option>
                                                        {allUsers.map(u => (
                                                            <option key={u.uid} value={u.uid}>{u.name}</option>
                                                        ))}
                                                    </select>

                                                    <button onClick={() => handleDeleteTask(task.id)} className="p-1.5 text-gray-300 hover:text-red-500 rounded hover:bg-red-50 transition-colors shrink-0">
                                                        <Trash2 size={14}/>
                                                    </button>
                                                </div>
                                            ))}
                                            <button 
                                                onClick={() => handleAddTask(phase)}
                                                className="w-full py-2 text-xs text-indigo-600 font-medium hover:bg-indigo-50 flex items-center justify-center gap-1 transition-colors"
                                            >
                                                <Plus size={12}/> Aggiungi Attività a {phaseConfig[phase]}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* FOOTER */}
                <div className="p-4 border-t border-gray-100 bg-white rounded-b-xl flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors">Annulla</button>
                    <button 
                        onClick={handleConfirm} 
                        disabled={tasks.length === 0}
                        className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 shadow-sm disabled:opacity-50 transition-colors"
                    >
                        Conferma e Avvia Processo
                    </button>
                </div>
            </div>
        </div>
    );
};