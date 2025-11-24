
import React, { useState, useEffect, useRef } from 'react';
import { Database, RefreshCw, AlertTriangle, Cloud, Save, Trash2, Check, Download, Upload, HardDrive, Loader2, Users, Building2 } from 'lucide-react';
import { seedDatabase, getFullDatabase, restoreDatabase, getAllUsers, updateUserRole, deleteUser, updateCompanyInfo, getCompanyInfo } from '../services/storage';
import { getStoredFirebaseConfig, saveFirebaseConfig, removeFirebaseConfig, FirebaseConfig } from '../services/firebase';
import { AppState, User, UserRole, CompanyInfo } from '../types';

interface SettingsViewProps {
    refreshData: () => void;
    onNavigate: (tab: string) => void;
    currentUser: User | null;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ refreshData, onNavigate, currentUser }) => {
    const [isCloudConfigOpen, setIsCloudConfigOpen] = useState(false);
    const [firebaseConfigStr, setFirebaseConfigStr] = useState('');
    const [currentConfig, setCurrentConfig] = useState<FirebaseConfig | null>(null);
    const [parseError, setParseError] = useState<string | null>(null);

    // Backup State
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [backupStats, setBackupStats] = useState<{ size: string, candidates: number, cvs: number } | null>(null);
    const [backupData, setBackupData] = useState<AppState | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [restoreStatus, setRestoreStatus] = useState<'IDLE' | 'RESTORING' | 'SUCCESS' | 'ERROR'>('IDLE');

    // Demo Data State
    const [isLoadingDemo, setIsLoadingDemo] = useState(false);

    // User Management State
    const [users, setUsers] = useState<User[]>([]);
    const [isLoadingUsers, setIsLoadingUsers] = useState(false);

    // Company Info State
    const [companyInfo, setCompanyInfo] = useState<CompanyInfo>({ name: '', industry: '', description: '' });
    const [isSavingCompany, setIsSavingCompany] = useState(false);

    useEffect(() => {
        const cfg = getStoredFirebaseConfig();
        setCurrentConfig(cfg);
        if (cfg) {
            setFirebaseConfigStr(JSON.stringify(cfg, null, 2));
        }

        // Fetch users if Admin
        if (currentUser?.role === UserRole.ADMIN) {
            loadUsers();
        }

        // Fetch Company Info
        getCompanyInfo().then(info => {
            if (info) setCompanyInfo(info);
        });

    }, [currentUser]);

    const loadUsers = async () => {
        setIsLoadingUsers(true);
        const userList = await getAllUsers();
        setUsers(userList);
        setIsLoadingUsers(false);
    };

    const handleRoleChange = async (uid: string, newRole: UserRole) => {
        await updateUserRole(uid, newRole);
        // Optimistic update
        setUsers(users.map(u => u.uid === uid ? { ...u, role: newRole } : u));
    };

    const handleDeleteUser = async (uid: string) => {
        if(confirm("Sei sicuro di voler eliminare questo utente? Non potrà più accedere, ma lo storico rimarrà visibile.")) {
            await deleteUser(uid);
            setUsers(users.map(u => u.uid === uid ? { ...u, isDeleted: true } : u));
        }
    };

    const handleSaveCompanyInfo = async () => {
        setIsSavingCompany(true);
        try {
            await updateCompanyInfo(companyInfo);
            refreshData(); // Sync global state
            alert("Informazioni aziendali salvate con successo.");
        } catch(e) {
            alert("Errore salvataggio informazioni.");
        } finally {
            setIsSavingCompany(false);
        }
    };

    const parseFirebaseConfig = (input: string): any => {
        try {
            return JSON.parse(input);
        } catch (e) {
            // Ignore
        }

        const config: any = {};
        const fields = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];
        let foundCount = 0;

        fields.forEach(field => {
            const regex = new RegExp(`\\b${field}\\s*:\\s*["']([^"']+)["']`);
            const match = input.match(regex);
            if (match && match[1]) {
                config[field] = match[1];
                foundCount++;
            }
        });

        if (foundCount < 2) {
             throw new Error("Non riesco a trovare i dati di configurazione nel testo incollato.");
        }
        return config;
    };

    const handleSaveConfig = () => {
        setParseError(null);
        try {
            const config = parseFirebaseConfig(firebaseConfigStr);
            const requiredFields = ['apiKey', 'projectId', 'authDomain'];
            const missing = requiredFields.filter(field => !config[field]);
            if (missing.length > 0) throw new Error(`Mancano: ${missing.join(', ')}`);
            saveFirebaseConfig(config as FirebaseConfig);
            setCurrentConfig(config);
            setIsCloudConfigOpen(false);
            // Reload to ensure Firebase is re-initialized globally
            window.location.reload();
        } catch (e: any) {
            setParseError(e.message || "Errore nel formato.");
        }
    };

    const handleRemoveConfig = () => {
        if (confirm("Disconnettere Cloud?")) {
            removeFirebaseConfig();
            setCurrentConfig(null);
            setFirebaseConfigStr('');
            // Reload to ensure Firebase is disconnected globally
            window.location.reload();
        }
    };
    
    const handleLoadDemoData = async () => {
        if(confirm("Questa operazione aggiungerà candidati e posizioni di prova. Vuoi procedere?")) {
            setIsLoadingDemo(true);
            try {
                // Explicitly pass current user ID to ensure visibility of created jobs
                await seedDatabase(currentUser?.uid);
                setTimeout(() => {
                    setIsLoadingDemo(false);
                    onNavigate('recruitment');
                }, 1000);
            } catch (e: any) {
                console.error(e);
                setIsLoadingDemo(false);
                alert("ERRORE: " + e.message + "\n\nSuggerimento: Controlla che le Regole di Sicurezza su Firebase permettano la scrittura.");
            }
        }
    };

    const analyzeBackup = async () => {
        setIsAnalyzing(true);
        try {
            const data = await getFullDatabase();
            setBackupData(data);
            
            const jsonString = JSON.stringify(data);
            const bytes = new Blob([jsonString]).size;
            const mb = (bytes / (1024 * 1024)).toFixed(2);
            const cvCount = data.candidates.filter(c => c.cvFileBase64).length;
            
            setBackupStats({ size: mb + ' MB', candidates: data.candidates.length, cvs: cvCount });
        } catch(e) {
            console.error(e);
            alert("Errore analisi backup");
        } finally {
            setIsAnalyzing(false);
        }
    };

    const performDownload = () => {
        if (!backupData) return;
        const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `talentflow_backup_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleRestoreFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!confirm("ATTENZIONE: Il ripristino SOVRASCRIVERÀ tutti i dati attuali. Continuare?")) {
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }

        setRestoreStatus('RESTORING');
        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const json = evt.target?.result as string;
                const data = JSON.parse(json);
                await restoreDatabase(data);
                setRestoreStatus('SUCCESS');
                refreshData();
                setTimeout(() => setRestoreStatus('IDLE'), 3000);
            } catch (err) {
                console.error(err);
                setRestoreStatus('ERROR');
            }
        };
        reader.readAsText(file);
    };

    return (
        <div className="p-8 max-w-4xl mx-auto h-full overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Impostazioni</h2>
            </div>
            
            <div className="space-y-8">
                {/* COMPANY INFO SECTION */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <Building2 size={20} className="text-indigo-600"/> Informazioni Aziendali
                    </h3>
                    <p className="text-sm text-gray-500 mb-4">
                        Queste informazioni verranno utilizzate dall'AI per contestualizzare le Job Description, le Valutazioni e l'Onboarding.
                    </p>
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Nome Azienda</label>
                                <input 
                                    value={companyInfo.name}
                                    onChange={e => setCompanyInfo({...companyInfo, name: e.target.value})}
                                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                                    placeholder="Es. TechCorp Solutions"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Settore</label>
                                <input 
                                    value={companyInfo.industry}
                                    onChange={e => setCompanyInfo({...companyInfo, industry: e.target.value})}
                                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                                    placeholder="Es. Software SaaS, FinTech..."
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Descrizione Attività e Valori</label>
                            <textarea 
                                value={companyInfo.description}
                                onChange={e => setCompanyInfo({...companyInfo, description: e.target.value})}
                                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 h-24 resize-none"
                                placeholder="Descrivi cosa fa l'azienda, la cultura e i valori principali..."
                            />
                        </div>
                        <div className="flex justify-end">
                            <button 
                                onClick={handleSaveCompanyInfo}
                                disabled={isSavingCompany}
                                className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors shadow-sm flex items-center gap-2 disabled:opacity-50"
                            >
                                {isSavingCompany ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>}
                                Salva Info
                            </button>
                        </div>
                    </div>
                </div>

                {/* ADMIN: USER MANAGEMENT */}
                {currentUser?.role === UserRole.ADMIN && (
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-indigo-100">
                        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <Users size={20} className="text-indigo-600"/> Gestione Utenti (Admin)
                        </h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-gray-50 text-gray-500">
                                    <tr>
                                        <th className="p-3 rounded-l-lg">Utente</th>
                                        <th className="p-3">Email</th>
                                        <th className="p-3">Ruolo</th>
                                        <th className="p-3 rounded-r-lg w-20"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {isLoadingUsers ? (
                                        <tr><td colSpan={4} className="p-4 text-center"><Loader2 className="animate-spin inline"/> Caricamento...</td></tr>
                                    ) : users.map(u => (
                                        <tr key={u.uid || u.email} className={u.isDeleted ? "opacity-50 bg-gray-50" : ""}>
                                            <td className="p-3 font-medium flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-indigo-600 font-bold text-xs border border-gray-200">
                                                    {u.avatar ? <img src={u.avatar} className="w-full h-full rounded-full"/> : (u.name || 'U').charAt(0)}
                                                </div>
                                                <div>
                                                    <div className={u.isDeleted ? "line-through text-gray-500" : "text-gray-900"}>
                                                        {u.name || 'Utente Sconosciuto'}
                                                        {u.uid === currentUser.uid && <span className="ml-2 text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">TU</span>}
                                                    </div>
                                                    {u.isDeleted && <div className="text-[10px] text-red-500 font-bold">ELIMINATO</div>}
                                                </div>
                                            </td>
                                            <td className="p-3 text-gray-600">{u.email}</td>
                                            <td className="p-3">
                                                <select 
                                                    value={u.role} 
                                                    onChange={(e) => u.uid && handleRoleChange(u.uid, e.target.value as UserRole)}
                                                    className="bg-white border border-gray-200 rounded px-2 py-1 text-xs font-medium focus:ring-2 focus:ring-indigo-500 outline-none disabled:opacity-50"
                                                    disabled={u.uid === currentUser.uid || !!u.isDeleted}
                                                >
                                                    <option value={UserRole.TEAM}>TEAM</option>
                                                    <option value={UserRole.HR}>HR</option>
                                                    <option value={UserRole.ADMIN}>ADMIN</option>
                                                </select>
                                            </td>
                                            <td className="p-3 text-right">
                                                {u.uid !== currentUser.uid && !u.isDeleted && (
                                                    <button 
                                                        onClick={() => u.uid && handleDeleteUser(u.uid)}
                                                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                        title="Elimina Utente"
                                                    >
                                                        <Trash2 size={16}/>
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* CLOUD CONNECTION */}
                <div className={`bg-white p-6 rounded-xl shadow-sm border-2 transition-all duration-300 ${currentConfig ? 'border-green-200 shadow-green-50' : 'border-gray-100'}`}>
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                <Cloud size={22} className={currentConfig ? "text-green-600" : "text-gray-400"} /> 
                                Connessione Cloud
                            </h3>
                            <p className="text-sm text-gray-500 mt-1">
                                {currentConfig 
                                    ? `Connesso al progetto: ${currentConfig.projectId}` 
                                    : "Abilita la sincronizzazione multi-utente collegando Firebase."}
                            </p>
                        </div>
                        {currentConfig && (
                            <span className="bg-green-100 text-green-800 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                                <Check size={12} /> CONNESSO
                            </span>
                        )}
                    </div>

                    {!isCloudConfigOpen && !currentConfig && (
                            <button 
                            onClick={() => setIsCloudConfigOpen(true)}
                            className="mt-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm flex items-center gap-2"
                            >
                                <Cloud size={16} /> Configura
                            </button>
                    )}

                    {(isCloudConfigOpen || currentConfig) && (
                        <div className="space-y-4 mt-6 animate-in slide-in-from-top-2">
                            <div>
                                <textarea 
                                    value={firebaseConfigStr}
                                    onChange={e => { setFirebaseConfigStr(e.target.value); setParseError(null); }}
                                    placeholder="Incolla qui la configurazione Firebase..."
                                    className={`w-full h-32 p-4 font-mono text-xs bg-gray-50 text-gray-900 border rounded-lg focus:ring-2 outline-none ${parseError ? 'border-red-300' : 'border-gray-200 focus:ring-indigo-500'}`}
                                />
                                {parseError && <p className="text-red-500 text-xs mt-2 flex items-center gap-1"><AlertTriangle size={12} /> {parseError}</p>}
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button onClick={handleSaveConfig} disabled={!firebaseConfigStr.trim()} className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 text-sm font-medium shadow-sm">
                                    <Save size={16} className="inline mr-2"/> {currentConfig ? 'Aggiorna' : 'Salva'}
                                </button>
                                {currentConfig && (
                                    <button onClick={handleRemoveConfig} className="bg-white text-red-600 border border-red-200 px-4 py-2 rounded-lg hover:bg-red-50 text-sm font-medium shadow-sm">
                                        <Trash2 size={16} className="inline mr-2"/> Disconnetti
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* BACKUP & RESTORE */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <HardDrive size={20} className="text-gray-600"/> Backup & Ripristino
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Export */}
                        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                            <h4 className="font-bold text-gray-800 mb-2 flex items-center gap-2"><Download size={16}/> Esporta Dati</h4>
                            <p className="text-xs text-gray-500 mb-4">Scarica un archivio completo inclusi i CV e le foto.</p>
                            
                            {!backupStats ? (
                                <button 
                                    onClick={analyzeBackup}
                                    disabled={isAnalyzing}
                                    className="w-full bg-white border border-gray-300 text-gray-700 px-3 py-2 rounded text-sm font-medium hover:bg-gray-100 shadow-sm flex justify-center"
                                >
                                    {isAnalyzing ? 'Analisi in corso...' : 'Prepara Backup'}
                                </button>
                            ) : (
                                <div className="space-y-3 animate-in fade-in">
                                    <div className="text-xs bg-white p-2 rounded border border-gray-200">
                                        <div className="flex justify-between mb-1"><span>Dimensione:</span> <strong>{backupStats.size}</strong></div>
                                        <div className="flex justify-between mb-1"><span>Candidati:</span> <strong>{backupStats.candidates}</strong></div>
                                        <div className="flex justify-between"><span>Allegati CV:</span> <strong>{backupStats.cvs}</strong></div>
                                    </div>
                                    <button 
                                        onClick={performDownload}
                                        className="w-full bg-indigo-600 text-white px-3 py-2 rounded text-sm font-medium hover:bg-indigo-700 shadow-sm flex items-center justify-center gap-2"
                                    >
                                        <Download size={16}/> Scarica .JSON
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Import */}
                        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                            <h4 className="font-bold text-gray-800 mb-2 flex items-center gap-2"><Upload size={16}/> Ripristina Dati</h4>
                            <p className="text-xs text-gray-500 mb-4">Carica un backup per ripristinare lo stato.</p>
                            
                            <input 
                                type="file" 
                                accept=".json"
                                ref={fileInputRef}
                                onChange={handleRestoreFile}
                                className="hidden"
                            />
                            
                            {restoreStatus === 'IDLE' && (
                                <button 
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-full bg-white border border-gray-300 text-gray-700 px-3 py-2 rounded text-sm font-medium hover:bg-gray-100 shadow-sm flex justify-center gap-2"
                                >
                                    <Upload size={16}/> Seleziona File
                                </button>
                            )}
                                {restoreStatus === 'RESTORING' && <div className="text-center text-sm text-indigo-600 font-medium">Ripristino in corso...</div>}
                                {restoreStatus === 'SUCCESS' && <div className="text-center text-sm text-green-600 font-bold">Ripristino completato!</div>}
                                {restoreStatus === 'ERROR' && <div className="text-center text-sm text-red-600 font-bold">Errore nel file</div>}
                        </div>
                    </div>
                </div>

                {/* DEMO DATA */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <Database size={20} className="text-gray-600"/> Gestione Rapida
                    </h3>
                    <button 
                        onClick={handleLoadDemoData}
                        disabled={isLoadingDemo}
                        className="flex items-center gap-2 bg-white border border-gray-300 text-gray-700 px-4 py-2.5 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium shadow-sm w-full justify-center sm:w-auto disabled:opacity-60"
                    >
                        {isLoadingDemo ? <Loader2 size={16} className="animate-spin"/> : <RefreshCw size={16} />}
                        {isLoadingDemo ? 'Generazione in corso...' : 'Genera Dati Demo'}
                    </button>
                </div>
            </div>
        </div>
    );
};