import React from 'react';
import { LayoutDashboard, Users, Briefcase, Settings, ChevronLeft, ChevronRight, LogOut, Flag } from 'lucide-react';
import { User, UserRole } from '../types';

interface SidebarProps {
    activeTab: string;
    onTabChange: (tab: string) => void;
    isCollapsed: boolean;
    toggleCollapse: () => void;
    user: User | null;
    onLogout: () => void;
}

// Talentium Custom Logo Component
const TalentiumLogo = ({ className = "w-8 h-8" }: { className?: string }) => (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
        <defs>
            <linearGradient id="talentiumGradient" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
                <stop stopColor="#34d399" /> {/* Emerald-400 */}
                <stop offset="1" stopColor="#0f766e" /> {/* Teal-700 */}
            </linearGradient>
            <filter id="glow" x="-4" y="-4" width="48" height="48" filterUnits="userSpaceOnUse">
                <feGaussianBlur stdDeviation="2" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
        </defs>
        <path d="M20 4L34 12V28L20 36L6 28V12L20 4Z" fill="url(#talentiumGradient)" fillOpacity="0.2" />
        <path d="M20 8L30 14V26L20 32L10 26V14L20 8Z" stroke="url(#talentiumGradient)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M20 8V32M10 14L30 14M10 26L30 26" stroke="white" strokeWidth="1.5" strokeOpacity="0.6" strokeLinecap="round"/>
        <circle cx="20" cy="20" r="3" fill="white" />
    </svg>
);

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, onTabChange, isCollapsed, toggleCollapse, user, onLogout }) => {
    const allMenuItems = [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: [UserRole.ADMIN, UserRole.HR] },
        { id: 'candidates', label: 'Candidati', icon: Users, roles: [UserRole.ADMIN, UserRole.HR] },
        { id: 'recruitment', label: 'Recruitment', icon: Briefcase, roles: [UserRole.ADMIN, UserRole.HR, UserRole.TEAM] },
        { id: 'onboarding', label: 'Onboarding', icon: Flag, roles: [UserRole.ADMIN, UserRole.HR] },
        { id: 'settings', label: 'Impostazioni', icon: Settings, roles: [UserRole.ADMIN] },
    ];

    const filteredMenu = allMenuItems.filter(item => {
        if (!user) return false;
        return item.roles.includes(user.role as UserRole);
    });

    return (
        <div className={`${isCollapsed ? 'w-20' : 'w-64'} glass-sidebar h-screen shadow-xl flex flex-col sticky top-0 transition-all duration-300 ease-in-out z-20 border-r border-white/20`}>
            <div className={`p-6 flex ${isCollapsed ? 'justify-center' : 'justify-between'} items-center`}>
                {!isCollapsed && (
                    <div className="flex items-center gap-3 text-emerald-800 overflow-hidden whitespace-nowrap animate-in fade-in">
                        <div className="bg-white/50 p-1.5 rounded-xl shadow-sm">
                            <TalentiumLogo className="w-8 h-8" />
                        </div>
                        <h1 className="text-2xl font-serif font-bold tracking-tight text-emerald-950">Talentium</h1>
                    </div>
                )}
                {isCollapsed && (
                    <div className="bg-white/50 p-2 rounded-xl shadow-sm">
                        <TalentiumLogo className="w-8 h-8" />
                    </div>
                )}
                
                <button 
                    onClick={toggleCollapse}
                    className={`text-stone-400 hover:text-emerald-600 transition-colors ${isCollapsed ? 'hidden' : ''}`}
                >
                    <ChevronLeft size={20} />
                </button>
            </div>

            <nav className="flex-1 px-3 py-4 space-y-1">
                {filteredMenu.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                        <button
                            key={item.id}
                            onClick={() => onTabChange(item.id)}
                            title={isCollapsed ? item.label : ''}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group relative ${
                                isActive 
                                ? 'bg-emerald-50/80 text-emerald-700 shadow-sm font-semibold backdrop-blur-md' 
                                : 'text-stone-500 hover:bg-white/50 hover:text-stone-800'
                            } ${isCollapsed ? 'justify-center px-0' : ''}`}
                        >
                            {isActive && <div className="absolute left-0 w-1 h-6 bg-emerald-500 rounded-r-full"></div>}
                            <Icon size={20} className={`shrink-0 transition-transform group-hover:scale-110 duration-200 ${isActive ? 'text-emerald-600' : 'text-stone-400 group-hover:text-stone-600'}`} />
                            {!isCollapsed && <span className="whitespace-nowrap">{item.label}</span>}
                            
                            {/* Tooltip for collapsed mode */}
                            {isCollapsed && (
                                <div className="absolute left-16 bg-stone-800 text-white text-xs px-3 py-1.5 rounded-md opacity-0 group-hover:opacity-100 pointer-events-none transition-all z-50 whitespace-nowrap shadow-lg translate-x-[-10px] group-hover:translate-x-0">
                                    {item.label}
                                </div>
                            )}
                        </button>
                    );
                })}
            </nav>

            <div className="p-4 border-t border-stone-200/30 bg-white/30 backdrop-blur-sm">
                 {isCollapsed ? (
                     <div className="flex flex-col items-center gap-4">
                        <button onClick={toggleCollapse} className="text-stone-400 hover:text-emerald-600">
                            <ChevronRight size={24} />
                        </button>
                        <img src={user?.avatar} alt="User" className="w-8 h-8 rounded-full border border-white shadow-sm" />
                     </div>
                 ) : (
                    <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-2">
                        <div className="flex items-center gap-3 bg-white/60 p-2 rounded-xl border border-white shadow-sm">
                            <img src={user?.avatar} alt="User" className="w-10 h-10 rounded-full border border-white shadow-sm object-cover" />
                            <div className="flex-1 overflow-hidden">
                                <p className="text-sm font-bold text-stone-800 truncate">{user?.name}</p>
                                <p className="text-xs text-stone-500 truncate flex items-center gap-1">
                                    <span className="px-1.5 py-0.5 bg-stone-100 rounded text-[9px] text-stone-600 font-bold uppercase tracking-wider border border-stone-200">{user?.role}</span>
                                </p>
                            </div>
                            <button onClick={onLogout} className="text-stone-400 hover:text-red-500 transition-colors p-1 hover:bg-red-50 rounded-lg" title="Logout">
                                <LogOut size={18} />
                            </button>
                        </div>
                        
                        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-xl p-3 text-white text-center shadow-lg shadow-emerald-200 relative overflow-hidden group">
                            <div className="absolute top-0 left-0 w-full h-full bg-white/10 transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                            <p className="text-[10px] opacity-80 uppercase tracking-wider font-medium">Powered by</p>
                            <p className="font-bold text-xs flex items-center justify-center gap-1">Google Gemini 2.5 <SparklesIcon/></p>
                        </div>
                    </div>
                 )}
            </div>
        </div>
    );
};

const SparklesIcon = () => (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="animate-pulse">
        <path d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6L12 2Z" fill="white"/>
    </svg>
);