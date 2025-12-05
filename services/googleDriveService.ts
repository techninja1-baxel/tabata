import { Client, UserProfile } from '../types';

const FOLDER_NAME = 'Tabata Data';
const FILE_NAME = 'clients_data.json';

interface BackupData {
  clients: Client[];
  userProfile: UserProfile | null;
  lastUpdated: string;
}

let accessToken: string | null = null;

export const setAccessToken = (token: string) => {
  accessToken = token;
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
  try {
    // Search for existing folder
    const query = `name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    const response = await callDriveAPI(
      `files?q=${encodeURIComponent(query)}&fields=files(id,name)`
    );

    if (response.files && response.files.length > 0) {
      return response.files[0].id;
    }

    // Create folder if it doesn't exist
    const createResponse = await callDriveAPI('files', {
      method: 'POST',
      body: JSON.stringify({
        name: FOLDER_NAME,
        mimeType: 'application/vnd.google-apps.folder',
      }),
    });

    return createResponse.id;
  } catch (error) {
    console.error('Error getting/creating folder:', error);
    throw error;
  }
};

// Find the data file in the folder
const findDataFile = async (folderId: string): Promise<string | null> => {
  try {
    const query = `name='${FILE_NAME}' and '${folderId}' in parents and trashed=false`;
    const response = await callDriveAPI(
      `files?q=${encodeURIComponent(query)}&fields=files(id,name)`
    );

    if (response.files && response.files.length > 0) {
      return response.files[0].id;
    }

    return null;
  } catch (error) {
    console.error('Error finding data file:', error);
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
export const saveToDrive = async (data: BackupData): Promise<void> => {
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
  } catch (error) {
    console.error('❌ Error saving to Drive:', error);
    throw error;
  }
};
