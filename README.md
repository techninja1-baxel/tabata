<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Tabata - Professional Client Management

A web-based application for Personal Trainers and Physiotherapists to manage clients, create AI-powered training plans, and track progress.

## Features

- 🔐 **Firebase Authentication** with Google Sign-In
- ☁️ **Google Drive Storage** - Data syncs across devices
- 🤖 **AI-Powered Training Plans** using Google Gemini
- 📊 **Client Management** with session tracking
- 📅 **Scheduling System** with automated reminders
- 📈 **Progress Tracking** and analytics

## Run Locally

**Prerequisites:**  Node.js

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure environment variables in `.env.local`:
   ```env
   VITE_FIREBASE_API_KEY=your-firebase-api-key
   VITE_FIREBASE_AUTH_DOMAIN=your-app.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your-project-id
   VITE_FIREBASE_STORAGE_BUCKET=your-app.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
   VITE_FIREBASE_APP_ID=your-app-id
   VITE_GEMINI_API_KEY=your-gemini-api-key
   ```

3. Run the app:
   ```bash
   npm run dev
   ```

## Setup Guide

See the Firebase setup instructions in the project documentation for detailed configuration steps.
