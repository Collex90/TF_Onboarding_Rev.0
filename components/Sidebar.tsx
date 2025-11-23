
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
        <div className={`${isCollapsed ? 'w-20' : 'w-64'} bg-white h-screen shadow-lg flex flex-col sticky top-0 transition-all duration-300 ease-in-out z-20`}>
            <div className={`p-6 border-b border-gray-100 flex ${isCollapsed ? 'justify-center' : 'justify-between'} items-center`}>
                {!isCollapsed && (
                    <div className="flex items-center gap-2 text-indigo-600 overflow-hidden whitespace-nowrap">
                        <LayoutDashboard size={28} className="shrink-0" />
                        <h1 className="text-xl font-bold tracking-tight">TalentFlow</h1>
                    </div>
                )}
                {isCollapsed && <LayoutDashboard size={28} className="text-indigo-600 shrink-0" />}
                
                <button 
                    onClick={toggleCollapse}
                    className={`text-gray-400 hover:text-indigo-600 transition-colors ${isCollapsed ? 'hidden' : ''}`}
                >
                    <ChevronLeft size={20} />
                </button>
            </div>

            <nav className="flex-1 p-4 space-y-2">
                {filteredMenu.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                        <button
                            key={item.id}
                            onClick={() => onTabChange(item.id)}
                            title={isCollapsed ? item.label : ''}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                                isActive 
                                ? 'bg-indigo-50 text-indigo-600 shadow-sm font-medium' 
                                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                            } ${isCollapsed ? 'justify-center px-0' : ''}`}
                        >
                            <Icon size={20} className="shrink-0" />
                            {!isCollapsed && <span className="whitespace-nowrap">{item.label}</span>}
                            
                            {/* Tooltip for collapsed mode */}
                            {isCollapsed && (
                                <div className="absolute left-16 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 whitespace-nowrap">
                                    {item.label}
                                </div>
                            )}
                        </button>
                    );
                })}
            </nav>

            <div className="p-4 border-t border-gray-100">
                 {isCollapsed ? (
                     <div className="flex flex-col items-center gap-4">
                        <button onClick={toggleCollapse} className="text-gray-400 hover:text-indigo-600">
                            <ChevronRight size={24} />
                        </button>
                        <img src={user?.avatar} alt="User" className="w-8 h-8 rounded-full border border-gray-200" />
                     </div>
                 ) : (
                    <div className="flex flex-col gap-4">
                        <div className="flex items-center gap-3">
                            <img src={user?.avatar} alt="User" className="w-10 h-10 rounded-full border border-gray-200 bg-gray-100" />
                            <div className="flex-1 overflow-hidden">
                                <p className="text-sm font-bold text-gray-900 truncate">{user?.name}</p>
                                <p className="text-xs text-gray-500 truncate flex items-center gap-1">
                                    {user?.email} 
                                    <span className="px-1 bg-gray-200 rounded text-[10px] text-gray-700 font-bold uppercase">{user?.role}</span>
                                </p>
                            </div>
                            <button onClick={onLogout} className="text-gray-400 hover:text-red-500 transition-colors" title="Logout">
                                <LogOut size={18} />
                            </button>
                        </div>
                        
                        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl p-3 text-white text-center">
                            <p className="text-[10px] opacity-80 uppercase tracking-wider">Powered by</p>
                            <p className="font-bold text-xs">Google Gemini 2.5</p>
                        </div>
                    </div>
                 )}
            </div>
        </div>
    );
};
