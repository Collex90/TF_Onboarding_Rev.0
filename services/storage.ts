import { AppState, Candidate, JobPosition, Application, SelectionStatus, Comment, CandidateStatus, User, UserRole, EmailTemplate, ScorecardTemplate, ScorecardSchema, OnboardingProcess, OnboardingTask, OnboardingTemplate, CompanyInfo, Attachment, OnboardingStatus, BackupMetadata, DeletedItem } from '../types';
import { db, auth, storage } from './firebase';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  doc, 
  setDoc, 
  getDoc,
  onSnapshot, 
  query, 
  getDocs,
  writeBatch,
  arrayUnion,
  where,
  deleteDoc,
  arrayRemove
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject, listAll, getMetadata, uploadString, getBytes } from 'firebase/storage';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, updateProfile, signOut } from 'firebase/auth';
import { getStoredFirebaseConfig } from './firebase';

const STORAGE_KEY = 'talentflow_data_v1';
const TEMPLATES_KEY = 'talentflow_scorecard_templates';
const ONBOARDING_TEMPLATES_KEY = 'talentflow_onboarding_templates';
const COMPANY_INFO_KEY = 'talentflow_company_info';

const defaultState: AppState = {
  candidates: [],
  jobs: [],
  applications: [],
  onboarding: [],
  companyInfo: { name: '', industry: '', description: '', productsServices: '' }
};

// Helper for ID generation
export const generateId = (): string => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
};

// --- STORAGE HELPER ---
const base64ToBlob = (base64: string, mimeType: string) => {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
};

const uploadBase64 = async (path: string, base64: string, mimeType: string): Promise<string> => {
    if (!storage) throw new Error("Storage not initialized");
    const blob = base64ToBlob(base64, mimeType);
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, blob);
    return await getDownloadURL(storageRef);
};

// --- SANITIZATION HELPER FOR FIRESTORE ---
const sanitizeForFirestore = (obj: any): any => {
    if (obj === undefined) return null;
    if (obj === null) return null;
    if (Array.isArray(obj)) {
        return obj.map(v => sanitizeForFirestore(v));
    }
    if (typeof obj === 'object') {
        const newObj: any = {};
        Object.keys(obj).forEach(key => {
            const val = obj[key];
            if (val !== undefined) {
                newObj[key] = sanitizeForFirestore(val);
            }
        });
        return newObj;
    }
    return obj;
};

// --- LOCAL STORAGE HELPERS ---
const getLocalData = (): AppState => {
  const stored = localStorage.getItem(STORAGE_KEY);
  const companyStored = localStorage.getItem(COMPANY_INFO_KEY);
  
  let state = { ...defaultState };
  if (stored) {
      try { state = { ...state, ...JSON.parse(stored) }; } catch {}
  }
  if (companyStored) {
      try { state.companyInfo = JSON.parse(companyStored); } catch {}
  }
  return state;
};

const saveLocalData = (data: AppState) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  if (data.companyInfo) {
      localStorage.setItem(COMPANY_INFO_KEY, JSON.stringify(data.companyInfo));
  }
};

// --- COMPANY INFO ---

export const updateCompanyInfo = async (info: CompanyInfo) => {
    if (db) {
        await setDoc(doc(db, 'settings', 'company'), sanitizeForFirestore(info));
    } else {
        localStorage.setItem(COMPANY_INFO_KEY, JSON.stringify(info));
        window.dispatchEvent(new Event('talentflow-local-update'));
    }
};

export const getCompanyInfo = async (): Promise<CompanyInfo | undefined> => {
    if (db) {
        const snap = await getDoc(doc(db, 'settings', 'company'));
        if (snap.exists()) return snap.data() as CompanyInfo;
        return undefined;
    } else {
        const stored = localStorage.getItem(COMPANY_INFO_KEY);
        return stored ? JSON.parse(stored) : undefined;
    }
}

// --- USER MANAGEMENT ---

export const syncUserProfile = async (authUser: User): Promise<User> => {
    if (!db || !authUser.uid) return authUser;
    const userRef = doc(db, 'users', authUser.uid);
    try {
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
            return { ...authUser, ...(userSnap.data() as any) } as User;
        } else {
            const userColl = collection(db, 'users');
            const snapshot = await getDocs(userColl);
            const newUserProfile: User = {
                ...authUser,
                role: snapshot.empty ? UserRole.ADMIN : UserRole.TEAM 
            };
            await setDoc(userRef, sanitizeForFirestore(newUserProfile));
            return newUserProfile;
        }
    } catch (e) {
        console.error("Error syncing user profile:", e);
        return authUser;
    }
};

export const getAllUsers = async (): Promise<User[]> => {
    if (!db) return []; 
    try {
        const snap = await getDocs(collection(db, 'users'));
        return snap.docs.map(d => d.data() as User);
    } catch (e) {
        console.error("Error getting users:", e);
        return [];
    }
};

export const updateUserRole = async (uid: string, newRole: UserRole) => {
    if (!db) return;
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, { role: newRole });
};

export const deleteUser = async (uid: string) => {
    if (!db) return;
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, { isDeleted: true });
};

// ADMIN CREATE USER (Uses a secondary app to avoid logging out current admin)
export const adminCreateUser = async (user: User, password: string): Promise<void> => {
    if (!db) throw new Error("Database not connected");
    const config = getStoredFirebaseConfig();
    if (!config) throw new Error("Config not found");

    // Initialize secondary app
    let secondaryApp;
    const appName = "SecondaryApp-" + Date.now();
    try {
        secondaryApp = initializeApp(config, appName);
        const secondaryAuth = getAuth(secondaryApp);

        const userCred = await createUserWithEmailAndPassword(secondaryAuth, user.email, password);
        await updateProfile(userCred.user, { displayName: user.name });
        
        // Save to Firestore (using MAIN app db)
        await setDoc(doc(db, 'users', userCred.user.uid), sanitizeForFirestore({
            ...user,
            uid: userCred.user.uid,
            avatar: `https://ui-avatars.com/api/?name=${user.name}&background=random`,
            isDeleted: false
        }));

        // Sign out from secondary app
        await signOut(secondaryAuth);
    } catch (e: any) {
        console.error("Error creating user:", e);
        throw e;
    }
};

