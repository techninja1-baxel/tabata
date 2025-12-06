import { Client, UserProfile } from '../types';
import { loadFromDrive, saveToDrive, setAccessToken, getFileMetadata, deleteDataFile } from './googleDriveService';
import { ENABLE_GOOGLE_LOGIN } from '../config';

const STORAGE_KEY_CLIENTS = 'fittrack_clients';
const STORAGE_KEY_USER = 'fittrack_user';
const STORAGE_KEY_SYNCED = 'fittrack_last_synced';
const STORAGE_KEY_DRIVE_SYNC = 'fittrack_last_drive_sync';
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
          
          // Update base sync time
          const metadata = await getFileMetadata();
          if (metadata) {
            localStorage.setItem(STORAGE_KEY_DRIVE_SYNC, metadata.modifiedTime);
          } else {
            localStorage.setItem(STORAGE_KEY_DRIVE_SYNC, new Date().toISOString());
          }

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
      
      // Check metadata first to see if we actually need to sync
      const metadata = await getFileMetadata();
      const lastDriveSync = localStorage.getItem(STORAGE_KEY_DRIVE_SYNC);
      const localSynced = localStorage.getItem(STORAGE_KEY_SYNCED);
      
      if (metadata) {
        const driveTime = new Date(metadata.modifiedTime).getTime();
        
        if (lastDriveSync) {
          const lastSyncTime = new Date(lastDriveSync).getTime();
          // If Drive file hasn't changed since our last sync, do nothing
          if (driveTime <= lastSyncTime + 1000) {
            console.log('✅ Local data is up to date with Drive');
            return;
          }
        } else if (localSynced) {
          // Fallback: If we have no sync record, check if local save is newer
          const localTime = new Date(localSynced).getTime();
          if (localTime > driveTime + 5000) {
            console.log('✅ Local data appears newer (fallback check), skipping download');
            // We assume we are ahead, so we'll let the next save update Drive
            return;
          }
        }
      }

      // Drive is newer (or we have no record), download it
      const driveData = await loadFromDrive();
      if (driveData && driveData.clients) {
        console.log('📥 Downloading newer data from Drive...');
        
        localStorage.setItem(STORAGE_KEY_CLIENTS, JSON.stringify(driveData.clients));
        localStorage.setItem(STORAGE_KEY_SYNCED, new Date().toISOString());
        
        // Update base sync time
        if (metadata) {
          localStorage.setItem(STORAGE_KEY_DRIVE_SYNC, metadata.modifiedTime);
        } else {
          // Fallback if metadata fetch failed but load succeeded (unlikely)
          localStorage.setItem(STORAGE_KEY_DRIVE_SYNC, new Date().toISOString());
        }
        
        // Notify app of update
        window.dispatchEvent(new CustomEvent('clients-updated'));
        
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
      
      const metadata = await getFileMetadata();
      const lastDriveSync = localStorage.getItem(STORAGE_KEY_DRIVE_SYNC);
      const localSynced = localStorage.getItem(STORAGE_KEY_SYNCED);
      
      if (metadata) {
        const driveTime = new Date(metadata.modifiedTime).getTime();
        
        if (lastDriveSync) {
          const lastSyncTime = new Date(lastDriveSync).getTime();
          if (driveTime <= lastSyncTime + 1000) {
            console.log('✅ Local data is up to date');
            return null;
          }
        } else if (localSynced) {
           const localTime = new Date(localSynced).getTime();
           if (localTime > driveTime + 5000) {
             console.log('✅ Local data appears newer (fallback check)');
             return null;
           }
        }
      }

      // If we get here, Drive is newer or we have no sync record
      console.log('📥 Newer data found on Drive');
      const driveData = await loadFromDrive();
      return driveData ? driveData.clients : null;

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
          const lastDriveSync = localStorage.getItem(STORAGE_KEY_DRIVE_SYNC);
          const localSynced = localStorage.getItem(STORAGE_KEY_SYNCED);
          
          console.log('🤔 Conflict Check:', {
            serverTime: metadata?.modifiedTime,
            localBaseTime: lastDriveSync,
            localSaveTime: localSynced,
            diff: metadata && lastDriveSync ? new Date(metadata.modifiedTime).getTime() - new Date(lastDriveSync).getTime() : 'N/A'
          });

          if (metadata) {
            const driveTime = new Date(metadata.modifiedTime).getTime();
            let lastSyncTime = 0;

            if (lastDriveSync) {
              lastSyncTime = new Date(lastDriveSync).getTime();
            } else if (localSynced) {
              // Fallback: use local save time if we have no sync record
              // This handles the case where user just updated the app
              lastSyncTime = new Date(localSynced).getTime();
            }
            
            // If Drive file is newer than our last sync, we have a conflict
            // Note: We add a small buffer (e.g., 5 seconds) to account for clock skew/network delay
            if (driveTime > lastSyncTime + 5000) {
              console.warn('⚠️ Conflict detected! Drive data is newer.');
              window.dispatchEvent(new CustomEvent('sync-conflict', { 
                detail: { 
                  lastSyncTime, 
                  driveTime
                } 
              }));
              // Don't clear pendingClients, let user resolve
              saveTimeout = null;
              return; 
            }
          }

          const newModifiedTime = await saveToDrive({
            clients: pendingClients,
            userProfile: StorageService.loadUser(),
            lastUpdated: new Date().toISOString()
          });
          
          // Update base sync time on success
          localStorage.setItem(STORAGE_KEY_DRIVE_SYNC, newModifiedTime);
          
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
        const newModifiedTime = await saveToDrive({
          clients: pendingClients,
          userProfile: StorageService.loadUser(),
          lastUpdated: new Date().toISOString()
        });
        
        localStorage.setItem(STORAGE_KEY_DRIVE_SYNC, newModifiedTime);
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
          const newModifiedTime = await saveToDrive({
            clients: clientsToSave,
            userProfile: StorageService.loadUser(),
            lastUpdated: new Date().toISOString()
          });
          
          localStorage.setItem(STORAGE_KEY_DRIVE_SYNC, newModifiedTime);
          console.log('✅ Retry successful');
          retryDelay = 2000; // Reset delay
          
          // Continue with next if any
          if (failedSaveQueue.length > 0) {
            StorageService.retryFailedSaves();
          }
        } catch (error: any) {
          console.error('❌ Retry failed:', error);
          
          // Check for auth errors - stop retrying if token is invalid
          if (error.message && (
            error.message.includes('401') || 
            error.message.includes('Unauthorized') ||
            error.message.includes('invalid authentication credentials')
          )) {
             console.warn('🛑 Auth error detected, stopping retries');
             // Don't clear queue, but stop processing. 
             // User needs to re-login to process queue.
             return;
          }

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
        const newModifiedTime = await saveToDrive({
          clients,
          userProfile: user,
          lastUpdated: new Date().toISOString(),
        });
        localStorage.setItem(STORAGE_KEY_DRIVE_SYNC, newModifiedTime);
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

    const newModifiedTime = await saveToDrive({
      clients,
      userProfile,
      lastUpdated: new Date().toISOString(),
    });

    localStorage.setItem(STORAGE_KEY_SYNCED, new Date().toISOString());
    localStorage.setItem(STORAGE_KEY_DRIVE_SYNC, newModifiedTime);
  },

  // Delete account (local and remote data)
  deleteAccount: async (): Promise<boolean> => {
    // Stop any pending saves or retries
    if (saveTimeout) clearTimeout(saveTimeout);
    if (retryTimer) clearTimeout(retryTimer);
    failedSaveQueue = [];
    pendingClients = null;

    let remoteSuccess = true;
    
    // 1. Delete from Drive if connected
    if (isOnline && accessToken) {
      try {
        await deleteDataFile();
        console.log('✅ Deleted Drive data');
      } catch (error) {
        console.error('❌ Failed to delete Drive data:', error);
        remoteSuccess = false;
      }
    }

    // 2. Clear Local Storage
    localStorage.removeItem(STORAGE_KEY_CLIENTS);
    localStorage.removeItem(STORAGE_KEY_USER);
    localStorage.removeItem(STORAGE_KEY_SYNCED);
    localStorage.removeItem(STORAGE_KEY_DRIVE_SYNC);
    localStorage.removeItem(STORAGE_KEY_ACCESS_TOKEN);
    
    // 3. Reset memory state
    accessToken = null;
    lastKnownCount = 0;
    
    console.log('✅ Account deleted locally');
    return remoteSuccess;
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