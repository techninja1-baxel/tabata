import React, { useState } from 'react';
import { UserProfile } from '../types';
import { validatePromoCode } from '../services/storageService';
import { ShieldCheck, Tag, CreditCard } from 'lucide-react';

interface SubscriptionProps {
  user: UserProfile;
  onUpdateUser: (user: UserProfile) => void;
}

const Subscription: React.FC<SubscriptionProps> = ({ user, onUpdateUser }) => {
  const [promoCode, setPromoCode] = useState('');
  const [message, setMessage] = useState('');
  const [isValidating, setIsValidating] = useState(false);

  const handleApplyCode = async () => {
    if (!promoCode) return;
    setIsValidating(true);
    setMessage('');
    
    const isValid = await validatePromoCode(promoCode);
    setIsValidating(false);

    if (isValid) {
      onUpdateUser({ ...user, isSubscribed: true, promoCode });
      setMessage('Success! Subscription activated via promo code.');
    } else {
      setMessage('Invalid promo code.');
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-slate-800">Subscription</h2>
        <p className="text-slate-500 mt-2">Manage your pro access and billing</p>
      </div>

      <div className="bg-white rounded-xl shadow-lg border border-emerald-100 overflow-hidden">
        <div className="bg-slate-900 p-6 text-white text-center">
           <p className="text-sm font-medium opacity-80 uppercase tracking-wide">Current Status</p>
           <div className="mt-2 flex justify-center items-center">
             {user.isSubscribed ? (
               <div className="flex items-center text-emerald-500 text-2xl font-bold">
                 <ShieldCheck className="mr-2" size={32} />
                 PRO MEMBER
               </div>
             ) : (
               <div className="text-2xl font-bold text-slate-200">Free Tier</div>
             )}
           </div>
        </div>
        
        <div className="p-8">
          {user.isSubscribed ? (
            <div className="text-center space-y-4">
               <p className="text-slate-600">You have full access to all features.</p>
               {user.promoCode && (
                 <p className="text-sm text-slate-400">Active Code: <span className="font-mono font-bold">{user.promoCode}</span></p>
               )}
            </div>
          ) : (
            <div className="space-y-6">
               <div className="flex items-center justify-between p-4 border border-slate-200 rounded-lg">
                  <div className="flex items-center">
                    <CreditCard className="text-slate-400 mr-3"/>
                    <div>
                        <p className="font-bold text-slate-800">Monthly Plan</p>
                        <p className="text-xs text-slate-500">$29/month</p>
                    </div>
                  </div>
                  <button className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm">Select</button>
               </div>

               <div className="relative">
                 <div className="absolute inset-0 flex items-center">
                   <div className="w-full border-t border-slate-200"></div>
                 </div>
                 <div className="relative flex justify-center text-sm">
                   <span className="px-2 bg-white text-slate-500">Or use a code</span>
                 </div>
               </div>

               <div className="flex gap-2">
                 <div className="relative flex-1">
                   <Tag className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                   <input 
                      type="text" 
                      placeholder="Enter Promo Code" 
                      className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg uppercase"
                      value={promoCode}
                      onChange={(e) => setPromoCode(e.target.value)}
                   />
                 </div>
                 <button 
                   onClick={handleApplyCode}
                   disabled={isValidating || !promoCode}
                   className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                 >
                   {isValidating ? '...' : 'Apply'}
                 </button>
               </div>
               {message && (
                 <p className={`text-center text-sm ${message.includes('Success') ? 'text-green-600' : 'text-red-500'}`}>
                   {message}
                 </p>
               )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Subscription;