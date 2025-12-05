import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Clients from './pages/Clients';
import ClientDetail from './pages/ClientDetail';
import Schedule from './pages/Schedule';
import Subscription from './pages/Subscription';
import FutureFeatures from './pages/FutureFeatures';
import Help from './pages/Help';
import { Client, UserProfile, ClientSession } from './types';
import { signInWithGoogle, signOut, onAuthChange } from './services/firebaseService';
import { StorageService, logUsageStats } from './services/storageService';
import { Lock, Cloud, Loader2, Code2 } from 'lucide-react';
import { ENABLE_GOOGLE_LOGIN } from './config';

const App: React.FC = () => {
  // Global State
  const [user, setUser] = useState<UserProfile | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  
  // Auth State
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  // Initialize storage service and load data when user signs in
  useEffect(() => {
    if (user) {
      // Initialize storage service (will check localStorage for stored token)
      StorageService.initialize(accessToken);
      
      // Load data from localStorage/Drive
      StorageService.loadClients().then((loadedClients) => {
        setClients(loadedClients);
        console.log(`✅ Loaded ${loadedClients.length} clients`);
      });
    }
  }, [user]);

  // Listen for Firebase auth state changes
  useEffect(() => {
    if (ENABLE_GOOGLE_LOGIN) {
      const unsubscribe = onAuthChange(async (firebaseUser) => {
        if (firebaseUser) {
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
          
          setUser(userProfile);
          StorageService.setCurrentUser(userProfile);
          
          // Load stored access token and initialize storage
          const storedToken = localStorage.getItem('fittrack_access_token');
          if (storedToken) {
            setAccessToken(storedToken);
          }
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
      setAccessToken(token);
      setUser(userProfile);
      StorageService.setCurrentUser(userProfile);
      
      // Initialize and load data
      StorageService.initialize(token);
      const loadedClients = await StorageService.loadClients();
      setClients(loadedClients);
      
      logUsageStats('User Logged In');
    } catch (err: any) {
      console.error(err);
      setAuthError("Login failed. Please check your popup blockers and try again.");
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
      
      await signOut();
      setUser(null);
      setClients([]);
      setAccessToken(null);
      setCurrentPage('dashboard');
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
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
          <div className="mb-6 flex justify-center">
             <div className={`p-4 rounded-full ${ENABLE_GOOGLE_LOGIN ? 'bg-emerald-100' : 'bg-amber-100'}`}>
                {ENABLE_GOOGLE_LOGIN ? (
                  <Lock className="text-emerald-600" size={32} />
                ) : (
                  <Code2 className="text-amber-600" size={32} />
                )}
             </div>
          </div>
          <h1 className="text-4xl font-black text-slate-900 mb-2 italic tracking-tighter">Tabata</h1>
          <p className="text-slate-500 mb-8 font-medium">Professional Client Management</p>
          
          <button 
              onClick={onGoogleLogin}
              className={`w-full flex items-center justify-center gap-3 px-6 py-3 border rounded-lg transition-colors font-medium group ${
                  ENABLE_GOOGLE_LOGIN 
                  ? 'border-slate-300 hover:bg-slate-50 text-slate-700' 
                  : 'bg-amber-100 border-amber-200 text-amber-900 hover:bg-amber-200'
              }`}
          >
              {ENABLE_GOOGLE_LOGIN ? (
                  <>
                      <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" className="w-5 h-5" />
                      Sign in with Google
                  </>
              ) : (
                  <>
                      <Code2 size={20} />
                      Enter Developer Mode
                  </>
              )}
          </button>

          {authError && (
              <p className="text-sm text-red-500 mt-4 font-medium">{authError}</p>
          )}
          
          <div className="mt-8 pt-6 border-t border-slate-100">
             <div className="flex items-center justify-center text-xs text-slate-400 gap-2 mb-2">
                 <Cloud size={14} />
                 <span>{ENABLE_GOOGLE_LOGIN ? 'Secure Cloud Sync' : 'Local Development Storage'}</span>
             </div>
             <p className="text-[10px] text-slate-400 leading-relaxed">
                {ENABLE_GOOGLE_LOGIN 
                 ? "By signing in, Tabata will create a secure file in your Google Drive to store your clients and plans. We do not have access to your other files."
                 : "Developer Mode enabled: Data is stored in your browser's LocalStorage and will not sync across devices."
                }
             </p>
          </div>
        </div>
      </div>
    );
  }

  // --- Main App Logic ---

  const renderContent = () => {
    // 1. Client Detail View (Special Case)
    if (currentPage.startsWith('client/') || selectedClientId) {
      const id = selectedClientId || currentPage.split('/')[1];
      const client = clients.find(c => c.id === id);
      if (client) {
        return (
          <ClientDetail 
            client={client} 
            onUpdateClient={(updated) => {
               const newClients = clients.map(c => c.id === updated.id ? updated : c);
               handleUpdateClients(newClients);
            }}
            onBack={() => {
              setSelectedClientId(null);
              setCurrentPage('clients');
            }} 
          />
        );
      }
    }

    // 2. Main Pages
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard clients={clients} onNavigate={(p) => setCurrentPage(p)} />;
      case 'clients':
        return (
          <Clients 
            clients={clients} 
            setClients={handleUpdateClients} 
            onSave={handleUpdateClients}
            onSelectClient={(id) => setSelectedClientId(id)}
          />
        );
      case 'schedule':
        return (
            <Schedule 
                clients={clients} 
                onUpdateClient={(updated) => {
                    const newClients = clients.map(c => c.id === updated.id ? updated : c);
                    handleUpdateClients(newClients);
                }}
                onNavigate={(page) => setCurrentPage(page)}
            />
        );
      case 'subscription':
        return user ? <Subscription user={user} onUpdateUser={handleUpdateUser} /> : null;
      case 'future':
        return <FutureFeatures />;
      case 'help':
        return <Help />;
      default:
        return <Dashboard clients={clients} onNavigate={(p) => setCurrentPage(p)} />;
    }
  };

  return (
    <Layout 
      currentPage={selectedClientId ? 'clients' : currentPage} 
      onNavigate={(page) => {
        setCurrentPage(page);
        setSelectedClientId(null);
      }}
      onLogout={onLogout}
      userEmail={user.email}
    >
      {renderContent()}
    </Layout>
  );
};

export default App;