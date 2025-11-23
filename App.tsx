
import React, { useState, useEffect, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { CandidateView } from './components/CandidateView';
import { RecruitmentView } from './components/RecruitmentView';
import { SettingsView } from './components/SettingsView';
import { DashboardView } from './components/DashboardView';
import { LoginView } from './components/LoginView';
import { OnboardingView } from './components/OnboardingView';
import { subscribeToData, generateId, addCandidate, createApplication, syncUserProfile, seedDatabase } from './services/storage';
import { AppState, User, UploadQueueItem, Candidate, SelectionStatus, CandidateStatus, UserRole } from './types';
import { auth, db, initFirebase } from './services/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { parseCV, evaluateFit } from './services/ai';
import { Loader2, CheckCircle, AlertTriangle, X, FileText, Minimize2, Maximize2, UploadCloud, Trash2 } from 'lucide-react';

// Helper to extract photo with Rule of Thirds Geometry
const extractPhoto = async (file: File, coords: [number, number, number, number]): Promise<string | undefined> => {
    if (!coords || coords.length !== 4) return undefined;
    const [ymin, xmin, ymax, xmax] = coords;
    
    try {
        let imageSource: CanvasImageSource | null = null;
        let width = 0;
        let height = 0;
        
        if (file.type === 'application/pdf') {
            const pdfjs = (window as any).pdfjsLib;
            if (!pdfjs) return undefined;
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
            const page = await pdf.getPage(1);
            const viewport = page.getViewport({ scale: 2.0 });
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            await page.render({ canvasContext: context!, viewport: viewport }).promise;
            imageSource = canvas;
            width = canvas.width;
            height = canvas.height;
        } else if (file.type.startsWith('image/')) {
            const bitmap = await createImageBitmap(file);
            imageSource = bitmap;
            width = bitmap.width;
            height = bitmap.height;
        }
        
        if (imageSource) {
            // Convert Normalized 0-1000 coords to Pixels
            const faceY = (ymin / 1000) * height;
            const faceX = (xmin / 1000) * width;
            const faceH = ((ymax - ymin) / 1000) * height;
            const faceW = ((xmax - xmin) / 1000) * width;

            // --- GEOMETRIC PORTRAIT LOGIC ---
            const padTop = faceH * 0.8;
            const padBottom = faceH * 0.5;
            const newHeight = faceH + padTop + padBottom;
            const newWidth = newHeight;
            const noseX = faceX + (faceW / 2);
            let cropX = noseX - (newWidth / 2);
            let cropY = faceY - padTop;
            
            if (cropY < 0) cropY = 0;
            if (cropX < 0) cropX = 0;
            if (cropX + newWidth > width) cropX = Math.max(0, width - newWidth);
            if (cropY + newHeight > height) cropY = Math.max(0, height - newHeight);
            
            const finalW = Math.min(newWidth, width);
            const finalH = Math.min(newHeight, height);
            
            const cropCanvas = document.createElement('canvas');
            cropCanvas.width = finalW;
            cropCanvas.height = finalH;
            const ctx = cropCanvas.getContext('2d');
            
            if (ctx) {
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, finalW, finalH);
                ctx.drawImage(imageSource, cropX, cropY, finalW, finalH, 0, 0, finalW, finalH);
                return cropCanvas.toDataURL('image/jpeg', 0.95).split(',')[1];
            }
        }
    } catch (e) { console.error("Photo extraction error:", e); }
    return undefined;
};

