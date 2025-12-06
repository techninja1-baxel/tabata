# Firebase Deployment Guide

## Overview
This application is deployed to Firebase Hosting for fast, reliable, and easy deployment.

**Live URL:** https://tabata-16abd.web.app

## Prerequisites

1. **Node.js** (v18 or higher)
2. **Firebase CLI** installed globally
   ```bash
   npm install -g firebase-tools
   ```
3. **Firebase Account** with access to the `tabata-16abd` project

## Initial Setup (One-time)

### 1. Install Dependencies
```bash
npm install
```

### 2. Login to Firebase
```bash
firebase login
```
This will open a browser window for authentication. Use the account that has access to the `tabata-16abd` project.

### 3. Verify Project Configuration
The project is already configured with:
- `firebase.json` - Hosting configuration
- `.firebaserc` - Project alias configuration

## Deployment Process

### Standard Deployment

1. **Build the application**
   ```bash
   npm run build
   ```
   This creates an optimized production build in the `dist` folder with code splitting for better mobile performance.

2. **Preview locally (optional)**
   ```bash
   npm run preview
   ```
   Opens http://localhost:4173/ to test the production build before deploying.

3. **Deploy to Firebase**
   ```bash
   firebase deploy --only hosting
   ```
   Deploys the `dist` folder to Firebase Hosting.

### Quick Deploy (All in one)
```bash
npm run build && firebase deploy --only hosting
```

## Environment Variables

The application uses Vite environment variables (prefixed with `VITE_`):

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_GOOGLE_CLIENT_ID`
- `VITE_GOOGLE_API_KEY`
- `VITE_GEMINI_API_KEY`

These are defined in `.env.local` and are **embedded at build time**. Never commit `.env.local` to Git.

## Project Structure

```
tabata/
├── dist/                  # Production build (auto-generated)
├── pages/                 # React components (lazy-loaded)
├── services/              # Firebase, API services
├── components/            # Reusable components
├── firebase.json          # Firebase Hosting config
├── .firebaserc            # Firebase project alias
├── vite.config.ts         # Build configuration with code splitting
└── .env.local             # Environment variables (not in Git)
```

## Performance Optimization

The build is optimized for mobile performance using:
- **Code splitting** - Pages load on demand
- **Vendor chunking** - React, Firebase, Charts in separate bundles
- **Tree shaking** - Unused code removed
- **Minification** - Compressed for faster loading

### Bundle Sizes (after optimization)
- Main bundle: ~204 KB
- Charts (lazy): ~282 KB
- Firebase: ~163 KB
- React: ~47 KB
- Individual pages: 1-11 KB each

## Troubleshooting

### "Not logged in" error
```bash
firebase logout
firebase login
```

### "Permission denied" error
Ensure your Firebase account has **Editor** or **Owner** role on the `tabata-16abd` project.

### Build errors
```bash
# Clean install
rm -rf node_modules dist
npm install
npm run build
```

### Deploy doesn't reflect changes
- Clear browser cache (Ctrl+Shift+R)
- Check Firebase Console for deployment status
- Wait a few minutes for CDN propagation

## Firebase Console

Access the Firebase Console for:
- Deployment history
- Custom domain setup
- Analytics
- Usage statistics

**Console URL:** https://console.firebase.google.com/project/tabata-16abd/hosting/sites

## Custom Domain Setup

To add a custom domain (e.g., GoDaddy):

1. **In Firebase Console:**
   - Go to Hosting → Add custom domain
   - Enter your domain name
   - Copy the provided DNS records

2. **In Domain Registrar (e.g., GoDaddy):**
   - Add A records for root domain
   - Add CNAME record for www subdomain
   - Wait 24-48 hours for DNS propagation

Firebase automatically provisions SSL certificates for custom domains.

## CI/CD (Optional)

For automated deployments on Git push, set up GitHub Actions:

1. Generate Firebase token:
   ```bash
   firebase login:ci
   ```

2. Add token to GitHub Secrets as `FIREBASE_TOKEN`

3. Use the workflow in `.github/workflows/firebase-deploy.yml`

## Support

- **Firebase Documentation:** https://firebase.google.com/docs/hosting
- **Vite Documentation:** https://vitejs.dev/
- **Project Issues:** Contact the development team

## Quick Reference Commands

```bash
# Development
npm run dev              # Start dev server (http://localhost:3000)

# Build & Deploy
npm run build            # Build for production
npm run preview          # Preview production build locally
firebase deploy          # Deploy to Firebase Hosting

# Firebase
firebase login           # Login to Firebase
firebase logout          # Logout from Firebase
firebase projects:list   # List available projects
firebase hosting:channel:deploy preview  # Deploy to preview channel
```

## Notes

- Always test locally with `npm run preview` before deploying
- The `dist` folder is auto-generated and should not be edited manually
- Environment variables must be set before building
- Firebase Hosting includes automatic CDN, SSL, and global deployment
