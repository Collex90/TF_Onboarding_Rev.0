import { GoogleGenAI, Type, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { Candidate, JobPosition, ScorecardSchema, OnboardingPhase, CompanyInfo } from "../types";

// Initialize the client safely handling both Vite and legacy envs
const getAI = () => {
    let key = '';
    try {
        // @ts-ignore - Vite environment check
        key = import.meta.env.VITE_API_KEY || '';
    } catch (e) {
        // Fallback for Node/Legacy environments
        key = process.env.API_KEY || '';
    }
    
    // Fallback if import.meta didn't work but process.env might
    if (!key && typeof process !== 'undefined' && process.env) {
        key = process.env.API_KEY || '';
    }
    
    if (!key) {
        console.warn("API Key mancante. Verifica il file .env (VITE_API_KEY). Uso modalità Mock.");
        return null;
    }
    return new GoogleGenAI({ apiKey: key });
};

export interface ParsedCVData extends Partial<Candidate> {
    faceCoordinates?: [number, number, number, number]; // [ymin, xmin, ymax, xmax] 0-1000
}

const COMMON_SAFETY_SETTINGS = [
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE }
];

export const parseCV = async (base64Data: string, mimeType: string): Promise<ParsedCVData> => {
    const ai = getAI();
    
    // MOCK FALLBACK DATA
    const mockData: ParsedCVData = {
        fullName: "Candidato (AI Fallback)",
        email: "email@simulata.com",
        phone: "+39 000 0000000",
        age: 30,
        skills: ["Skill Simulata 1", "Skill Simulata 2", "Fallback Mode"],
        summary: "⚠️ ATTENZIONE: L'API AI ha superato la quota o non è configurata correttamente. Dati simulati.",
        currentCompany: "Mock Company",
        currentRole: "Mock Role",
        currentSalary: "0k",
        benefits: ["Benefit Simulato"],
        // No face coords in mock
    };

    if (!ai) return mockData;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: {
                parts: [
                    { inlineData: { data: base64Data, mimeType } },
                    { text: "Estrai dati CV in JSON. Foto: coordinate viso 0-1000." }
                ]
            },
            config: {
                // MODIFIED PROMPT: Focus on Experience Context
                systemInstruction: `Sei un parser di CV esperto. Estrai i dati in JSON rigoroso.
                
                ISTRUZIONI SUMMARY:
                Non limitarti a una bio generica. Genera un summary di 4-5 frasi che spieghi COSA ha fatto il candidato e COME ha usato le sue competenze.
                Distinguere tra "Utilizzatore" (es. Data Entry su SAP) e "Implementatore/Esperto" (es. Configuratore SAP).
                Evidenzia responsabilità e risultati.

                REGOLE SKILLS:
                1. Estrai MASSIMO 10 skills tecniche principali.
                2. Ignora software di base (Word, Excel base, Chrome, Windows) a meno che non sia un ruolo amministrativo junior.
                3. Se c'è una foto del volto, restituisci faceCoordinates [ymin, xmin, ymax, xmax].`,
                responseMimeType: 'application/json',
                safetySettings: COMMON_SAFETY_SETTINGS,
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        fullName: { type: Type.STRING },
                        email: { type: Type.STRING },
                        phone: { type: Type.STRING },
                        age: { type: Type.INTEGER },
                        skills: { type: Type.ARRAY, items: { type: Type.STRING } },
                        summary: { type: Type.STRING },
                        
                        currentCompany: { type: Type.STRING },
                        currentRole: { type: Type.STRING },
                        currentSalary: { type: Type.STRING },
                        benefits: { type: Type.ARRAY, items: { type: Type.STRING } },

                        faceCoordinates: { 
                            type: Type.ARRAY, 
                            items: { type: Type.INTEGER },
                            description: "[ymin, xmin, ymax, xmax] in 0-1000 scale"
                        }
                    },
                    required: ['fullName', 'email', 'skills', 'summary']
                }
            }
        });

        const text = response.text;
        if (!text) {
            console.error("Gemini response text is empty", response);
            throw new Error("Risposta vuota da Gemini (Safety o Token limit)");
        }
        return JSON.parse(text);
    } catch (error) {
        console.error("AI Parsing Error:", error);
        return mockData; // Return mock data instead of crashing
    }
};

