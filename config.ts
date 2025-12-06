// SECURITY NOTE: 
// 1. Do not commit .env files to version control (add to .gitignore).
// 2. Go to Google Cloud Console > APIs & Services > Credentials.
// 3. Edit your API Key -> Set "Application restrictions" to "HTTP referrers (Websites)".
// 4. Add your domain (e.g., http://localhost:3000/*) to the allowed list.

// Toggle this to FALSE to work on the app without Google API credentials.
// When FALSE: Uses LocalStorage and a Mock User.
// When TRUE: Uses Firebase Authentication with Google Sign-In.
export const ENABLE_GOOGLE_LOGIN = true;

// Gemini API configuration
export const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";

// Legacy Google Drive API config (kept for backward compatibility)
export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
export const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY || "";
export const DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"];
export const SCOPES = "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email";