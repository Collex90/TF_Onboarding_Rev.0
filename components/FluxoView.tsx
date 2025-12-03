
import React, { useState } from 'react';
import { User, AppState } from '../types';
import { Euro, Plus, FileText, UploadCloud, Calendar, Tag, Image as ImageIcon, Save } from 'lucide-react';

interface FluxoViewProps {
    data: AppState;
    user: User | null;
}

export const FluxoView: React.FC<FluxoViewProps> = ({ data, user }) => {
    const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
    
    // Mock Data
    const recentExpenses = [
        { id: 1, date: '2024-02-20', category: 'Trasporti', desc: 'Taxi Milano Centrale', amount: '25.00€', status: 'APPROVED' },
        { id: 2, date: '2024-02-21', category: 'Vitto', desc: 'Pranzo Cliente', amount: '45.50€', status: 'PENDING' },
        { id: 3, date: '2024-02-22', category: 'Alloggio', desc: 'Hotel Roma', amount: '120.00€', status: 'DRAFT' },
    ];

    return (
        <div className="h-full bg-stone-50 p-8 overflow-y-auto">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h2 className="text-3xl font-serif font-bold text-stone-900">Le Mie Spese</h2>
                    <p className="text-stone-500">Gestisci rimborsi e note spese.</p>
                </div>
                <button 
                    onClick={() => setIsAddExpenseOpen(true)}
                    className="bg-violet-600 text-white px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg hover:bg-violet-700 transition-colors"
                >
                    <Plus size={20}/> Nuova Spesa
                </button>
            </div>

            <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-stone-50 text-stone-500 uppercase text-xs font-bold border-b border-stone-200">
                        <tr>
                            <th className="p-4">Data</th>
                            <th className="p-4">Categoria</th>
                            <th className="p-4">Descrizione</th>
                            <th className="p-4">Importo</th>
                            <th className="p-4">Stato</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                        {recentExpenses.map(ex => (
                            <tr key={ex.id} className="hover:bg-violet-50 transition-colors">
                                <td className="p-4 text-stone-600 font-medium">{ex.date}</td>
                                <td className="p-4"><span className="bg-stone-100 text-stone-600 px-2 py-1 rounded text-xs font-bold">{ex.category}</span></td>
                                <td className="p-4 text-stone-800">{ex.desc}</td>
                                <td className="p-4 font-bold text-stone-900">{ex.amount}</td>
                                <td className="p-4">
                                    <span className={`text-[10px] font-bold px-2 py-1 rounded border ${
                                        ex.status === 'APPROVED' ? 'bg-green-100 text-green-700 border-green-200' :
                                        ex.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700 border-yellow-200' :
                                        'bg-stone-100 text-stone-500 border-stone-200'
                                    }`}>
                                        {ex.status}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <div className="p-4 border-t border-stone-100 text-center text-stone-400 text-xs italic">
                    Visualizzando le ultime 3 spese
                </div>
            </div>

            {/* ADD EXPENSE MODAL */}
            {isAddExpenseOpen && (
                <div className="fixed inset-0 bg-stone-900/40 flex items-center justify-center z-[100] backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-in zoom-in-95 p-6">
                        <h3 className="text-xl font-bold text-stone-900 mb-6 flex items-center gap-2 font-serif">
                            <Euro size={24} className="text-violet-600"/> Nuova Spesa
                        </h3>
                        
                        <div className="space-y-4">
                            <div className="border-2 border-dashed border-stone-300 rounded-xl bg-stone-50 p-6 text-center cursor-pointer hover:bg-violet-50 hover:border-violet-300 transition-colors">
                                <UploadCloud size={32} className="mx-auto text-stone-400 mb-2"/>
                                <p className="text-sm font-bold text-stone-600">Carica Scontrino / Ricevuta</p>
                                <p className="text-xs text-stone-400">PDF, JPG, PNG</p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-stone-500 uppercase mb-1">Data</label>
                                    <div className="relative">
                                        <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"/>
                                        <input type="date" className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-violet-500"/>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-stone-500 uppercase mb-1">Importo</label>
                                    <div className="relative">
                                        <Euro size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"/>
                                        <input type="number" placeholder="0.00" className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-violet-500"/>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-stone-500 uppercase mb-1">Categoria</label>
                                <select className="w-full p-2 bg-stone-50 border border-stone-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-violet-500 text-stone-700">
                                    <option>Vitto</option>
                                    <option>Trasporti</option>
                                    <option>Alloggio</option>
                                    <option>Altro</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-stone-500 uppercase mb-1">Descrizione</label>
                                <input type="text" placeholder="Es. Pranzo con cliente..." className="w-full p-2 bg-stone-50 border border-stone-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-violet-500"/>
                            </div>
                        </div>

                        <div className="flex gap-3 mt-8">
                            <button onClick={() => setIsAddExpenseOpen(false)} className="flex-1 py-2 text-stone-600 font-bold hover:bg-stone-100 rounded-xl transition-colors">Annulla</button>
                            <button className="flex-1 py-2 bg-violet-600 text-white rounded-xl font-bold hover:bg-violet-700 shadow-lg shadow-violet-200 transition-colors flex items-center justify-center gap-2">
                                <Save size={18}/> Salva
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
