

export enum SelectionStatus {
  TO_ANALYZE = 'DA_ANALIZZARE',
  SCREENING = 'TELEFONATA_CONOSCITIVA',
  FIRST_INTERVIEW = 'PRIMO_COLLOQUIO',
  SECOND_INTERVIEW = 'SECONDO_COLLOQUIO',
  OFFER = 'PROPOSTA',
  HIRED = 'ASSUNTO',
  REJECTED = 'SCARTATO'
}

export const StatusLabels: Record<SelectionStatus, string> = {
  [SelectionStatus.TO_ANALYZE]: 'Da Analizzare',
  [SelectionStatus.SCREENING]: 'Screening Telefonico',
  [SelectionStatus.FIRST_INTERVIEW]: '1° Colloquio',
  [SelectionStatus.SECOND_INTERVIEW]: '2° Colloquio',
  [SelectionStatus.OFFER]: 'Proposta',
  [SelectionStatus.HIRED]: 'Assunto',
  [SelectionStatus.REJECTED]: 'Scartato'
};

export const StatusColors: Record<SelectionStatus, string> = {
  [SelectionStatus.TO_ANALYZE]: 'bg-gray-100 text-gray-700 border-gray-200',
  [SelectionStatus.SCREENING]: 'bg-blue-50 text-blue-700 border-blue-200',
  [SelectionStatus.FIRST_INTERVIEW]: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  [SelectionStatus.SECOND_INTERVIEW]: 'bg-purple-50 text-purple-700 border-purple-200',
  [SelectionStatus.OFFER]: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  [SelectionStatus.HIRED]: 'bg-green-50 text-green-700 border-green-200',
  [SelectionStatus.REJECTED]: 'bg-red-50 text-red-700 border-red-200'
};

export enum CandidateStatus {
    CANDIDATE = 'CANDIDATE',
    HIRED = 'HIRED',
    FORMER = 'FORMER_EMPLOYEE'
}

export const CandidateStatusLabels: Record<CandidateStatus, string> = {
    [CandidateStatus.CANDIDATE]: 'Candidato',
    [CandidateStatus.HIRED]: 'Assunto',
    [CandidateStatus.FORMER]: 'Ex Dipendente'
};

export const CandidateStatusColors: Record<CandidateStatus, string> = {
    [CandidateStatus.CANDIDATE]: 'bg-blue-50 text-blue-700 border-blue-200',
    [CandidateStatus.HIRED]: 'bg-green-50 text-green-700 border-green-200',
    [CandidateStatus.FORMER]: 'bg-amber-50 text-amber-700 border-amber-200'
};

export enum UserRole {
    ADMIN = 'ADMIN',
    HR = 'HR',
    TEAM = 'TEAM'
}

export interface User {
    uid?: string; // Firestore Auth ID
    name: string;
    email: string;
    role: UserRole | string; // Supports enum or string
    avatar?: string;
    isDeleted?: boolean; // Soft delete flag
}

export interface Comment {
    id: string;
    text: string;
    authorName: string;
    authorAvatar?: string;
    createdAt: number;
}

export interface Attachment {
    id: string;
    name: string;
    type: string; // mimeType
    dataBase64?: string; // Optional if url is present
    url?: string; // Firebase Storage URL
    uploadedBy: string;
    createdAt: number;
}

export interface Candidate {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  age?: number;
  skills: string[];
  summary: string;
  
  photo?: string; // Base64 (legacy/local)
  photoUrl?: string; // Storage URL
  
  cvFileBase64?: string; // Base64 (legacy/local)
  cvUrl?: string; // Storage URL
  cvMimeType?: string;
  
  comments?: Comment[];
  attachments?: Attachment[];
  
  status: CandidateStatus; 

  // Current Occupation Fields
  currentCompany?: string;
  currentRole?: string;
  currentSalary?: string; // RAL
  benefits?: string[]; 

  isDeleted?: boolean; // Soft Delete flag

  createdAt: number;
}

// --- SCORECARD INTERFACES ---
export interface ScorecardItem {
    id: string;
    label: string;
    description?: string;
}

export interface ScorecardCategory {
    id: string;
    name: string;
    items: ScorecardItem[];
}

export interface ScorecardSchema {
    categories: ScorecardCategory[];
}

export interface ScorecardTemplate {
    id: string;
    name: string;
    schema: ScorecardSchema;
    createdAt: number;
}