export const generateJobDetails = async (title: string, department: string, companyContext?: CompanyInfo): Promise<{ description: string, requirements: string }> => {
    const ai = getAI();
    
    const mockJob = {
        description: "⚠️ DESCRIZIONE SIMULATA. Impossibile connettersi all'AI.",
        requirements: "- Requisito simulato\n- Altro requisito"
    };

    if (!ai) return mockJob;

    let systemInstruction = "Genera Job Description sintetica (max 300 char) e requisiti. IMPORTANTE: Usa SOLO testo semplice e elenchi puntati Markdown (con il trattino -). NON usare MAI tag HTML come <ul> o <li>.";
    if (companyContext && companyContext.name) {
        systemInstruction = `Sei un HR Manager per l'azienda ${companyContext.name} operante nel settore ${companyContext.industry}. 
        
        CONTESTO AZIENDALE:
        Descrizione: "${companyContext.description}"
        Prodotti/Servizi: "${companyContext.productsServices || 'Non specificato'}"

        Genera una Job Description e Requisiti specifici per questa realtà. Il tono deve riflettere la cultura aziendale descritta.
        I requisiti devono includere competenze pertinenti ai prodotti/servizi dell'azienda se applicabile.
        IMPORTANTE: Usa SOLO testo semplice e elenchi puntati Markdown (con il trattino -). NON usare MAI tag HTML come <ul> o <li>.`;
    }

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Job: ${title} (${department})`,
            config: {
                systemInstruction,
                responseMimeType: 'application/json',
                safetySettings: COMMON_SAFETY_SETTINGS,
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        description: { type: Type.STRING },
                        requirements: { type: Type.STRING }
                    },
                    required: ['description', 'requirements']
                }
            }
        });

        const text = response.text;
        if (!text) throw new Error("Risposta vuota");
        return JSON.parse(text);
    } catch (error) {
        console.error("AI Job Gen Error:", error);
        return mockJob;
    }
};

export const generateScorecardSchema = async (title: string, description: string, companyContext?: CompanyInfo): Promise<ScorecardSchema> => {
    const ai = getAI();
    
    const mockSchema: ScorecardSchema = {
        categories: [
            { id: 'cat1', name: 'Competenze', items: [{id: 's1', label: 'Tecniche'}, {id: 's2', label: 'Esperienza'}] }
        ]
    };

    if (!ai) return mockSchema;

    let systemInstruction = "Crea 3 categorie di valutazione con 3 item ciascuna per interviste.";
    if (companyContext && companyContext.name) {
        systemInstruction = `Crea una scheda di valutazione per ${companyContext.name} (${companyContext.industry}). 
        
        CONTESTO AZIENDALE:
        Descrizione: "${companyContext.description}"
        Prodotti/Servizi: "${companyContext.productsServices || ''}"

        Le domande e i criteri devono:
        1. Riflettere i valori aziendali descritti.
        2. Valutare l'attitudine a lavorare nel settore specifico (${companyContext.industry}).
        3. Se pertinente, valutare la familiarità con la tipologia di prodotti offerti (${companyContext.productsServices}).`;
    }

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Scorecard per: ${title}. Desc: ${description.substring(0, 200)}`,
            config: {
                systemInstruction,
                responseMimeType: 'application/json',
                safetySettings: COMMON_SAFETY_SETTINGS,
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        categories: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    id: { type: Type.STRING },
                                    name: { type: Type.STRING },
                                    items: {
                                        type: Type.ARRAY,
                                        items: {
                                            type: Type.OBJECT,
                                            properties: {
                                                id: { type: Type.STRING },
                                                label: { type: Type.STRING },
                                                description: { type: Type.STRING }
                                            },
                                            required: ['id', 'label']
                                        }
                                    }
                                },
                                required: ['id', 'name', 'items']
                            }
                        }
                    },
                    required: ['categories']
                }
            }
        });

        const text = response.text;
        if (!text) throw new Error("Empty response");
        return JSON.parse(text) as ScorecardSchema;
    } catch (e) {
        console.error("Scorecard Gen Error:", e);
        return mockSchema;
    }
};

