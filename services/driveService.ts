import { GOOGLE_API_KEY, GOOGLE_CLIENT_ID, DISCOVERY_DOCS, SCOPES, ENABLE_GOOGLE_LOGIN } from '../config';
import { Client, UserProfile } from '../types';

// Global types for GAPI and Google Identity Services
declare global {
  interface Window {
    gapi: any;
    google: any;
  }
}

const FILE_NAME = 'fittrack_pro_data.json';
const LOCAL_STORAGE_KEY = 'fittrack_dev_backup';

// Structure of the file saved in Drive
interface BackupData {
  clients: Client[];
  userProfile: UserProfile | null;
  lastUpdated: string;
}

let tokenClient: any;
let gapiInited = false;
let gisInited = false;
let driveFileId: string | null = null;

export const initializeGoogleServices = (onInitComplete: () => void) => {
  if (!ENABLE_GOOGLE_LOGIN) {
    console.log('[Dev Mode] Skipping Google Services Initialization');
    setTimeout(onInitComplete, 500); // Simulate brief load
    return;
  }

  const gapiLoaded = () => {
    window.gapi.load('client', async () => {
      await window.gapi.client.init({
        apiKey: GOOGLE_API_KEY,
        discoveryDocs: DISCOVERY_DOCS,
      });
      gapiInited = true;
      if (gisInited) onInitComplete();
    });
  };

  const gisLoaded = () => {
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: SCOPES,
      callback: '', // Defined at request time
    });
    gisInited = true;
    if (gapiInited) onInitComplete();
  };

  if (window.gapi) gapiLoaded();
  if (window.google) gisLoaded();
};

export const handleLogin = async (): Promise<UserProfile> => {
  if (!ENABLE_GOOGLE_LOGIN) {
    console.log('[Dev Mode] Simulating Login');
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          name: 'Dev Trainer',
          email: 'dev@fittrack.local',
          photoUrl: undefined,
          isSubscribed: true // Default to Pro for testing
        });
      }, 800);
    });
  }

  return new Promise((resolve, reject) => {
    tokenClient.callback = async (resp: any) => {
      if (resp.error) {
        reject(resp);
      }
      
      // Token acquired, now fetch User Info
      try {
        const about = await window.gapi.client.drive.about.get({
          fields: "user"
        });
        
        const googleUser = about.result.user;
        const userProfile: UserProfile = {
          name: googleUser.displayName,
          email: googleUser.emailAddress,
          photoUrl: googleUser.photoLink,
          isSubscribed: false 
        };
        
        resolve(userProfile);
      } catch (err) {
        reject(err);
      }
    };

    if (window.gapi.client.getToken() === null) {
      tokenClient.requestAccessToken({ prompt: 'consent' });
    } else {
      tokenClient.requestAccessToken({ prompt: '' });
    }
  });
};

export const loadFromDrive = async (): Promise<BackupData | null> => {
  if (!ENABLE_GOOGLE_LOGIN) {
    console.log('[Dev Mode] Loading from LocalStorage');
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  }

  try {
    // 1. Find the file
    const response = await window.gapi.client.drive.files.list({
      q: `name = '${FILE_NAME}' and trashed = false`,
      fields: 'files(id, name)',
      spaces: 'drive',
    });

    const files = response.result.files;
    
    if (files && files.length > 0) {
      driveFileId = files[0].id;
      
      // 2. Download content
      const fileContent = await window.gapi.client.drive.files.get({
        fileId: driveFileId,
        alt: 'media'
      });
      
      return fileContent.result as BackupData;
    } else {
      return null;
    }
  } catch (error) {
    console.error("Error loading from Drive:", error);
    throw error;
  }
};

export const saveToDrive = async (data: BackupData): Promise<void> => {
  if (!ENABLE_GOOGLE_LOGIN) {
    console.log('[Dev Mode] Saving to LocalStorage');
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
    return;
  }

  try {
    const fileContent = JSON.stringify(data);
    const fileMetadata = {
      name: FILE_NAME,
      mimeType: 'application/json',
    };

    const boundary = 'foo_bar_baz';
    const delimiter = "\r\n--" + boundary + "\r\n";
    const close_delim = "\r\n--" + boundary + "--";
    const contentType = 'application/json';

    const multipartRequestBody =
        delimiter +
        'Content-Type: application/json\r\n\r\n' +
        JSON.stringify(fileMetadata) +
        delimiter +
        'Content-Type: ' + contentType + '\r\n\r\n' +
        fileContent +
        close_delim;

    const request = window.gapi.client.request({
      'path': driveFileId ? `/upload/drive/v3/files/${driveFileId}` : '/upload/drive/v3/files',
      'method': driveFileId ? 'PATCH' : 'POST',
      'params': {'uploadType': 'multipart'},
      'headers': {
        'Content-Type': 'multipart/related; boundary=' + boundary
      },
      'body': multipartRequestBody
    });

    const response = await request;
    
    if (!driveFileId && response.result.id) {
        driveFileId = response.result.id;
    }

  } catch (error) {
    console.error("Error saving to Drive:", error);
  }
};

export const signOut = () => {
  if (!ENABLE_GOOGLE_LOGIN) {
    console.log('[Dev Mode] Signed Out');
    return;
  }

  const token = window.gapi.client.getToken();
  if (token !== null) {
    window.google.accounts.oauth2.revoke(token.access_token);
    window.gapi.client.setToken('');
    driveFileId = null;
  }
};