// --- SCORECARD TEMPLATES ---

export const saveScorecardTemplate = async (name: string, schema: ScorecardSchema) => {
    const template: ScorecardTemplate = {
        id: generateId(),
        name,
        schema,
        createdAt: Date.now()
    };

    if (db) {
        await setDoc(doc(db, 'scorecardTemplates', template.id), sanitizeForFirestore(template));
    } else {
        const stored = localStorage.getItem(TEMPLATES_KEY);
        const templates: ScorecardTemplate[] = stored ? JSON.parse(stored) : [];
        templates.push(template);
        localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates));
    }
};

export const updateScorecardTemplate = async (template: ScorecardTemplate) => {
    if (db) {
        await updateDoc(doc(db, 'scorecardTemplates', template.id), sanitizeForFirestore(template));
    } else {
        const stored = localStorage.getItem(TEMPLATES_KEY);
        if (stored) {
            const templates: ScorecardTemplate[] = JSON.parse(stored);
            const index = templates.findIndex(t => t.id === template.id);
            if (index !== -1) {
                templates[index] = template;
                localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates));
            }
        }
    }
};

export const getScorecardTemplates = async (): Promise<ScorecardTemplate[]> => {
    if (db) {
        const snap = await getDocs(collection(db, 'scorecardTemplates'));
        return snap.docs.map(d => d.data() as ScorecardTemplate).sort((a, b) => b.createdAt - a.createdAt);
    } else {
        const stored = localStorage.getItem(TEMPLATES_KEY);
        return stored ? JSON.parse(stored) : [];
    }
};

export const deleteScorecardTemplate = async (id: string) => {
    if (db) {
        await deleteDoc(doc(db, 'scorecardTemplates', id));
    } else {
        const stored = localStorage.getItem(TEMPLATES_KEY);
        if (stored) {
            const templates: ScorecardTemplate[] = JSON.parse(stored);
            const filtered = templates.filter(t => t.id !== id);
            localStorage.setItem(TEMPLATES_KEY, JSON.stringify(filtered));
        }
    }
};

// --- DATA SUBSCRIPTION (REALTIME) ---
export const subscribeToData = (user: User | null, callback: (data: AppState) => void, onError?: (err: any) => void): (() => void) => {
  if (db) {
    const qCandidates = query(collection(db, 'candidates'));
    
    // Allow seeing all jobs for now to enable metrics, filtering is done in UI
    const qJobs = query(collection(db, 'jobs'));

    const qApps = query(collection(db, 'applications'));
    const qOnboarding = query(collection(db, 'onboarding'));
    const docCompany = doc(db, 'settings', 'company');

    const handleError = (err: any) => {
        console.error("Firestore subscription error:", err);
        if (onError) onError(err);
    };

    let pendingUpdate = false;
    const safeCallback = () => {
        if (pendingUpdate) return;
        pendingUpdate = true;
        requestAnimationFrame(() => {
             refreshFullStateFromFirebase(user, callback).catch(handleError);
             pendingUpdate = false;
        });
    };

    const unsubCandidates = onSnapshot(qCandidates, safeCallback, handleError);
    const unsubJobs = onSnapshot(qJobs, safeCallback, handleError);
    const unsubApps = onSnapshot(qApps, safeCallback, handleError);
    const unsubOnboarding = onSnapshot(qOnboarding, safeCallback, handleError);
    const unsubCompany = onSnapshot(docCompany, safeCallback, handleError);

    return () => {
        unsubCandidates();
        unsubJobs();
        unsubApps();
        unsubOnboarding();
        unsubCompany();
    };
  }

  const getFilteredLocal = () => {
      const d = getLocalData();
      return {
          ...d,
          candidates: (d.candidates || []).filter(c => !c.isDeleted),
          jobs: (d.jobs || []).filter(j => !j.isDeleted),
          applications: (d.applications || []).filter(a => !a.isDeleted)
      };
  };

  callback(getFilteredLocal());
  const handleLocalUpdate = () => callback(getFilteredLocal());
  window.addEventListener('talentflow-local-update', handleLocalUpdate);
  return () => window.removeEventListener('talentflow-local-update', handleLocalUpdate);
};

let cachedState: AppState = { ...defaultState };
const refreshFullStateFromFirebase = async (user: User | null, callback: (data: AppState) => void) => {
    if (!db) return;
    try {
        const qJobs = query(collection(db, 'jobs'));

        const [cSnap, jSnap, aSnap, oSnap, companySnap] = await Promise.all([
            getDocs(collection(db, 'candidates')),
            getDocs(qJobs),
            getDocs(collection(db, 'applications')),
            getDocs(collection(db, 'onboarding')),
            getDoc(doc(db, 'settings', 'company'))
        ]);

        cachedState = {
            candidates: cSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) } as Candidate)).filter(c => !c.isDeleted),
            jobs: jSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) } as JobPosition)).filter(j => !j.isDeleted),
            applications: aSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) } as Application)).filter(a => !a.isDeleted),
            onboarding: oSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) } as OnboardingProcess)),
            companyInfo: companySnap.exists() ? companySnap.data() as CompanyInfo : undefined
        };
        callback(cachedState);
    } catch (e) {
        console.error("Error syncing with Firebase", e);
        throw e; 
    }
};

