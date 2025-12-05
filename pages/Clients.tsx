import React, { useState } from 'react';
import { Client } from '../types';
import { Search, Plus, X, User, Ruler, Scale, Activity, Moon, Utensils, Calendar } from 'lucide-react';

interface ClientsProps {
  clients: Client[];
  setClients: (clients: Client[]) => void;
  onSelectClient: (id: string) => void;
  onSave: (clients: Client[]) => void;
}

const Clients: React.FC<ClientsProps> = ({ clients, setClients, onSelectClient, onSave }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Form State
  const [step, setStep] = useState(1); // 1: Basic, 2: Bio, 3: Lifestyle
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newSessions, setNewSessions] = useState(10);
  
  // Bio
  const [newGender, setNewGender] = useState('Male');
  const [newHeight, setNewHeight] = useState('');
  const [newWeight, setNewWeight] = useState('');
  const [newBodyType, setNewBodyType] = useState('Mesomorph');
  
  // Lifestyle
  const [newActivity, setNewActivity] = useState('Moderate');
  const [newSleep, setNewSleep] = useState('6-8h');
  const [newDiet, setNewDiet] = useState('Standard');
  const [newDays, setNewDays] = useState('3');

  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const resetForm = () => {
    setNewName('');
    setNewPhone('');
    setNewSessions(10);
    setNewGender('Male');
    setNewHeight('');
    setNewWeight('');
    setNewBodyType('Mesomorph');
    setNewActivity('Moderate');
    setNewSleep('6-8h');
    setNewDiet('Standard');
    setNewDays('3');
    setStep(1);
    setIsModalOpen(false);
  }

  const handleAddClient = (e: React.FormEvent) => {
    e.preventDefault();
    if (step < 3) {
        setStep(step + 1);
        return;
    }

    const newClient: Client = {
      id: crypto.randomUUID(),
      name: newName,
      email: '', 
      phone: newPhone,
      sessionsTotal: Number(newSessions),
      sessionsUsed: 0,
      notes: '',
      progressNotes: [],
      plans: [],
      history: [],
      schedule: [],
      joinedAt: new Date().toISOString(),
      // Bio & Lifestyle
      gender: newGender,
      height: newHeight,
      weight: newWeight,
      bodyType: newBodyType,
      activityLevel: newActivity,
      sleepDuration: newSleep,
      dietType: newDiet,
      trainingDays: newDays
    };

    const updated = [...clients, newClient];
    setClients(updated);
    onSave(updated);
    resetForm();
  };

  return (
    <div className="space-y-4 min-h-[80vh]">
      {/* Search Bar */}
      <div className="sticky top-0 bg-slate-50 pt-2 pb-4 z-10">
          <div className="relative shadow-sm">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
              type="text" 
              placeholder="Search clients..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3.5 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-base"
            />
          </div>
      </div>

      {/* Client List */}
      <div className="space-y-3 pb-24">
         {filteredClients.map(client => {
             const remaining = client.sessionsTotal - client.sessionsUsed;
             const percentage = (remaining / client.sessionsTotal) * 100;
             const isLow = remaining <= 1;

             return (
                 <div 
                    key={client.id}
                    onClick={() => onSelectClient(client.id)}
                    className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm active:scale-[0.98] transition-transform"
                 >
                     <div className="flex items-center justify-between mb-3">
                         <div className="flex items-center">
                             <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold mr-3 border border-slate-200">
                                 {client.name[0]}
                             </div>
                             <div>
                                 <h3 className="font-bold text-slate-800 text-lg">{client.name}</h3>
                                 <p className="text-xs text-slate-400">{client.phone}</p>
                             </div>
                         </div>
                         <div className={`text-sm font-bold ${isLow ? 'text-red-500' : 'text-emerald-600'}`}>
                             {remaining} Left
                         </div>
                     </div>
                     
                     {/* Progress Bar */}
                     <div className="w-full bg-slate-100 rounded-full h-2 mb-1">
                        <div 
                          className={`h-2 rounded-full transition-all duration-500 ${isLow ? 'bg-red-500' : 'bg-emerald-500'}`} 
                          style={{ width: `${percentage}%` }}
                        ></div>
                     </div>
                 </div>
             )
         })}
         {filteredClients.length === 0 && (
             <div className="text-center py-12 text-slate-400">
                 No clients found.
             </div>
         )}
      </div>

      {/* Floating Action Button */}
      <button 
        onClick={() => setIsModalOpen(true)}
        className="fixed bottom-24 right-6 w-14 h-14 bg-emerald-600 text-white rounded-full shadow-xl shadow-emerald-200 flex items-center justify-center hover:bg-emerald-700 active:scale-95 transition-all z-20"
      >
        <Plus size={28} />
      </button>

      {/* Full Screen Add Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-50 flex flex-col animate-in slide-in-from-bottom duration-300">
           <div className="bg-white px-4 py-4 flex justify-between items-center border-b border-slate-100">
               <div className="flex items-center">
                  <span className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center font-bold mr-3 text-sm">
                      {step}/3
                  </span>
                  <h3 className="text-lg font-bold">New Client</h3>
               </div>
               <button onClick={resetForm} className="p-2 bg-slate-100 rounded-full">
                   <X size={20} />
               </button>
           </div>
           
           <form onSubmit={handleAddClient} className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {/* STEP 1: BASIC INFO */}
              {step === 1 && (
                  <div className="space-y-6 animate-in slide-in-from-right duration-300">
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Full Name</label>
                        <input 
                          required
                          autoFocus
                          type="text" 
                          className="w-full p-4 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-lg"
                          value={newName}
                          onChange={e => setNewName(e.target.value)}
                          placeholder="e.g. John Doe"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Phone Number</label>
                        <input 
                          type="tel" 
                          className="w-full p-4 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-lg"
                          value={newPhone}
                          onChange={e => setNewPhone(e.target.value)}
                          placeholder="Mobile number"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Session Pack</label>
                        <div className="grid grid-cols-4 gap-2">
                            {[10, 20, 50].map(num => (
                                <button
                                  key={num}
                                  type="button"
                                  onClick={() => setNewSessions(num)}
                                  className={`py-3 rounded-xl border font-bold transition-all ${newSessions === num ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300'}`}
                                >
                                    {num}
                                </button>
                            ))}
                            <div className="relative">
                                <input 
                                  type="number" 
                                  placeholder="Other"
                                  value={[10, 20, 50].includes(newSessions) ? '' : (newSessions || '')}
                                  onChange={(e) => {
                                      const val = e.target.value;
                                      setNewSessions(val === '' ? 0 : Number(val));
                                  }}
                                  className={`w-full h-full text-center rounded-xl border font-bold outline-none focus:ring-2 focus:ring-emerald-500 transition-all ${![10, 20, 50].includes(newSessions) && newSessions > 0 ? 'border-emerald-500 text-emerald-600 bg-emerald-50' : 'border-slate-200 text-slate-600'}`}
                                />
                            </div>
                        </div>
                      </div>
                  </div>
              )}

              {/* STEP 2: BIOMETRICS */}
              {step === 2 && (
                  <div className="space-y-6 animate-in slide-in-from-right duration-300">
                      <div className="flex p-1 bg-slate-100 rounded-xl">
                        {['Male', 'Female', 'Other'].map(g => (
                          <button
                            key={g}
                            type="button"
                            onClick={() => setNewGender(g)}
                            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
                              newGender === g ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'
                            }`}
                          >
                            {g}
                          </button>
                        ))}
                      </div>

                      <div className="flex gap-4">
                        <div className="flex-1">
                          <label className="block text-xs font-bold text-slate-500 mb-1 flex items-center">
                            <Ruler size={12} className="mr-1"/> Height (cm)
                          </label>
                          <input 
                            type="number" 
                            className="w-full p-3 bg-white border border-slate-200 rounded-xl text-center font-bold outline-none focus:border-emerald-500"
                            placeholder="175"
                            value={newHeight}
                            onChange={e => setNewHeight(e.target.value)}
                          />
                        </div>
                        <div className="flex-1">
                          <label className="block text-xs font-bold text-slate-500 mb-1 flex items-center">
                            <Scale size={12} className="mr-1"/> Weight (kg)
                          </label>
                          <input 
                            type="number" 
                            className="w-full p-3 bg-white border border-slate-200 rounded-xl text-center font-bold outline-none focus:border-emerald-500"
                            placeholder="70"
                            value={newWeight}
                            onChange={e => setNewWeight(e.target.value)}
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-2 flex items-center">
                            <User size={12} className="mr-1"/> Body Type
                        </label>
                        <div className="grid grid-cols-1 gap-2">
                           {['Ectomorph', 'Mesomorph', 'Endomorph'].map(type => (
                             <button
                               key={type}
                               type="button"
                               onClick={() => setNewBodyType(type)}
                               className={`p-3 rounded-xl border text-left transition-all ${
                                 newBodyType === type 
                                 ? 'bg-emerald-50 border-emerald-500 ring-1 ring-emerald-500 text-emerald-900 font-bold' 
                                 : 'bg-white border-slate-200 text-slate-600'
                               }`}
                             >
                                {type}
                             </button>
                           ))}
                        </div>
                      </div>
                  </div>
              )}

              {/* STEP 3: LIFESTYLE */}
              {step === 3 && (
                  <div className="space-y-6 animate-in slide-in-from-right duration-300">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-2 flex items-center">
                           <Calendar size={12} className="mr-1"/> Training Days / Week
                        </label>
                        <div className="flex gap-2 overflow-x-auto pb-2">
                           {[1,2,3,4,5,6,7].map(d => (
                             <button
                               key={d}
                               type="button"
                               onClick={() => setNewDays(d.toString())}
                               className={`w-10 h-10 rounded-lg flex-shrink-0 border text-sm font-bold transition-all ${
                                 newDays === d.toString() ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600 border-slate-200'
                               }`}
                             >
                               {d}
                             </button>
                           ))}
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-2 flex items-center">
                           <Activity size={12} className="mr-1"/> Daily Activity
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                           {['Sedentary', 'Moderate', 'Active'].map(a => (
                             <button
                               key={a}
                               type="button"
                               onClick={() => setNewActivity(a)}
                               className={`py-3 px-1 rounded-xl border text-xs font-bold transition-all ${
                                 newActivity === a ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600 border-slate-200'
                               }`}
                             >
                               {a}
                             </button>
                           ))}
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-2 flex items-center">
                           <Moon size={12} className="mr-1"/> Sleep
                        </label>
                        <div className="flex p-1 bg-slate-100 rounded-xl">
                          {['< 6h', '6-8h', '8h+'].map(s => (
                            <button
                              key={s}
                              type="button"
                              onClick={() => setNewSleep(s)}
                              className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
                                newSleep === s ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'
                              }`}
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-2 flex items-center">
                           <Utensils size={12} className="mr-1"/> Diet Type
                        </label>
                        <select 
                           value={newDiet}
                           onChange={(e) => setNewDiet(e.target.value)}
                           className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-emerald-500"
                        >
                            {['Standard', 'Vegetarian', 'Vegan', 'Keto', 'Paleo', 'Intermittent Fasting'].map(d => (
                                <option key={d} value={d}>{d}</option>
                            ))}
                        </select>
                      </div>
                  </div>
              )}

              <div className="pt-4 flex gap-3">
                  {step > 1 && (
                      <button 
                        type="button"
                        onClick={() => setStep(step - 1)}
                        className="px-6 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold text-lg"
                      >
                        Back
                      </button>
                  )}
                  <button 
                    type="submit"
                    className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-bold text-lg shadow-lg shadow-emerald-200"
                  >
                    {step === 3 ? 'Create Client' : 'Next'}
                  </button>
              </div>
           </form>
        </div>
      )}
    </div>
  );
};

export default Clients;