import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  Calendar, 
  Menu,
  LogOut,
  Settings,
  HelpCircle,
  Dumbbell,
  X,
  Loader2
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  onLogout: () => void;
  userEmail?: string;
}

const Layout: React.FC<LayoutProps> = ({ children, onLogout, userEmail }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);

  const mainTabs = [
    { id: '/dashboard', label: 'Home', icon: LayoutDashboard },
    { id: '/schedule', label: 'Schedule', icon: Calendar },
    { id: '/clients', label: 'Clients', icon: Users },
  ];

  const menuItems = [
    // Subscription disabled
    { id: '/future', label: 'Labs (Beta)', icon: Dumbbell },
    { id: '/help', label: 'Help & Bugs', icon: HelpCircle },
  ];

  const handleMenuNavigate = (path: string) => {
    navigate(path);
    setIsMenuOpen(false);
  };

  const getPageTitle = () => {
    if (currentPath.startsWith('/clients/')) return 'Client Profile';
    switch (currentPath) {
      case '/':
      case '/dashboard': return 'Tabata';
      case '/schedule': return 'My Schedule';
      case '/clients': return 'Clients';
      case '/subscription': return 'Subscription';
      case '/future': return 'Labs';
      case '/help': return 'Support';
      default: return 'Tabata';
    }
  };

  const isTabActive = (tabPath: string) => {
    if (tabPath === '/dashboard') {
      return currentPath === '/' || currentPath === '/dashboard';
    }
    if (tabPath === '/clients') {
      return currentPath.startsWith('/clients');
    }
    return currentPath === tabPath;
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden">
      {/* Top Header */}
      <header className="flex-none bg-white border-b border-slate-200 px-4 py-3 flex justify-between items-center shadow-sm z-20">
        <h1 className="text-xl font-black text-slate-900 tracking-tight italic">{getPageTitle()}</h1>
        <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-sm border border-emerald-200">
           {userEmail ? userEmail[0].toUpperCase() : 'U'}
        </div>
      </header>

      {/* Main Content Scroll Area */}
      <main className="flex-1 overflow-y-auto pb-20 scroll-smooth">
        <div className="p-4 max-w-lg mx-auto">
          {children}
        </div>
      </main>

      {/* Bottom Navigation */}
      <nav className="flex-none bg-white border-t border-slate-200 pb-safe fixed bottom-0 w-full z-30 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <div className="flex justify-around items-center h-16">
          {mainTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = isTabActive(tab.id);
            return (
              <button
                key={tab.id}
                onClick={() => navigate(tab.id)}
                className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${
                  isActive ? 'text-emerald-600' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
                <span className="text-[10px] font-medium">{tab.label}</span>
              </button>
            );
          })}
          
          {/* Menu Tab */}
          <button
            onClick={() => setIsMenuOpen(true)}
            className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${
              isMenuOpen ? 'text-emerald-600' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <Menu size={24} />
            <span className="text-[10px] font-medium">More</span>
          </button>
        </div>
      </nav>

      {/* More Menu Overlay */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
           <div className="bg-white rounded-t-2xl p-6 shadow-2xl animate-in slide-in-from-bottom duration-300">
              <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
                  <div className="flex items-center">
                     <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mr-3">
                        <Menu size={20} className="text-slate-600"/>
                     </div>
                     <div>
                        <h3 className="font-bold text-lg text-slate-800">Menu</h3>
                        <p className="text-xs text-slate-500">{userEmail}</p>
                     </div>
                  </div>
                  <button onClick={() => setIsMenuOpen(false)} className="p-2 bg-slate-100 rounded-full text-slate-500">
                      <X size={20} />
                  </button>
              </div>

              <div className="space-y-2">
                  {menuItems.map(item => {
                      const Icon = item.icon;
                      return (
                          <button 
                            key={item.id}
                            onClick={() => handleMenuNavigate(item.id)}
                            className="w-full flex items-center p-4 rounded-xl hover:bg-slate-50 transition-colors text-slate-700 font-medium border border-slate-100 shadow-sm"
                          >
                              <Icon size={20} className="mr-3 text-slate-400" />
                              {item.label}
                          </button>
                      )
                  })}
                  
                  <div className="h-px bg-slate-100 my-4" />
                  
                  <button 
                    onClick={async () => {
                      setIsLoggingOut(true);
                      await onLogout();
                      setIsLoggingOut(false);
                    }}
                    disabled={isLoggingOut}
                    className="w-full flex items-center p-4 rounded-xl bg-red-50 text-red-600 font-medium border border-red-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                      {isLoggingOut ? (
                        <>
                          <Loader2 size={20} className="mr-3 animate-spin" />
                          Signing Out...
                        </>
                      ) : (
                        <>
                          <LogOut size={20} className="mr-3" />
                          Sign Out
                        </>
                      )}
                  </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default Layout;