export const evaluateFit = async (candidate: Candidate, job: JobPosition, companyContext?: CompanyInfo): Promise<{ score: number, reasoning: string }> => {
    const ai = getAI();

    const mockEval = {
        score: 50,
        reasoning: "⚠️ VALUTAZIONE SIMULATA (AI Error o Quota)."
    };

    if (!ai) return mockEval;

    // --- CONTEXTUAL INTELLIGENCE LOGIC ---
    
    let roleFocus = "Generalista";
    // Default weighting: Balanced
    let weightingInstruction = "Bilancia Hard Skills (40%), Esperienza (30%) e Soft Skills/Fit (30%).";

    const dept = job.department.toLowerCase();
    const title = job.title.toLowerCase();

    if (dept.includes('sales') || dept.includes('vendite') || dept.includes('commerciale') || title.includes('sales') || title.includes('account')) {
        roleFocus = "SALES & COMMERCIAL";
        weightingInstruction = "CRITICO: Priorità ai RISULTATI (numeri), NETWORK e capacità comunicative. Le Hard Skills tecniche (es. CRM) contano solo se usate per vendere, non per configurare.";
    } else if (dept.includes('engineering') || dept.includes('dev') || dept.includes('it') || dept.includes('tech') || title.includes('developer') || title.includes('engineer')) {
        roleFocus = "TECHNICAL / ENGINEERING";
        weightingInstruction = "CRITICO: Priorità allo STACK TECNOLOGICO (Hard Skills 60%). Verifica la profondità tecnica: aver 'usato' un tool non basta, bisogna averlo 'sviluppato' o 'gestito' a fondo.";
    } else if (dept.includes('product') || title.includes('manager') || title.includes('owner')) {
        roleFocus = "PRODUCT & MANAGEMENT";
        weightingInstruction = "CRITICO: Cerca esperienza pregressa in ruoli simili (Seniority). Valuta la capacità di visione e leadership.";
    }

    let systemInstruction = `Sei un Senior Recruiter esperto in ${roleFocus}. Valuta il match candidato/job (0-100%).
    
    REGOLA AUREA: CONTESTO > PAROLE CHIAVE
    Non dare punteggio solo perché una parola chiave è presente. Analizza COME è stata usata in base al ruolo.
    
    ESEMPIO DI RAGIONAMENTO:
    - Se cerchi un 'Esperto CRM' (Tecnico) e il candidato è un 'Sales' che usa il CRM per inserire dati -> MATCH BASSO (è un utente, non un tecnico).
    - Se cerchi un 'Sales' e il candidato è un 'Consulente CRM' che lo installa ma non vende -> MATCH MEDIO-BASSO (sa il tool ma non il mestiere).
    - Se il CV dice "Utilizzo di Word/Excel" senza contesto -> Peso nullo per ruoli Senior.

    ISTRUZIONI PESATURA:
    ${weightingInstruction}

    CONTESTO AZIENDALE:
    Azienda: ${companyContext?.name || 'Non specificato'}
    Settore: ${companyContext?.industry || 'Non specificato'}
    Descrizione: "${companyContext?.description || ''}"

    OUTPUT:
    - Score: 0-100 (Sii severo. 90+ solo per match perfetti e comprovati).
    - Reasoning: Max 2 frasi. Spiega i PRO (perché sì) e i CONTRO (cosa manca o è superficiale).
    `;

    // TOKEN OPTIMIZATION: Truncate large fields
    const prompt = `
    CANDIDATO:
    Nome: ${candidate.fullName}
    Ruolo Attuale: ${candidate.currentRole}
    Azienda Attuale: ${candidate.currentCompany}
    Skills Dichiarate: ${candidate.skills.slice(0, 15).join(', ')}
    
    STORIA E DETTAGLI (Analizza profondità qui): 
    ${candidate.summary?.substring(0, 1500) || ''}
    
    POSIZIONE APERTA:
    Titolo: ${job.title}
    Dipartimento: ${job.department}
    Requisiti: ${job.requirements?.substring(0, 1000) || ''}
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                systemInstruction,
                responseMimeType: 'application/json',
                safetySettings: COMMON_SAFETY_SETTINGS,
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        score: { type: Type.INTEGER },
                        reasoning: { type: Type.STRING }
                    },
                    required: ['score', 'reasoning']
                }
            }
        });

        const text = response.text;
        if (!text) throw new Error("Nessuna risposta da Gemini (Text Empty)");
        return JSON.parse(text);
    } catch (error) {
        console.error("AI Evaluation Error:", error);
        return mockEval;
    }
};

export const generateOnboardingChecklist = async (jobTitle: string, companyContext?: CompanyInfo): Promise<{ items: { department: string, task: string, phase: OnboardingPhase }[] }> => {
    const ai = getAI();
    const fallback = { 
        items: [
            { department: "HR", task: "Firma Contratto", phase: OnboardingPhase.PRE_BOARDING },
            { department: "IT", task: "Setup PC", phase: OnboardingPhase.PRE_BOARDING },
            { department: "Team", task: "Introduzione Colleghi", phase: OnboardingPhase.DAY_1 }
        ] 
    };

    if (!ai) return fallback;

    let systemInstruction = "Crea una lista di 8-12 attività di onboarding divise per dipartimento (HR, IT, TEAM) e fase temporale (PRE_BOARDING, DAY_1, WEEK_1, MONTH_1). Rispondi in JSON.";
    if (companyContext && companyContext.name) {
        systemInstruction = `Crea un piano di onboarding specifico per ${companyContext.name} (${companyContext.industry}). 
        
        CONTESTO AZIENDALE:
        Descrizione: "${companyContext.description}"
        Prodotti/Servizi: "${companyContext.productsServices || ''}"

        ISTRUZIONI:
        1. Includi task per far conoscere al neoassunto i prodotti/servizi chiave (${companyContext.productsServices}).
        2. Includi momenti di formazione sulla cultura aziendale descritta.
        3. Adatta il tono (formale/informale) alla descrizione dell'azienda.
        
        Genera task pratici e specifici.`;
    }

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Genera checklist onboarding per: ${jobTitle}`,
            config: {
                systemInstruction,
                responseMimeType: 'application/json',
                safetySettings: COMMON_SAFETY_SETTINGS,
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        items: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    department: { type: Type.STRING },
                                    task: { type: Type.STRING },
                                    phase: { type: Type.STRING, enum: ['PRE_BOARDING', 'DAY_1', 'WEEK_1', 'MONTH_1'] }
                                },
                                required: ['department', 'task', 'phase']
                            }
                        }
                    },
                    required: ['items']
                }
            }
        });

        const text = response.text;
        if (!text) throw new Error("Empty AI Response");
        return JSON.parse(text);
    } catch (e) {
        console.error("Onboarding Gen Error", e);
        return fallback;
    }
};