import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Client } from '../types';
import { 
  Users, 
  AlertCircle, 
  TrendingUp, 
  CalendarCheck,
  ChevronRight
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';

interface DashboardProps {
  clients: Client[];
}

const Dashboard: React.FC<DashboardProps> = ({ clients }) => {
  const navigate = useNavigate();
  const activeClients = clients.length;
  const criticalClients = clients.filter(c => (c.sessionsTotal - c.sessionsUsed) <= 1);
  const totalSessionsCompleted = clients.reduce((acc, c) => acc + c.sessionsUsed, 0);
  
  const sessionDistribution = [
    { name: 'Strength', value: 45 },
    { name: 'Cardio', value: 25 },
    { name: 'Rehab', value: 20 },
    { name: 'Mobility', value: 10 },
  ];

  const COLORS = ['#059669', '#3b82f6', '#f59e0b', '#8b5cf6'];

  return (
    <div className="space-y-6">
      {/* Date Header */}
      <div>
        <p className="text-sm font-medium text-slate-400 uppercase tracking-wider">
            {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
        <h2 className="text-2xl font-bold text-slate-800">Hello, Coach 👋</h2>
      </div>

      {/* Critical Alerts - Prominent Card */}
      {criticalClients.length > 0 && (
          <div className="bg-red-50 border border-red-100 rounded-2xl p-4 shadow-sm animate-in slide-in-from-top-4 duration-500">
             <div className="flex items-center mb-3">
                 <AlertCircle className="text-red-500 mr-2" size={20}/>
                 <h3 className="font-bold text-red-800">Renewals Needed</h3>
             </div>
             <div className="space-y-2">
                 {criticalClients.slice(0, 3).map(client => (
                     <div key={client.id} className="flex justify-between items-center bg-white p-3 rounded-xl border border-red-100 shadow-sm">
                         <span className="font-medium text-slate-700">{client.name}</span>
                         <button 
                            onClick={() => navigate(`/clients/${client.id}`)}
                            className="text-xs font-bold bg-red-100 text-red-600 px-3 py-1.5 rounded-full"
                         >
                            Renew
                         </button>
                     </div>
                 ))}
                 {criticalClients.length > 3 && (
                     <p className="text-center text-xs text-red-500 font-medium mt-2">
                         + {criticalClients.length - 3} more
                     </p>
                 )}
             </div>
          </div>
      )}

      {/* Quick Stats Row */}
      <div className="grid grid-cols-2 gap-3">
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between h-24">
              <div className="flex justify-between items-start">
                  <span className="text-slate-400 text-xs font-bold uppercase">Active Clients</span>
                  <Users size={16} className="text-blue-500" />
              </div>
              <p className="text-2xl font-bold text-slate-800">{activeClients}</p>
          </div>
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between h-24">
              <div className="flex justify-between items-start">
                  <span className="text-slate-400 text-xs font-bold uppercase">Sessions Done</span>
                  <CalendarCheck size={16} className="text-purple-500" />
              </div>
              <p className="text-2xl font-bold text-slate-800">{totalSessionsCompleted}</p>
          </div>
      </div>

      {/* Focus Chart - Collapsible or Compact */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-800 flex items-center">
                  <TrendingUp size={18} className="mr-2 text-emerald-500"/> Focus Breakdown
              </h3>
          </div>
          <div className="h-40 w-full flex items-center">
            <div className="h-full w-1/2">
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <PieChart>
                    <Pie
                    data={sessionDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={30}
                    outerRadius={50}
                    paddingAngle={5}
                    dataKey="value"
                    >
                    {sessionDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                    </Pie>
                </PieChart>
                </ResponsiveContainer>
            </div>
            <div className="w-1/2 text-xs space-y-2">
                {sessionDistribution.map((entry, index) => (
                <div key={entry.name} className="flex items-center justify-between text-slate-600">
                    <div className="flex items-center">
                        <div className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: COLORS[index] }}></div>
                        {entry.name}
                    </div>
                    <span className="font-bold">{entry.value}%</span>
                </div>
                ))}
            </div>
          </div>
      </div>

      {/* Quick Links */}
      <div className="space-y-2">
          <button 
            onClick={() => navigate('/clients')}
            className="w-full bg-emerald-600 text-white p-4 rounded-2xl shadow-lg shadow-emerald-200 flex justify-between items-center font-medium active:scale-[0.98] transition-all"
          >
              <span>Manage Clients</span>
              <ChevronRight size={20} />
          </button>
          <button 
            onClick={() => navigate('/schedule')}
            className="w-full bg-white text-slate-700 border border-slate-200 p-4 rounded-2xl shadow-sm flex justify-between items-center font-medium active:scale-[0.98] transition-all"
          >
              <span>View Schedule</span>
              <ChevronRight size={20} />
          </button>
      </div>
    </div>
  );
};

export default Dashboard;