// --- OPTIMIZATION: Resize Image before sending to AI ---
const resizeImage = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            const MAX_SIZE = 1024;

            if (width > height) {
                if (width > MAX_SIZE) {
                    height *= MAX_SIZE / width;
                    width = MAX_SIZE;
                }
            } else {
                if (height > MAX_SIZE) {
                    width *= MAX_SIZE / height;
                    height = MAX_SIZE;
                }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', 0.8).split(',')[1]);
            } else {
                reject(new Error("Canvas context not available"));
            }
        };
        img.onerror = reject;
        img.src = URL.createObjectURL(file);
    });
};

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [data, setData] = useState<AppState>({ candidates: [], jobs: [], applications: [], onboarding: [] });
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  
  // Data Loading States
  const [loadingData, setLoadingData] = useState(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // --- GLOBAL UPLOAD STATE ---
  const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([]);
  const [isUploadWidgetOpen, setIsUploadWidgetOpen] = useState(false);
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);

  // Refresh Trigger
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [firebaseInitialized, setFirebaseInitialized] = useState(0);
  const [authInstance, setAuthInstance] = useState<any>(null);
  const [hasAutoSeeded, setHasAutoSeeded] = useState(false);

  // Initialization
  useEffect(() => {
      const { auth: a } = initFirebase();
      setAuthInstance(a);
      setFirebaseInitialized(Date.now());
  }, []);

  // Handle Auth State
  useEffect(() => {
    if (authInstance) {
        const unsubscribeAuth = onAuthStateChanged(authInstance, async (firebaseUser) => {
            if (firebaseUser) {
                const basicUser: User = {
                    uid: firebaseUser.uid,
                    name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
                    email: firebaseUser.email || '',
                    role: UserRole.TEAM, // Default role, will be overwritten by sync
                    avatar: firebaseUser.photoURL || `https://ui-avatars.com/api/?name=${firebaseUser.email}&background=random`
                };

                // Sync with Firestore to get real role
                const syncedUser = await syncUserProfile(basicUser);
                setUser(syncedUser);
            } else {
                setUser(null);
            }
        });
        return () => unsubscribeAuth();
    } else {
        const storedUser = localStorage.getItem('talentflow_user_session');
        if (storedUser) {
            try { setUser(JSON.parse(storedUser)); } catch(e) { console.error("Invalid session"); }
        }
    }
  }, [authInstance]);

  // --- RBAC REDIRECT LOGIC ---
  useEffect(() => {
      if (user) {
          // If user is TEAM, they cannot access dashboard or settings or candidates
          // They are forced to 'recruitment'
          if (user.role === UserRole.TEAM && activeTab !== 'recruitment') {
              setActiveTab('recruitment');
          }
          // If user is HR, they cannot access settings
          if (user.role === UserRole.HR && activeTab === 'settings') {
              setActiveTab('dashboard');
          }
      }
  }, [user, activeTab]);


  // Handle Data Subscription (Realtime) - FIXED RACE CONDITION
  useEffect(() => {
    if (db && !user) {
        setLoadingData(true);
        return;
    }

    setConnectionError(null);
    // PASS USER CONTEXT to apply security filters
    const unsubscribe = subscribeToData(
        user,
        (newData) => {
            setData(newData);
            setLoadingData(false);
            setConnectionError(null);
        },
        (error) => {
            if (error.code === 'permission-denied') {
                setConnectionError("Accesso Negato: Verifica di essere loggato con un utente abilitato.");
            } else {
                setConnectionError("Errore di connessione al Database.");
            }
            setLoadingData(false);
        }
    );
    return () => unsubscribe();
  }, [user, refreshTrigger, firebaseInitialized]); 

  // AUTO-SEED DEMO DATA
  useEffect(() => {
      if (user && !loadingData && data.candidates.length === 0 && !hasAutoSeeded) {
          // If DB is empty and we haven't seeded yet, do it automatically
          const autoSeed = async () => {
              console.log("Auto-seeding demo data for user:", user.uid);
              await seedDatabase(user.uid);
              setHasAutoSeeded(true);
              setRefreshTrigger(p => p + 1); // Force refresh
          };
          autoSeed();
      }
  }, [user, loadingData, data.candidates.length, hasAutoSeeded]);

  const handleConfigChange = () => {
      const { auth: a } = initFirebase();
      setAuthInstance(a);
      setFirebaseInitialized(Date.now());
  };

  // ... (Upload logic - handleUploadFiles, processQueue, saveCandidateAndApp, handleForceSave - KEPT SAME)
  const handleUploadFiles = (files: File[], jobId?: string) => {
      const newItems: UploadQueueItem[] = files.map(file => ({ id: generateId(), file, status: 'IDLE', jobId }));
      setUploadQueue(prev => [...prev, ...newItems]);
      setIsUploadWidgetOpen(true);
  };

  useEffect(() => {
      const processQueue = async () => {
          if (isProcessingQueue) return;
          const nextItem = uploadQueue.find(i => i.status === 'IDLE');
          if (!nextItem) return;

          setIsProcessingQueue(true);
          try {
            setUploadQueue(prev => prev.map(i => i.id === nextItem.id ? { ...i, status: 'PROCESSING' } : i));
            
            let base64 = '';
            let finalMimeType = nextItem.file.type; // Default

            // OPTIMIZATION: Resize images before sending to AI
            if (nextItem.file.type.startsWith('image/')) {
                base64 = await resizeImage(nextItem.file);
                finalMimeType = 'image/jpeg'; // Resized image is always JPEG
            } else {
                 base64 = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve((reader.result as string).split(',')[1]);
                    reader.onerror = reject;
                    reader.readAsDataURL(nextItem.file);
                });
            }

            const parsedData = await parseCV(base64, finalMimeType);
            let photoBase64 = undefined;
            if (parsedData.faceCoordinates) {
                photoBase64 = await extractPhoto(nextItem.file, parsedData.faceCoordinates);
            }

            let aiEvaluation: { score: number, reasoning: string } | undefined = undefined;
            if (nextItem.jobId) {
                const job = data.jobs.find(j => j.id === nextItem.jobId);
                if (job) {
                    try {
                         const tempCandidate = { ...parsedData, id: 'temp', skills: parsedData.skills || [], summary: parsedData.summary || '', age: parsedData.age, fullName: parsedData.fullName || 'Candidate' } as Candidate;
                         aiEvaluation = await evaluateFit(tempCandidate, job);
                    } catch (e) { console.warn("Failed to calculate AI Fit during upload:", e); }
                }
            }

            const emailExists = data.candidates.some(c => c.email.toLowerCase() === parsedData.email?.toLowerCase());
            const nameExists = data.candidates.some(c => c.fullName.toLowerCase() === parsedData.fullName?.toLowerCase());
            const duplicateReason = emailExists ? "Email esistente" : nameExists ? "Nome esistente" : undefined;

            const fullCandidateData = { ...parsedData, photo: photoBase64, cvFileBase64: base64, cvMimeType: finalMimeType };

            if (duplicateReason) {
                setUploadQueue(prev => prev.map(i => i.id === nextItem.id ? { ...i, status: 'DUPLICATE', duplicateReason, parsedData: fullCandidateData } : i));
            } else {
                await saveCandidateAndApp(fullCandidateData, nextItem.jobId, aiEvaluation);
                setUploadQueue(prev => prev.map(i => i.id === nextItem.id ? { ...i, status: 'SUCCESS' } : i));
            }

          } catch (error: any) {
              setUploadQueue(prev => prev.map(i => i.id === nextItem.id ? { ...i, status: 'ERROR', errorMessage: error.message } : i));
          } finally {
              setIsProcessingQueue(false);
          }
      };
      processQueue();
  }, [uploadQueue, isProcessingQueue, data.candidates, data.jobs]);

  const saveCandidateAndApp = async (parsedData: any, jobId?: string, aiEvaluation?: { score: number, reasoning: string }) => {
      const newCandidate: Candidate = {
          id: generateId(),
          fullName: parsedData.fullName || 'Sconosciuto',
          email: parsedData.email || 'no-email',
          phone: parsedData.phone || '',
          age: parsedData.age,
          skills: parsedData.skills || [],
          summary: parsedData.summary || '',
          currentCompany: parsedData.currentCompany || '',
          currentRole: parsedData.currentRole || '',
          currentSalary: parsedData.currentSalary || '',
          benefits: parsedData.benefits || [],
          photo: parsedData.photo,
          cvFileBase64: parsedData.cvFileBase64,
          cvMimeType: parsedData.cvMimeType,
          status: CandidateStatus.CANDIDATE,
          createdAt: Date.now(),
          comments: []
      };
      await addCandidate(newCandidate);

      if (jobId) {
          await createApplication({
              id: generateId(),
              candidateId: newCandidate.id,
              jobId,
              status: SelectionStatus.TO_ANALYZE,
              aiScore: aiEvaluation?.score,
              aiReasoning: aiEvaluation?.reasoning,
              updatedAt: Date.now()
          });
      }
  };

  const handleForceSave = async (itemId: string) => {
      const item = uploadQueue.find(i => i.id === itemId);
      if (!item || !item.parsedData) return;
      setIsProcessingQueue(true);
      try {
           let aiEvaluation = undefined;
           if (item.jobId) {
               const job = data.jobs.find(j => j.id === item.jobId);
               if (job) {
                    try {
                        const tempCandidate = { ...item.parsedData, skills: item.parsedData.skills || [] } as Candidate;
                        aiEvaluation = await evaluateFit(tempCandidate, job);
                    } catch(e){}
               }
           }
          await saveCandidateAndApp(item.parsedData, item.jobId, aiEvaluation);
          setUploadQueue(prev => prev.map(i => i.id === itemId ? { ...i, status: 'SUCCESS' } : i));
      } catch(e) { console.error(e); } finally { setIsProcessingQueue(false); }
  };

  const handleLogin = (loggedInUser: User) => {
      setUser(loggedInUser);
      if (!authInstance) localStorage.setItem('talentflow_user_session', JSON.stringify(loggedInUser));
  };

  const handleLogout = () => {
      if (authInstance) authInstance.signOut();
      setUser(null);
      localStorage.removeItem('talentflow_user_session');
  };

  const renderContent = () => {
    if (loadingData) return <div className="flex items-center justify-center h-full text-gray-400"><Loader2 className="animate-spin mr-2"/> Caricamento dati...</div>;
    
    if (connectionError) return (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <AlertTriangle className="text-red-500 mb-4" size={48} />
            <h2 className="text-xl font-bold text-gray-900 mb-2">Errore Connessione</h2>
            <p className="text-gray-500 mb-6">{connectionError}</p>
            <button onClick={() => window.location.reload()} className="px-4 py-2 bg-indigo-600 text-white rounded-lg">Riprova</button>
        </div>
    );

    const props = { 
        candidates: data.candidates, 
        jobs: data.jobs, 
        applications: data.applications, 
        refreshData: () => setRefreshTrigger(prev => prev + 1), 
        currentUser: user,
        onUpload: handleUploadFiles
    };

    switch (activeTab) {
      case 'dashboard': return <DashboardView data={data} onNavigate={setActiveTab} />;
      case 'candidates': return <CandidateView {...props} />;
      case 'recruitment': return <RecruitmentView data={data} refreshData={() => setRefreshTrigger(prev => prev + 1)} currentUser={user} onUpload={handleUploadFiles} />;
      case 'onboarding': return <OnboardingView data={data} refreshData={() => setRefreshTrigger(prev => prev + 1)} currentUser={user} />;
      case 'settings': return <SettingsView refreshData={() => setRefreshTrigger(prev => prev + 1)} onNavigate={setActiveTab} currentUser={user} />; 
      default: return <CandidateView {...props} />;
    }
  };

  if (!user) return <LoginView onLogin={handleLogin} isCloudConfigured={!!db} />;
  
  const pendingCount = uploadQueue.filter(i => i.status === 'IDLE' || i.status === 'PROCESSING').length;
  const duplicateCount = uploadQueue.filter(i => i.status === 'DUPLICATE').length;

  return (
    <div className="flex min-h-screen bg-gray-50 overflow-hidden relative">
      <Sidebar 
        activeTab={activeTab} 
        onTabChange={setActiveTab} 
        isCollapsed={isSidebarCollapsed}
        toggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        user={user}
        onLogout={handleLogout}
      />
      <main className="flex-1 h-screen overflow-hidden relative transition-all duration-300">
        {renderContent()}
      </main>

      {/* GLOBAL UPLOAD WIDGET */}
      {uploadQueue.length > 0 && (
          <div className={`fixed bottom-6 right-6 w-96 bg-white rounded-xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden transition-all duration-300 z-50 ${isUploadWidgetOpen ? 'h-96' : 'h-14'}`}>
              <div className="bg-gray-900 text-white p-3 flex items-center justify-between cursor-pointer hover:bg-gray-800 transition-colors" onClick={() => setIsUploadWidgetOpen(!isUploadWidgetOpen)}>
                  <div className="flex items-center gap-3">{isProcessingQueue ? <Loader2 size={18} className="animate-spin"/> : <UploadCloud size={18}/>}<span className="font-medium text-sm">Upload ({pendingCount} in coda)</span>{duplicateCount > 0 && <span className="bg-yellow-500 text-gray-900 text-xs font-bold px-1.5 rounded">{duplicateCount} !</span>}</div>
                  <div className="flex items-center gap-2">{isUploadWidgetOpen ? <Minimize2 size={16}/> : <Maximize2 size={16}/>}<button onClick={(e) => { e.stopPropagation(); setUploadQueue([]); }} className="hover:text-red-400 p-1 rounded" title="Chiudi e pulisci"><X size={16}/></button></div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
                  {uploadQueue.map(item => (
                      <div key={item.id} className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm text-sm">
                          <div className="flex items-center justify-between mb-1"><span className="font-bold truncate max-w-[180px] text-gray-800">{item.file.name}</span>{item.status === 'IDLE' && <span className="text-gray-400 text-xs">In coda</span>}{item.status === 'PROCESSING' && <Loader2 size={14} className="animate-spin text-indigo-600"/>}{item.status === 'SUCCESS' && <CheckCircle size={14} className="text-green-500"/>}{item.status === 'ERROR' && <X size={14} className="text-red-500"/>}{item.status === 'DUPLICATE' && <AlertTriangle size={14} className="text-yellow-500"/>}</div>
                          {item.status === 'ERROR' && <p className="text-red-500 text-xs">{item.errorMessage}</p>}
                          {item.status === 'DUPLICATE' && (<div className="mt-2"><p className="text-yellow-700 text-xs mb-2 font-medium">{item.duplicateReason}</p><div className="flex gap-2"><button onClick={() => setUploadQueue(q => q.filter(i => i.id !== item.id))} className="px-3 py-1.5 bg-gray-100 text-red-600 hover:bg-red-100 border border-gray-200 rounded text-xs font-medium flex items-center gap-1 transition-colors shadow-sm"><Trash2 size={12} />Scarta</button><button onClick={() => handleForceSave(item.id)} className="px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 text-xs font-medium shadow-sm">Salva</button></div></div>)}
                      </div>
                  ))}
              </div>
              <div className="p-3 border-t border-gray-200 bg-white flex justify-between"><button onClick={() => setUploadQueue([])} className="text-xs text-gray-400 hover:text-red-500" disabled={isProcessingQueue}>Cancella completati</button></div>
          </div>
      )}
    </div>
  );
}

export default App;
