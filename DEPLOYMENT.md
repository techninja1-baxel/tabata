# Azure Deployment Instructions

## Automated Deployment via GitHub Actions

A GitHub Actions workflow has been configured to automatically deploy your application to Azure App Service on every push to the `master` branch.

### Setup Required:

#### 1. Add GitHub Secrets

Go to your GitHub repository: **Settings → Secrets and variables → Actions → New repository secret**

Add the following secrets:

```
Name: AZURE_WEBAPP_PUBLISH_PROFILE
Value: [Get from Azure Portal - App Service → Deployment Center → Manage publish profile → Download]

Name: VITE_FIREBASE_API_KEY
Value: AIzaSyCoAnn5vy9u-CSN41_tXlrDyxCjxCSgSmU

Name: VITE_FIREBASE_AUTH_DOMAIN
Value: tabata-16abd.firebaseapp.com

Name: VITE_FIREBASE_PROJECT_ID
Value: tabata-16abd

Name: VITE_FIREBASE_STORAGE_BUCKET
Value: tabata-16abd.firebasestorage.app

Name: VITE_FIREBASE_MESSAGING_SENDER_ID
Value: 76986387784

Name: VITE_FIREBASE_APP_ID
Value: 1:76986387784:web:2c8fc9aacaef0d87d3b77d

Name: VITE_GOOGLE_CLIENT_ID
Value: 76986387784-kfbgq24v3h0i3pfj7eqrq5p7f79s4eja.apps.googleusercontent.com

Name: VITE_GOOGLE_API_KEY
Value: AIzaSyCoAnn5vy9u-CSN41_tXlrDyxCjxCSgSmU

Name: VITE_GEMINI_API_KEY
Value: AIzaSyCf1t9GOWhXRJN4Hderc5BQYwpB-kRRfKc
```

#### 2. Get Publish Profile

You can get the publish profile using:
```powershell
az webapp deployment list-publishing-profiles --resource-group tabata-rg --name tabata --xml > publish-profile.xml
```

Or download it from Azure Portal:
1. Go to https://portal.azure.com
2. Navigate to your App Service 'tabata'
3. Click **Deployment Center** → **Manage publish profile** → **Download publish profile**
4. Copy the entire contents of the downloaded file
5. Paste it as the value for `AZURE_WEBAPP_PUBLISH_PROFILE` secret in GitHub

#### 3. Deploy

Once secrets are configured:
- Push to `master` branch: Automatic deployment
- Manual deployment: Go to **Actions** tab → **Deploy to Azure App Service** → **Run workflow**

---

## Manual Deployment (Alternative)

If you prefer manual deployment:

### Option 1: Using Azure CLI

```powershell
# Build the application
npm run build

# Deploy
az webapp deploy --resource-group tabata-rg --name tabata --src-path deploy.zip --async true
```

### Option 2: Using FTP

1. Get FTP credentials from Azure Portal
2. Upload contents of `dist` folder to `/site/wwwroot`

### Option 3: Using VS Code

1. Install **Azure App Service** extension
2. Sign in to Azure
3. Right-click `dist` folder → **Deploy to Web App** → Select 'tabata'

---

## Your App Service Details

- **Name:** tabata
- **Resource Group:** tabata-rg
- **URL:** https://tabata.azurewebsites.net
- **Region:** South India
- **Runtime:** Node.js 24 LTS
- **OS:** Linux

---

## Environment Variables Configured in Azure

The following environment variables have already been set in your Azure App Service:

✅ VITE_FIREBASE_API_KEY
✅ VITE_FIREBASE_AUTH_DOMAIN
✅ VITE_FIREBASE_PROJECT_ID
✅ VITE_FIREBASE_STORAGE_BUCKET
✅ VITE_FIREBASE_MESSAGING_SENDER_ID
✅ VITE_FIREBASE_APP_ID
✅ VITE_GOOGLE_CLIENT_ID
✅ VITE_GOOGLE_API_KEY
✅ VITE_GEMINI_API_KEY

---

## Troubleshooting

### Build Fails
- Check GitHub Actions logs for specific error messages
- Verify all secrets are correctly configured

### App Not Loading
- Check App Service logs: `az webapp log tail --resource-group tabata-rg --name tabata`
- Verify the startup command is set correctly
- Check if the app is running: https://tabata.azurewebsites.net

### API Keys Not Working
- Remember: Vite embeds env variables at build time
- Rebuild after changing any environment variables
- For GitHub Actions: Update secrets and trigger a new deployment

---

## Next Steps

1. Add GitHub secrets as described above
2. Push to master branch or manually trigger the workflow
3. Monitor deployment in the **Actions** tab on GitHub
4. Visit https://tabata.azurewebsites.net to see your app!
