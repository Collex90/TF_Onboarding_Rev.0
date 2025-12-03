
import React, { useState, useMemo } from 'react';
import { User, AppState, Employee, EmployeeStatus, EmployeeStatusLabels, EmployeeStatusColors } from '../types';
import { Users, GraduationCap, ShieldCheck, Plus, Search, Mail, Phone, Calendar, Edit, Trash2, X, CheckCircle, Save, Loader2 } from 'lucide-react';
import { addEmployee, updateEmployee, deleteEmployee, generateId } from '../services/storage';

interface HumanViewProps {
    data: AppState;
    user: User | null;
}

export const HumanView: React.FC<HumanViewProps> = ({ data, user }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
    
    // Form State
    const initialFormState: Partial<Employee> = {
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        role: '',
        department: '',
        status: EmployeeStatus.ACTIVE,
        contractType: 'FULL_TIME',
        startDate: Date.now()
    };
    const [formData, setFormData] = useState<Partial<Employee>>(initialFormState);

    const employees = useMemo(() => {
        let list = data.employees;
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            list = list.filter(e => 
                e.firstName.toLowerCase().includes(term) || 
                e.lastName.toLowerCase().includes(term) ||
                e.role.toLowerCase().includes(term) ||
                e.department.toLowerCase().includes(term)
            );
        }
        return list;
    }, [data.employees, searchTerm]);

    const handleAdd = () => {
        setEditingEmployee(null);
        setFormData(initialFormState);
        setIsModalOpen(true);
    };

    const handleEdit = (emp: Employee) => {
        setEditingEmployee(emp);
        setFormData({ ...emp });
        setIsModalOpen(true);
    };

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (confirm("Sei sicuro di voler eliminare questo dipendente?")) {
            await deleteEmployee(id);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            if (!formData.firstName || !formData.lastName || !formData.email) {
                alert("Compila i campi obbligatori.");
                setIsSaving(false);
                return;
            }

            const empData: Employee = {
                ...initialFormState, // Defaults
                ...formData,
                id: editingEmployee ? editingEmployee.id : generateId(),
                createdAt: editingEmployee ? editingEmployee.createdAt : Date.now()
            } as Employee;

            if (editingEmployee) {
                await updateEmployee(empData);
            } else {
                await addEmployee(empData);
            }
            setIsModalOpen(false);
        } catch (error) {
            console.error(error);
            alert("Errore durante il salvataggio.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="h-full bg-stone-50 p-8 overflow-y-auto">
            {/* HEADER */}
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h2 className="text-3xl font-serif font-bold text-stone-900">Anagrafica Dipendenti</h2>
                    <p className="text-stone-500">Gestione risorse umane, formazione e sicurezza.</p>
                </div>
                <div className="flex gap-2">
                    <button className="bg-white border border-stone-200 text-stone-700 px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-sm hover:bg-stone-50 transition-colors">
                        <GraduationCap size={20}/> Formazione
                    </button>
                    <button onClick={handleAdd} className="bg-blue-600 text-white px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg hover:bg-blue-700 transition-colors">
                        <Plus size={20}/> Nuovo Dipendente
                    </button>
                </div>
            </div>

            {/* LIST */}
            <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden mb-8">
                <div className="p-4 border-b border-stone-100 flex gap-4 bg-stone-50/50">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={18}/>
                        <input 
                            type="text" 
                            placeholder="Cerca dipendente..." 
                            className="w-full pl-10 pr-4 py-2 bg-white border border-stone-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
                
                {employees.length === 0 ? (
                    <div className="p-8 text-center text-stone-400 italic">Nessun dipendente trovato.</div>
                ) : (
                    <table className="w-full text-left text-sm">
                        <thead className="bg-stone-50 text-stone-500 uppercase text-xs font-bold border-b border-stone-200">
                            <tr>
                                <th className="p-4">Nome</th>
                                <th className="p-4">Contatti</th>
                                <th className="p-4">Ruolo</th>
                                <th className="p-4">Dipartimento</th>
                                <th className="p-4">Stato</th>
                                <th className="p-4 w-20"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100">
                            {employees.map(emp => (
                                <tr key={emp.id} className="hover:bg-blue-50 transition-colors cursor-pointer group" onClick={() => handleEdit(emp)}>
                                    <td className="p-4 font-bold text-stone-900 flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-stone-200 flex items-center justify-center text-sm font-bold text-stone-600 border-2 border-white shadow-sm overflow-hidden">
                                            {emp.photo ? <img src={`data:image/jpeg;base64,${emp.photo}`} className="w-full h-full object-cover"/> : emp.firstName.charAt(0)}
                                        </div>
                                        <div>
                                            <div className="font-bold text-stone-900">{emp.firstName} {emp.lastName}</div>
                                            <div className="text-xs text-stone-400 font-medium">{new Date(emp.startDate).toLocaleDateString()}</div>
                                        </div>
                                    </td>
                                    <td className="p-4 text-stone-600">
                                        <div className="flex flex-col gap-1">
                                            <span className="flex items-center gap-1 text-xs"><Mail size={10}/> {emp.email}</span>
                                            {emp.phone && <span className="flex items-center gap-1 text-xs"><Phone size={10}/> {emp.phone}</span>}
                                        </div>
                                    </td>
                                    <td className="p-4 text-stone-600 font-medium">{emp.role}</td>
                                    <td className="p-4 text-stone-600"><span className="bg-stone-100 px-2 py-1 rounded text-xs font-bold text-stone-500 border border-stone-200">{emp.department}</span></td>
                                    <td className="p-4">
                                        <span className={`text-[10px] font-bold px-2 py-1 rounded border ${EmployeeStatusColors[emp.status]}`}>
                                            {EmployeeStatusLabels[emp.status]}
                                        </span>
                                    </td>
                                    <td className="p-4 text-right">
                                        <button onClick={(e) => handleDelete(e, emp.id)} className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100">
                                            <Trash2 size={16}/>
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* DASHBOARD WIDGETS */}
            <div className="grid grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
                    <h3 className="font-bold text-stone-800 mb-4 flex items-center gap-2"><GraduationCap size={20} className="text-blue-600"/> Scadenze Formazione</h3>
                    <div className="space-y-3">
                        <div className="flex justify-between items-center text-sm p-3 bg-stone-50 rounded-xl border border-stone-100">
                            <span className="text-stone-700 font-medium">Corso Privacy (GDPR)</span>
                            <span className="text-red-600 font-bold text-xs bg-red-50 px-2 py-1 rounded">Scade tra 3gg</span>
                        </div>
                        <div className="flex justify-between items-center text-sm p-3 bg-stone-50 rounded-xl border border-stone-100">
                            <span className="text-stone-700 font-medium">Security Awareness</span>
                            <span className="text-stone-500 text-xs font-bold bg-stone-200 px-2 py-1 rounded">Scade tra 20gg</span>
                        </div>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
                    <h3 className="font-bold text-stone-800 mb-4 flex items-center gap-2"><ShieldCheck size={20} className="text-amber-600"/> Visite Mediche</h3>
                    <div className="space-y-3">
                        <div className="flex justify-between items-center text-sm p-3 bg-stone-50 rounded-xl border border-stone-100">
                            <span className="text-stone-700 font-medium">Mario Rossi</span>
                            <span className="text-amber-600 font-bold text-xs flex items-center gap-1"><Calendar size={12}/> Da prenotare</span>
                        </div>
                        <div className="flex justify-between items-center text-sm p-3 bg-stone-50 rounded-xl border border-stone-100">
                            <span className="text-stone-700 font-medium">Giulia Bianchi</span>
                            <span className="text-green-600 font-bold text-xs flex items-center gap-1"><CheckCircle size={12}/> Effettuata</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ADD/EDIT MODAL */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-stone-900/40 flex items-center justify-center z-[100] backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl animate-in zoom-in-95 flex flex-col max-h-[90vh]">
                        <div className="flex justify-between items-center p-6 border-b border-stone-100 bg-stone-50/50 rounded-t-2xl">
                            <h3 className="text-xl font-bold text-stone-900 font-serif">
                                {editingEmployee ? 'Modifica Dipendente' : 'Nuovo Dipendente'}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-stone-400 hover:text-stone-600">
                                <X size={24}/>
                            </button>
                        </div>
                        
                        <form onSubmit={handleSubmit} className="p-8 space-y-6 overflow-y-auto custom-scrollbar">
                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-xs font-bold text-stone-500 uppercase mb-1">Nome</label>
                                    <input required value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} className="w-full p-2.5 bg-white border border-stone-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-stone-900 font-medium" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-stone-500 uppercase mb-1">Cognome</label>
                                    <input required value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} className="w-full p-2.5 bg-white border border-stone-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-stone-900 font-medium" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-stone-500 uppercase mb-1">Email</label>
                                    <input type="email" required value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full p-2.5 bg-white border border-stone-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-stone-900 font-medium" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-stone-500 uppercase mb-1">Telefono</label>
                                    <input value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full p-2.5 bg-white border border-stone-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-stone-900 font-medium" />
                                </div>
                            </div>

                            <div className="border-t border-stone-100 pt-4">
                                <h4 className="text-sm font-bold text-stone-900 mb-3 uppercase tracking-wider flex items-center gap-2">Dati Contrattuali</h4>
                                <div className="grid grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-xs font-bold text-stone-500 uppercase mb-1">Ruolo</label>
                                        <input required value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} className="w-full p-2.5 bg-white border border-stone-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-stone-900 font-medium" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-stone-500 uppercase mb-1">Dipartimento</label>
                                        <input required value={formData.department} onChange={e => setFormData({...formData, department: e.target.value})} className="w-full p-2.5 bg-white border border-stone-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-stone-900 font-medium" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-stone-500 uppercase mb-1">Data Assunzione</label>
                                        <input type="date" required value={formData.startDate ? new Date(formData.startDate).toISOString().split('T')[0] : ''} onChange={e => setFormData({...formData, startDate: new Date(e.target.value).getTime()})} className="w-full p-2.5 bg-white border border-stone-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-stone-900 font-medium" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-stone-500 uppercase mb-1">Tipo Contratto</label>
                                        <select value={formData.contractType} onChange={e => setFormData({...formData, contractType: e.target.value as any})} className="w-full p-2.5 bg-white border border-stone-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-stone-900 font-medium">
                                            <option value="FULL_TIME">Full Time</option>
                                            <option value="PART_TIME">Part Time</option>
                                            <option value="INTERN">Stage</option>
                                            <option value="CONTRACTOR">P.IVA / Esterno</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-stone-500 uppercase mb-1">Stato</label>
                                        <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as any})} className={`w-full p-2.5 bg-white border border-stone-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-stone-900 font-bold ${EmployeeStatusColors[formData.status || EmployeeStatus.ACTIVE]}`}>
                                            {Object.keys(EmployeeStatusLabels).map(key => (
                                                <option key={key} value={key}>{EmployeeStatusLabels[key as EmployeeStatus]}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-stone-100">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-stone-600 hover:bg-stone-100 rounded-xl font-medium transition-colors">Annulla</button>
                                <button 
                                    type="submit" 
                                    disabled={isSaving}
                                    className="px-6 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 flex items-center gap-2 disabled:opacity-50 transition-all"
                                >
                                    {isSaving ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>} Salva
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
