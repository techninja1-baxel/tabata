import { Client, UserProfile } from '../types';
import { loadFromDrive, saveToDrive, setAccessToken, getFileMetadata } from './googleDriveService';
import { ENABLE_GOOGLE_LOGIN } from '../config';

const STORAGE_KEY_CLIENTS = 'fittrack_clients';
const STORAGE_KEY_USER = 'fittrack_user';
const STORAGE_KEY_SYNCED = 'fittrack_last_synced';
const STORAGE_KEY_ACCESS_TOKEN = 'fittrack_access_token';

let isOnline = false;
let accessToken: string | null = null;
let saveTimeout: any = null; // Using any to avoid NodeJS.Timeout vs number issues in browser
let pendingClients: Client[] | null = null;
let lastKnownCount = 0;
let failedSaveQueue: Client[][] = [];
let retryTimer: any = null;
let retryDelay = 2000; // Start with 2 seconds

export const StorageService = {
  // Initialize with access token
  initialize: (token: string | null) => {
    accessToken = token;
    if (token) {
      setAccessToken(token);
      localStorage.setItem(STORAGE_KEY_ACCESS_TOKEN, token);
      isOnline = ENABLE_GOOGLE_LOGIN && navigator.onLine;
    } else {
      // Try to load from localStorage
      const storedToken = localStorage.getItem(STORAGE_KEY_ACCESS_TOKEN);
      if (storedToken) {
        accessToken = storedToken;
        setAccessToken(storedToken);
        isOnline = ENABLE_GOOGLE_LOGIN && navigator.onLine;
      }
    }

    // Setup online/offline listeners
    window.addEventListener('online', () => {
      console.log('🌐 Network online');
      isOnline = ENABLE_GOOGLE_LOGIN && !!accessToken;
      if (isOnline) {
        StorageService.retryFailedSaves();
        StorageService.syncFromDrive();
      }
    });
    
    window.addEventListener('offline', () => {
      console.log('🔌 Network offline');
      isOnline = false;
    });
  },

  // Load clients from Drive or LocalStorage
  loadClients: async (): Promise<Client[]> => {
    // Always return localStorage immediately for fast initial load
    const stored = localStorage.getItem(STORAGE_KEY_CLIENTS);
    let localClients: Client[] = [];
    
    try {
      localClients = stored ? JSON.parse(stored) : [];
      if (!Array.isArray(localClients)) {
        console.error('❌ Invalid data format in localStorage, resetting to empty');
        localClients = [];
      }
    } catch (e) {
      console.error('❌ Failed to parse localStorage data:', e);
      localClients = [];
    }
    
    // If we have local data, return it immediately
    if (localClients.length > 0) {
      const totalNotes = localClients.reduce((sum: number, c: Client) => sum + (c.progressNotes?.length || 0), 0);
      console.log('📥 Quick load from localStorage. Clients:', localClients.length, 'Total notes:', totalNotes);
      
      // Sync with Drive in background (non-blocking)
      if (isOnline && accessToken) {
        StorageService.syncFromDrive().catch(error => {
          console.error('Background Drive sync failed:', error);
        });
      }
      
      return localClients;
    }
    
    // No local data - must check Drive
    if (isOnline && accessToken) {
      try {
        console.log('📥 No local data, loading from Google Drive...');
        const driveData = await loadFromDrive();
        if (driveData && driveData.clients) {
          localStorage.setItem(STORAGE_KEY_CLIENTS, JSON.stringify(driveData.clients));
          localStorage.setItem(STORAGE_KEY_SYNCED, new Date().toISOString());
          const totalNotes = driveData.clients.reduce((sum: number, c: Client) => sum + (c.progressNotes?.length || 0), 0);
          console.log('✅ Loaded from Drive. Clients:', driveData.clients.length, 'Total notes:', totalNotes);
          return driveData.clients;
        }
      } catch (error) {
        console.error('Failed to load from Drive:', error);
      }
    }

    // Return empty array if no data anywhere
    console.log('📥 No data found');
    return [];
  },
  
  // Background sync from Drive (non-blocking)
  syncFromDrive: async (): Promise<void> => {
    if (!isOnline || !accessToken) return;
    
    try {
      console.log('🔄 Background sync from Drive...');
      const driveData = await loadFromDrive();
      if (driveData && driveData.clients) {
        const stored = localStorage.getItem(STORAGE_KEY_CLIENTS);
        const localClients = stored ? JSON.parse(stored) : [];
        
        const driveTimestamp = new Date(driveData.lastUpdated).getTime();
        const localTimestamp = localStorage.getItem(STORAGE_KEY_SYNCED);
        
        if (localTimestamp) {
          const localTime = new Date(localTimestamp).getTime();
          if (localTime > driveTimestamp) {
            console.log('✅ Local data is newer, no sync needed');
            return;
          }
        }
        
        // Drive is newer, update localStorage
        localStorage.setItem(STORAGE_KEY_CLIENTS, JSON.stringify(driveData.clients));
        localStorage.setItem(STORAGE_KEY_SYNCED, new Date().toISOString());
        console.log('✅ Background sync completed');
      }
    } catch (error) {
      console.error('Background sync failed:', error);
    }
  },
  
  // Check Drive for updates without automatically applying them
  checkDriveForUpdates: async (): Promise<Client[] | null> => {
    if (!isOnline || !accessToken) return null;
    
    try {
      console.log('🔍 Checking Drive for updates...');
      const driveData = await loadFromDrive();
      if (driveData && driveData.clients) {
        const localTimestamp = localStorage.getItem(STORAGE_KEY_SYNCED);
        const driveTimestamp = new Date(driveData.lastUpdated).getTime();
        
        if (localTimestamp) {
          const localTime = new Date(localTimestamp).getTime();
          if (driveTimestamp > localTime) {
            console.log('📥 Newer data found on Drive');
            return driveData.clients;
          }
        } else {
          // No local sync timestamp, Drive data is available
          console.log('📥 Drive data available');
          return driveData.clients;
        }
      }
      console.log('✅ Local data is up to date');
      return null;
    } catch (error) {
      console.error('Failed to check Drive for updates:', error);
      return null;
    }
  },

  // Save clients to Drive and LocalStorage
  saveClients: async (clients: Client[]): Promise<void> => {
    // 1. Empty Array Protection
    // If we have a significant drop in client count (to zero), block it unless explicitly confirmed
    if (clients.length === 0 && lastKnownCount > 0) {
      console.warn(`⚠️ Preventing save of empty array! Previous count was ${lastKnownCount}`);
      return;
    }
    
    // Update last known count if valid
    if (clients.length > 0) {
      lastKnownCount = clients.length;
    }

    // 2. Immediate LocalStorage Save (Synchronous)
    const totalNotes = clients.reduce((sum, c) => sum + (c.progressNotes?.length || 0), 0);
    console.log('💾 Saving clients locally. Total notes:', totalNotes);
    
    localStorage.setItem(STORAGE_KEY_CLIENTS, JSON.stringify(clients));
    localStorage.setItem(STORAGE_KEY_SYNCED, new Date().toISOString());
    console.log('✅ Saved to localStorage');

    // 3. Debounced Drive Save
    if (isOnline && accessToken) {
      // Clear existing timeout
      if (saveTimeout) {
        clearTimeout(saveTimeout);
      }
      
      // Store pending data
      pendingClients = clients;
      
      // Set new timeout (2 seconds)
      saveTimeout = setTimeout(async () => {
        if (!pendingClients) return;
        
        console.log('☁️ Executing debounced Drive save...');
        try {
          // Check for conflicts first
          const metadata = await getFileMetadata();
          const lastSynced = localStorage.getItem(STORAGE_KEY_SYNCED);
          
          if (metadata && lastSynced) {
            const driveTime = new Date(metadata.modifiedTime).getTime();
            const localTime = new Date(lastSynced).getTime();
            
            // If Drive file is newer than our last sync, we have a conflict
            // Note: We add a small buffer (e.g., 5 seconds) to account for clock skew/network delay
            if (driveTime > localTime + 5000) {
              console.warn('⚠️ Conflict detected! Drive data is newer.');
              window.dispatchEvent(new CustomEvent('sync-conflict', { 
                detail: { 
                  localTime, 
                  driveTime
                } 
              }));
              // Don't clear pendingClients, let user resolve
              saveTimeout = null;
              return; 
            }
          }

          await saveToDrive({
            clients: pendingClients,
            userProfile: StorageService.loadUser(),
            lastUpdated: new Date().toISOString()
          });
          console.log('✅ Drive save completed');
          pendingClients = null;
          saveTimeout = null;
        } catch (error) {
          console.error('❌ Drive save failed:', error);
          // Queue for retry
          if (pendingClients) {
            failedSaveQueue.push(pendingClients);
            pendingClients = null;
            StorageService.retryFailedSaves();
          }
        }
      }, 2000);
    }
  },
  
  // Force flush any pending saves (call on logout)
  flushPendingSaves: async (): Promise<void> => {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
      saveTimeout = null;
    }
    
    if (pendingClients && isOnline && accessToken) {
      console.log('🔄 Flushing pending save before exit...');
      try {
        await saveToDrive({
          clients: pendingClients,
          userProfile: StorageService.loadUser(),
          lastUpdated: new Date().toISOString()
        });
        console.log('✅ Flushed pending save');
        pendingClients = null;
      } catch (error) {
        console.error('❌ Failed to flush pending save:', error);
      }
    }
  },

  // Retry failed saves with exponential backoff
  retryFailedSaves: async (): Promise<void> => {
    if (failedSaveQueue.length === 0) return;
    
    if (retryTimer) clearTimeout(retryTimer);
    
    retryTimer = setTimeout(async () => {
      if (!isOnline || !accessToken) return;
      
      console.log(`🔄 Retrying ${failedSaveQueue.length} failed saves...`);
      const clientsToSave = failedSaveQueue.shift(); // Get oldest failed save
      
      if (clientsToSave) {
        try {
          await saveToDrive({
            clients: clientsToSave,
            userProfile: StorageService.loadUser(),
            lastUpdated: new Date().toISOString()
          });
          console.log('✅ Retry successful');
          retryDelay = 2000; // Reset delay
          
          // Continue with next if any
          if (failedSaveQueue.length > 0) {
            StorageService.retryFailedSaves();
          }
        } catch (error) {
          console.error('❌ Retry failed:', error);
          // Put back in queue
          failedSaveQueue.unshift(clientsToSave);
          // Increase delay (max 30s)
          retryDelay = Math.min(retryDelay * 2, 30000);
          StorageService.retryFailedSaves();
        }
      }
    }, retryDelay);
  },

  // Load user profile
  loadUser: (): UserProfile | null => {
    const stored = localStorage.getItem(STORAGE_KEY_USER);
    return stored ? JSON.parse(stored) : null;
  },

  // Save user profile
  saveUser: async (user: UserProfile): Promise<void> => {
    localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));

    if (isOnline && accessToken) {
      try {
        const clients = await StorageService.loadClients();
        await saveToDrive({
          clients,
          userProfile: user,
          lastUpdated: new Date().toISOString(),
        });
      } catch (error) {
        console.error('Failed to sync user to Drive:', error);
      }
    }
  },

  // Get last sync time
  getLastSyncTime: (): string | null => {
    return localStorage.getItem(STORAGE_KEY_SYNCED);
  },

  // Force sync to Drive
  forceSyncToDrive: async (): Promise<void> => {
    if (!isOnline || !accessToken) {
      throw new Error('Not connected to Google Drive');
    }

    const clients = await StorageService.loadClients();
    const userProfile = StorageService.loadUser();

    await saveToDrive({
      clients,
      userProfile,
      lastUpdated: new Date().toISOString(),
    });

    localStorage.setItem(STORAGE_KEY_SYNCED, new Date().toISOString());
  },

  // Validate promo code
  validatePromoCode: async (code: string): Promise<boolean> => {
    await new Promise(resolve => setTimeout(resolve, 1000));
    const validCodes = ['PROMO2024', 'EARLYBIRD', 'TECHNINJA', 'DEMO'];
    return validCodes.includes(code.toUpperCase());
  },

  // Set current user (for App.tsx compatibility)
  setCurrentUser: (user: UserProfile | null) => {
    if (user) {
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEY_USER);
      localStorage.removeItem(STORAGE_KEY_ACCESS_TOKEN);
    }
  },
};

// Legacy exports for backward compatibility
export const loadClients = () => StorageService.loadClients();
export const saveClients = (clients: Client[]) => StorageService.saveClients(clients);
export const loadUser = () => StorageService.loadUser();
export const saveUser = (user: UserProfile) => StorageService.saveUser(user);
export const validatePromoCode = (code: string) => StorageService.validatePromoCode(code);
export const logUsageStats = async (action: string) => {
  console.log(`[Analytics] ${action}`);
};