// --- BACKUP & RESTORE ---
export const getFullDatabase = async (): Promise<AppState> => {
    if (db) {
        const [cSnap, jSnap, aSnap, oSnap, compSnap] = await Promise.all([
            getDocs(collection(db, 'candidates')),
            getDocs(collection(db, 'jobs')),
            getDocs(collection(db, 'applications')),
            getDocs(collection(db, 'onboarding')),
            getDoc(doc(db, 'settings', 'company'))
        ]);
        return {
            candidates: cSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) } as Candidate)),
            jobs: jSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) } as JobPosition)),
            applications: aSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) } as Application)),
            onboarding: oSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) } as OnboardingProcess)),
            companyInfo: compSnap.exists() ? compSnap.data() as CompanyInfo : undefined
        };
    } else {
        return getLocalData();
    }
};

export const restoreDatabase = async (backupData: AppState) => {
    if (!backupData.candidates || !backupData.jobs || !backupData.applications) {
        throw new Error("Il file selezionato non è un backup valido di TalentFlow.");
    }
    if (db) {
        const allItems = [
            ...backupData.candidates.map(c => ({ type: 'candidates', data: c })),
            ...backupData.jobs.map(j => ({ type: 'jobs', data: j })),
            ...backupData.applications.map(a => ({ type: 'applications', data: a })),
            ...(backupData.onboarding || []).map(o => ({ type: 'onboarding', data: o }))
        ];
        const chunkSize = 450;
        for (let i = 0; i < allItems.length; i += chunkSize) {
            const chunk = allItems.slice(i, i + chunkSize);
            const batch = writeBatch(db);
            chunk.forEach(item => {
                const ref = doc(db, item.type, item.data.id);
                batch.set(ref, sanitizeForFirestore(item.data));
            });
            await batch.commit();
        }
        if (backupData.companyInfo) {
            await setDoc(doc(db, 'settings', 'company'), sanitizeForFirestore(backupData.companyInfo));
        }
    } else {
        saveLocalData(backupData);
        window.dispatchEvent(new Event('talentflow-local-update'));
    }
};

// --- CLOUD BACKUP (SYSTEM) ---

