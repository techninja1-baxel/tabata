import { UserProfile } from '../types';
import { GOOGLE_CLIENT_ID, SCOPES } from '../config';

declare global {
  interface Window {
    google: any;
  }
}

let tokenClient: any = null;
let accessToken: string | null = null;

// Initialize Google Identity Services
export const initializeGoogleIdentity = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (typeof window.google === 'undefined') {
      reject(new Error('Google Identity Services library not loaded'));
      return;
    }

    try {
      // Initialize the token client
      tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: SCOPES,
        callback: '', // Will be set per request
      });
      
      console.log('✅ Google Identity Services initialized');
      resolve();
    } catch (error) {
      console.error('❌ Failed to initialize Google Identity Services:', error);
      reject(error);
    }
  });
};

// Sign in with Google Identity Services
export const signInWithGoogleIdentity = (): Promise<{ userProfile: UserProfile; accessToken: string }> => {
  return new Promise((resolve, reject) => {
    if (!tokenClient) {
      reject(new Error('Google Identity Services not initialized'));
      return;
    }

    console.log('🔐 Starting Google Identity sign-in...');

    // Set the callback for this request
    tokenClient.callback = async (tokenResponse: any) => {
      if (tokenResponse.error) {
        console.error('❌ Token error:', tokenResponse.error);
        reject(new Error(tokenResponse.error));
        return;
      }

      console.log('✅ Got access token');
      accessToken = tokenResponse.access_token;

      try {
        // Get user info from Google
        const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (!userInfoResponse.ok) {
          throw new Error('Failed to fetch user info');
        }

        const userInfo = await userInfoResponse.json();
        console.log('✅ Got user info:', userInfo.email);

        const userProfile: UserProfile = {
          name: userInfo.name || 'User',
          email: userInfo.email || '',
          photoUrl: userInfo.picture || undefined,
          isSubscribed: false,
        };

        resolve({ userProfile, accessToken: accessToken! });
      } catch (error: any) {
        console.error('❌ Failed to get user info:', error);
        reject(error);
      }
    };

    // Request access token
    tokenClient.requestAccessToken({ prompt: 'consent' });
  });
};

// Sign out
export const signOutGoogleIdentity = (): Promise<void> => {
  return new Promise((resolve) => {
    if (accessToken && window.google?.accounts?.oauth2) {
      window.google.accounts.oauth2.revoke(accessToken, () => {
        console.log('✅ Access token revoked');
        accessToken = null;
        resolve();
      });
    } else {
      accessToken = null;
      resolve();
    }
  });
};

// Get current access token
export const getAccessToken = (): string | null => {
  return accessToken;
};

// Check if user is currently signed in
export const isSignedIn = (): boolean => {
  return accessToken !== null;
};
