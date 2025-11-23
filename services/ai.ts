import { GoogleGenAI, Type } from "@google/genai";
import { Candidate, JobPosition, ScorecardSchema, OnboardingPhase } from "../types";

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
    { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' }
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
                systemInstruction: "Sei un parser di CV esperto. Estrai i dati in JSON rigoroso. Sii sintetico nel summary (max 2 frasi). Se c'è una foto del volto, restituisci faceCoordinates [ymin, xmin, ymax, xmax]. Ignora soft skills generiche.",
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

export const generateJobDetails = async (title: string, department: string): Promise<{ description: string, requirements: string }> => {
    const ai = getAI();
    
    const mockJob = {
        description: "⚠️ DESCRIZIONE SIMULATA. Impossibile connettersi all'AI.",
        requirements: "- Requisito simulato\n- Altro requisito"
    };

    if (!ai) return mockJob;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Job: ${title} (${department})`,
            config: {
                systemInstruction: "Genera Job Description sintetica (max 300 char) e requisiti puntati.",
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

export const generateScorecardSchema = async (title: string, description: string): Promise<ScorecardSchema> => {
    const ai = getAI();
    
    const mockSchema: ScorecardSchema = {
        categories: [
            { id: 'cat1', name: 'Competenze', items: [{id: 's1', label: 'Tecniche'}, {id: 's2', label: 'Esperienza'}] }
        ]
    };

    if (!ai) return mockSchema;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Scorecard per: ${title}. Desc: ${description.substring(0, 200)}`,
            config: {
                systemInstruction: "Crea 3 categorie di valutazione con 3 item ciascuna per interviste.",
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

export const evaluateFit = async (candidate: Candidate, job: JobPosition): Promise<{ score: number, reasoning: string }> => {
    const ai = getAI();

    const mockEval = {
        score: 50,
        reasoning: "⚠️ VALUTAZIONE SIMULATA (AI Error o Quota)."
    };

    if (!ai) return mockEval;

    // TOKEN OPTIMIZATION: Truncate large fields
    const prompt = `
    CAND: ${candidate.fullName}
    ROLE: ${candidate.currentRole}
    SKILLS: ${candidate.skills.slice(0, 10).join(', ')}
    SUMM: ${candidate.summary?.substring(0, 600) || ''}
    
    JOB: ${job.title}
    REQS: ${job.requirements?.substring(0, 800) || ''}
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                systemInstruction: "Valuta match candidato/job (0-100). Sii severo ma giusto. Ragionamento max 2 frasi.",
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

export const generateOnboardingChecklist = async (jobTitle: string): Promise<{ items: { department: string, task: string, phase: OnboardingPhase }[] }> => {
    const ai = getAI();
    const fallback = { 
        items: [
            { department: "HR", task: "Firma Contratto", phase: OnboardingPhase.PRE_BOARDING },
            { department: "IT", task: "Setup PC", phase: OnboardingPhase.PRE_BOARDING },
            { department: "Team", task: "Introduzione Colleghi", phase: OnboardingPhase.DAY_1 }
        ] 
    };

    if (!ai) return fallback;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Genera checklist onboarding per: ${jobTitle}`,
            config: {
                systemInstruction: "Crea una lista di 8-12 attività di onboarding divise per dipartimento (HR, IT, TEAM) e fase temporale (PRE_BOARDING, DAY_1, WEEK_1, MONTH_1). Rispondi in JSON.",
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