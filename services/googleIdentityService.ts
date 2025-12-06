import { UserProfile } from '../types';
import { GOOGLE_CLIENT_ID, SCOPES } from '../config';

declare global {
  interface Window {
    google: any;
  }
}

interface TokenData {
  token: string;
  expiresAt: number; // Unix timestamp
}

let tokenClient: any = null;
let tokenData: TokenData | null = null;

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
        prompt: 'consent', // Force consent screen to ensure scopes are granted
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
      
      // Store token with expiration
      const expiresIn = tokenResponse.expires_in || 3600; // Default 1 hour
      tokenData = {
        token: tokenResponse.access_token,
        expiresAt: Date.now() + (expiresIn * 1000) - 60000, // 1 min buffer
      };
      
      // Persist to localStorage
      localStorage.setItem('fittrack_token_data', JSON.stringify(tokenData));
      localStorage.setItem('fittrack_access_token', tokenData.token); // Keep for compatibility

      try {
        // Get user info from Google
        const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: {
            Authorization: `Bearer ${tokenData.token}`,
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

        resolve({ userProfile, accessToken: tokenData!.token });
      } catch (error: any) {
        console.error('❌ Failed to get user info:', error);
        reject(error);
      }
    };

    // Request access token (prompt only if needed)
    tokenClient.requestAccessToken({ prompt: '' });
  });
};

// Refresh token
const refreshToken = async (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (!tokenClient) {
      reject(new Error('Token client not initialized'));
      return;
    }
    
    console.log('🔄 Refreshing token...');
    
    // Store original callback to restore later if needed, 
    // but here we just overwrite it for the refresh flow
    tokenClient.callback = async (tokenResponse: any) => {
      if (tokenResponse.error) {
        console.error('❌ Refresh token error:', tokenResponse.error);
        reject(new Error(tokenResponse.error));
        return;
      }
      
      const expiresIn = tokenResponse.expires_in || 3600;
      tokenData = {
        token: tokenResponse.access_token,
        expiresAt: Date.now() + (expiresIn * 1000) - 60000,
      };
      
      localStorage.setItem('fittrack_token_data', JSON.stringify(tokenData));
      localStorage.setItem('fittrack_access_token', tokenData.token);
      
      console.log('✅ Token refreshed successfully');
      
      // Emit event for UI to update
      window.dispatchEvent(new CustomEvent('token-refreshed', { detail: { token: tokenData.token } }));
      
      resolve();
    };
    
    // Request new token silently (no prompt)
    tokenClient.requestAccessToken({ prompt: '' });
  });
};

// Get current access token (with automatic refresh)
export const getAccessToken = async (): Promise<string | null> => {
  if (!tokenData) {
    // Try to restore from localStorage
    const stored = localStorage.getItem('fittrack_token_data');
    if (stored) {
      try {
        tokenData = JSON.parse(stored);
      } catch (e) {
        console.error('Failed to parse token data:', e);
        localStorage.removeItem('fittrack_token_data');
        return null;
      }
    } else {
      // Fallback to simple token if data not found (migration path)
      const simpleToken = localStorage.getItem('fittrack_access_token');
      if (simpleToken) {
        // We don't know expiration, so assume valid for now but expire soon
        tokenData = {
          token: simpleToken,
          expiresAt: Date.now() + 3600000 // Assume 1 hour from now
        };
      }
    }
  }
  
  // Check if token is expired
  if (tokenData && Date.now() >= tokenData.expiresAt) {
    console.log('⚠️ Token expired, refreshing...');
    try {
      await refreshToken();
    } catch (error) {
      console.error('❌ Failed to refresh token:', error);
      // Clear expired token
      tokenData = null;
      localStorage.removeItem('fittrack_token_data');
      localStorage.removeItem('fittrack_access_token');
      
      // Emit event for UI to handle
      window.dispatchEvent(new CustomEvent('token-expired'));
      return null;
    }
  }
  
  return tokenData?.token || null;
};

// Get token synchronously (for compatibility)
export const getAccessTokenSync = (): string | null => {
  return tokenData?.token || localStorage.getItem('fittrack_access_token');
};

// Sign out
export const signOutGoogleIdentity = (): Promise<void> => {
  return new Promise((resolve) => {
    const token = tokenData?.token || localStorage.getItem('fittrack_access_token');
    
    const clearLocal = () => {
      tokenData = null;
      localStorage.removeItem('fittrack_token_data');
      localStorage.removeItem('fittrack_access_token');
      resolve();
    };

    if (token && window.google?.accounts?.oauth2) {
      try {
        window.google.accounts.oauth2.revoke(token, () => {
          console.log('✅ Access token revoked');
          clearLocal();
        });
      } catch (e) {
        console.error('Error revoking token:', e);
        clearLocal();
      }
    } else {
      clearLocal();
    }
  });
};

// Check if user is currently signed in
export const isSignedIn = (): boolean => {
  if (tokenData) {
    return Date.now() < tokenData.expiresAt;
  }
  return !!localStorage.getItem('fittrack_access_token');
};
