import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider, 
  signOut as firebaseSignOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  indexedDBLocalPersistence,
  User
} from 'firebase/auth';
import { UserProfile } from '../types';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

// Prefer durable persistence up front to avoid Safari/mobile flakiness
setPersistence(auth, indexedDBLocalPersistence)
  .catch(() => setPersistence(auth, browserLocalPersistence))
  .catch((err) => {
    console.warn('Auth persistence fallback failed:', err);
  });

// Add Drive scope for file access
googleProvider.addScope('https://www.googleapis.com/auth/drive.file');

// Customize authentication behavior
googleProvider.setCustomParameters({
  prompt: 'select_account', // Always show account selection
});

// Detect if we're on mobile device
const isMobileDevice = (): boolean => {
  const hasTouch = typeof navigator !== 'undefined' ? navigator.maxTouchPoints > 0 : false;
  const uaMobile = typeof navigator !== 'undefined' ? /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) : false;
  const narrowScreen = typeof window !== 'undefined' ? window.innerWidth <= 1024 : false;
  return uaMobile || (hasTouch && narrowScreen);
};

export const signInWithGoogle = async (): Promise<{ userProfile: UserProfile; accessToken: string }> => {
  try {
    const isMobile = isMobileDevice();
    console.log(`🔐 Sign-in starting on ${isMobile ? 'mobile' : 'desktop'} device`);
    
    // Try popup first (works better with third-party cookie restrictions)
    console.log('📱 Attempting popup auth...');
    const result = await signInWithPopup(auth, googleProvider);
    
    // Get access token for Drive API
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const accessToken = credential?.accessToken || '';
    
    if (!accessToken) {
      console.error('❌ No access token returned from Google');
      throw new Error('Failed to get Google Drive access. Please try again.');
    }
    
    console.log('✅ Popup auth succeeded, got access token');
    
    const userProfile: UserProfile = {
      name: result.user.displayName || 'User',
      email: result.user.email || '',
      photoUrl: result.user.photoURL || undefined,
      isSubscribed: false,
    };
    
    return { userProfile, accessToken };
  } catch (error: any) {
    console.error('❌ Sign-in error:', error.code, error.message);
    
    // If popup is blocked, try redirect as fallback
    if (error.code === 'auth/popup-blocked' || error.message?.includes('blocked')) {
      console.log('⚠️ Popup blocked, trying redirect as fallback...');
      try {
        await signInWithRedirect(auth, googleProvider);
        // This will redirect away from the page
        return new Promise(() => {}); // Never resolves, page will redirect
      } catch (redirectError: any) {
        console.error('❌ Redirect also failed:', redirectError);
        throw new Error('Unable to sign in. Please check your browser settings and allow popups for this site.');
      }
    }
    
    // Handle user cancellation gracefully
    if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
      throw new Error('Sign-in was cancelled. Please try again.');
    }
    
    // Handle network errors
    if (error.code === 'auth/network-request-failed') {
      throw new Error('Network error. Please check your connection and try again.');
    }
    
    // Handle unauthorized domain
    if (error.code === 'auth/unauthorized-domain') {
      throw new Error('This domain is not authorized. Please contact support.');
    }
    
    throw new Error(error.message || 'Failed to sign in with Google. Please try again.');
  }
};

// Handle redirect result after user returns from Google sign-in
export const handleRedirectResult = async (): Promise<{ userProfile: UserProfile; accessToken: string } | null> => {
  try {
    console.log('🔎 Calling getRedirectResult...');
    const result = await getRedirectResult(auth);
    console.log('📋 Redirect result:', result ? 'Found' : 'None');
    
    if (!result) {
      console.log('ℹ️ No pending redirect (normal for popup auth or direct page load)');
      return null; // No redirect result
    }
    
    // Get access token for Drive API
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const accessToken = credential?.accessToken || '';
    console.log('🎫 Access token from credential:', accessToken ? `${accessToken.substring(0, 20)}...` : 'MISSING');
    
    if (!accessToken) {
      console.error('❌ Redirect completed but no access token - possible third-party cookie issue');
      throw new Error('Sign-in completed but Drive access was not granted. Please enable third-party cookies or use a different browser.');
    }
    
    const userProfile: UserProfile = {
      name: result.user.displayName || 'User',
      email: result.user.email || '',
      photoUrl: result.user.photoURL || undefined,
      isSubscribed: false,
    };
    
    return { userProfile, accessToken };
  } catch (error: any) {
    console.error('❌ Redirect result error:', error.code, error.message);
    if (error.message?.includes('third-party cookie')) {
      throw error; // Re-throw our custom message
    }
    throw new Error(error.message || 'Failed to complete sign-in');
  }
};

export const signOut = async (): Promise<void> => {
  try {
    await firebaseSignOut(auth);
  } catch (error: any) {
    console.error('Sign-out error:', error);
    throw new Error(error.message || 'Failed to sign out');
  }
};

export const onAuthChange = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback);
};

export const getCurrentUser = (): User | null => {
  return auth.currentUser;
};

export const getAccessToken = async (): Promise<string | null> => {
  const user = auth.currentUser;
  if (!user) return null;
  
  try {
    // Get OAuth access token - managed by App.tsx
    return null;
  } catch (error) {
    console.error('Error getting access token:', error);
    return null;
  }
};

export { auth };
