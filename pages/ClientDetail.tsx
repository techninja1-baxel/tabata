import React, { useState, useRef, useEffect } from 'react';
import { Client, PlanFocus, TrainingPlan, ClientSession, PlanSession } from '../types';
import { generateTrainingPlan } from '../services/geminiService';
import { 
  ArrowLeft, 
  Phone,
  MessageCircle,
  FileText,
  Dumbbell,
  History,
  Share2,
  Wand2,
  X,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Check,
  AlertTriangle,
  RefreshCw,
  Pencil,
  Ruler,
  Scale,
  User,
  Activity,
  Moon,
  Utensils,
  Calendar,
  Lightbulb,
  BrainCircuit,
  HeartPulse
} from 'lucide-react';

interface ClientDetailProps {
  client: Client;
  onUpdateClient: (updatedClient: Client) => void;
  onBack: () => void;
}

// Trivia Data for Loading Screen
const FITNESS_TRIVIA = [
    { icon: BrainCircuit, title: "Neural Drive", text: "Strength gains in the first 4-6 weeks are mostly neurological adaptations, not muscle growth." },
    { icon: HeartPulse, title: "EPOC Effect", text: "HIIT can increase your metabolism for hours after exercise due to Excess Post-exercise Oxygen Consumption." },
    { icon: Moon, title: "Sleep & HGH", text: "The majority of Human Growth Hormone (HGH) is released during slow-wave sleep." },
    { icon: Scale, title: "Muscle Density", text: "Muscle tissue is roughly 18% denser than fat tissue, which is why the scale doesn't tell the whole story." },
    { icon: Dumbbell, title: "Eccentric Loading", text: "Muscles are approximately 20-30% stronger during the eccentric (lowering) phase of a lift." },
    { icon: Utensils, title: "Protein Timing", text: "Total daily protein intake matters more for hypertrophy than the immediate 'anabolic window' post-workout." },
    { icon: Activity, title: "NEAT", text: "Non-Exercise Activity Thermogenesis (fidgeting, walking) can account for up to 15-30% of total energy expenditure." },
];

