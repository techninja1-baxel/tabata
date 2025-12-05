import React from 'react';
import { Construction } from 'lucide-react';

const FutureFeatures: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-6">
      <div className="p-6 bg-indigo-50 rounded-full text-indigo-600">
        <Construction size={64} />
      </div>
      <div>
        <h2 className="text-3xl font-bold text-slate-800">Tabata Labs</h2>
        <p className="text-slate-500 mt-2 max-w-md mx-auto">
          We are constantly building. Here are some features coming soon to your dashboard.
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8 w-full max-w-2xl text-left">
         {[
           "Wearable Device Integration (Apple Health/Fitbit)",
           "Video Analysis for Movement Correction"
         ].map((feature, i) => (
           <div key={i} className="p-4 border border-slate-200 rounded-lg bg-white shadow-sm opacity-70">
              <span className="font-medium text-slate-700">{feature}</span>
              <span className="block text-xs text-indigo-500 mt-1 font-bold uppercase">Coming Soon</span>
           </div>
         ))}
      </div>
    </div>
  );
};

export default FutureFeatures;