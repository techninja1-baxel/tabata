import React, { useState, useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useParams } from 'react-router-dom';
import Layout from './components/Layout';
import { Client, UserProfile, ClientSession } from './types';
import { signInWithGoogle, signOut, onAuthChange, handleRedirectResult } from './services/firebaseService';
import { StorageService, logUsageStats } from './services/storageService';
import { Lock, Cloud, Loader2, Code2 } from 'lucide-react';
import { ENABLE_GOOGLE_LOGIN } from './config';

// Lazy load pages for better performance
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Clients = lazy(() => import('./pages/Clients'));
const ClientDetail = lazy(() => import('./pages/ClientDetail'));
const Schedule = lazy(() => import('./pages/Schedule'));
const Subscription = lazy(() => import('./pages/Subscription'));
const FutureFeatures = lazy(() => import('./pages/FutureFeatures'));
const Help = lazy(() => import('./pages/Help'));

// Loading component
const PageLoader = () => (
  <div className="flex items-center justify-center h-screen bg-gray-900">
    <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
  </div>
);

// Wrapper component for ClientDetail that uses URL params
const ClientDetailWrapper: React.FC<{ clients: Client[]; onUpdateClient: (client: Client) => void }> = ({ clients, onUpdateClient }) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const client = clients.find(c => c.id === id);
  
  if (!client) {
    return <div className="p-8 text-center text-white">Client not found</div>;
  }
  
  return (
    <ClientDetail 
      client={client} 
      onUpdateClient={onUpdateClient}
      onBack={() => navigate('/clients')} 
    />
  );
};

