import React from 'react';
import { Mail, HelpCircle } from 'lucide-react';

const Help: React.FC = () => {
  const supportEmail = "techninja1.baxel@protonmail.com";

  return (
    <div className="max-w-2xl mx-auto space-y-8 h-[60vh] flex flex-col justify-center">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-slate-800">Help & Support</h2>
        <p className="text-slate-500 mt-2">Need assistance? We're here to help.</p>
      </div>

      <div className="bg-white p-8 rounded-xl shadow-lg border border-slate-100 text-center">
         <div className="flex justify-center mb-6">
            <div className="p-4 bg-emerald-50 text-emerald-600 rounded-full">
              <HelpCircle size={48} />
            </div>
         </div>
         
         <h3 className="text-xl font-bold text-slate-800 mb-2">Contact Support</h3>
         <p className="text-slate-500 mb-6">
           For bug reports, feature requests, or general inquiries, please reach out to our team directly.
         </p>

         <a 
           href={`mailto:${supportEmail}?subject=Tabata Support`}
           className="inline-flex items-center px-6 py-3 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors font-medium"
         >
           <Mail size={18} className="mr-2" />
           {supportEmail}
         </a>
      </div>
    </div>
  );
};

export default Help;