import React, { useState } from 'react';
import { LayoutDashboard, ArrowRight, AlertCircle, UserPlus, LogIn, Sparkles } from 'lucide-react';
import { User } from '../types';
import { auth } from '../services/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';

interface LoginViewProps {
    onLogin: (user: User) => void;
    isCloudConfigured: boolean;
}

// Talentium Custom Logo (Large)
const TalentiumLogoLarge = ({ className = "w-16 h-16" }: { className?: string }) => (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
        <defs>
            <linearGradient id="talentiumGradientLg" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
                <stop stopColor="#34d399" /> {/* Emerald-400 */}
                <stop offset="1" stopColor="#0f766e" /> {/* Teal-700 */}
            </linearGradient>
            <filter id="glowLg" x="-10" y="-10" width="60" height="60" filterUnits="userSpaceOnUse">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
        </defs>
        {/* Outer Glow */}
        <path d="M20 2L36 11V29L20 38L4 29V11L20 2Z" fill="url(#talentiumGradientLg)" fillOpacity="0.1" filter="url(#glowLg)" />
        
        {/* Main Structure */}
        <path d="M20 4L34 12V28L20 36L6 28V12L20 4Z" fill="white" fillOpacity="0.1" stroke="url(#talentiumGradientLg)" strokeWidth="0.5" />
        <path d="M20 8L30 14V26L20 32L10 26V14L20 8Z" stroke="url(#talentiumGradientLg)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        
        {/* Internal Details */}
        <path d="M20 8V32" stroke="white" strokeWidth="1.5" strokeOpacity="0.8" strokeLinecap="round"/>
        <path d="M10 14L30 14" stroke="white" strokeWidth="1.5" strokeOpacity="0.8" strokeLinecap="round"/>
        <path d="M10 26L30 26" stroke="white" strokeWidth="1.5" strokeOpacity="0.8" strokeLinecap="round"/>
        
        {/* Core Gem */}
        <circle cx="20" cy="20" r="4" fill="white" className="animate-pulse" />
    </svg>
);

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
                } else {
                    // LOGIN
                    await signInWithEmailAndPassword(auth, email, password);
                }
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
                        uid: 'local-admin', // UID fisso per ambiente demo/locale
                        name: capitalizedName || 'Utente Demo',
                        email: email,
                        role: 'ADMIN', // In locale sei sempre admin
                        avatar: `https://ui-avatars.com/api/?name=${demoName}&background=059669&color=fff`
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
        <div className="min-h-screen flex w-full bg-stone-50 font-sans">
            {/* LEFT SIDE - IMAGE & BRANDING */}
            <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-stone-900">
                <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop')] bg-cover bg-center opacity-60 mix-blend-overlay"></div>
                <div className="absolute inset-0 bg-gradient-to-t from-emerald-900/90 via-stone-900/40 to-stone-900/20"></div>
                
                <div className="relative z-10 flex flex-col justify-between p-16 h-full text-white">
                    <div className="flex items-center gap-4">
                        <div className="bg-white/10 backdrop-blur-md p-2 rounded-2xl border border-white/20 shadow-xl">
                            <TalentiumLogoLarge className="w-10 h-10" />
                        </div>
                        <span className="text-3xl font-serif font-bold tracking-tight text-white">Talentium</span>
                    </div>

                    <div className="space-y-6 max-w-lg">
                        <h1 className="text-5xl font-serif font-bold leading-tight">
                            Il futuro del <span className="text-emerald-400">Recruiting</span> è qui.
                        </h1>
                        <p className="text-lg text-stone-200 font-light leading-relaxed">
                            Automatizza lo screening, analizza i candidati con l'AI e gestisci l'intero ciclo di vita del talento in un'unica piattaforma elegante ed efficiente.
                        </p>
                        
                        <div className="flex gap-4 pt-4">
                            <div className="flex -space-x-3">
                                {[1,2,3,4].map(i => (
                                    <div key={i} className="w-10 h-10 rounded-full border-2 border-stone-800 bg-stone-700 overflow-hidden">
                                        <img src={`https://ui-avatars.com/api/?name=User+${i}&background=random`} alt="User" />
                                    </div>
                                ))}
                            </div>
                            <div className="flex flex-col justify-center">
                                <span className="text-sm font-bold">1000+ HR Manager</span>
                                <span className="text-xs text-stone-400">si fidano di noi</span>
                            </div>
                        </div>
                    </div>
                    
                    <div className="text-xs text-stone-400 flex justify-between items-end">
                        <span>© 2024 Talentium Inc.</span>
                        <div className="flex items-center gap-1">
                            <Sparkles size={12} className="text-emerald-400"/> Powered by Gemini 2.5
                        </div>
                    </div>
                </div>
            </div>

            {/* RIGHT SIDE - FORM */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-8 relative">
                 {/* Mobile Background (visible only on small screens) */}
                 <div className="absolute inset-0 lg:hidden bg-[url('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop')] bg-cover bg-center opacity-10"></div>

                <div className="w-full max-w-md relative z-10">
                    <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl p-8 border border-white">
                        <div className="mb-8 text-center">
                            <div className="w-20 h-20 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-inner border border-white rotate-3 transform hover:rotate-6 transition-transform">
                                <TalentiumLogoLarge className="w-12 h-12" />
                            </div>
                            <h2 className="text-3xl font-serif font-bold text-stone-800 mb-2">
                                {isRegistering ? "Crea Account" : "Bentornato"}
                            </h2>
                            <p className="text-stone-500 text-sm">
                                {isRegistering ? "Inizia a gestire i tuoi talenti oggi stesso." : "Accedi alla tua dashboard Talentium."}
                            </p>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-5">
                            {isCloudConfigured && (
                                <div className="bg-emerald-50 text-emerald-800 px-3 py-2 rounded-lg border border-emerald-100 text-xs text-center font-bold flex items-center justify-center gap-2 mb-4">
                                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div> 
                                    Cloud Connesso & Sicuro
                                </div>
                            )}

                            {error && (
                                <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm flex items-start gap-3 border border-red-100 animate-in slide-in-from-top-2">
                                    <AlertCircle size={18} className="shrink-0 mt-0.5"/> 
                                    <span>{error}</span>
                                </div>
                            )}

                            {isRegistering && (
                                <div className="animate-in slide-in-from-top-2 fade-in">
                                    <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1.5 ml-1">Nome Completo</label>
                                    <input 
                                        type="text" 
                                        required={isRegistering}
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="Mario Rossi"
                                        className="w-full px-4 py-3.5 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all bg-stone-50 focus:bg-white text-stone-900 placeholder:text-stone-300 font-medium"
                                    />
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1.5 ml-1">Email Aziendale</label>
                                <input 
                                    type="email" 
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="nome@azienda.com"
                                    className="w-full px-4 py-3.5 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all bg-stone-50 focus:bg-white text-stone-900 placeholder:text-stone-300 font-medium"
                                />
                            </div>
                            
                            <div>
                                <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1.5 ml-1">Password</label>
                                <input 
                                    type="password" 
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full px-4 py-3.5 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all bg-stone-50 focus:bg-white text-stone-900 placeholder:text-stone-300 font-medium"
                                />
                            </div>

                            <button 
                                type="submit" 
                                disabled={isLoading}
                                className="w-full bg-stone-900 text-white py-4 rounded-xl font-bold hover:bg-emerald-600 transition-all shadow-lg hover:shadow-emerald-200 hover:-translate-y-0.5 flex items-center justify-center gap-2 disabled:opacity-70 disabled:shadow-none disabled:translate-y-0 mt-4"
                            >
                                {isLoading ? 'Elaborazione...' : isRegistering ? <>Crea Account <UserPlus size={18}/></> : <>Accedi <ArrowRight size={18}/></>}
                            </button>
                            
                            <div className="pt-6 border-t border-stone-100 text-center">
                                <p className="text-sm text-stone-500 mb-3">
                                    {isRegistering ? "Hai già un account?" : "Non hai un account?"}
                                </p>
                                <button 
                                    type="button"
                                    onClick={() => { setIsRegistering(!isRegistering); setError(null); }}
                                    className="text-emerald-600 font-bold hover:text-emerald-700 transition-colors text-sm flex items-center justify-center gap-2 mx-auto px-4 py-2 hover:bg-emerald-50 rounded-lg"
                                >
                                    {isRegistering ? <><LogIn size={16}/> Accedi al sistema</> : <><UserPlus size={16}/> Registrati ora</>}
                                </button>
                            </div>
                        </form>
                    </div>

                    {!isCloudConfigured && (
                        <div className="text-center mt-6 animate-pulse">
                            <p className="text-[10px] text-stone-400 bg-stone-100/50 inline-block px-3 py-1 rounded-full border border-stone-200">
                                🔧 Modalità Demo Locale Attiva
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};