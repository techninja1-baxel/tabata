import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup, 
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

// Customize popup behavior
googleProvider.setCustomParameters({
  prompt: 'select_account', // Always show account selection
});

export const signInWithGoogle = async (): Promise<{ userProfile: UserProfile; accessToken: string }> => {
  try {
    // Configure popup to be centered and appropriately sized
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
    // Handle popup closed by user
    if (error.code === 'auth/popup-closed-by-user') {
      throw new Error('Sign-in cancelled');
    }
    throw new Error(error.message || 'Failed to sign in');
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