const ClientDetail: React.FC<ClientDetailProps> = ({ client, onUpdateClient, onBack }) => {
  const [activeTab, setActiveTab] = useState<'plans' | 'history' | 'notes'>('plans');
  const [newNote, setNewNote] = useState('');
  
  // Wizard State
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false); // New state for custom confirm dialog
  const [triviaIndex, setTriviaIndex] = useState(0);
  
  // Ref to track the current generation request ID for cancellation
  const generationIdRef = useRef(0);
  
  // Edit Profile State
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Client>>({});

  // Replacement State
  const [showReplaceUI, setShowReplaceUI] = useState(false);
  const [planToReplace, setPlanToReplace] = useState<string | null>(null);
  
  // Generation Inputs
  const [genFocus, setGenFocus] = useState<string[]>([]);
  const [genDuration, setGenDuration] = useState('4 Weeks');
  const [genContext, setGenContext] = useState('');

  // UI State for Plans
  const [expandedPlanId, setExpandedPlanId] = useState<string | null>(null);
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);

  // Trivia Rotation Effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isGenerating && !showCancelConfirm) {
        interval = setInterval(() => {
            setTriviaIndex(prev => (prev + 1) % FITNESS_TRIVIA.length);
        }, 5000); // Change fact every 5 seconds
    }
    return () => clearInterval(interval);
  }, [isGenerating, showCancelConfirm]);

  // --- Actions ---

  const handleAddNote = () => {
      if(!newNote.trim()) return;
      const updated = {
          ...client,
          progressNotes: [{
              id: crypto.randomUUID(),
              date: new Date().toISOString(),
              content: newNote
          }, ...(client.progressNotes || [])]
      };
      console.log('📝 Adding note. Total notes after:', updated.progressNotes.length);
      console.log('Note content:', newNote);
      onUpdateClient(updated);
      setNewNote('');
  };

  const initiatePlanGeneration = () => {
    if (genFocus.length === 0) return;

    // Check Limit
    if (client.plans.length >= 2) {
      setShowReplaceUI(true);
      return;
    }

    executeGeneration();
  };

  const executeGeneration = async (replaceId?: string) => {
    setIsGenerating(true);
    setShowCancelConfirm(false);
    setShowReplaceUI(false); 
    setTriviaIndex(0); // Reset trivia
    
    // Increment Generation ID. 
    // This marks the start of a "new" valid request.
    const thisRunId = generationIdRef.current + 1;
    generationIdRef.current = thisRunId;
    
    // Auto-inject stored client details
    const bioContext = `
      Client Profile: ${client.gender || 'Not specified'}, Height: ${client.height || '?'}cm, Weight: ${client.weight || '?'}kg.
      Body Type: ${client.bodyType || 'Not specified'}.
      Lifestyle: ${client.activityLevel || 'Moderate'} Activity, Sleeps ${client.sleepDuration || '?'}h.
      Diet: ${client.dietType || 'Standard'}.
      Preferred Training Frequency: ${client.trainingDays || '3'} days per week.
    `;

    const fullContext = `
      Duration: ${genDuration}.
      ${bioContext}
      Specific Request: ${genContext}. 
      Client Medical/History: ${client.notes}
    `;

    try {
      // Create a timeout promise that rejects after 3 minutes (180,000 ms)
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error("TIMEOUT")), 180000)
      );

      // Race the generation against the timeout
      const sessions = await Promise.race([
        generateTrainingPlan(genFocus, genDuration, client.name, fullContext),
        timeoutPromise
      ]);
      
      // CRITICAL CHECK: 
      // If the generationIdRef has changed (because user closed the modal or started a new one),
      // we discard this result.
      if (generationIdRef.current !== thisRunId) {
        console.log('Generation cancelled or superseded. Discarding result.');
        return;
      }
      
      const newPlan: TrainingPlan = {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        title: `${genDuration} ${genFocus[0]} Plan`,
        focus: genFocus,
        duration: genDuration,
        sessions: sessions
      };

      let updatedPlans;
      if (replaceId) {
        updatedPlans = client.plans.map(p => p.id === replaceId ? newPlan : p);
      } else {
        updatedPlans = [newPlan, ...client.plans];
      }

      onUpdateClient({ ...client, plans: updatedPlans });
      
      setIsWizardOpen(false);
      setPlanToReplace(null);
      setExpandedPlanId(newPlan.id); 
      setWizardStep(1);
      setGenFocus([]);
      setGenContext('');
    } catch (error: any) {
      // Ignore errors if we cancelled
      if (generationIdRef.current !== thisRunId) return;

      if (error.message === 'TIMEOUT') {
        alert("The plan generation timed out (3 mins). Please try again with fewer requirements or a shorter duration.");
      } else {
        console.error(error);
        alert("AI Generation failed. Please try again.");
      }
    } finally {
      // Only turn off spinner if we are still the active run
      if (generationIdRef.current === thisRunId) {
        setIsGenerating(false);
      }
    }
  };

  const handleSharePlan = (plan: TrainingPlan) => {
    const text = `🏋️ *${plan.title} for ${client.name}*\n` +
                 `🎯 Focus: ${plan.focus.join(', ')}\n\n` +
                 plan.sessions.map(s => 
                   `*${s.dayLabel}: ${s.targetFocus}*\n` +
                   s.exercises.map(e => `• ${e.name} (${e.sets} x ${e.reps}) ${e.remarks ? `- ${e.remarks}` : ''}`).join('\n')
                 ).join('\n\n') + 
                 `\nCreated with Tabata Pro`;
    
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const whatsappLink = `https://wa.me/${client.phone.replace(/[^0-9]/g, '')}`;

  const openEditProfile = () => {
    setEditForm({
      gender: client.gender || 'Male',
      height: client.height || '',
      weight: client.weight || '',
      bodyType: client.bodyType || 'Mesomorph',
      activityLevel: client.activityLevel || 'Moderate',
      sleepDuration: client.sleepDuration || '6-8h',
      dietType: client.dietType || 'Standard',
      trainingDays: client.trainingDays || '3'
    });
    setIsEditProfileOpen(true);
  };

  const saveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateClient({ ...client, ...editForm });
    setIsEditProfileOpen(false);
  };

  // Called when user actively clicks "Cancel Generation"
  const handleRequestCancel = () => {
    setShowCancelConfirm(true);
  };

  // Confirmed Cancellation
  const handleConfirmCancel = () => {
    setShowCancelConfirm(false);
    setIsGenerating(false);
    generationIdRef.current += 1; 
  };

  // Called when closing the wizard entirely
  const handleCloseWizard = () => {
     setIsWizardOpen(false);
     setShowReplaceUI(false);
     setPlanToReplace(null);
     setShowCancelConfirm(false);
     
     // Also cancel any running process
     setIsGenerating(false);
     generationIdRef.current += 1; 
  };

  // --- UI Components ---

  const renderEditProfileModal = () => {
    if (!isEditProfileOpen) return null;
    return (
      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex justify-center items-end sm:items-center animate-in fade-in">
         <div className="bg-white w-full max-w-lg rounded-t-2xl sm:rounded-2xl p-6 h-[80vh] flex flex-col animate-in slide-in-from-bottom duration-300">
            <div className="flex justify-between items-center mb-6">
               <h3 className="font-bold text-xl">Edit Profile</h3>
               <button onClick={() => setIsEditProfileOpen(false)} className="p-2 bg-slate-100 rounded-full"><X size={20}/></button>
            </div>
            <form onSubmit={saveProfile} className="flex-1 overflow-y-auto space-y-6">
                 {/* Biometrics */}
                 <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Biometrics</h4>
                    <div className="flex p-1 bg-slate-100 rounded-xl mb-4">
                      {['Male', 'Female', 'Other'].map(g => (
                        <button
                          key={g}
                          type="button"
                          onClick={() => setEditForm({...editForm, gender: g})}
                          className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${editForm.gender === g ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}
                        >
                          {g}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-4 mb-4">
                        <div className="flex-1">
                          <label className="text-xs font-bold text-slate-500 mb-1 block">Height (cm)</label>
                          <input type="number" value={editForm.height} onChange={e=>setEditForm({...editForm, height: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-center font-bold outline-none focus:border-emerald-500" />
                        </div>
                        <div className="flex-1">
                          <label className="text-xs font-bold text-slate-500 mb-1 block">Weight (kg)</label>
                          <input type="number" value={editForm.weight} onChange={e=>setEditForm({...editForm, weight: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-center font-bold outline-none focus:border-emerald-500" />
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                        {['Ectomorph', 'Mesomorph', 'Endomorph'].map(t => (
                           <button key={t} type="button" onClick={() => setEditForm({...editForm, bodyType: t})} className={`p-2 rounded-lg border text-xs font-bold ${editForm.bodyType === t ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-white border-slate-200'}`}>{t}</button>
                        ))}
                    </div>
                 </div>

                 {/* Lifestyle */}
                 <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Lifestyle</h4>
                    <div className="mb-4">
                       <label className="text-xs font-bold text-slate-500 mb-2 block">Days Per Week</label>
                       <div className="flex gap-2 overflow-x-auto pb-1">
                           {[1,2,3,4,5,6,7].map(d => (
                              <button key={d} type="button" onClick={() => setEditForm({...editForm, trainingDays: d.toString()})} className={`w-10 h-10 rounded-lg flex-shrink-0 border text-sm font-bold ${editForm.trainingDays === d.toString() ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600'}`}>{d}</button>
                           ))}
                       </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mb-4">
                        {['Sedentary', 'Moderate', 'Active'].map(a => (
                           <button key={a} type="button" onClick={() => setEditForm({...editForm, activityLevel: a})} className={`p-2 rounded-lg border text-xs font-bold ${editForm.activityLevel === a ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-white border-slate-200'}`}>{a}</button>
                        ))}
                    </div>
                    <div className="flex p-1 bg-slate-100 rounded-xl mb-4">
                          {['< 6h', '6-8h', '8h+'].map(s => (
                            <button key={s} type="button" onClick={() => setEditForm({...editForm, sleepDuration: s})} className={`flex-1 py-2 text-sm font-bold rounded-lg ${editForm.sleepDuration === s ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}>{s}</button>
                          ))}
                    </div>
                    <select value={editForm.dietType} onChange={e=>setEditForm({...editForm, dietType: e.target.value})} className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-sm">
                        {['Standard', 'Vegetarian', 'Vegan', 'Keto', 'Paleo', 'Intermittent Fasting'].map(d=><option key={d} value={d}>{d}</option>)}
                    </select>
                 </div>

                 <button type="submit" className="w-full py-4 bg-emerald-600 text-white rounded-xl font-bold text-lg shadow-lg">Save Changes</button>
            </form>
         </div>
      </div>
    )
  }

  const renderWizard = () => {
    if (!isWizardOpen) return null;

    const categories = {
        'Performance & Fitness': [
            PlanFocus.STRENGTH,
            PlanFocus.ENDURANCE,
            PlanFocus.HIIT,
            PlanFocus.WEIGHT_LOSS,
            PlanFocus.MOBILITY
        ],
        'Rehabilitation & Recovery': [
            PlanFocus.REHAB_LBP,
            PlanFocus.REHAB_SHOULDER,
            PlanFocus.REHAB_KNEE,
            PlanFocus.REHAB_HIP,
            PlanFocus.REHAB_ANKLE,
            PlanFocus.REHAB_ELBOW,
            PlanFocus.REHAB_NECK,
            PlanFocus.REHAB_POSTURE,
            PlanFocus.REHAB_CORE
        ]
    };
    
    // Helper to render current Trivia Card
    const TriviaCard = () => {
        const item = FITNESS_TRIVIA[triviaIndex];
        const Icon = item.icon;
        return (
            <div className="animate-in fade-in slide-in-from-right duration-500" key={triviaIndex}>
                <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 mt-6 text-left relative overflow-hidden h-44 flex flex-col">
                    <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                        <Icon size={80} />
                    </div>
                    <div className="flex items-center text-indigo-700 mb-2 z-10">
                        <Lightbulb size={16} className="mr-2 fill-indigo-200" />
                        <span className="text-xs font-bold uppercase tracking-wider">Did you know?</span>
                    </div>
                    <div className="z-10 flex-1 flex flex-col justify-center">
                        <h4 className="font-bold text-slate-800 mb-1">{item.title}</h4>
                        <p className="text-sm text-slate-600 leading-relaxed line-clamp-4">{item.text}</p>
                    </div>
                </div>
                <div className="flex justify-center gap-1 mt-3">
                    {FITNESS_TRIVIA.map((_, i) => (
                        <div key={i} className={`h-1 rounded-full transition-all duration-300 ${i === triviaIndex ? 'w-6 bg-emerald-500' : 'w-1 bg-slate-200'}`} />
                    ))}
                </div>
            </div>
        );
    };

    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center bg-black/60 backdrop-blur-sm animate-in fade-in">
        <div className="bg-white w-full max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl h-auto max-h-[90dvh] flex flex-col animate-in slide-in-from-bottom duration-300 relative overflow-hidden">
          
          {/* Wizard Header */}
          <div className="flex justify-between items-center p-4 border-b border-slate-100">
             <div className="flex items-center">
                <div className={`flex items-center font-bold ${showReplaceUI && !isGenerating ? 'text-amber-600' : 'text-emerald-600'}`}>
                  {showReplaceUI && !isGenerating ? <AlertTriangle size={20} className="mr-2"/> : <Sparkles size={20} className="mr-2" />}
                  {isGenerating ? 'Drafting Plan...' : (showReplaceUI ? 'Limit Reached' : 'AI Plan Creator')}
                </div>
                {!isGenerating && !showReplaceUI && (
                  <span className="ml-3 text-xs font-medium text-slate-400 bg-slate-100 px-2 py-1 rounded-full">
                    Step {wizardStep}/2
                  </span>
                )}
             </div>
             
             {/* Only show close button when NOT generating */}
             {!isGenerating && (
                <button 
                    onClick={handleCloseWizard}
                    className="p-2 bg-slate-100 rounded-full text-slate-500 hover:bg-slate-200 transition-colors"
                >
                    <X size={20} />
                </button>
             )}
          </div>

          {/* Wizard Body */}
          <div className="flex-1 overflow-y-auto p-6 relative">
             {isGenerating ? (
               // Loading Screen
               <div className="flex flex-col items-center justify-center h-full text-center">
                 <div className="mb-6 relative">
                     <div className="w-16 h-16 border-4 border-slate-100 border-t-emerald-500 rounded-full animate-spin"></div>
                     <div className="absolute inset-0 flex items-center justify-center">
                         <BrainCircuit size={24} className="text-emerald-500 animate-pulse" />
                     </div>
                 </div>
                 <div>
                   <h3 className="text-lg font-bold text-slate-800">Constructing Routine</h3>
                   <p className="text-slate-400 text-sm mt-1 mb-2">
                     Applying progressive overload principles...
                   </p>
                 </div>
                 
                 {/* Flash Card Section */}
                 <div className="w-full max-w-xs mx-auto">
                    <TriviaCard />
                 </div>
                 
                 {/* Cancel Button - Triggers Custom Dialog */}
                 <button 
                   type="button"
                   onClick={handleRequestCancel}
                   className="mt-6 px-6 py-2 bg-red-50 border border-red-100 rounded-lg text-red-600 text-sm font-bold hover:bg-red-100 transition-colors"
                 >
                   Cancel Generation
                 </button>
               </div>
             ) : showReplaceUI ? (
                // Limit UI
                <div className="space-y-6">
                   <div className="text-center">
                      <h3 className="text-2xl font-bold text-slate-800">Storage Full</h3>
                      <p className="text-slate-500 text-sm mt-2">
                        You can only have 2 active plans per client. Please select an existing plan to replace.
                      </p>
                   </div>
                   <div className="space-y-3">
                      {client.plans.map(plan => (
                        <button
                          key={plan.id}
                          onClick={() => setPlanToReplace(plan.id)}
                          className={`w-full p-4 rounded-xl border flex items-center justify-between transition-all ${
                            planToReplace === plan.id 
                            ? 'bg-amber-50 border-amber-500 text-amber-900 ring-1 ring-amber-500' 
                            : 'bg-white border-slate-200 text-slate-600 hover:border-amber-200'
                          }`}
                        >
                           <div className="text-left">
                              <p className="font-bold">{plan.title}</p>
                              <p className="text-xs opacity-70">{new Date(plan.createdAt).toLocaleDateString()}</p>
                           </div>
                           {planToReplace === plan.id && <RefreshCw size={20} className="text-amber-600" />}
                        </button>
                      ))}
                   </div>
                </div>
             ) : (
               <>
                 {/* Step 1: Focus */}
                 {wizardStep === 1 && (
                   <div className="space-y-6 animate-in slide-in-from-right duration-300">
                      <div className="text-center mb-6">
                        <h3 className="text-2xl font-bold text-slate-800">What's the goal?</h3>
                        <p className="text-slate-500 text-sm">Select the primary focus for this block.</p>
                      </div>
                      
                      {Object.entries(categories).map(([category, items]) => (
                          <div key={category} className="mb-6 last:mb-0">
                              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 pl-1">{category}</h4>
                              <div className="grid grid-cols-2 gap-3">
                                {items.map((focus) => (
                                  <button
                                    key={focus}
                                    onClick={() => {
                                      if (genFocus.includes(focus)) {
                                        setGenFocus(genFocus.filter(f => f !== focus));
                                      } else {
                                        setGenFocus([focus]); 
                                      }
                                    }}
                                    className={`p-4 rounded-xl border text-left text-sm font-medium transition-all ${
                                      genFocus.includes(focus) 
                                      ? 'bg-emerald-50 border-emerald-500 text-emerald-700 ring-1 ring-emerald-500' 
                                      : 'bg-white border-slate-200 text-slate-600 hover:border-emerald-200'
                                    }`}
                                  >
                                    {focus}
                                  </button>
                                ))}
                              </div>
                          </div>
                      ))}
                   </div>
                 )}

                 {/* Step 2: Details */}
                 {wizardStep === 2 && (
                   <div className="space-y-6 animate-in slide-in-from-right duration-300">
                      <div className="text-center">
                        <h3 className="text-2xl font-bold text-slate-800">Final Details</h3>
                        <p className="text-slate-500 text-sm">Using stored profile data for calibration.</p>
                      </div>
                      
                      <div className="bg-slate-50 p-4 rounded-xl text-xs text-slate-500 flex gap-4">
                          <div>
                              <span className="block font-bold text-slate-700">Days/Week</span>
                              {client.trainingDays || '3'}
                          </div>
                          <div>
                              <span className="block font-bold text-slate-700">Body Type</span>
                              {client.bodyType || 'N/A'}
                          </div>
                          <div>
                              <span className="block font-bold text-slate-700">Activity</span>
                              {client.activityLevel || 'N/A'}
                          </div>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-bold text-slate-700 mb-2">Duration</label>
                          <div className="flex gap-2 overflow-x-auto pb-2">
                             {['1 Week', '2 Weeks', '4 Weeks', '8 Weeks'].map(d => (
                               <button
                                 key={d}
                                 onClick={() => setGenDuration(d)}
                                 className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap ${
                                   genDuration === d ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600'
                                 }`}
                               >
                                 {d}
                               </button>
                             ))}
                          </div>
                        </div>

                        <div>
                           <label className="block text-sm font-bold text-slate-700 mb-2">Injuries / Equipment / Context</label>
                           <textarea 
                             className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-emerald-500 min-h-[120px]"
                             placeholder="e.g. Has a lower back injury, only has dumbbells..."
                             value={genContext}
                             onChange={e => setGenContext(e.target.value)}
                           />
                        </div>
                      </div>
                   </div>
                 )}
               </>
             )}
          </div>

          {/* Wizard Footer */}
          {!isGenerating && (
            <div className="p-4 border-t border-slate-100 bg-slate-50/50">
              {showReplaceUI ? (
                 <div className="flex gap-3">
                    <button onClick={() => setShowReplaceUI(false)} className="px-6 py-4 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold">Cancel</button>
                    <button onClick={() => { if (planToReplace) executeGeneration(planToReplace); }} disabled={!planToReplace} className="flex-1 py-4 bg-amber-600 text-white rounded-xl font-bold text-lg shadow-lg shadow-amber-200 disabled:opacity-50">Replace Plan</button>
                 </div>
              ) : wizardStep < 2 ? (
                <button onClick={() => setWizardStep(2)} disabled={genFocus.length === 0} className="w-full py-4 bg-emerald-600 text-white rounded-xl font-bold text-lg shadow-lg shadow-emerald-200 disabled:opacity-50">Next</button>
              ) : (
                <div className="flex gap-3">
                  <button onClick={() => setWizardStep(1)} className="px-6 py-4 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold">Back</button>
                  <button onClick={initiatePlanGeneration} className="flex-1 py-4 bg-emerald-600 text-white rounded-xl font-bold text-lg shadow-lg shadow-emerald-200">Generate Plan</button>
                </div>
              )}
            </div>
          )}

          {/* Cancel Confirmation Overlay - Placed here to cover the entire wizard including headers/footers */}
          {showCancelConfirm && (
            <div className="absolute inset-0 z-50 bg-white flex flex-col items-center justify-center p-6 animate-in fade-in duration-200">
                <div className="w-16 h-16 bg-slate-50 text-slate-500 rounded-full flex items-center justify-center mb-6 animate-in zoom-in duration-300">
                    <AlertTriangle size={32} />
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">Stop Generation?</h3>
                <p className="text-slate-500 mb-8 max-w-[260px] text-center leading-relaxed text-sm">
                    This will discard the current plan draft and you will have to restart.
                </p>
                <div className="flex w-full gap-3 max-w-xs">
                    <button 
                        type="button"
                        onClick={() => setShowCancelConfirm(false)}
                        className="flex-1 py-3 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition-colors text-sm"
                    >
                        Resume
                    </button>
                    <button 
                        type="button"
                        onClick={handleConfirmCancel}
                        className="flex-1 py-3 bg-red-50 text-red-600 font-bold rounded-xl hover:bg-red-100 transition-colors border border-red-100 text-sm"
                    >
                        Stop
                    </button>
                </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="pb-24">
      {renderWizard()}
      {renderEditProfileModal()}

      {/* Header Profile Card */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 mb-6 relative">
          <button onClick={onBack} className="absolute top-5 left-5 text-slate-400 p-2 hover:bg-slate-50 rounded-full">
              <ArrowLeft size={24} />
          </button>
          
          {/* Edit Profile Button */}
          <button onClick={openEditProfile} className="absolute top-5 right-5 text-slate-400 p-2 hover:bg-slate-50 rounded-full">
              <Pencil size={20} />
          </button>
          
          <div className="flex flex-col items-center text-center mt-6">
              <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center text-2xl font-bold text-slate-500 mb-3 border-4 border-white shadow-sm">
                  {client.name[0]}
              </div>
              <h2 className="text-2xl font-bold text-slate-800">{client.name}</h2>
              <div className="flex flex-wrap justify-center gap-1 text-xs text-slate-500 mb-4 mt-1">
                 {client.gender && <span>{client.gender} • </span>}
                 {client.trainingDays && <span>{client.trainingDays}d/wk • </span>}
                 {client.bodyType && <span>{client.bodyType}</span>}
              </div>
              
              <div className="flex gap-3 w-full justify-center mb-6">
                  <a href={`tel:${client.phone}`} className="p-3 bg-slate-50 rounded-full text-slate-600 hover:bg-slate-100 transition-colors">
                      <Phone size={20} />
                  </a>
                  <a href={whatsappLink} target="_blank" className="p-3 bg-green-50 rounded-full text-green-600 hover:bg-green-100 transition-colors">
                      <MessageCircle size={20} />
                  </a>
              </div>

              {/* Balance Card */}
              <div className="bg-slate-900 text-white w-full rounded-xl p-4 flex justify-center items-center shadow-lg shadow-slate-200 text-center">
                  <div>
                      <span className="text-xs text-slate-400 uppercase font-bold">Balance</span>
                      <p className="text-3xl font-bold mt-1">{client.sessionsTotal - client.sessionsUsed} <span className="text-lg font-normal text-slate-400">/ {client.sessionsTotal}</span></p>
                  </div>
              </div>
          </div>
      </div>

      {/* Tabs */}
      <div className="flex p-1 bg-slate-200/50 rounded-xl mb-6 sticky top-0 z-10 backdrop-blur-md">
          {[
              { id: 'plans', icon: Dumbbell, label: 'Plans' },
              { id: 'history', icon: History, label: 'History' },
              { id: 'notes', icon: FileText, label: 'Notes' }
          ].map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex-1 flex items-center justify-center py-2.5 rounded-lg text-sm font-bold transition-all ${
                      isActive ? 'bg-white text-slate-800 shadow-sm scale-[1.02]' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                      <Icon size={16} className="mr-2" />
                      {tab.label}
                  </button>
              )
          })}
      </div>

      {/* Content Area */}
      <div>
          {activeTab === 'notes' && (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                      <textarea 
                        className="w-full h-24 p-2 text-sm outline-none resize-none bg-transparent placeholder-slate-400"
                        placeholder="Type a new progress note..."
                        value={newNote}
                        onChange={e => setNewNote(e.target.value)}
                      />
                      <div className="flex justify-end mt-2 pt-2 border-t border-slate-100">
                          <button onClick={handleAddNote} className="text-sm font-bold text-emerald-600 px-3 py-1 bg-emerald-50 rounded-lg">Save Note</button>
                      </div>
                  </div>
                  {(client.progressNotes || []).map(note => (
                      <div key={note.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                          <p className="text-xs text-slate-400 font-bold mb-1 uppercase tracking-wide">
                              {new Date(note.date).toLocaleDateString()}
                          </p>
                          <p className="text-slate-700 leading-relaxed">{note.content}</p>
                      </div>
                  ))}
              </div>
          )}

          {activeTab === 'history' && (
              <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2">
                  {client.history.filter(session => session.status === 'completed').map(session => (
                      <div key={session.id} className="bg-white p-4 rounded-xl border border-slate-100 flex justify-between items-center shadow-sm">
                          <div className="flex items-center">
                              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 mr-3">
                                <Check size={20} strokeWidth={3} />
                              </div>
                              <div>
                                <p className="font-bold text-slate-800">
                                    {new Date(session.date).toLocaleDateString(undefined, {month:'short', day:'numeric'})}
                                </p>
                                <p className="text-xs text-slate-500 capitalize">{session.status}</p>
                              </div>
                          </div>
                          {session.notes && (
                              <p className="text-xs text-slate-400 max-w-[120px] truncate bg-slate-50 px-2 py-1 rounded">
                                {session.notes}
                              </p>
                          )}
                      </div>
                  ))}
                  {client.history.filter(session => session.status === 'completed').length === 0 && (
                     <div className="text-center py-10 opacity-50">
                        <History size={48} className="mx-auto mb-2 text-slate-300"/>
                        <p className="text-slate-400">No session history.</p>
                     </div>
                  )}
              </div>
          )}

          {activeTab === 'plans' && (
              <div className="space-y-4 pb-20 animate-in fade-in slide-in-from-bottom-2">
                  {/* Create New Plan Button */}
                  <button 
                    onClick={() => setIsWizardOpen(true)}
                    className="w-full bg-indigo-600 text-white p-4 rounded-xl shadow-lg shadow-indigo-200 flex justify-between items-center group active:scale-[0.98] transition-all"
                  >
                      <div className="flex items-center font-bold">
                        <div className="p-2 bg-indigo-500 rounded-lg mr-3">
                           <Wand2 size={20} />
                        </div>
                        Create AI Plan
                      </div>
                      <Sparkles size={20} className="text-indigo-300 group-hover:text-white transition-colors" />
                  </button>

                  {client.plans.length === 0 && (
                      <div className="text-center py-10 opacity-50">
                          <Dumbbell size={48} className="mx-auto mb-2 text-slate-300"/>
                          <p className="text-slate-400">No training plans yet.</p>
                      </div>
                  )}

                  {client.plans.map(plan => {
                      const isExpanded = expandedPlanId === plan.id;
                      return (
                      <div key={plan.id} className="bg-white rounded-xl overflow-hidden border border-slate-100 shadow-sm transition-all">
                          {/* Plan Header */}
                          <div 
                             onClick={() => setExpandedPlanId(isExpanded ? null : plan.id)}
                             className="p-4 flex justify-between items-center cursor-pointer bg-slate-50 active:bg-slate-100"
                          >
                              <div>
                                 <h3 className="font-bold text-slate-800 text-lg">{plan.title}</h3>
                                 <div className="flex gap-2 mt-1">
                                    {plan.focus.map((f, i) => (
                                        i < 2 && <span key={f} className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded font-bold uppercase tracking-wider">{f}</span>
                                    ))}
                                 </div>
                              </div>
                              <div className="flex items-center gap-3">
                                  <button 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleSharePlan(plan);
                                    }}
                                    className="p-2 bg-green-50 text-green-600 rounded-full hover:bg-green-100"
                                  >
                                      <Share2 size={18} />
                                  </button>
                                  {isExpanded ? <ChevronUp size={20} className="text-slate-400" /> : <ChevronDown size={20} className="text-slate-400" />}
                              </div>
                          </div>
                          
                          {/* Plan Body (Sessions) */}
                          {isExpanded && (
                              <div className="border-t border-slate-100">
                                  {plan.sessions.map((session, idx) => {
                                      const isSessionOpen = expandedSessionId === session.id;
                                      return (
                                          <div key={session.id} className="border-b border-slate-100 last:border-0">
                                              <div 
                                                onClick={() => setExpandedSessionId(isSessionOpen ? null : session.id)}
                                                className="p-4 flex justify-between items-center cursor-pointer hover:bg-slate-50/50"
                                              >
                                                  <div className="flex items-center">
                                                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500 mr-3">
                                                          {idx + 1}
                                                      </div>
                                                      <div>
                                                          <p className="font-bold text-slate-700 text-sm">{session.dayLabel}</p>
                                                          <p className="text-xs text-slate-500">{session.targetFocus}</p>
                                                      </div>
                                                  </div>
                                                  {isSessionOpen ? <ChevronUp size={16} className="text-slate-300" /> : <ChevronDown size={16} className="text-slate-300" />}
                                              </div>

                                              {/* Exercises List */}
                                              {isSessionOpen && (
                                                  <div className="bg-slate-50/50 px-4 pb-4 space-y-2">
                                                      {session.exercises.map((ex, i) => (
                                                          <div key={ex.id} className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm flex justify-between items-start">
                                                              <div className="flex-1 mr-2">
                                                                  <p className="font-medium text-slate-800 text-sm">{ex.name}</p>
                                                                  {ex.remarks && <p className="text-xs text-slate-400 italic mt-0.5">{ex.remarks}</p>}
                                                              </div>
                                                              <div className="text-right">
                                                                  <div className="font-bold text-indigo-600 text-sm bg-indigo-50 px-2 py-1 rounded inline-block">
                                                                    {ex.sets} x {ex.reps}
                                                                  </div>
                                                              </div>
                                                          </div>
                                                      ))}
                                                  </div>
                                              )}
                                          </div>
                                      );
                                  })}
                              </div>
                          )}
                      </div>
                      );
                  })}
              </div>
          )}
      </div>
    </div>
  );
};

export default ClientDetail;