export interface JobPosition {
  id: string;
  title: string;
  department: string;
  description: string;
  requirements: string;
  status: 'OPEN' | 'CLOSED' | 'SUSPENDED' | 'COMPLETED';
  assignedTeamMembers?: string[]; // Array of User UIDs who can access this job
  scorecardSchema?: ScorecardSchema; // The evaluation template
  isDeleted?: boolean; // Soft delete flag
  createdAt: number;
}

export interface Application {
  id: string;
  candidateId: string;
  jobId: string;
  status: SelectionStatus;
  aiScore?: number;
  aiReasoning?: string;
  rating?: number; // 1-5 General Rating
  priority?: 'LOW' | 'MEDIUM' | 'HIGH';
  rejectionReason?: string;
  rejectionNotes?: string;
  
  scorecardResults?: Record<string, number>; // item.id -> score (1-5)
  
  updatedAt: number;
  isDeleted?: boolean; 
}

// --- ONBOARDING INTERFACES ---

export enum OnboardingPhase {
    PRE_BOARDING = 'PRE_BOARDING',
    DAY_1 = 'DAY_1',
    WEEK_1 = 'WEEK_1',
    MONTH_1 = 'MONTH_1'
}

export const OnboardingPhaseLabels: Record<OnboardingPhase, string> = {
    [OnboardingPhase.PRE_BOARDING]: 'Prima dell\'arrivo',
    [OnboardingPhase.DAY_1]: 'Primo Giorno',
    [OnboardingPhase.WEEK_1]: 'Prima Settimana',
    [OnboardingPhase.MONTH_1]: 'Primo Mese'
};

export type OnboardingStatus = 'TO_START' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export const OnboardingStatusLabels: Record<OnboardingStatus, string> = {
    'TO_START': 'Da Iniziare',
    'IN_PROGRESS': 'In Corso',
    'COMPLETED': 'Completato',
    'CANCELLED': 'Annullato'
};

export const OnboardingStatusColors: Record<OnboardingStatus, string> = {
    'TO_START': 'bg-gray-100 text-gray-700 border-gray-200',
    'IN_PROGRESS': 'bg-blue-100 text-blue-700 border-blue-200',
    'COMPLETED': 'bg-green-100 text-green-700 border-green-200',
    'CANCELLED': 'bg-red-50 text-red-700 border-red-200'
};

export interface OnboardingTask {
    id: string;
    description: string;
    department: string; // 'HR', 'IT', 'TEAM', 'ADMIN'
    phase: OnboardingPhase; // TIMELINE PHASE
    assigneeId?: string; // UID of the user responsible for this task
    dueDate?: number; // Timestamp
    isCompleted: boolean;
    comments?: Comment[];
    attachments?: Attachment[];
}

export interface OnboardingProcess {
    id: string;
    candidateId: string;
    jobId: string;
    status: OnboardingStatus;
    startDate: number;
    phaseConfig?: Record<string, string>; // Maps phase enum keys to Custom Label
    tasks: OnboardingTask[];
    comments?: Comment[];
}

export interface OnboardingTemplate {
    id: string;
    name: string;
    phaseConfig?: Record<string, string>; // Maps phase enum keys to Custom Label
    tasks: Omit<OnboardingTask, 'id' | 'isCompleted'>[]; // Template stores structure + assignments/dates
    createdAt: number;
}

export interface CompanyInfo {
    name: string;
    industry: string;
    description: string;
    productsServices?: string; // NEW: Detailed products and services for AI context
}

export interface AppState {
  candidates: Candidate[];
  jobs: JobPosition[];
  applications: Application[];
  onboarding: OnboardingProcess[];
  companyInfo?: CompanyInfo;
}

export interface UploadQueueItem {
    id: string;
    file: File;
    status: 'IDLE' | 'PROCESSING' | 'SUCCESS' | 'ERROR' | 'DUPLICATE';
    parsedData?: Partial<Candidate>;
    errorMessage?: string;
    duplicateReason?: string;
    jobId?: string; 
}

export interface EmailTemplate {
    id: string;
    name: string;
    subject: string;
    body: string;
}

// --- BACKUP & SYSTEM TYPES ---
export interface BackupMetadata {
    name: string;
    fullPath: string;
    sizeBytes: number;
    timeCreated: string;
    generation: string;
}

export interface DeletedItem {
    id: string;
    type: 'candidate' | 'application' | 'job'; // Add other types if needed
    name: string; // Display name
    deletedAt?: number; // Not strictly tracked in schema yet, but good for future
}
