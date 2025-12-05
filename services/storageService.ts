import { Client, UserProfile } from '../types';
import { loadFromDrive, saveToDrive, setAccessToken } from './googleDriveService';
import { ENABLE_GOOGLE_LOGIN } from '../config';

const STORAGE_KEY_CLIENTS = 'fittrack_clients';
const STORAGE_KEY_USER = 'fittrack_user';
const STORAGE_KEY_SYNCED = 'fittrack_last_synced';
const STORAGE_KEY_ACCESS_TOKEN = 'fittrack_access_token';

let isOnline = false;
let accessToken: string | null = null;

export const StorageService = {
  // Initialize with access token
  initialize: (token: string | null) => {
    accessToken = token;
    if (token) {
      setAccessToken(token);
      localStorage.setItem(STORAGE_KEY_ACCESS_TOKEN, token);
      isOnline = ENABLE_GOOGLE_LOGIN;
    } else {
      // Try to load from localStorage
      const storedToken = localStorage.getItem(STORAGE_KEY_ACCESS_TOKEN);
      if (storedToken) {
        accessToken = storedToken;
        setAccessToken(storedToken);
        isOnline = ENABLE_GOOGLE_LOGIN;
      }
    }
  },

  // Load clients from Drive or LocalStorage
  loadClients: async (): Promise<Client[]> => {
    // First check localStorage
    const stored = localStorage.getItem(STORAGE_KEY_CLIENTS);
    const localClients = stored ? JSON.parse(stored) : [];
    
    if (isOnline && accessToken) {
      try {
        console.log('📥 Loading data from Google Drive...');
        const driveData = await loadFromDrive();
        if (driveData) {
          // Compare timestamps - use newer data
          const driveTimestamp = new Date(driveData.lastUpdated).getTime();
          const localTimestamp = localStorage.getItem(STORAGE_KEY_SYNCED);
          
          if (localTimestamp) {
            const localTime = new Date(localTimestamp).getTime();
            if (localTime > driveTimestamp) {
              console.log('⚠️ localStorage is newer than Drive, using local data');
              const totalNotes = localClients.reduce((sum: number, c: Client) => sum + (c.progressNotes?.length || 0), 0);
              console.log('📥 Using localStorage data. Total notes:', totalNotes);
              return localClients;
            }
          }
          
          // Drive is newer, use it
          localStorage.setItem(STORAGE_KEY_CLIENTS, JSON.stringify(driveData.clients));
          localStorage.setItem(STORAGE_KEY_SYNCED, new Date().toISOString());
          const totalNotes = driveData.clients.reduce((sum: number, c: Client) => sum + (c.progressNotes?.length || 0), 0);
          console.log('📥 Using Drive data. Total notes:', totalNotes);
          return driveData.clients;
        }
      } catch (error) {
        console.error('Failed to load from Drive, using local cache:', error);
      }
    }

    // Fallback to localStorage
    const totalNotes = localClients.reduce((sum: number, c: Client) => sum + (c.progressNotes?.length || 0), 0);
    console.log('📥 Loaded clients from localStorage. Total notes:', totalNotes);
    return localClients;
  },

  // Save clients to Drive and LocalStorage
  saveClients: async (clients: Client[]): Promise<void> => {
    // Always save to localStorage first (immediate)
    const totalNotes = clients.reduce((sum, c) => sum + (c.progressNotes?.length || 0), 0);
    console.log('💾 Saving clients. Total notes across all clients:', totalNotes);
    localStorage.setItem(STORAGE_KEY_CLIENTS, JSON.stringify(clients));

    // Then sync to Drive (background)
    if (isOnline && accessToken) {
      try {
        console.log('📤 Syncing to Google Drive...');
        const userProfile = StorageService.loadUser();
        await saveToDrive({
          clients,
          userProfile,
          lastUpdated: new Date().toISOString(),
        });
        localStorage.setItem(STORAGE_KEY_SYNCED, new Date().toISOString());
      } catch (error) {
        console.error('Failed to sync to Drive:', error);
        // Don't throw - local save succeeded
      }
    }
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