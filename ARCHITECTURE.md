# Tabata - Architecture & Design Document

## Table of Contents
1. [System Overview](#system-overview)
2. [State Management](#state-management)
3. [Data Persistence Architecture](#data-persistence-architecture)
4. [Authentication Flow](#authentication-flow)
5. [Performance Optimization](#performance-optimization)
6. [Data Flow Diagrams](#data-flow-diagrams)

---

## System Overview

Tabata is a Progressive Web App (PWA) for personal trainers to manage clients, workout plans, and schedules. The application prioritizes **instant loading** and **offline-first** capabilities while maintaining cloud sync for data portability across devices.

### Technology Stack
- **Frontend**: React 19.2.0 + TypeScript
- **Routing**: React Router 7.10.1
- **Build Tool**: Vite 6.2.0
- **Styling**: Tailwind CSS 3.4.14
- **Authentication**: Google Identity Services (OAuth 2.0)
- **Cloud Storage**: Google Drive API v3
- **Local Storage**: Browser localStorage + IndexedDB (via service worker)
- **AI Integration**: Google Gemini 2.0 Flash
- **Hosting**: Firebase Hosting

---

## State Management

### Architecture Pattern: **Lifted State + Context (Implicit)**

The application uses a **centralized state management** pattern where all global state is lifted to the root `App.tsx` component. There is no explicit Context API or Redux - state is passed down via props.

### Core State Structure

```typescript
// Located in: App.tsx

// User State
const [user, setUser] = useState<UserProfile | null>(null);
const [accessToken, setAccessToken] = useState<string | null>(null);
const [isAuthLoading, setIsAuthLoading] = useState(true);
const [authError, setAuthError] = useState<string | null>(null);

// Data State
const [clients, setClients] = useState<Client[]>([]);

// Sync State
const [showSyncBanner, setShowSyncBanner] = useState(false);
const [pendingDriveData, setPendingDriveData] = useState<Client[] | null>(null);
```

### State Flow

```
User Action (Component)
    ↓
Handler Function (App.tsx)
    ↓
Update State (setState)
    ↓
Save to Storage (StorageService)
    ↓
Re-render (React)
```

### Key State Handlers

#### 1. Client Management
```typescript
const handleUpdateClients = (newClients: Client[]) => {
  setClients(newClients);
  saveData(newClients, user);
};

const handleUpdateClient = (updated: Client) => {
  const newClients = clients.map(c => c.id === updated.id ? updated : c);
  handleUpdateClients(newClients);
};
```

#### 2. Authentication State
```typescript
const onGoogleLogin = async () => {
  // 1. Sign in with Google
  const { userProfile, accessToken: token } = await signInWithGoogleIdentity();
  
  // 2. Update state IMMEDIATELY (instant UI update)
  setAccessToken(token);
  setUser(userProfile);
  setIsAuthLoading(false);
  
  // 3. Load data from localStorage synchronously
  const stored = localStorage.getItem('fittrack_clients');
  setClients(JSON.parse(stored || '[]'));
};
```

### State Persistence Strategy

**Principle**: State is ephemeral, storage is persistent.

- **React State** = Current session memory
- **localStorage** = Primary source of truth
- **Google Drive** = Secondary backup/sync layer

---

## Data Persistence Architecture

### Three-Tier Storage Model

```
┌─────────────────────────────────────────────────────────────┐
│                      React State                             │
│                  (In-Memory, Ephemeral)                      │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       ↓
┌─────────────────────────────────────────────────────────────┐
│                   localStorage (Tier 1)                      │
│              - Primary source of truth                       │
│              - Synchronous read/write                        │
│              - 5-10MB limit per domain                       │
│              - Always up-to-date                             │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       ↓ (Background sync)
┌─────────────────────────────────────────────────────────────┐
│                Google Drive (Tier 2)                         │
│              - Secondary backup                              │
│              - Async sync (non-blocking)                     │
│              - Cross-device sync                             │
│              - Unlimited storage                             │
└─────────────────────────────────────────────────────────────┘
```

### Storage Keys

```typescript
// Located in: services/storageService.ts

const STORAGE_KEY_CLIENTS = 'fittrack_clients';       // Client[] array
const STORAGE_KEY_USER = 'fittrack_user';             // UserProfile object
const STORAGE_KEY_SYNCED = 'fittrack_last_synced';    // ISO timestamp
const STORAGE_KEY_ACCESS_TOKEN = 'fittrack_access_token'; // OAuth token
```

### Data Models

```typescript
// Client data structure
interface Client {
  id: string;                    // UUID
  name: string;
  phone: string;
  email: string;
  photoUrl?: string;
  injuries?: string;
  goals?: string;
  notes?: string;
  workoutPlans?: WorkoutPlan[];  // Array of training plans
  progressNotes?: ProgressNote[]; // Array of session notes
  upcomingSessions?: ClientSession[];
}

// Backup data structure (Drive)
interface BackupData {
  clients: Client[];
  userProfile: UserProfile | null;
  lastUpdated: string;           // ISO timestamp
}
```

---

## Data Loading Strategy

### Phase 1: Instant Session Restore (< 50ms)

**Occurs on page load when user has existing session**

```typescript
// App.tsx - useEffect on mount

// 1. Check localStorage FIRST (synchronous, instant)
const storedToken = localStorage.getItem('fittrack_access_token');
const storedUser = StorageService.loadUser();

if (storedToken && storedUser) {
  // 2. Restore session instantly
  setAccessToken(storedToken);
  setUser(storedUser);
  setIsAuthLoading(false);
  
  // 3. Load clients from localStorage (synchronous)
  const stored = localStorage.getItem('fittrack_clients');
  setClients(JSON.parse(stored || '[]'));
  
  // UI is now fully loaded and interactive
}

// 4. Google Identity Services initializes in background
initializeGoogleIdentity().then(() => {
  // No Drive checks on load - purely background init
});
```

**Timeline**:
- 0ms: Page loads
- 10ms: localStorage read
- 50ms: UI rendered with data
- 200ms: Google Services ready (background)

### Phase 2: First-Time Login

**Occurs when user clicks "Sign in with Google"**

```typescript
const onGoogleLogin = async () => {
  // 1. OAuth flow (user picks account)
  const { userProfile, accessToken } = await signInWithGoogleIdentity();
  
  // 2. Store token and user
  localStorage.setItem('fittrack_access_token', accessToken);
  StorageService.setCurrentUser(userProfile);
  
  // 3. Update UI immediately
  setUser(userProfile);
  setIsAuthLoading(false);
  
  // 4. Load any existing local data
  const stored = localStorage.getItem('fittrack_clients');
  setClients(JSON.parse(stored || '[]'));
  
  // No Drive loading - starts with empty state or local cache
};
```

---

## Data Saving Strategy

### Principle: **localStorage First, Drive Background**

All save operations follow this pattern:

```typescript
// services/storageService.ts

saveClients: async (clients: Client[]): Promise<void> => {
  // 1. Save to localStorage IMMEDIATELY (synchronous)
  localStorage.setItem(STORAGE_KEY_CLIENTS, JSON.stringify(clients));
  console.log('✅ Saved to localStorage');

  // 2. Sync to Drive in background (fire and forget)
  if (isOnline && accessToken) {
    const userProfile = StorageService.loadUser();
    saveToDrive({
      clients,
      userProfile,
      lastUpdated: new Date().toISOString(),
    }).then(() => {
      localStorage.setItem(STORAGE_KEY_SYNCED, new Date().toISOString());
      console.log('✅ Background sync to Drive completed');
    }).catch(error => {
      console.error('Background sync to Drive failed:', error);
      // User is NOT notified - local data is safe
    });
  }
}
```

### Save Triggers

1. **Adding/Editing/Deleting Clients**: `handleUpdateClients()`
2. **Adding/Editing Workout Plans**: `handleUpdateClient()`
3. **Adding Progress Notes**: Component-level handler → `handleUpdateClient()`
4. **Scheduling Sessions**: `Schedule.tsx` → `onUpdateClient()`
5. **User Profile Changes**: `Subscription.tsx` → `handleUpdateUser()`

### Drive Sync Behavior

```typescript
// googleDriveService.ts

// Caching to avoid repeated API calls
let cachedFolderId: string | null = null;
let cachedFileId: string | null = null;

// First save creates folder + file
// Subsequent saves use PATCH to update existing file
const saveToDrive = async (data: BackupData): Promise<void> => {
  const folderId = await getOrCreateFolder(); // Cached after first call
  const fileId = await findDataFile(folderId); // Cached after first call
  
  if (fileId) {
    // Update existing file (PATCH)
    await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${accessToken}` },
      body: JSON.stringify(data),
    });
  } else {
    // Create new file (POST)
    // ... file creation logic
  }
};
```

---

## Data Loading from Drive

### Strategy: **Manual Check Only**

**We DO NOT automatically load from Drive on app start** to ensure instant loading.

### Removed Features (for performance)
```typescript
// ❌ REMOVED: Automatic Drive check on load
StorageService.checkDriveForUpdates().then((driveClients) => {
  if (driveClients) {
    setPendingDriveData(driveClients);
    setShowSyncBanner(true);
  }
});
```

### Drive Sync Banner (Future Feature - Currently Disabled)

When enabled, it would work like this:

```typescript
// User manually triggers sync check (e.g., pull-to-refresh)
StorageService.checkDriveForUpdates().then((driveClients) => {
  if (driveClients && driveClients.length > 0) {
    // Show banner: "New data available from Drive"
    setPendingDriveData(driveClients);
    setShowSyncBanner(true);
  }
});

// User clicks "Load" button
const handleLoadDriveData = () => {
  setClients(pendingDriveData);
  localStorage.setItem('fittrack_clients', JSON.stringify(pendingDriveData));
  setShowSyncBanner(false);
};
```

### Cross-Device Sync Scenario

**User has data on Device A, opens app on Device B:**

1. Device B loads → No local data → Empty state
2. User adds first client → Triggers save → Syncs to Drive
3. Device A opens → Loads from localStorage (old data)
4. Device A saves something → Drive file gets updated with Device A's data
5. **Conflict resolution**: Last write wins (no merge logic)

**Current Limitation**: Manual conflict resolution required if devices have diverged.

---

## Authentication Flow

### Technology: **Google Identity Services (OAuth 2.0)**

Replaced Firebase Auth due to mobile third-party cookie issues.

### OAuth Flow

```
User clicks "Sign in with Google"
    ↓
initTokenClient.requestAccessToken()
    ↓
Google OAuth Popup
    ↓
User selects account and grants permissions
    ↓
Callback receives access_token
    ↓
Fetch user info from https://www.googleapis.com/oauth2/v2/userinfo
    ↓
Store token in localStorage
    ↓
Update React state (user logged in)
```

### OAuth Scopes

```typescript
// config.ts
export const SCOPES = 
  "https://www.googleapis.com/auth/drive.file " +
  "https://www.googleapis.com/auth/userinfo.profile " +
  "https://www.googleapis.com/auth/userinfo.email";
```

### Token Management

```typescript
// services/googleIdentityService.ts

let tokenClient: any = null;
let accessToken: string | null = null;

export const signInWithGoogleIdentity = (): Promise<AuthResult> => {
  return new Promise((resolve, reject) => {
    tokenClient.callback = async (tokenResponse: any) => {
      accessToken = tokenResponse.access_token;
      
      // Fetch user info
      const userInfo = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` }
      }).then(r => r.json());
      
      resolve({ userProfile, accessToken });
    };
    
    // Trigger OAuth popup
    tokenClient.requestAccessToken({ prompt: '' }); // No forced consent
  });
};
```

### Logout Flow

```typescript
const onLogout = async () => {
  // 1. Save to localStorage immediately
  localStorage.setItem('fittrack_clients', JSON.stringify(clients));
  
  // 2. Background save to Drive (non-blocking)
  StorageService.saveClients(clients).catch(err => 
    console.error('Background Drive save failed:', err)
  );
  
  // 3. Revoke token
  window.google.accounts.oauth2.revoke(accessToken, () => {
    console.log('Token revoked');
  });
  
  // 4. Clear state
  localStorage.removeItem('fittrack_access_token');
  setUser(null);
  setClients([]);
  setAccessToken(null);
};
```

---

## Performance Optimization

### 1. Code Splitting & Lazy Loading

```typescript
// App.tsx
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Clients = lazy(() => import('./pages/Clients'));
const ClientDetail = lazy(() => import('./pages/ClientDetail'));
const Schedule = lazy(() => import('./pages/Schedule'));

// Result: Main bundle = 203KB, Total = 800KB (vs 986KB before)
```

### 2. Instant Session Restore

**Before**:
```typescript
// ❌ Slow: Wait for async operations
initializeGoogleIdentity().then(() => {
  StorageService.loadClients().then((clients) => {
    setClients(clients);
    setIsAuthLoading(false); // UI blocked until here
  });
});
```

**After**:
```typescript
// ✅ Fast: Synchronous localStorage read
const stored = localStorage.getItem('fittrack_clients');
setClients(JSON.parse(stored || '[]'));
setIsAuthLoading(false); // UI renders immediately

// Background initialization
initializeGoogleIdentity(); // Non-blocking
```

### 3. Drive API Caching

```typescript
// Folder and file IDs are cached after first lookup
let cachedFolderId: string | null = null;
let cachedFileId: string | null = null;

// First call: 2 API requests (search folder + search file)
// Subsequent calls: 0 API requests (use cache)
```

### 4. Non-Blocking Saves

All Drive saves are fire-and-forget:

```typescript
// User clicks save
handleUpdateClients(newClients); // Returns immediately

// Background (async)
saveToDrive(data)
  .then(() => console.log('Synced'))
  .catch(() => console.error('Sync failed')); // User not interrupted
```

### 5. Tailwind CSS Bundling

**Before**: CDN load (blocking render)
**After**: PostCSS + Tailwind plugin (bundled in CSS)

```javascript
// postcss.config.js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

---

## Data Flow Diagrams

### On App Load (Returning User)

```
┌──────────────┐
│  Page Load   │
└──────┬───────┘
       │
       ↓ (0ms - synchronous)
┌──────────────────────────┐
│ Read localStorage        │
│ - fittrack_access_token  │
│ - fittrack_user          │
│ - fittrack_clients       │
└──────┬───────────────────┘
       │
       ↓ (< 50ms)
┌──────────────────────────┐
│ Update React State       │
│ setUser(storedUser)      │
│ setClients(localClients) │
│ setIsAuthLoading(false)  │
└──────┬───────────────────┘
       │
       ↓ (< 100ms)
┌──────────────────────────┐
│  UI Fully Rendered       │
│  (User can interact)     │
└──────────────────────────┘
       │
       ↓ (background)
┌──────────────────────────┐
│ Initialize Google        │
│ Identity Services        │
└──────────────────────────┘
```

### On Data Change (e.g., Add Client)

```
┌──────────────────┐
│ User adds client │
└────────┬─────────┘
         │
         ↓
┌────────────────────┐
│ handleUpdateClients│
└────────┬───────────┘
         │
         ↓ (immediate)
┌────────────────────────────┐
│ setClients(newClients)     │
│ (React re-renders UI)      │
└────────┬───────────────────┘
         │
         ↓ (synchronous)
┌────────────────────────────┐
│ localStorage.setItem()     │
│ (Data persisted locally)   │
└────────┬───────────────────┘
         │
         ↓ (async, background)
┌────────────────────────────┐
│ saveToDrive()              │
│ (Cloud backup)             │
└────────────────────────────┘
         │
         ↓ (fire and forget)
┌────────────────────────────┐
│ Success/Failure logged     │
│ (User not interrupted)     │
└────────────────────────────┘
```

### Login Flow

```
┌──────────────────────────┐
│ User clicks "Sign in"    │
└──────────┬───────────────┘
           │
           ↓
┌──────────────────────────┐
│ requestAccessToken()     │
└──────────┬───────────────┘
           │
           ↓
┌──────────────────────────┐
│ Google OAuth Popup       │
│ (User picks account)     │
└──────────┬───────────────┘
           │
           ↓
┌──────────────────────────┐
│ Receive access_token     │
└──────────┬───────────────┘
           │
           ↓
┌──────────────────────────┐
│ Fetch user info from API │
└──────────┬───────────────┘
           │
           ↓
┌──────────────────────────┐
│ Store in localStorage:   │
│ - Token                  │
│ - User profile           │
└──────────┬───────────────┘
           │
           ↓
┌──────────────────────────┐
│ Update React state       │
│ setUser(userProfile)     │
│ setIsAuthLoading(false)  │
└──────────┬───────────────┘
           │
           ↓
┌──────────────────────────┐
│ Load local data          │
│ setClients(localClients) │
└──────────┬───────────────┘
           │
           ↓
┌──────────────────────────┐
│ UI rendered (logged in)  │
└──────────────────────────┘
```

---

## Future Improvements

### 1. Sync Conflict Resolution
Currently: Last write wins
Proposed: Timestamp-based merge with user prompt on conflict

### 2. Incremental Sync
Currently: Full data payload every save
Proposed: Delta sync (only changed records)

### 3. Offline Queue
Currently: Saves fail silently if offline
Proposed: Queue saves and retry when online

### 4. IndexedDB Migration
Currently: localStorage (5-10MB limit)
Proposed: IndexedDB (unlimited, structured queries)

### 5. Real-time Sync
Currently: Manual save triggers
Proposed: WebSocket or Firebase Realtime Database for live updates

---

## Environment Variables

### Development (.env.local)
```env
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
VITE_GOOGLE_API_KEY=your-api-key
VITE_GEMINI_API_KEY=your-gemini-key
VITE_FIREBASE_API_KEY=your-firebase-key
VITE_FIREBASE_PROJECT_ID=your-project-id
```

### Production (Firebase Hosting)
Environment variables are baked into the build at compile time via Vite.
They are NOT read at runtime.

**Build command**: `npm run build`
**Deploy command**: `firebase deploy --only hosting`

---

## Critical Design Decisions

### 1. Why localStorage over IndexedDB?
- **Simplicity**: Synchronous API, no async complexity
- **Sufficient**: 5-10MB is enough for 100+ clients with full data
- **Performance**: Faster than IndexedDB for small datasets
- **Migration path**: Can add IndexedDB later without breaking changes

### 2. Why Google Identity Services over Firebase Auth?
- **Mobile compatibility**: Firebase Auth has third-party cookie issues on mobile browsers
- **Simpler**: Direct OAuth flow, no Firebase SDK overhead
- **Token control**: Direct access to access_token for Drive API

### 3. Why no automatic Drive sync on load?
- **Speed**: Each Drive API call adds 200-500ms latency
- **Reliability**: User can work offline without waiting for network
- **Battery**: Reduces unnecessary mobile data usage

### 4. Why fire-and-forget Drive saves?
- **UX**: User sees instant save confirmation
- **Offline**: App works without internet, syncs when online
- **Error handling**: Local data is always safe, Drive is bonus

---

## Security Considerations

### 1. API Key Exposure
**Risk**: Gemini API key is in client-side bundle
**Mitigation**: 
- Use HTTP referrer restrictions in Google Cloud Console
- Monitor API usage quotas
- Consider server-side proxy for production

### 2. OAuth Token Storage
**Risk**: Access token in localStorage (XSS vulnerable)
**Mitigation**:
- OAuth tokens are short-lived
- Drive API scope is limited to app-created files only
- No sensitive user data in Drive folder (just workout plans)

### 3. Data Validation
**Current**: Client-side validation only
**Recommendation**: Add schema validation (Zod) before saving

---

## Monitoring & Debugging

### Console Logs

The app includes comprehensive logging:

```typescript
console.log('⚡ Instant session restore');
console.log('✅ Saved to localStorage');
console.log('✅ Background sync to Drive completed');
console.error('Background sync to Drive failed:', error);
```

### Performance Metrics

Key metrics to monitor:
- Time to Interactive (TTI): < 100ms
- localStorage read time: < 10ms
- Drive API latency: 200-500ms (background only)
- Bundle size: 203KB main, 800KB total

---

## Conclusion

Tabata's architecture prioritizes **instant loading** and **offline-first** capabilities through:

1. **Synchronous localStorage reads** on startup
2. **Background Drive sync** that never blocks UI
3. **Optimistic updates** with local persistence
4. **Code splitting** for fast initial load
5. **Cached Drive API calls** to minimize network requests

This design ensures the app feels instant on both desktop and mobile, even on slow networks.
