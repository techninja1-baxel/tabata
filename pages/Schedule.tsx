import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Client, SessionStatus, ScheduledSession, WorkoutExercise } from '../types';
import { 
  Plus, 
  X, 
  Calendar, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  ChevronRight,
  User,
  MapPin,
  Dumbbell,
  UserPlus
} from 'lucide-react';

interface ScheduleProps {
  clients: Client[];
  onUpdateClient: (client: Client) => void;
}

const Schedule: React.FC<ScheduleProps> = ({ clients, onUpdateClient }) => {
  const navigate = useNavigate();
  
  // Helper function to get rounded time (next 30-minute interval)
  const getRoundedTime = () => {
    const now = new Date();
    const minutes = now.getMinutes();
    const roundedMinutes = minutes < 30 ? 30 : 60;
    
    if (roundedMinutes === 60) {
      now.setHours(now.getHours() + 1);
      now.setMinutes(0);
    } else {
      now.setMinutes(30);
    }
    
    const hours = now.getHours().toString().padStart(2, '0');
    const mins = now.getMinutes().toString().padStart(2, '0');
    return `${hours}:${mins}`;
  };
  
  // UI State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ session: any; status: SessionStatus } | null>(null);
  const [validationError, setValidationError] = useState('');
  
  // Form State
  const [selectedClientId, setSelectedClientId] = useState('');
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);
  const [newTime, setNewTime] = useState(getRoundedTime());
  const [customTitle, setCustomTitle] = useState('');
  
  // Logic to get sorted upcoming sessions
  const futureSessions = clients.flatMap(client => 
    (client.schedule || []).map(s => ({ ...s, clientName: client.name, clientId: client.id }))
  )
  .filter(s => new Date(s.datetime) > new Date() && s.status !== 'cancelled')
  .sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());

  const confirmStatusChange = (session: any, status: SessionStatus) => {
      setConfirmAction({ session, status });
  };

  const handleStatusChange = (session: any, status: SessionStatus) => {
      const client = clients.find(c => c.id === session.clientId);
      if(!client) return;

      if (status === 'completed') {
          // Move to history logic (simplified duplicate of original logic for mobile speed)
          const historyEntry = {
              id: crypto.randomUUID(),
              date: new Date().toISOString(),
              status: 'completed' as SessionStatus,
              notes: session.title || 'Completed Session'
          };
          const updated = {
              ...client,
              sessionsUsed: client.sessionsUsed + 1,
              history: [historyEntry, ...client.history],
              schedule: client.schedule.filter(s => s.id !== session.id)
          };
          onUpdateClient(updated);
      } else if (status === 'cancelled') {
          const updated = {
              ...client,
              schedule: client.schedule.map(s => s.id === session.id ? { ...s, status: 'cancelled' as SessionStatus } : s)
          };
          onUpdateClient(updated);
      }
  };

  const handleAddSession = (e: React.FormEvent) => {
      e.preventDefault();
      setValidationError('');
      
      if (!selectedClientId) return;
      
      // Validate that the selected datetime is not in the past
      const selectedDateTime = new Date(`${newDate}T${newTime}`);
      const now = new Date();
      
      if (selectedDateTime <= now) {
        setValidationError('Cannot schedule a session in the past. Please select a future date and time.');
        return;
      }
      
      const client = clients.find(c => c.id === selectedClientId);
      if(!client) return;

      const newSession: ScheduledSession = {
          id: crypto.randomUUID(),
          clientId: selectedClientId,
          datetime: `${newDate}T${newTime}`,
          status: 'scheduled',
          title: customTitle || 'Training Session',
          exercises: []
      };

      onUpdateClient({
          ...client,
          schedule: [...client.schedule, newSession]
      });

      setIsAddModalOpen(false);
      setSelectedClientId('');
      setCustomTitle('');
      setNewDate(new Date().toISOString().split('T')[0]);
      setNewTime(getRoundedTime());
      setValidationError('');
  };

  // Grouping sessions by date
  const groupedSessions: {[key: string]: any[]} = {};
  futureSessions.forEach(session => {
      const dateKey = new Date(session.datetime).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
      if(!groupedSessions[dateKey]) groupedSessions[dateKey] = [];
      groupedSessions[dateKey].push(session);
  });

  return (
    <div className="min-h-[80vh] relative">
      <div className="space-y-6 pb-24">
        {Object.keys(groupedSessions).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                <Calendar size={48} className="mb-4 opacity-50"/>
                <p>No upcoming sessions.</p>
                <button onClick={() => setIsAddModalOpen(true)} className="mt-4 text-emerald-600 font-bold">Schedule One</button>
            </div>
        ) : (
            Object.keys(groupedSessions).map(dateKey => (
                <div key={dateKey}>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 sticky top-0 bg-slate-50 py-2 z-10">
                        {dateKey}
                    </h3>
                    <div className="space-y-3">
                        {groupedSessions[dateKey].map((session) => (
                            <div key={session.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden">
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex items-center">
                                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mr-3 font-bold text-slate-600">
                                            {session.clientName[0]}
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-slate-800">{session.clientName}</h4>
                                            <div className="flex items-center text-xs text-slate-500 mt-0.5">
                                                <Clock size={12} className="mr-1"/>
                                                {new Date(session.datetime).toLocaleTimeString(undefined, {hour: '2-digit', minute:'2-digit'})}
                                            </div>
                                        </div>
                                    </div>
                                    {session.planId && (
                                        <div className="bg-emerald-50 text-emerald-600 p-1.5 rounded-lg">
                                            <Dumbbell size={16} />
                                        </div>
                                    )}
                                </div>
                                
                                {session.title && (
                                    <div className="mb-4 bg-slate-50 p-2 rounded-lg text-sm text-slate-600 font-medium">
                                        {session.title}
                                    </div>
                                )}

                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => confirmStatusChange(session, 'cancelled')}
                                        className="flex-1 py-2 rounded-xl border border-slate-200 text-slate-500 font-bold text-sm"
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        onClick={() => confirmStatusChange(session, 'completed')}
                                        className="flex-[2] py-2 rounded-xl bg-slate-900 text-white font-bold text-sm hover:bg-emerald-600 transition-colors"
                                    >
                                        Complete
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))
        )}
      </div>

      {/* FAB */}
      <button 
        onClick={() => setIsAddModalOpen(true)}
        className="fixed bottom-24 right-6 w-14 h-14 bg-emerald-600 text-white rounded-full shadow-xl shadow-emerald-200 flex items-center justify-center hover:bg-emerald-700 active:scale-95 transition-all z-20"
      >
        <Plus size={28} />
      </button>

      {/* Add Session Modal */}
      {isAddModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-50 flex flex-col animate-in slide-in-from-bottom duration-300">
             <div className="bg-white px-4 py-4 flex justify-between items-center border-b border-slate-100">
                 <h3 className="text-lg font-bold">New Session</h3>
                 <button onClick={() => setIsAddModalOpen(false)} className="p-2 bg-slate-100 rounded-full">
                     <X size={20} />
                 </button>
             </div>

             {/* Dynamic Content based on Clients existence */}
             {clients.length === 0 ? (
                 <div className="flex-1 p-6 flex flex-col items-center justify-center text-center">
                    <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-6">
                        <UserPlus size={40} className="text-slate-400" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 mb-2">No Clients Yet</h3>
                    <p className="text-slate-500 mb-8 max-w-xs">
                        You need to add a client before you can schedule a session.
                    </p>
                    <button 
                        onClick={() => navigate('/clients')}
                        className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold text-lg shadow-lg shadow-emerald-200"
                    >
                        Go to Clients
                    </button>
                 </div>
             ) : (
                <form onSubmit={handleAddSession} className="flex-1 p-6 space-y-6">
                    {validationError && (
                      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm font-medium">
                        {validationError}
                      </div>
                    )}
                    
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Select Client</label>
                        <div className="grid grid-cols-2 gap-2">
                            {clients.map(c => (
                                <button
                                    key={c.id}
                                    type="button"
                                    onClick={() => setSelectedClientId(c.id)}
                                    className={`p-3 rounded-xl border text-left text-sm font-medium transition-all ${selectedClientId === c.id ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-white border-slate-200 text-slate-600'}`}
                                >
                                    {c.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">Date</label>
                            <input 
                                type="date"
                                className="w-full p-3 bg-white border border-slate-200 rounded-xl"
                                value={newDate}
                                onChange={(e) => setNewDate(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">Time</label>
                            <input 
                                type="time"
                                className="w-full p-3 bg-white border border-slate-200 rounded-xl"
                                value={newTime}
                                onChange={(e) => setNewTime(e.target.value)}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Label / Focus</label>
                        <input 
                            type="text"
                            placeholder="e.g. Leg Day"
                            className="w-full p-4 bg-white border border-slate-200 rounded-xl text-lg outline-none focus:ring-2 focus:ring-emerald-500"
                            value={customTitle}
                            onChange={(e) => setCustomTitle(e.target.value)}
                        />
                    </div>

                    <div className="pt-8">
                        <button 
                            type="submit"
                            disabled={!selectedClientId}
                            className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold text-lg shadow-lg shadow-emerald-200 disabled:opacity-50"
                        >
                            Confirm Booking
                        </button>
                    </div>
                </form>
             )}
          </div>
      )}

      {/* Confirmation Dialog */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl p-6 max-w-sm mx-4 shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="flex items-center justify-center mb-4">
              {confirmAction.status === 'completed' ? (
                <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
                  <CheckCircle2 size={32} className="text-emerald-600" />
                </div>
              ) : (
                <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
                  <XCircle size={32} className="text-red-600" />
                </div>
              )}
            </div>
            
            <h3 className="text-xl font-bold text-slate-900 mb-2 text-center">
              {confirmAction.status === 'completed' ? 'Mark as Done?' : 'Cancel Session?'}
            </h3>
            
            <p className="text-slate-600 text-center mb-6">
              {confirmAction.status === 'completed' 
                ? 'This will mark the session as completed and move it to history.'
                : 'This session will be marked as cancelled and archived.'}
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setConfirmAction(null)}
                className="flex-1 py-3 px-4 rounded-xl border border-slate-200 text-slate-700 font-medium hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  handleStatusChange(confirmAction.session, confirmAction.status);
                  setConfirmAction(null);
                }}
                className={`flex-1 py-3 px-4 rounded-xl font-medium text-white transition-colors ${
                  confirmAction.status === 'completed'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Schedule;