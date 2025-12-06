import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useParams } from 'react-router-dom';
import Layout from './components/Layout';
import { Client, UserProfile, ClientSession } from './types';
import { initializeGoogleIdentity, signInWithGoogleIdentity, signOutGoogleIdentity, isSignedIn } from './services/googleIdentityService';
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
  
  // Sync notification state
  const [showSyncBanner, setShowSyncBanner] = useState(false);
  const [pendingDriveData, setPendingDriveData] = useState<Client[] | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Google Identity Services initialization flag
  const googleInitializedRef = useRef(false);

  // Initialize Google Identity Services on mount
  useEffect(() => {
    if (ENABLE_GOOGLE_LOGIN && !googleInitializedRef.current) {
      // Check for existing session FIRST (instant)
      const storedToken = localStorage.getItem('fittrack_access_token');
      const storedUser = StorageService.loadUser();
      
      if (storedToken && storedUser) {
        // Restore session instantly
        console.log('⚡ Instant session restore');
        setAccessToken(storedToken);
        setUser(storedUser);
        setIsAuthLoading(false);
        StorageService.initialize(storedToken);
        
        // Load clients from localStorage immediately
        const stored = localStorage.getItem('fittrack_clients');
        if (stored) {
          try {
            const localClients = JSON.parse(stored);
            setClients(localClients);
            console.log('⚡ Instant client data loaded:', localClients.length);
          } catch (e) {
            console.error('Failed to parse local clients:', e);
          }
        }
      } else {
        setIsAuthLoading(false);
      }
      
      // Initialize Google Identity Services in background (non-blocking)
      console.log('🔍 Initializing Google Identity Services...');
      initializeGoogleIdentity()
        .then(() => {
          googleInitializedRef.current = true;
          console.log('✅ Google Identity Services ready');
        })
        .catch((error) => {
          console.error('❌ Failed to initialize Google Identity Services:', error);
          setAuthError('Failed to initialize Google Sign-In');
        });
    } else if (!ENABLE_GOOGLE_LOGIN) {
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

  // Listen for service events
  useEffect(() => {
    const handleTokenExpired = () => {
      console.log('⚠️ Token expired event received');
      onLogout();
    };

    const handleSyncConflict = (event: CustomEvent) => {
      console.log('⚠️ Sync conflict event received', event.detail);
      alert('Sync Conflict: Remote data is newer. Please refresh to load latest data.');
    };
    
    const handleTokenRefreshed = (event: CustomEvent) => {
      console.log('✅ Token refreshed event received');
      setAccessToken(event.detail.token);
    };

    window.addEventListener('token-expired', handleTokenExpired as EventListener);
    window.addEventListener('sync-conflict', handleSyncConflict as EventListener);
    window.addEventListener('token-refreshed', handleTokenRefreshed as EventListener);

    return () => {
      window.removeEventListener('token-expired', handleTokenExpired as EventListener);
      window.removeEventListener('sync-conflict', handleSyncConflict as EventListener);
      window.removeEventListener('token-refreshed', handleTokenRefreshed as EventListener);
    };
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
      setIsAuthLoading(true);
      
      const { userProfile, accessToken: token } = await signInWithGoogleIdentity();
      
      console.log('✅ Sign-in succeeded, user:', userProfile.email);
      
      // Store access token
      localStorage.setItem('fittrack_access_token', token);
      console.log('✅ Access token saved to localStorage');
      
      // Initialize storage with token
      StorageService.initialize(token);
      
      // Set state immediately (login is instant)
      setAccessToken(token);
      setUser(userProfile);
      StorageService.setCurrentUser(userProfile);
      setIsAuthLoading(false);
      
      // Load data from localStorage immediately (synchronous)
      const stored = localStorage.getItem('fittrack_clients');
      if (stored) {
        try {
          const localClients = JSON.parse(stored);
          setClients(localClients);
          console.log(`⚡ Loaded ${localClients.length} clients instantly`);
        } catch (e) {
          console.error('Failed to parse clients:', e);
          setClients([]);
        }
      } else {
        console.log('📥 No local data, will load from Drive on first save');
        setClients([]);
      }
      
      logUsageStats('User Logged In');
    } catch (err: any) {
      console.error('❌ Login error:', err);
      setAuthError(err.message || 'Login failed. Please try again.');
      setIsAuthLoading(false);
    }
  };



  const onLogout = async () => {
    try {
      // Save to localStorage immediately, Drive sync happens in background
      if (clients.length > 0 && user) {
        console.log('💾 Saving data to localStorage...');
        localStorage.setItem('fittrack_clients', JSON.stringify(clients));
        // Background save to Drive (non-blocking)
        StorageService.saveClients(clients).catch(err => 
          console.error('Background Drive save failed:', err)
        );
      }
      
      // Clear access token
      localStorage.removeItem('fittrack_access_token');
      
      await signOutGoogleIdentity();
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
  
  const handleLoadDriveData = () => {
    if (pendingDriveData) {
      setClients(pendingDriveData);
      localStorage.setItem('fittrack_clients', JSON.stringify(pendingDriveData));
      localStorage.setItem('fittrack_last_synced', new Date().toISOString());
      setPendingDriveData(null);
      setShowSyncBanner(false);
      console.log('✅ Drive data loaded successfully');
    }
  };

  const handleSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      console.log('🔄 Manual sync requested');
      await StorageService.syncFromDrive();
      // Also check for updates
      const updates = await StorageService.checkDriveForUpdates();
      if (updates) {
        setPendingDriveData(updates);
        setShowSyncBanner(true);
      }
    } catch (error) {
      console.error('Manual sync failed:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <BrowserRouter>
      <Layout onLogout={onLogout} onSync={handleSync} isSyncing={isSyncing} userEmail={user?.email}>
        {/* Sync notification banner */}
        {showSyncBanner && (
          <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 max-w-md w-full mx-4">
            <div className="bg-blue-600 text-white px-4 py-3 rounded-lg shadow-lg flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cloud className="w-5 h-5" />
                <span className="text-sm font-medium">New data available from Drive</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleLoadDriveData}
                  className="px-3 py-1 bg-white text-blue-600 rounded text-sm font-medium hover:bg-blue-50 transition-colors"
                >
                  Load
                </button>
                <button
                  onClick={() => setShowSyncBanner(false)}
                  className="px-3 py-1 text-white hover:bg-blue-700 rounded text-sm font-medium transition-colors"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}
        
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