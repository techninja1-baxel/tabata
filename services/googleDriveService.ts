import { Client, UserProfile } from '../types';

const FOLDER_NAME = 'Tabata Data';
const FILE_NAME = 'clients_data.json';

interface BackupData {
  clients: Client[];
  userProfile: UserProfile | null;
  lastUpdated: string;
}

let accessToken: string | null = null;
let cachedFolderId: string | null = null;
let cachedFileId: string | null = null;

export const setAccessToken = (token: string) => {
  accessToken = token;
};

export const invalidateCache = () => {
  cachedFolderId = null;
  cachedFileId = null;
};

const callDriveAPI = async (endpoint: string, options: RequestInit = {}) => {
  if (!accessToken) {
    throw new Error('No access token available');
  }

  const response = await fetch(`https://www.googleapis.com/drive/v3/${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Drive API error');
  }

  return response.json();
};

// Find or create the app folder
const getOrCreateFolder = async (): Promise<string> => {
  // Return cached folder ID if available
  if (cachedFolderId) {
    return cachedFolderId;
  }
  
  try {
    // Search for existing folder
    const query = `name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    const response = await callDriveAPI(
      `files?q=${encodeURIComponent(query)}&fields=files(id,name)`
    );

    if (response.files && response.files.length > 0) {
      cachedFolderId = response.files[0].id;
      return cachedFolderId;
    }

    // Create folder if it doesn't exist
    const createResponse = await callDriveAPI('files', {
      method: 'POST',
      body: JSON.stringify({
        name: FOLDER_NAME,
        mimeType: 'application/vnd.google-apps.folder',
      }),
    });

    cachedFolderId = createResponse.id;
    return cachedFolderId;
  } catch (error) {
    console.error('Error getting/creating folder:', error);
    throw error;
  }
};

// Find the data file in the folder
const findDataFile = async (folderId: string): Promise<string | null> => {
  // Return cached file ID if available
  if (cachedFileId) {
    return cachedFileId;
  }
  
  try {
    const query = `name='${FILE_NAME}' and '${folderId}' in parents and trashed=false`;
    const response = await callDriveAPI(
      `files?q=${encodeURIComponent(query)}&fields=files(id,name)`
    );

    if (response.files && response.files.length > 0) {
      cachedFileId = response.files[0].id;
      return cachedFileId;
    }

    return null;
  } catch (error) {
    console.error('Error finding data file:', error);
    return null;
  }
};

// Get file metadata (for conflict detection)
export const getFileMetadata = async (): Promise<{ id: string; modifiedTime: string } | null> => {
  try {
    const folderId = await getOrCreateFolder();
    const fileId = await findDataFile(folderId);

    if (!fileId) return null;

    const response = await callDriveAPI(
      `files/${fileId}?fields=id,modifiedTime`
    );

    return {
      id: response.id,
      modifiedTime: response.modifiedTime
    };
  } catch (error) {
    console.error('Error getting file metadata:', error);
    return null;
  }
};

// Load data from Drive
export const loadFromDrive = async (): Promise<BackupData | null> => {
  try {
    const folderId = await getOrCreateFolder();
    const fileId = await findDataFile(folderId);

    if (!fileId) {
      console.log('No data file found in Drive');
      return null;
    }

    // Download file content
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to download file');
    }

    const data = await response.json();
    const totalNotes = data.clients?.reduce((sum: number, c: any) => sum + (c.progressNotes?.length || 0), 0) || 0;
    console.log('✅ Data loaded from Google Drive. Total notes loaded:', totalNotes);
    return data;
  } catch (error) {
    console.error('Error loading from Drive:', error);
    return null;
  }
};

// Save data to Drive
export const saveToDrive = async (data: BackupData, retry = true): Promise<void> => {
  try {
    const totalNotes = data.clients.reduce((sum, c) => sum + (c.progressNotes?.length || 0), 0);
    console.log('🚀 saveToDrive called. Total notes to save:', totalNotes);
    
    const folderId = await getOrCreateFolder();
    const fileId = await findDataFile(folderId);

    const content = JSON.stringify(data, null, 2);

    if (fileId) {
      // Update existing file
      const response = await fetch(
        `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: content,
        }
      );

      if (!response.ok) {
        if (response.status === 404 && retry) {
          console.log('⚠️ 404 detected during save, invalidating cache and retrying...');
          invalidateCache();
          return saveToDrive(data, false);
        }
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to update file');
      }
    } else {
      // Create new file
      const metadata = {
        name: FILE_NAME,
        parents: [folderId],
        mimeType: 'application/json',
      };

      // Create file with metadata
      const fileResponse = await callDriveAPI('files', {
        method: 'POST',
        body: JSON.stringify(metadata),
      });

      // Upload content
      await fetch(
        `https://www.googleapis.com/upload/drive/v3/files/${fileResponse.id}?uploadType=media`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: content,
        }
      );
    }

    console.log('✅ Data saved to Google Drive. Total notes saved:', totalNotes);
  } catch (error: any) {
    console.error('❌ Error saving to Drive:', error);
    if (retry && (error.message?.includes('404') || error.message?.includes('File not found'))) {
      console.log('⚠️ 404 detected (catch), invalidating cache and retrying...');
      invalidateCache();
      return saveToDrive(data, false);
    }
    throw error;
  }
};