export const uploadBackupToCloud = async (state: AppState): Promise<void> => {
    if (!db || !storage) throw new Error("Cloud non attivo");
    const jsonString = JSON.stringify(state);
    const dateStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const timeStr = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup_${timeStr}.json`;
    
    // Upload to Storage
    const storageRef = ref(storage, `system_backups/${filename}`);
    await uploadString(storageRef, jsonString);
    
    // Update Log in Firestore (to prevent multiple daily backups)
    await setDoc(doc(db, 'settings', 'backup_log'), {
        lastBackupDate: dateStr,
        lastBackupFile: filename,
        updatedAt: Date.now()
    }, { merge: true });
};

export const checkAndTriggerAutoBackup = async () => {
    if (!db || !storage) return; // No cloud
    
    try {
        const logRef = doc(db, 'settings', 'backup_log');
        const logSnap = await getDoc(logRef);
        const today = new Date().toISOString().split('T')[0];
        
        if (logSnap.exists()) {
            const lastDate = logSnap.data().lastBackupDate;
            if (lastDate === today) {
                console.log("Backup already done today.");
                return; // Already backed up today
            }
        }
        
        console.log("Triggering Auto-Backup...");
        const fullData = await getFullDatabase();
        await uploadBackupToCloud(fullData);
        console.log("Auto-Backup Completed.");
        
    } catch (e) {
        console.error("Auto-Backup Failed:", e);
    }
};

export const getCloudBackups = async (): Promise<BackupMetadata[]> => {
    if (!storage) return [];
    const listRef = ref(storage, 'system_backups');
    try {
        const res = await listAll(listRef);
        const metaPromises = res.items.map(itemRef => getMetadata(itemRef));
        const metas = await Promise.all(metaPromises);
        
        return metas.map(m => ({
            name: m.name,
            fullPath: m.fullPath,
            sizeBytes: m.size,
            timeCreated: m.timeCreated,
            generation: m.generation
        })).sort((a, b) => new Date(b.timeCreated).getTime() - new Date(a.timeCreated).getTime());
    } catch (e) {
        console.error("Error listing backups:", e);
        return [];
    }
};

export const restoreFromCloud = async (fullPath: string) => {
    if (!storage) throw new Error("Storage not active");
    const storageRef = ref(storage, fullPath);

    // FIX CORS ISSUE: Use getBytes instead of fetch(url)
    try {
        const buffer = await getBytes(storageRef);
        // Decode ArrayBuffer to String
        const text = new TextDecoder().decode(buffer);
        const jsonData = JSON.parse(text);
        await restoreDatabase(jsonData);
    } catch (e: any) {
         console.error("Restore failed", e);
         throw new Error("Impossibile scaricare il backup (Problema di Rete/CORS): " + e.message);
    }
};

// --- RECYCLE BIN (SOFT DELETE MANAGE) ---
export const getDeletedItems = async (): Promise<DeletedItem[]> => {
    if (!db) return [];
    
    const results: DeletedItem[] = [];
    
    // Candidates
    const cQ = query(collection(db, 'candidates'), where('isDeleted', '==', true));
    const cSnap = await getDocs(cQ);
    cSnap.forEach(d => {
        const data = d.data();
        results.push({ id: d.id, type: 'candidate', name: data.fullName || 'Unknown' });
    });

    // Jobs
    const jQ = query(collection(db, 'jobs'), where('isDeleted', '==', true));
    const jSnap = await getDocs(jQ);
    jSnap.forEach(d => {
        const data = d.data();
        results.push({ id: d.id, type: 'job', name: data.title || 'Unknown Position' });
    });

    // Applications
    const aQ = query(collection(db, 'applications'), where('isDeleted', '==', true));
    const aSnap = await getDocs(aQ);
    // Fetch job titles for context would be nice, but keep simple for now
    aSnap.forEach(d => {
         // App doesn't have a name, so we use ID or fetch related candidate.
         // For Recycle Bin V1, let's stick to restoring Candidates/Jobs.
         // Standalone deleted apps are rare in this logic (cascading delete).
    });

    return results;
};

export const restoreDeletedItem = async (id: string, type: 'candidate' | 'application' | 'job') => {
    if (!db) return;
    
    const batch = writeBatch(db);
    
    if (type === 'candidate') {
        const ref = doc(db, 'candidates', id);
        batch.update(ref, { isDeleted: false });
        
        // Also restore applications for this candidate? 
        const appsQ = query(collection(db, 'applications'), where('candidateId', '==', id), where('isDeleted', '==', true));
        const appsSnap = await getDocs(appsQ);
        appsSnap.forEach(doc => {
            batch.update(doc.ref, { isDeleted: false });
        });
    } else if (type === 'job') {
         const ref = doc(db, 'jobs', id);
         batch.update(ref, { isDeleted: false });
    } else {
         const ref = doc(db, 'applications', id);
         batch.update(ref, { isDeleted: false });
    }
    
    await batch.commit();
};


// --- ACTIONS ---

export const addCandidate = async (candidate: Candidate) => {
  if (db) {
    if (storage) {
        // Handle CV
        if (candidate.cvFileBase64 && !candidate.cvUrl) {
            try {
                candidate.cvUrl = await uploadBase64(`candidates/${candidate.id}/cv`, candidate.cvFileBase64, candidate.cvMimeType || 'application/pdf');
                candidate.cvFileBase64 = undefined; // Optimization: Don't store Base64 in Firestore
            } catch (e) { console.error("CV Upload Failed", e); }
        }
        // Handle Photo
        if (candidate.photo && !candidate.photoUrl) {
            try {
                candidate.photoUrl = await uploadBase64(`candidates/${candidate.id}/photo`, candidate.photo, 'image/jpeg');
                candidate.photo = undefined; // Optimization
            } catch (e) { console.error("Photo Upload Failed", e); }
        }
        // Handle Attachments
        if (candidate.attachments) {
            for (let i = 0; i < candidate.attachments.length; i++) {
                const att = candidate.attachments[i];
                if (att.dataBase64 && !att.url) {
                    try {
                        att.url = await uploadBase64(`candidates/${candidate.id}/attachments/${att.id}`, att.dataBase64, att.type);
                        att.dataBase64 = undefined;
                    } catch (e) { console.error("Attachment Upload Failed", e); }
                }
            }
        }
    }
    await setDoc(doc(db, 'candidates', candidate.id), sanitizeForFirestore(candidate));
  } else {
    const data = getLocalData();
    data.candidates.push(candidate);
    saveLocalData(data);
    window.dispatchEvent(new Event('talentflow-local-update'));
  }
};

export const updateCandidate = async (candidate: Candidate) => {
  if (db) {
    if (storage) {
        if (candidate.cvFileBase64 && !candidate.cvUrl) {
             candidate.cvUrl = await uploadBase64(`candidates/${candidate.id}/cv`, candidate.cvFileBase64, candidate.cvMimeType || 'application/pdf');
             candidate.cvFileBase64 = undefined;
        }
        if (candidate.photo && !candidate.photoUrl) {
             candidate.photoUrl = await uploadBase64(`candidates/${candidate.id}/photo`, candidate.photo, 'image/jpeg');
             candidate.photo = undefined;
        }
        if (candidate.attachments) {
            for (let i = 0; i < candidate.attachments.length; i++) {
                const att = candidate.attachments[i];
                if (att.dataBase64 && !att.url) {
                     att.url = await uploadBase64(`candidates/${candidate.id}/attachments/${att.id}`, att.dataBase64, att.type);
                     att.dataBase64 = undefined;
                }
            }
        }
    }
    await setDoc(doc(db, 'candidates', candidate.id), sanitizeForFirestore(candidate), { merge: true });
  } else {
    const data = getLocalData();
    const index = data.candidates.findIndex(c => c.id === candidate.id);
    if (index !== -1) {
        data.candidates[index] = candidate;
        saveLocalData(data);
        window.dispatchEvent(new Event('talentflow-local-update'));
    }
  }
};

export const deleteCandidate = async (candidateId: string) => {
    if (db) {
        const batch = writeBatch(db);
        const candidateRef = doc(db, 'candidates', candidateId);
        batch.update(candidateRef, { isDeleted: true });
        const q = query(collection(db, 'applications'), where('candidateId', '==', candidateId));
        const appsSnap = await getDocs(q);
        appsSnap.forEach((doc) => {
            batch.update(doc.ref, { isDeleted: true });
        });
        await batch.commit();
    } else {
        const data = getLocalData();
        const candidate = data.candidates.find(c => c.id === candidateId);
        if (candidate) candidate.isDeleted = true;
        data.applications.forEach(a => {
            if (a.candidateId === candidateId) {
                a.isDeleted = true;
            }
        });
        saveLocalData(data);
        window.dispatchEvent(new Event('talentflow-local-update'));
    }
};

export const addCandidateComment = async (candidateId: string, comment: Comment) => {
    if (db) {
        await updateDoc(doc(db, 'candidates', candidateId), {
            comments: arrayUnion(sanitizeForFirestore(comment))
        });
    } else {
        const data = getLocalData();
        const candidate = data.candidates.find(c => c.id === candidateId);
        if (candidate) {
            if (!candidate.comments) candidate.comments = [];
            candidate.comments.push(comment);
            saveLocalData(data);
            window.dispatchEvent(new Event('talentflow-local-update'));
        }
    }
};

export const addCandidateAttachment = async (candidateId: string, attachment: Attachment) => {
    if(db) {
        if (storage && attachment.dataBase64) {
             attachment.url = await uploadBase64(`candidates/${candidateId}/attachments/${attachment.id}`, attachment.dataBase64, attachment.type);
             attachment.dataBase64 = undefined;
        }
        await updateDoc(doc(db, 'candidates', candidateId), {
            attachments: arrayUnion(sanitizeForFirestore(attachment))
        });
    } else {
        const data = getLocalData();
        const candidate = data.candidates.find(c => c.id === candidateId);
        if(candidate) {
            if(!candidate.attachments) candidate.attachments = [];
            candidate.attachments.push(attachment);
            saveLocalData(data);
            window.dispatchEvent(new Event('talentflow-local-update'));
        }
    }
};

export const deleteCandidateAttachment = async (candidateId: string, attachmentId: string) => {
    if (db) {
        const candRef = doc(db, 'candidates', candidateId);
        const snap = await getDoc(candRef);
        if (snap.exists()) {
            const data = snap.data();
            const updatedAttachments = (data.attachments || []).filter((a: any) => a.id !== attachmentId);
            await updateDoc(candRef, { attachments: updatedAttachments });
            // Optionally delete from storage if url exists
            if (storage) {
                try {
                    const storageRef = ref(storage, `candidates/${candidateId}/attachments/${attachmentId}`);
                    await deleteObject(storageRef);
                } catch(e) { /* ignore if not exists */ }
            }
        }
    } else {
        const data = getLocalData();
        const candidate = data.candidates.find(c => c.id === candidateId);
        if(candidate && candidate.attachments) {
            candidate.attachments = candidate.attachments.filter(a => a.id !== attachmentId);
            saveLocalData(data);
            window.dispatchEvent(new Event('talentflow-local-update'));
        }
    }
};

export const addJob = async (job: JobPosition) => {
  if (db) {
    await setDoc(doc(db, 'jobs', job.id), sanitizeForFirestore(job));
  } else {
    const data = getLocalData();
    data.jobs.push(job);
    saveLocalData(data);
    window.dispatchEvent(new Event('talentflow-local-update'));
  }
};

export const updateJob = async (job: JobPosition) => {
    if (db) {
        await updateDoc(doc(db, 'jobs', job.id), sanitizeForFirestore(job));
    } else {
        const data = getLocalData();
        const index = data.jobs.findIndex(j => j.id === job.id);
        if (index !== -1) {
            data.jobs[index] = job;
            saveLocalData(data);
            window.dispatchEvent(new Event('talentflow-local-update'));
        }
    }
};

export const deleteJob = async (jobId: string) => {
    if (db) {
        await updateDoc(doc(db, 'jobs', jobId), { isDeleted: true });
    } else {
        const data = getLocalData();
        const job = data.jobs.find(j => j.id === jobId);
        if(job) job.isDeleted = true;
        saveLocalData(data);
        window.dispatchEvent(new Event('talentflow-local-update'));
    }
};

export const createApplication = async (app: Application) => {
  if (db) {
    await setDoc(doc(db, 'applications', app.id), sanitizeForFirestore(app));
  } else {
    const data = getLocalData();
    const exists = data.applications.some(a => a.candidateId === app.candidateId && a.jobId === app.jobId);
    if (!exists) {
      data.applications.push(app);
      saveLocalData(data);
      window.dispatchEvent(new Event('talentflow-local-update'));
    }
  }
};

export const updateApplicationStatus = async (appId: string, status: SelectionStatus, rejectionReason?: string, rejectionNotes?: string) => {
  const updateData: any = { status, updatedAt: Date.now() };
  if (rejectionReason) updateData.rejectionReason = rejectionReason;
  if (rejectionNotes) updateData.rejectionNotes = rejectionNotes;

  if (db) {
    await updateDoc(doc(db, 'applications', appId), sanitizeForFirestore(updateData));
  } else {
    const data = getLocalData();
    const app = data.applications.find(a => a.id === appId);
    if (app) {
      app.status = status;
      app.updatedAt = Date.now();
      if (rejectionReason) app.rejectionReason = rejectionReason;
      if (rejectionNotes) app.rejectionNotes = rejectionNotes;
      saveLocalData(data);
      window.dispatchEvent(new Event('talentflow-local-update'));
    }
  }
};

export const updateApplicationMetadata = async (appId: string, metadata: { rating?: number, priority?: 'LOW' | 'MEDIUM' | 'HIGH' }) => {
    if (db) {
        await updateDoc(doc(db, 'applications', appId), sanitizeForFirestore(metadata));
    } else {
        const data = getLocalData();
        const app = data.applications.find(a => a.id === appId);
        if (app) {
            if (metadata.rating !== undefined) app.rating = metadata.rating;
            if (metadata.priority !== undefined) app.priority = metadata.priority;
            saveLocalData(data);
            window.dispatchEvent(new Event('talentflow-local-update'));
        }
    }
};

export const updateApplicationAiScore = async (appId: string, score: number, reasoning: string) => {
  if (db) {
     await updateDoc(doc(db, 'applications', appId), { aiScore: score, aiReasoning: reasoning });
  } else {
    const data = getLocalData();
    const app = data.applications.find(a => a.id === appId);
    if (app) {
      app.aiScore = score;
      app.aiReasoning = reasoning;
      saveLocalData(data);
      window.dispatchEvent(new Event('talentflow-local-update'));
    }
  }
};

export const updateApplicationScorecard = async (appId: string, results: Record<string, number>) => {
    if (db) {
        await updateDoc(doc(db, 'applications', appId), { scorecardResults: results });
    } else {
        const data = getLocalData();
        const app = data.applications.find(a => a.id === appId);
        if (app) {
            app.scorecardResults = results;
            saveLocalData(data);
            window.dispatchEvent(new Event('talentflow-local-update'));
        }
    }
};

// --- ONBOARDING ACTIONS ---

export const createOnboardingProcess = async (process: OnboardingProcess) => {
    if (db) {
        await setDoc(doc(db, 'onboarding', process.id), sanitizeForFirestore(process));
    } else {
        const data = getLocalData();
        if (!data.onboarding) data.onboarding = [];
        data.onboarding.push(process);
        saveLocalData(data);
        window.dispatchEvent(new Event('talentflow-local-update'));
    }
};

export const updateOnboardingStatus = async (processId: string, status: OnboardingStatus) => {
    if (db) {
        await updateDoc(doc(db, 'onboarding', processId), { status });
    } else {
        const data = getLocalData();
        const p = data.onboarding.find(o => o.id === processId);
        if (p) {
            p.status = status;
            saveLocalData(data);
            window.dispatchEvent(new Event('talentflow-local-update'));
        }
    }
};

export const updateOnboardingTask = async (processId: string, tasks: OnboardingTask[], isCompleted: boolean) => {
    const updateData: any = { tasks };
    if (isCompleted) updateData.status = 'COMPLETED';
    if (db) {
        await updateDoc(doc(db, 'onboarding', processId), sanitizeForFirestore(updateData));
    } else {
        const data = getLocalData();
        const process = data.onboarding.find(p => p.id === processId);
        if (process) {
            process.tasks = tasks;
            if (isCompleted) process.status = 'COMPLETED';
            saveLocalData(data);
            window.dispatchEvent(new Event('talentflow-local-update'));
        }
    }
};

export const addOnboardingComment = async (processId: string, comment: Comment) => {
    if (db) {
        await updateDoc(doc(db, 'onboarding', processId), {
            comments: arrayUnion(sanitizeForFirestore(comment))
        });
    } else {
        const data = getLocalData();
        const p = data.onboarding.find(o => o.id === processId);
        if (p) {
            if(!p.comments) p.comments = [];
            p.comments.push(comment);
            saveLocalData(data);
            window.dispatchEvent(new Event('talentflow-local-update'));
        }
    }
};

export const addTaskComment = async (processId: string, taskId: string, comment: Comment, tasks: OnboardingTask[]) => {
    const updatedTasks = tasks.map(t => t.id === taskId ? { ...t, comments: [...(t.comments || []), comment] } : t);
    await updateOnboardingTask(processId, updatedTasks, false); // Status not auto-changed by comment
};

export const addTaskAttachment = async (processId: string, taskId: string, attachment: Attachment, tasks: OnboardingTask[]) => {
    if (db && storage && attachment.dataBase64) {
        try {
            attachment.url = await uploadBase64(`onboarding/${processId}/tasks/${taskId}/${attachment.id}`, attachment.dataBase64, attachment.type);
            attachment.dataBase64 = undefined;
        } catch(e) { console.error(e); }
    }
    const updatedTasks = tasks.map(t => t.id === taskId ? { ...t, attachments: [...(t.attachments || []), attachment] } : t);
    await updateOnboardingTask(processId, updatedTasks, false);
};

export const deleteTaskAttachment = async (processId: string, taskId: string, attachmentId: string, tasks: OnboardingTask[]) => {
    const updatedTasks = tasks.map(t => {
        if(t.id === taskId && t.attachments) {
            return { ...t, attachments: t.attachments.filter(a => a.id !== attachmentId) };
        }
        return t;
    });
    await updateOnboardingTask(processId, updatedTasks, false);
    if(db && storage) {
        try {
            await deleteObject(ref(storage, `onboarding/${processId}/tasks/${taskId}/${attachmentId}`));
        } catch(e) {}
    }
};

export const deleteOnboardingProcess = async (id: string) => {
    if(db) {
        await deleteDoc(doc(db, 'onboarding', id));
    } else {
        const data = getLocalData();
        data.onboarding = data.onboarding.filter(o => o.id !== id);
        saveLocalData(data);
        window.dispatchEvent(new Event('talentflow-local-update'));
    }
}

// ... rest of the file (Templates, Email, Seed) kept as is ...
export const saveOnboardingTemplate = async (template: OnboardingTemplate) => {
    if (db) {
        await setDoc(doc(db, 'onboardingTemplates', template.id), sanitizeForFirestore(template));
    } else {
        const stored = localStorage.getItem(ONBOARDING_TEMPLATES_KEY);
        const templates: OnboardingTemplate[] = stored ? JSON.parse(stored) : [];
        const index = templates.findIndex(t => t.id === template.id);
        if (index !== -1) {
            templates[index] = template;
        } else {
            templates.push(template);
        }
        localStorage.setItem(ONBOARDING_TEMPLATES_KEY, JSON.stringify(templates));
    }
};

export const getOnboardingTemplates = async (): Promise<OnboardingTemplate[]> => {
    if (db) {
        const snap = await getDocs(collection(db, 'onboardingTemplates'));
        return snap.docs.map(d => d.data() as OnboardingTemplate).sort((a, b) => b.createdAt - a.createdAt);
    } else {
        const stored = localStorage.getItem(ONBOARDING_TEMPLATES_KEY);
        return stored ? JSON.parse(stored) : [];
    }
};

export const deleteOnboardingTemplate = async (id: string) => {
    if (db) {
        await deleteDoc(doc(db, 'onboardingTemplates', id));
    } else {
        const stored = localStorage.getItem(ONBOARDING_TEMPLATES_KEY);
        if (stored) {
            const templates: OnboardingTemplate[] = JSON.parse(stored);
            const filtered = templates.filter(t => t.id !== id);
            localStorage.setItem(ONBOARDING_TEMPLATES_KEY, JSON.stringify(filtered));
        }
    }
};

export const getEmailTemplates = (): EmailTemplate[] => [
    {
        id: 'interview',
        name: 'Convocazione Colloquio',
        subject: 'Invito a colloquio per la posizione di {jobTitle} - {candidateName}',
        body: `Gentile {candidateName},\n\nGrazie per aver inviato la tua candidatura per la posizione di {jobTitle} presso la nostra azienda.\n\nSiamo rimasti colpiti dal tuo profilo e vorremmo invitarti a un colloquio conoscitivo per approfondire le tue esperienze e competenze.\n\nPer favore, comunicaci le tue disponibilità per la prossima settimana.\n\nCordiali saluti,\nIl Team HR`
    },
    {
        id: 'rejection',
        name: 'Feedback Negativo',
        subject: 'Aggiornamento candidatura per {jobTitle}',
        body: `Gentile {candidateName},\n\nGrazie per il tempo dedicato al processo di selezione per la posizione di {jobTitle}.\n\nDopo un'attenta valutazione, dobbiamo informarti che abbiamo deciso di procedere con altri candidati il cui profilo è più in linea con le nostre attuali esigenze.\n\nTerremo comunque il tuo CV nel nostro database per future opportunità.\n\nTi auguriamo il meglio per la tua ricerca professionale.\n\nCordiali saluti,\nIl Team HR`
    },
    {
        id: 'offer',
        name: 'Proposta di Assunzione',
        subject: 'Offerta di lavoro - {jobTitle} - {candidateName}',
        body: `Gentile {candidateName},\n\nSiamo lieti di informarti che il processo di selezione ha avuto esito positivo!\n\nVorremmo offrirti la posizione di {jobTitle}. In allegato troverai i dettagli della nostra proposta.\n\nSperiamo di averti presto nel nostro team.\n\nCordiali saluti,\nIl Team HR`
    }
];