const App: React.FC = () => {
  // Global State
  const [user, setUser] = useState<UserProfile | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  
  // Auth State
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  // Initialize storage service and load data when user signs in
  useEffect(() => {
    if (user && accessToken) {
      // Re-initialize storage service when token changes
      StorageService.initialize(accessToken);
    }
  }, [user, accessToken]);

  // Check for redirect result on page load
  useEffect(() => {
    if (ENABLE_GOOGLE_LOGIN) {
      handleRedirectResult().then((result) => {
        if (result) {
          console.log('✅ Sign-in redirect completed successfully');
          const { userProfile, accessToken: token } = result;
          
          // Store access token for Drive operations
          if (token) {
            localStorage.setItem('fittrack_access_token', token);
          }
          
          // Initialize storage and load data
          StorageService.initialize(token);
          StorageService.loadClients().then((loadedClients) => {
            setAccessToken(token);
            setClients(loadedClients);
            setUser(userProfile);
            StorageService.setCurrentUser(userProfile);
            setIsAuthLoading(false);
          });
        }
      }).catch((error) => {
        console.error('Redirect result error:', error);
        setAuthError(error.message);
        setIsAuthLoading(false);
      });
    }
  }, []);

  // Listen for Firebase auth state changes
  useEffect(() => {
    if (ENABLE_GOOGLE_LOGIN) {
      const unsubscribe = onAuthChange(async (firebaseUser) => {
        if (firebaseUser) {
          // Load stored access token FIRST
          const storedToken = localStorage.getItem('fittrack_access_token');
          
          // If no token in localStorage (incognito/new session), we need to wait for explicit login
          // Don't auto-restore session without Drive access token
          if (!storedToken) {
            console.log('⚠️ No access token found - user needs to sign in again');
            setUser(null);
            setClients([]);
            setAccessToken(null);
            setIsAuthLoading(false);
            return;
          }
          
          const userProfile: UserProfile = {
            name: firebaseUser.displayName || 'User',
            email: firebaseUser.email || '',
            photoUrl: firebaseUser.photoURL || undefined,
            isSubscribed: false,
          };
          
          // Load stored subscription status from localStorage
          const storedUser = StorageService.loadUser();
          if (storedUser) {
            userProfile.isSubscribed = storedUser.isSubscribed;
            userProfile.promoCode = storedUser.promoCode;
          }
          
          // Initialize storage with token
          setAccessToken(storedToken);
          StorageService.initialize(storedToken);
          
          // Load data from Drive/localStorage
          console.log('🔄 Restoring session - loading data...');
          const loadedClients = await StorageService.loadClients();
          console.log(`✅ Session restored with ${loadedClients.length} clients`);
          
          // Now set user and clients
          setClients(loadedClients);
          setUser(userProfile);
          StorageService.setCurrentUser(userProfile);
        } else {
          setUser(null);
          setClients([]);
          setAccessToken(null);
        }
        setIsAuthLoading(false);
      });

      return () => unsubscribe();
    } else {
      // Developer mode
      const mockUser: UserProfile = {
        name: 'Dev Trainer',
        email: 'dev@fittrack.local',
        photoUrl: undefined,
        isSubscribed: true,
      };
      
      StorageService.initialize(null);
      StorageService.loadClients().then((loadedClients) => {
        setClients(loadedClients);
      });
      
      setUser(mockUser);
      StorageService.setCurrentUser(mockUser);
      setIsAuthLoading(false);
    }
  }, []);

  // Check for expired schedules periodically
  useEffect(() => {
    if (!user || clients.length === 0) return;

    const checkExpiredSchedules = () => {
      const now = new Date().toISOString();
      let hasUpdates = false;

      const updatedClients = clients.map(client => {
        if (!client.schedule || client.schedule.length === 0) return client;

        const activeSchedule = [];
        const expiredSchedule = [];

        for (const session of client.schedule) {
          if (session.datetime < now) {
            expiredSchedule.push(session);
          } else {
            activeSchedule.push(session);
          }
        }

        if (expiredSchedule.length > 0) {
          hasUpdates = true;
          const newHistoryEntries: ClientSession[] = expiredSchedule.map(s => {
             let note = s.title || 'Scheduled Session';
             if (s.exercises && s.exercises.length > 0) {
                note += `\n\nWorkout Plan (Not logged as completed):\n${s.exercises.map(e => `• ${e.name}`).join('\n')}`;
             }
             return {
               id: crypto.randomUUID(),
               date: s.datetime,
               status: s.status === 'cancelled' ? 'cancelled' : 'scheduled',
               notes: note
             };
          });

          return {
            ...client,
            schedule: activeSchedule,
            history: [...newHistoryEntries, ...client.history].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())
          };
        }
        
        return client;
      });

      if (hasUpdates) {
        console.log('Moved expired sessions to history');
        setClients(updatedClients);
        StorageService.saveClients(updatedClients);
      }
    };

    checkExpiredSchedules();
    const intervalId = setInterval(checkExpiredSchedules, 60000);
    return () => clearInterval(intervalId);
  }, [clients, user]);

  // --- Data Persistence ---

  const saveData = (newClients: Client[], newUser: UserProfile) => {
    setClients(newClients);
    setUser(newUser);
    
    // Save using StorageService (will handle both localStorage and Drive)
    StorageService.saveClients(newClients);
    StorageService.saveUser(newUser);
  };

  const handleUpdateClients = (newClients: Client[]) => {
    if (!user) return;
    saveData(newClients, user);
  };

  const handleUpdateUser = (newUser: UserProfile) => {
    saveData(clients, newUser);
  };

  // --- Auth Handlers ---

  const onGoogleLogin = async () => {
    try {
      setAuthError(null);
      const { userProfile, accessToken: token } = await signInWithGoogle();
      
      // Store access token for Drive operations FIRST
      if (token) {
        localStorage.setItem('fittrack_access_token', token);
      }
      
      // Initialize storage with token BEFORE setting user
      StorageService.initialize(token);
      
      // Load data from Drive/localStorage BEFORE setting user state
      console.log('🔄 Loading user data before login completion...');
      const loadedClients = await StorageService.loadClients();
      console.log(`✅ Loaded ${loadedClients.length} clients from storage`);
      
      // Now set state - this will trigger UI to show
      setAccessToken(token);
      setClients(loadedClients);
      setUser(userProfile);
      StorageService.setCurrentUser(userProfile);
      
      logUsageStats('User Logged In');
    } catch (err: any) {
      console.error(err);
      // Show different message if it's a redirect
      if (err.message?.includes('Redirecting')) {
        setAuthError("Redirecting to Google sign-in...");
      } else {
        setAuthError("Login failed. If you're on mobile or popups are blocked, the page will redirect automatically.");
      }
    }
  };



  const onLogout = async () => {
    try {
      // Save current clients data before logging out
      if (clients.length > 0 && user) {
        console.log('💾 Saving data before logout...');
        await StorageService.saveClients(clients);
        // Wait a bit to ensure Drive sync completes
        await new Promise(resolve => setTimeout(resolve, 1000));
        console.log('✅ Data saved successfully');
      }
      
      // Clear access token
      localStorage.removeItem('fittrack_access_token');
      
      await signOut();
      setUser(null);
      setClients([]);
      setAccessToken(null);
      StorageService.setCurrentUser(null);
    } catch (err: any) {
      console.error(err);
    }
  };

  // --- Rendering ---

  // Loading Screen
  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="animate-spin text-white mx-auto mb-4" size={48} />
          <p className="text-slate-300 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  // Login Screen
  if (!user) {
    // In developer mode, show simple dev login
    if (!ENABLE_GOOGLE_LOGIN) {
      return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
            <div className="mb-6 flex justify-center">
               <div className="p-4 rounded-full bg-amber-100">
                  <Code2 className="text-amber-600" size={32} />
               </div>
            </div>
            <h1 className="text-4xl font-black text-slate-900 mb-2 italic tracking-tighter">Tabata</h1>
            <p className="text-slate-500 mb-8 font-medium">Professional Client Management</p>
            
            <button 
                onClick={onGoogleLogin}
                className="w-full flex items-center justify-center gap-3 px-6 py-3 border rounded-lg transition-colors font-medium group bg-amber-100 border-amber-200 text-amber-900 hover:bg-amber-200"
            >
                <Code2 size={20} />
                Enter Developer Mode
            </button>

            {authError && (
                <p className="text-sm text-red-500 mt-4 font-medium">{authError}</p>
            )}
            
            <div className="mt-8 pt-6 border-t border-slate-100">
               <div className="flex items-center justify-center text-xs text-slate-400 gap-2 mb-2">
                   <Cloud size={14} />
                   <span>Local Development Storage</span>
               </div>
               <p className="text-[10px] text-slate-400 leading-relaxed">
                  Developer Mode enabled: Data is stored in your browser's LocalStorage and will not sync across devices.
               </p>
            </div>
          </div>
        </div>
      );
    }

    // Production mode - show Google login
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
          <div className="mb-6 flex justify-center">
             <div className="p-4 rounded-full bg-emerald-100">
                <Lock className="text-emerald-600" size={32} />
             </div>
          </div>
          <h1 className="text-4xl font-black text-slate-900 mb-2 italic tracking-tighter">Tabata</h1>
          <p className="text-slate-500 mb-8 font-medium">Professional Client Management</p>
          
          <button 
              onClick={onGoogleLogin}
              className="w-full flex items-center justify-center gap-3 px-6 py-3 border rounded-lg transition-colors font-medium group border-slate-300 hover:bg-slate-50 text-slate-700"
          >
              <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" className="w-5 h-5" />
              Sign in with Google
          </button>

          {authError && (
              <p className="text-sm text-red-500 mt-4 font-medium">{authError}</p>
          )}
          
          <div className="mt-8 pt-6 border-t border-slate-100">
             <div className="flex items-center justify-center text-xs text-slate-400 gap-2 mb-2">
                 <Cloud size={14} />
                 <span>Secure Cloud Sync</span>
             </div>
             <p className="text-[10px] text-slate-400 leading-relaxed">
                By signing in, Tabata will create a secure file in your Google Drive to store your clients and plans. We do not have access to your other files.
             </p>
          </div>
        </div>
      </div>
    );
  }

  // --- Main App Logic ---

  const handleUpdateClient = (updated: Client) => {
    const newClients = clients.map(c => c.id === updated.id ? updated : c);
    handleUpdateClients(newClients);
  };

  return (
    <BrowserRouter>
      <Layout onLogout={onLogout} userEmail={user.email}>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Dashboard clients={clients} />} />
            <Route path="/dashboard" element={<Dashboard clients={clients} />} />
            <Route path="/schedule" element={
              <Schedule 
                clients={clients} 
                onUpdateClient={handleUpdateClient}
              />
            } />
            <Route path="/clients" element={
              <Clients 
                clients={clients} 
                setClients={handleUpdateClients} 
                onSave={handleUpdateClients}
              />
            } />
            <Route path="/clients/:id" element={
              <ClientDetailWrapper 
                clients={clients}
                onUpdateClient={handleUpdateClient}
              />
            } />
            <Route path="/subscription" element={
              user ? <Subscription user={user} onUpdateUser={handleUpdateUser} /> : <PageLoader />
            } />
            <Route path="/future" element={<FutureFeatures />} />
            <Route path="/help" element={<Help />} />
          </Routes>
        </Suspense>
      </Layout>
    </BrowserRouter>
  );
};

export default App;