import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider, 
  signOut as firebaseSignOut,
  onAuthStateChanged,
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

// Add Drive scope for file access
googleProvider.addScope('https://www.googleapis.com/auth/drive.file');

// Customize authentication behavior
googleProvider.setCustomParameters({
  prompt: 'select_account', // Always show account selection
});

// Check if we're on mobile or if popups are likely to be blocked
const isMobileOrPopupBlocked = () => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

export const signInWithGoogle = async (): Promise<{ userProfile: UserProfile; accessToken: string }> => {
  try {
    // Use redirect on mobile devices or if popups might be blocked
    if (isMobileOrPopupBlocked()) {
      await signInWithRedirect(auth, googleProvider);
      // Redirect will happen, so this won't return immediately
      throw new Error('Redirecting to sign in...');
    }
    
    // Try popup first for desktop
    const result = await signInWithPopup(auth, googleProvider);
    
    // Get access token for Drive API
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const accessToken = credential?.accessToken || '';
    
    const userProfile: UserProfile = {
      name: result.user.displayName || 'User',
      email: result.user.email || '',
      photoUrl: result.user.photoURL || undefined,
      isSubscribed: false,
    };
    
    return { userProfile, accessToken };
  } catch (error: any) {
    console.error('Sign-in error:', error);
    
    // If popup is blocked, try redirect as fallback
    if (error.code === 'auth/popup-blocked' || error.message?.includes('popup')) {
      console.log('Popup blocked, using redirect method...');
      await signInWithRedirect(auth, googleProvider);
      throw new Error('Redirecting to sign in...');
    }
    
    // Handle popup closed by user
    if (error.code === 'auth/popup-closed-by-user') {
      throw new Error('Sign-in cancelled');
    }
    
    throw new Error(error.message || 'Failed to sign in');
  }
};

// Handle redirect result after user returns from Google sign-in
export const handleRedirectResult = async (): Promise<{ userProfile: UserProfile; accessToken: string } | null> => {
  try {
    const result = await getRedirectResult(auth);
    
    if (!result) {
      return null; // No redirect result
    }
    
    // Get access token for Drive API
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const accessToken = credential?.accessToken || '';
    
    const userProfile: UserProfile = {
      name: result.user.displayName || 'User',
      email: result.user.email || '',
      photoUrl: result.user.photoURL || undefined,
      isSubscribed: false,
    };
    
    return { userProfile, accessToken };
  } catch (error: any) {
    console.error('Redirect result error:', error);
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