export const seedDatabase = async (assignToUserId?: string) => {
    // Keep seed data simple (no storage needed for mock)
    // Fallback to auth.currentUser if no ID is passed
    const targetUserId = assignToUserId || auth?.currentUser?.uid;
    
    // 5 CANDIDATES
    const mockCandidates: Candidate[] = [
        {
            id: 'c1',
            fullName: 'Giulia Rossi',
            email: 'giulia.rossi@example.com',
            phone: '+39 333 1234567',
            age: 28,
            skills: ['React', 'TypeScript', 'Tailwind CSS', 'Figma'],
            summary: 'Sviluppatrice Frontend Senior con 6 anni di esperienza nella creazione di interfacce utente complesse e scalabili.',
            currentCompany: 'WebAgency Srl',
            currentRole: 'Frontend Lead',
            currentSalary: '35k',
            benefits: ['Buoni Pasto', 'PC Aziendale'],
            status: CandidateStatus.CANDIDATE,
            createdAt: Date.now(),
            comments: []
        },
        // ... rest of seed data same as original file ...
        {
            id: 'c2',
            fullName: 'Marco Bianchi',
            email: 'marco.bianchi@example.com',
            phone: '+39 333 9876543',
            age: 34,
            skills: ['Project Management', 'Agile', 'Scrum', 'Jira'],
            summary: 'Product Owner certificato con forte background tecnico e capacità di gestione team cross-funzionali.',
            currentCompany: 'TechCorp SpA',
            currentRole: 'Product Manager',
            currentSalary: '55k',
            benefits: ['Auto Aziendale', 'Assicurazione Sanitaria', 'Smart Working'],
            status: CandidateStatus.CANDIDATE,
            createdAt: Date.now(),
            comments: []
        },
        {
            id: 'c3',
            fullName: 'Alessandro Verdi',
            email: 'alessandro.verdi@example.com',
            phone: '+39 333 4567890',
            age: 26,
            skills: ['Python', 'Machine Learning', 'TensorFlow', 'Data Analysis'],
            summary: 'Data Scientist appassionato di AI generativa e analisi predittiva per il business.',
            currentCompany: 'Startup AI',
            currentRole: 'Jr Data Scientist',
            currentSalary: '28k',
            benefits: ['Stock Options', 'Corsi Formazione'],
            status: CandidateStatus.HIRED,
            createdAt: Date.now(),
            comments: []
        },
        {
            id: 'c4',
            fullName: 'Francesca Neri',
            email: 'francesca.neri@example.com',
            phone: '+39 338 1122334',
            age: 31,
            skills: ['Sales', 'Negoziazione', 'CRM', 'B2B', 'Cold Calling'],
            summary: 'Sales Account Manager con comprovata esperienza nel superamento dei target di vendita nel settore IT.',
            currentCompany: 'SalesForce Solutions',
            currentRole: 'Account Executive',
            currentSalary: '42k + Bonus',
            benefits: ['Auto Aziendale', 'Bonus Trimestrali', 'iPhone'],
            status: CandidateStatus.CANDIDATE,
            createdAt: Date.now(),
            comments: []
        },
        {
            id: 'c5',
            fullName: 'Luca Blu',
            email: 'luca.blu@example.com',
            phone: '+39 340 5566778',
            age: 23,
            skills: ['HTML', 'CSS', 'JavaScript', 'React Basic'],
            summary: 'Junior Developer motivato con buone basi accademiche e voglia di imparare le moderne tecnologie web.',
            currentCompany: 'Freelance',
            currentRole: 'Web Developer Jr',
            currentSalary: '22k',
            benefits: [],
            status: CandidateStatus.CANDIDATE,
            createdAt: Date.now(),
            comments: []
        }
    ];

    const defaultScorecard: ScorecardSchema = {
        categories: [
            {
                id: 'cat_tech', name: 'Competenze Tecniche', items: [
                    { id: 'tech_1', label: 'Conoscenza Strumenti', description: 'Valuta la padronanza degli strumenti richiesti per il ruolo.' },
                    { id: 'tech_2', label: 'Problem Solving', description: 'Capacità di risolvere problemi complessi in autonomia.' }
                ]
            },
            {
                id: 'cat_soft', name: 'Soft Skills', items: [
                    { id: 'soft_1', label: 'Comunicazione', description: 'Chiarezza nell\'esposizione e capacità di sintesi.' },
                    { id: 'soft_2', label: 'Team Work', description: 'Attitudine al lavoro di squadra e alla collaborazione.' }
                ]
            },
            {
                id: 'cat_culture', name: 'Culture Fit', items: [
                    { id: 'cult_1', label: 'Valori Aziendali', description: 'Allineamento con la mission e i valori dell\'azienda.' },
                    { id: 'cult_2', label: 'Motivazione', description: 'Interesse genuino per la posizione e l\'azienda.' }
                ]
            }
        ]
    };

    // 3 JOBS
    const mockJobs: JobPosition[] = [
        {
            id: 'j1',
            title: 'Senior Frontend Developer',
            department: 'Engineering',
            description: 'Cerchiamo un esperto React per guidare lo sviluppo della nostra nuova dashboard.',
            requirements: '5+ anni di esperienza, ottima conoscenza di React e TypeScript.',
            status: 'OPEN',
            assignedTeamMembers: targetUserId ? [targetUserId] : [],
            createdAt: Date.now(),
            scorecardSchema: defaultScorecard
        },
        {
            id: 'j2',
            title: 'Sales Manager',
            department: 'Sales',
            description: 'Responsabile vendite per il mercato Enterprise.',
            requirements: 'Esperienza comprovata B2B, doti di negoziazione.',
            status: 'OPEN',
            assignedTeamMembers: targetUserId ? [targetUserId] : [],
            createdAt: Date.now(),
            scorecardSchema: defaultScorecard
        },
        {
            id: 'j3',
            title: 'Product Owner',
            department: 'Product',
            description: 'Responsabile della roadmap di prodotto per il Q3/Q4.',
            requirements: 'Esperienza pregressa in aziende SaaS B2B.',
            status: 'OPEN',
            assignedTeamMembers: targetUserId ? [targetUserId] : [],
            createdAt: Date.now(),
            scorecardSchema: defaultScorecard
        }
    ];

    const mockApplications: Application[] = [
        // Applications for J1 (Frontend)
        {
            id: 'a1',
            candidateId: 'c1', // Giulia
            jobId: 'j1',
            status: SelectionStatus.FIRST_INTERVIEW,
            rating: 5,
            priority: 'HIGH',
            aiScore: 92,
            aiReasoning: "Profilo eccellente, stack tecnologico perfettamente allineato.",
            updatedAt: Date.now()
        },
        {
            id: 'a5',
            candidateId: 'c5', // Luca
            jobId: 'j1',
            status: SelectionStatus.TO_ANALYZE,
            rating: 3,
            priority: 'LOW',
            aiScore: 65,
            updatedAt: Date.now()
        },

        // Applications for J2 (Sales)
        {
            id: 'a4',
            candidateId: 'c4', // Francesca
            jobId: 'j2',
            status: SelectionStatus.SECOND_INTERVIEW,
            rating: 4,
            priority: 'HIGH',
            aiScore: 88,
            updatedAt: Date.now(),
            scorecardResults: {
                'soft_1': 5, 'soft_2': 4, 'soft_3': 3,
                'sales_1': 5, 'sales_2': 4, 'sales_3': 5
            }
        },
        {
            id: 'a6', // Using C2 (Marco) as a secondary applicant for Sales just to compare
            candidateId: 'c2',
            jobId: 'j2',
            status: SelectionStatus.FIRST_INTERVIEW,
            rating: 3,
            priority: 'MEDIUM',
            aiScore: 70,
            updatedAt: Date.now(),
            scorecardResults: {
                'soft_1': 3, 'soft_2': 5, 'soft_3': 4,
                'sales_1': 2, 'sales_2': 3, 'sales_3': 2
            }
        },

        // Applications for J3 (Product)
        {
            id: 'a2',
            candidateId: 'c2', // Marco
            jobId: 'j3',
            status: SelectionStatus.FIRST_INTERVIEW,
            aiScore: 85,
            aiReasoning: "Il profilo combacia molto bene con i requisiti di gestione Agile richiesti.",
            rating: 5,
            priority: 'HIGH',
            updatedAt: Date.now()
        },
        {
            id: 'a3',
            candidateId: 'c3', // Alessandro
            jobId: 'j3',
            status: SelectionStatus.HIRED, // Already hired here
            rating: 5,
            priority: 'HIGH',
            updatedAt: Date.now()
        }
    ];

    if (db) {
        try {
            const batch = writeBatch(db);
            mockCandidates.forEach(c => batch.set(doc(db, 'candidates', c.id), sanitizeForFirestore(c)));
            mockJobs.forEach(j => batch.set(doc(db, 'jobs', j.id), sanitizeForFirestore(j)));
            mockApplications.forEach(a => batch.set(doc(db, 'applications', a.id), sanitizeForFirestore(a)));
            await batch.commit();
            console.log("Seed completed successfully for user:", targetUserId);
        } catch (e: any) {
            console.error("Seed error", e);
            throw new Error("Errore Cloud: " + e.message);
        }
    } else {
        const demoState: AppState = {
            candidates: mockCandidates,
            jobs: mockJobs,
            applications: mockApplications,
            onboarding: [],
            companyInfo: defaultState.companyInfo
        };
        saveLocalData(demoState);
        window.dispatchEvent(new Event('talentflow-local-update'));
        console.log("Seed completed locally");
    }
};