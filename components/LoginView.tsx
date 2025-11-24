
import React, { useState } from 'react';
import { LayoutDashboard, ArrowRight, AlertCircle, UserPlus, LogIn } from 'lucide-react';
import { User } from '../types';
import { auth } from '../services/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { syncUserProfile } from '../services/storage';

interface LoginViewProps {
    onLogin: (user: User) => void;
    isCloudConfigured: boolean;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLogin, isCloudConfigured }) => {
    const [isRegistering, setIsRegistering] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState(''); // Solo per registrazione
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);
        
        if (auth) {
            try {
                if (isRegistering) {
                    // REGISTRAZIONE
                    if (!name.trim()) throw new Error("Inserisci il tuo nome e cognome");
                    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                    await updateProfile(userCredential.user, { displayName: name });
                    
                    // Creazione profilo nel DB (verrà gestita anche da onAuthStateChanged, ma forziamo qui per sicurezza UX)
                    // L'utente verrà loggato automaticamente da Firebase dopo la creazione
                } else {
                    // LOGIN
                    await signInWithEmailAndPassword(auth, email, password);
                }
                // onAuthStateChanged in App.tsx gestirà il redirect e il caricamento dati
            } catch (err: any) {
                console.error(err);
                let msg = err.message;
                if (msg.includes("email-already-in-use")) msg = "Email già registrata.";
                if (msg.includes("weak-password")) msg = "La password deve essere di almeno 6 caratteri.";
                if (msg.includes("invalid-credential")) msg = "Email o password errati.";
                setError(isRegistering ? "Registrazione fallita: " + msg : "Login fallito: " + msg);
                setIsLoading(false);
            }
        } else {
            // Demo Local Auth
            setTimeout(() => {
                if (email.length > 3) {
                    const demoName = isRegistering ? name : email.split('@')[0].replace('.', ' ');
                    const capitalizedName = demoName.charAt(0).toUpperCase() + demoName.slice(1);
                    
                    const user: User = {
                        name: capitalizedName || 'Utente Demo',
                        email: email,
                        role: 'ADMIN', // In locale sei sempre admin
                        avatar: `https://ui-avatars.com/api/?name=${demoName}&background=6366f1&color=fff`
                    };
                    onLogin(user);
                } else {
                    setError("Inserisci una email valida");
                    setIsLoading(false);
                }
            }, 800);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col animate-in fade-in zoom-in duration-300">
                <div className="p-8 pb-0 flex flex-col items-center">
                    <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600 mb-4 rotate-3 shadow-sm">
                        <LayoutDashboard size={32} />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900">TalentFlow AI</h1>
                    <p className="text-gray-500 text-center mt-2 text-sm">
                        {isRegistering ? "Crea il tuo account aziendale." : "Piattaforma di AI Talent Management."}
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-5">
                    {isCloudConfigured && (
                        <div className="bg-green-50 text-green-800 p-2 rounded border border-green-100 text-xs text-center font-medium flex items-center justify-center gap-2">
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div> Cloud Connesso
                        </div>
                    )}

                    {error && (
                        <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-center gap-2 border border-red-100">
                            <AlertCircle size={16} className="shrink-0"/> {error}
                        </div>
                    )}

                    {isRegistering && (
                        <div className="animate-in slide-in-from-top-2 fade-in">
                            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Nome e Cognome</label>
                            <input 
                                type="text" 
                                required={isRegistering}
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Mario Rossi"
                                className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all bg-gray-50 focus:bg-white text-gray-900"
                            />
                        </div>
                    )}

                    <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Email Aziendale</label>
                        <input 
                            type="email" 
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="nome@azienda.com"
                            className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all bg-gray-50 focus:bg-white text-gray-900"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Password</label>
                        <input 
                            type="password" 
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all bg-gray-50 focus:bg-white text-gray-900"
                        />
                    </div>

                    <button 
                        type="submit" 
                        disabled={isLoading}
                        className="w-full bg-indigo-600 text-white py-3 rounded-lg font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 disabled:opacity-70 disabled:shadow-none mt-2"
                    >
                        {isLoading ? 'Elaborazione...' : isRegistering ? <>Crea Account <UserPlus size={18}/></> : <>Accedi <ArrowRight size={18}/></>}
                    </button>
                    
                    <div className="pt-4 border-t border-gray-100 text-center">
                        <p className="text-sm text-gray-500 mb-3">
                            {isRegistering ? "Hai già un account?" : "Non hai un account?"}
                        </p>
                        <button 
                            type="button"
                            onClick={() => { setIsRegistering(!isRegistering); setError(null); }}
                            className="text-indigo-600 font-bold hover:text-indigo-800 transition-colors text-sm flex items-center justify-center gap-1 mx-auto"
                        >
                            {isRegistering ? <><LogIn size={14}/> Accedi al sistema</> : <><UserPlus size={14}/> Registrati ora</>}
                        </button>
                    </div>

                    {!isCloudConfigured && (
                        <div className="text-center mt-2">
                            <p className="text-[10px] text-gray-400 bg-gray-50 inline-block px-2 py-1 rounded">
                                Modalità Demo Locale
                            </p>
                        </div>
                    )}
                </form>
            </div>
        </div>
    );
};
